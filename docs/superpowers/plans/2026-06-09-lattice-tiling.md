# Lattice & Tiling Implementation Plan (cycle 3a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose motif Arrangement (Auto/Straight/Brick/Diamond), Spacing (Tight/Normal/Airy), and Motif size (S/M/L, now in Explore too) for the seamless wallpaper tile and the infinite Explore field.

**Architecture:** Generator reads `CFG.lattice`/`CFG.spacing` (set per generate) instead of the old random-pick / fixed gap; `composeFabricTile` and `composeInfiniteWindow` honour the arrangement offsets (Diamond made distinct via a second-axis offset). Pattern-affecting settings append to the seed string ONLY when non-default, so existing links stay pixel-identical; all values go in the hash.

**Tech Stack:** Plain ES2017 JS, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/lattice-tiling` off `main`.

---

## Conventions

No test runner. Generator lattice functions are testable in a Node `vm` sandbox. The app/UI is DOM-bound → `node --check` + grep here, live Playwright after deploy. Temp tests in `/tmp`, never committed.

**The back-compat invariant (critical):** a design at `lattice="auto"` + `spacing="normal"` (+ default `scale="medium"`) must produce the **byte-identical old seed string and RNG stream**, so existing share links render pixel-identically. Achieved by (a) appending `|lat…|sp…` to the seed string only when non-default, and (b) `spacing="normal"` mapping to the exact old gap `round(mm*0.35)`, and (c) `lattice="auto"` keeping `composeFabricTile`'s existing random `pick(...)`.

**Generator harness** (`/tmp/vy_lt_test.js` preamble; run; delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,Number,String,Map};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const TP={name:'t',bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
const cfg0=(extra)=>{ VY.gen.setSeed('x'); VY.gen.setConfig(Object.assign({P:TP,region:'',variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,lattice:'auto',spacing:'normal'},extra)); };
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

---

## Task 1: `generator.js` — seamless tile (`composeFabricTile`) + CFG + SPACING

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add lattice/spacing defaults to `CFG`.** The `CFG` literal (line ~14) currently is:
```js
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:''};
```
Change to:
```js
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:'',lattice:'auto',spacing:'normal'};
```

- [ ] **Step 2: Add the SPACING map** just above `composeFabricTile` (line ~398):
```js
// gap = max(2, round(mm * ratio)); 'normal' reproduces the historic round(mm*0.35)
const SPACING={tight:0.2, normal:0.35, airy:0.6};
```

- [ ] **Step 3: Replace `composeFabricTile`** (lines ~398-420) with the lattice-aware version (gap from spacing; lattice from CFG with `auto`→old random pick; Diamond gets a distinct second-axis offset):
```js
function composeFabricTile(scaleKey){
  const P=CFG.P, v=CFG.variety;
  const mm=[9,11,13][{small:0,medium:1,large:2}[scaleKey]];
  const gap=Math.max(2,Math.round(mm*(SPACING[CFG.spacing]||0.35))), period=mm+gap;
  const latt=CFG.lattice==="auto" ? pick(v>0.5?["straight","brick","diamond"]:["straight","brick"]) : CFG.lattice;
  const cols=latt==="straight"?period:period*2;
  const rows=latt==="straight"?period:period*2;
  const grid=newGrid(cols,rows);
  const setN=Math.max(1,1+Math.round(v*3)), motifs=[];
  for(let i=0;i<setN;i++) motifs.push(pickMotif(mm));
  const filler=(CFG.dens>=3||v>0.45)?makeFiller():null;
  const h=Math.round(period/2);
  let row=0;
  for(let gy=0; gy<rows; gy+=period, row++){
    const offX=(latt!=="straight"&&row%2)?h:0;
    let i=0;
    for(let gx=offX; gx<cols; gx+=period, i++){
      const offY=(latt==="diamond"&&i%2)?h:0;
      const idx=(row+i)%setN;
      blitWrap(grid, motifs[idx], gx, gy+offY);
      if(filler) blitWrap(grid, filler, gx+h, gy+offY+h);
    }
  }
  return {grid,cols,rows,palette:P};
}
```
(`auto`+`normal` reproduces the old behaviour exactly: same `pick(...)` draw, same `gap=round(mm*0.35)`. Explicit lattice skips the `pick` — fine, that's a non-default/new pattern.)

- [ ] **Step 4: Test** — `/tmp/vy_lt_test.js` (harness +):
```js
// spacing -> period (mm=11 medium): tight gap2 period13, normal gap4 period15, airy gap7 period18
cfg0({lattice:'straight',spacing:'tight'});  let t=VY.gen.composeFabricTile('medium'); assert(t.cols===13,'tight straight period 13');
cfg0({lattice:'straight',spacing:'normal'}); t=VY.gen.composeFabricTile('medium'); assert(t.cols===15,'normal straight period 15 (back-compat gap)');
cfg0({lattice:'straight',spacing:'airy'});   t=VY.gen.composeFabricTile('medium'); assert(t.cols===18,'airy straight period 18');
// lattice -> tile size: straight period, brick/diamond 2*period
cfg0({lattice:'brick',spacing:'normal'});    t=VY.gen.composeFabricTile('medium'); assert(t.cols===30&&t.rows===30,'brick tile 2*period');
// diamond distinct from brick (same seed/config, different grid)
cfg0({lattice:'brick',spacing:'normal'});   const B=VY.gen.composeFabricTile('medium').grid.map(r=>Array.from(r));
cfg0({lattice:'diamond',spacing:'normal'}); const D=VY.gen.composeFabricTile('medium').grid.map(r=>Array.from(r));
assert(JSON.stringify(B)!==JSON.stringify(D),'diamond != brick');
// determinism: same seed+config -> identical tile
cfg0({lattice:'diamond',spacing:'airy'}); const D1=VY.gen.composeFabricTile('large').grid.map(r=>Array.from(r));
cfg0({lattice:'diamond',spacing:'airy'}); const D2=VY.gen.composeFabricTile('large').grid.map(r=>Array.from(r));
assert(JSON.stringify(D1)===JSON.stringify(D2),'deterministic for same seed+config');
// auto produces a valid tile (cols is period or 2*period for mm=11 normal => 15 or 30)
cfg0({lattice:'auto',spacing:'normal'}); t=VY.gen.composeFabricTile('medium'); assert(t.cols===15||t.cols===30,'auto valid tile');
```
Run: `node --check generator.js && node /tmp/vy_lt_test.js && rm /tmp/vy_lt_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**
```bash
git add generator.js
git commit -m "feat: lattice/spacing controls in composeFabricTile (distinct diamond; normal=back-compat gap)"
```

---

## Task 2: `generator.js` — Explore field (`buildFabricConfig` + `composeInfiniteWindow`)

**Files:** Modify `generator.js`.

- [ ] **Step 1: `buildFabricConfig`** (lines ~233-238) — read `CFG.lattice`/`CFG.spacing`, resolve `auto`→`straight` (Explore's established default), gap from spacing, store `lattice`:
```js
function buildFabricConfig(P, aim, lab, mm, seed){
  const gap=Math.max(2, Math.round(mm*(SPACING[CFG.spacing]||0.35))), period=mm+gap;
  const lattice=(CFG.lattice && CFG.lattice!=="auto") ? CFG.lattice : "straight";
  return { P, aim, lab:lab||null, mm, gap, period, lattice,
           heroPool: heroForRegion(CFG.region), seed,
           cacheMax: 1024, _cache: new Map() };
}
```

- [ ] **Step 2: `composeInfiniteWindow`** (lines ~256-266) — apply the arrangement offset per cell (position-addressable → seam-consistent):
```js
function composeInfiniteWindow(cfg, wx0, wy0, wcols, wrows){
  const g=newGrid(wcols, wrows), period=cfg.period, h=Math.round(period/2);
  const latX0=Math.floor(wx0/period)-1, latX1=Math.floor((wx0+wcols)/period)+1;
  const latY0=Math.floor(wy0/period)-1, latY1=Math.floor((wy0+wrows)/period)+1;
  for(let latY=latY0;latY<=latY1;latY++) for(let latX=latX0;latX<=latX1;latX++){
    const motif=cellMotif(latX,latY,cfg);
    const pad=Math.floor((period-motif.length)/2);
    const offX=(cfg.lattice!=="straight" && (latY&1)) ? h : 0;
    const offY=(cfg.lattice==="diamond" && (latX&1)) ? h : 0;
    blit(g, motif, latX*period+offX+pad - wx0, latY*period+offY+pad - wy0);
  }
  return { grid:g, cols:wcols, rows:wrows, palette:cfg.P };
}
```
(The existing ±1-cell range margin covers the ≤h shift, so no coverage gap. `cfg.lattice` is always a concrete value — `buildFabricConfig` resolved `auto`.)

- [ ] **Step 3: Test** — `/tmp/vy_lt_test.js` (harness +). `buildFabricConfig` reads `CFG`, so set CFG via `cfg0(...)` first:
```js
// gap from spacing (mm=11): normal period 15, airy period 18
cfg0({spacing:'normal',lattice:'auto'}); let fc=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.6,tradition:0.4,symmetry:'d4'},null,11,'s');
assert(fc.period===15&&fc.lattice==='straight','normal gap; auto->straight');
cfg0({spacing:'airy',lattice:'brick'}); fc=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.6,tradition:0.4,symmetry:'d4'},null,11,'s');
assert(fc.period===18&&fc.lattice==='brick','airy gap; brick kept');
// seam-consistency under brick AND diamond: overlap identical across two offset windows
['straight','brick','diamond'].forEach(L=>{
  cfg0({lattice:L,spacing:'normal'});
  const cf=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.7,tradition:0.5,symmetry:'d4'},null,11,'seam');
  const A=VY.gen.composeInfiniteWindow(cf,0,0,50,50), Bw=VY.gen.composeInfiniteWindow(cf,19,11,50,50);
  let same=true,checked=0; for(let wy=11;wy<50;wy++)for(let wx=19;wx<50;wx++){ if(A.grid[wy][wx]!==Bw.grid[wy-11][wx-19])same=false; checked++; }
  assert(same&&checked>0,'seam-consistent: '+L);
});
// straight vs brick vs diamond windows differ
const win=L=>{cfg0({lattice:L,spacing:'normal'}); const cf=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.7,tradition:0.5,symmetry:'d4'},null,11,'w'); return JSON.stringify(VY.gen.composeInfiniteWindow(cf,0,0,60,60).grid.map(r=>Array.from(r)));};
const ws=win('straight'), wb=win('brick'), wd=win('diamond');
assert(ws!==wb&&wb!==wd&&ws!==wd,'straight/brick/diamond windows all differ');
```
Run: `node --check generator.js && node /tmp/vy_lt_test.js && rm /tmp/vy_lt_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add generator.js
git commit -m "feat: Explore field honours lattice arrangement + spacing (seam-consistent offsets)"
```

---

## Task 3: `app.js` — state, seed-suffix, setConfig, Explore mm, hash

**Files:** Modify `app.js`.

- [ ] **Step 1: DEFAULTS** (line ~23-24) — add the two fields:
```js
             tradition:45,symmetry:"d4",lab:null,viewX:null,viewY:null,viewZoom:null,
             bgColor:null,threadCols:[],lattice:"auto",spacing:"normal"};
```

- [ ] **Step 2: Seed suffix (conditional) + setConfig.** In `generate()`, replace the `setSeed(...)` line (~81) so it appends only when non-default:
```js
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}|${state.tradition}|${state.symmetry}`
    + (state.lattice!=="auto"?"|lat"+state.lattice:"") + (state.spacing!=="normal"?"|sp"+state.spacing:""));
```
And add `lattice`/`spacing` to the `setConfig({...})` call (~86-94), e.g. after `symmetry:state.symmetry,`:
```js
    lattice:state.lattice,
    spacing:state.spacing,
```

- [ ] **Step 3: Explore mm from scale.** Replace the hardwired line (~124):
```js
    const mm=11;   // fixed medium lattice for v1 (zoom is the user's scale control)
```
with:
```js
    const mm=[9,11,13][{small:0,medium:1,large:2}[state.scale]];   // Explore motif size follows the Scale control
```

- [ ] **Step 4: Hash — write.** In `writeHash()`, after the `o.thr=…` colour clause and before `const p=new URLSearchParams(o);`, add:
```js
if(state.lattice!=="auto")o.lat=state.lattice;
if(state.spacing!=="normal")o.sp=state.spacing;
```

- [ ] **Step 5: Hash — read.** In `readHash()`, after the `thr` colour parse and before the `vox` parse, add:
```js
  const _lt=g("lat",""); if(["straight","brick","diamond"].includes(_lt)) state.lattice=_lt;
  const _sp=g("sp",""); if(["tight","airy"].includes(_sp)) state.spacing=_sp; else if(_sp==="normal") state.spacing="normal";
```

- [ ] **Step 6: Verify.** `node --check app.js` (expect pass). Then:
```bash
grep -n 'lat"+state.lattice\|sp"+state.spacing' app.js   # seed suffix present (conditional)
grep -n 'lattice:state.lattice\|spacing:state.spacing' app.js  # setConfig
grep -n 'small:0,medium:1,large:2}\[state.scale\]' app.js       # explore mm from scale (>=1; composeFabricTile is in generator)
grep -n 'o.lat=\|o.sp=\|g("lat"\|g("sp"' app.js                  # hash read+write
```
Confirm the base seed string (before the `+ (…)` suffixes) is unchanged from before. Browser verification is the controller's live pass.

- [ ] **Step 7: Commit**
```bash
git add app.js
git commit -m "feat: lattice/spacing state + conditional seed-suffix + setConfig + Explore mm-from-scale + hash"
```

---

## Task 4: UI — Output section controls + visibility (`index.html` + `app.js`)

**Files:** Modify `index.html`, `app.js`.

- [ ] **Step 1: Restructure the Output section** (`index.html`). The current `#sec-output` body is:
```html
      <div class="acc-b hidden" id="sec-output">
        <div id="wallControls">
          <label for="res">Resolution</label>
          <select id="res"></select>
          <label>Layout</label>
          <div class="seg" id="layoutSeg" role="radiogroup" aria-label="Layout"></div>
          <label>Motif scale</label>
          <div class="seg" id="scaleSeg" role="radiogroup" aria-label="Motif scale"></div>
        </div>
        <div id="panelControls" class="hidden">
          <label>Panel shape</label>
          <div class="seg" id="shapeSeg" role="radiogroup" aria-label="Panel shape"></div>
        </div>
      </div>
```
Replace it with (move `#scaleSeg` into its own group; add Arrangement + Spacing):
```html
      <div class="acc-b hidden" id="sec-output">
        <div id="wallControls">
          <label for="res">Resolution</label>
          <select id="res"></select>
          <label>Layout</label>
          <div class="seg" id="layoutSeg" role="radiogroup" aria-label="Layout"></div>
        </div>
        <div id="scaleGroup">
          <label>Motif scale</label>
          <div class="seg" id="scaleSeg" role="radiogroup" aria-label="Motif scale"></div>
        </div>
        <div id="latticeGroup">
          <label>Arrangement</label>
          <div class="seg" id="latticeSeg" role="radiogroup" aria-label="Motif arrangement"></div>
          <label>Spacing</label>
          <div class="seg" id="spacingSeg" role="radiogroup" aria-label="Motif spacing"></div>
        </div>
        <div id="panelControls" class="hidden">
          <label>Panel shape</label>
          <div class="seg" id="shapeSeg" role="radiogroup" aria-label="Panel shape"></div>
        </div>
      </div>
```

- [ ] **Step 2: Add the control data + build the segs** (`app.js`). After the `SYMS` const (line ~9) add:
```js
const LATTICES=[["auto","Auto"],["straight","Straight"],["brick","Brick"],["diamond","Diamond"]];
const SPACINGS=[["tight","Tight"],["normal","Normal"],["airy","Airy"]];
```
And in the `buildSeg(...)` calls line (~33), append:
```js
buildSeg("latticeSeg",LATTICES,"lattice");buildSeg("spacingSeg",SPACINGS,"spacing");
```

- [ ] **Step 3: Visibility + `.on` state** (`app.js` `syncUI`). Replace the three visibility lines (~52-55):
```js
  const wall=state.mode==="wallpaper";
  document.getElementById("wallControls").classList.toggle("hidden",!wall);
  document.getElementById("panelControls").classList.toggle("hidden",state.mode!=="panel");
  document.querySelector('.acc-sec[data-sec="output"]').classList.toggle("hidden",state.mode==="explore");
```
with:
```js
  const wall=state.mode==="wallpaper", explore=state.mode==="explore";
  const tiling=(wall&&state.layout==="fabric")||explore;   // seamless tile + Explore
  document.getElementById("wallControls").classList.toggle("hidden",!wall);
  document.getElementById("scaleGroup").classList.toggle("hidden",!(wall||explore));
  document.getElementById("latticeGroup").classList.toggle("hidden",!tiling);
  document.getElementById("panelControls").classList.toggle("hidden",state.mode!=="panel");
  document.querySelector('.acc-sec[data-sec="output"]').classList.toggle("hidden",false);  // every mode has something now
```
And extend the `segKey` map (line ~60) to light the two new segs:
```js
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry",latticeSeg:"lattice",spacingSeg:"spacing"};
```

- [ ] **Step 4: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c 'id="latticeSeg"' index.html      # 1
grep -c 'id="spacingSeg"' index.html      # 1
grep -c 'id="scaleGroup"\|id="latticeGroup"' index.html   # 2
grep -c 'buildSeg("latticeSeg"\|buildSeg("spacingSeg"' app.js   # 2
grep -c 'latticeSeg:"lattice",spacingSeg:"spacing"' app.js      # 1
```
Browser verification (controls appear in fabric-wallpaper + Explore, hidden for framed/panel; arrangements/spacing visibly change the tiling) is the controller's live pass.

- [ ] **Step 5: Commit**
```bash
git add index.html app.js
git commit -m "feat: Arrangement + Spacing controls in Output; Scale + tiling shown in Explore"
```

---

## Self-review notes

- **Spec coverage:** composeFabricTile lattice/spacing/diamond → Task 1; buildFabricConfig + composeInfiniteWindow Explore offsets → Task 2; state/seed-suffix/setConfig/Explore-mm/hash → Task 3; controls + visibility → Task 4. Determinism convention (conditional seed suffix; normal=back-compat gap; auto=old pick) → Tasks 1 & 3. All spec sections mapped.
- **Back-compat:** `normal`→`round(mm*0.35)` (old gap), `auto`→old random `pick` and `straight` for Explore, seed suffix only when non-default, `scale` already in seed → existing seamless & Explore links pixel-identical. Verified live in the controller pass.
- **Type/name consistency:** `CFG.lattice`/`CFG.spacing` (strings), `SPACING` map, `cfg.lattice`/`cfg.period`/`cfg.gap`, state `lattice`/`spacing`, hash `lat`/`sp`, ids `#latticeSeg`/`#spacingSeg`/`#scaleGroup`/`#latticeGroup`, `LATTICES`/`SPACINGS`. Consistent across tasks. Offsets defined identically in the finite tile (row%2 / i%2) and the infinite window (latY&1 / latX&1).
- **Placeholder scan:** none — exact code, exact commands.
- **Live verification (controller, after deploy):** (1) a pre-existing seamless link and an Explore link render pixel-identical; (2) Straight/Brick/Diamond are three distinct tilings in both surfaces, Diamond≠Brick; (3) Tight/Normal/Airy change density, Normal==before; (4) Scale changes the Explore field's motif size; (5) Explore roam under brick/diamond has no seams; (6) controls show only where they apply (fabric-wallpaper + Explore), hidden for framed layouts/panel; (7) `lat`/`sp` round-trip the hash, default keeps URLs param-free; 0 console errors.
```
