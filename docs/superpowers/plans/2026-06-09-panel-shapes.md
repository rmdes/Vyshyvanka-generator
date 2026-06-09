# Panel Dimensions & Shapes Implementation Plan (cycle 3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Panel-size control (S/M/L) that scales each garment-panel shape's primary dimension, plus three new shapes (Cuff, Runner, Napkin).

**Architecture:** `composePanel`/`sampler` read `CFG.panelSize` and apply a multiplier to the length dimension (medium = ×1.0 = current); new `napkinCloth()` helper for the square cloth. `panelSize` follows the cycle-3a determinism convention (seed-suffix only when non-default, gated to panel mode; hash `psz`). Panel-only.

**Tech Stack:** Plain ES2017 JS, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/panel-shapes` off `main` (incl. 3a).

---

## Conventions

No test runner. `composePanel`/`sampler`/`napkinCloth` are generator functions testable in a Node `vm` sandbox (they read `CFG`, set via `setConfig`, and consume the seeded module RNG). The app/UI is DOM-bound → `node --check` + grep here, live Playwright after deploy. Temp tests `/tmp`, never committed.

**Back-compat:** `panelSize='medium'` → multiplier 1.0 → `Math.round(base*1)==base`, so the four existing shapes keep their exact `cols`/`reps`/`G`. New shapes (cuff/runner/napkin) are additive (`shape` already in the seed).

**Generator harness** (`/tmp/vy_ps_test.js` preamble; run; delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,Number,String,Map};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const TP={name:'t',bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
const cfg0=(extra)=>{ VY.gen.setSeed('p'); VY.gen.setConfig(Object.assign({P:TP,region:'',variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,lattice:'auto',spacing:'normal',panelSize:'medium'},extra)); };
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```
(`composePanel`/`sampler` aren't on `VY.gen` yet — they ARE: `VY.gen={composeWallpaper, composePanel, sampler}` at the export block. Confirm `VY.gen.composePanel`/`VY.gen.sampler` exist before testing.)

---

## Task 1: `generator.js` — Panel-size scaling for existing shapes + sampler

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add `panelSize` default to `CFG`** (line ~14). It currently ends `...,lattice:'auto',spacing:'normal'};`. Change to:
```js
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:'',lattice:'auto',spacing:'normal',panelSize:'medium'};
```

- [ ] **Step 2: Add the SIZEMUL map** just above `composePanel` (line ~323):
```js
const SIZEMUL={small:0.6, medium:1.0, large:1.55};
```

- [ ] **Step 3: Replace `composePanel`** (lines ~323-332) — scale each shape's length dimension (medium = current):
```js
function composePanel(shape){
  const P=CFG.P, dens=CFG.dens, m=[7,9,9,11,13][dens-1];
  const mul=SIZEMUL[CFG.panelSize]||1, scaleN=(base,min)=>Math.max(min, Math.round(base*mul));
  let cols,spec=[];
  const B=()=>spec.push(borderBand(cols)),S=()=>spec.push(separator(cols)),M=(mm)=>spec.push(mainBand(cols,mm||m));
  if(shape==="sleeve"){cols=[31,35,39,43,47][dens-1];const reps=scaleN([3,4,5,6,7][dens-1],1);B();S();for(let i=0;i<reps;i++){M();S();}B();}
  else if(shape==="collar"){cols=scaleN([110,130,150,160,170][dens-1],40);B();S();M();S();B();}
  else if(shape==="rushnyk"){cols=scaleN([45,51,55,61,67][dens-1],24);B();S();M(m);S();M(m+4);S();M(m);S();B();}
  else return sampler();
  const rows=spec.reduce((s,b)=>s+b.length,0),grid=newGrid(cols,rows);let y=0;for(const b of spec){blit(grid,b,0,y);y+=b.length;}
  return {grid,cols,rows,palette:P};
}
```

- [ ] **Step 4: Replace `sampler`** (lines ~333-338) — scale grid `G`:
```js
function sampler(){
  const P=CFG.P, mul=SIZEMUL[CFG.panelSize]||1, G=Math.max(2,Math.round([3,3,4,4,5][CFG.dens-1]*mul)),m=11,gap=2,cell=m+gap,cols=G*cell+gap,rows=G*cell+gap,grid=newGrid(cols,rows);
  for(let r=0;r<G;r++)for(let c=0;c<G;c++)blit(grid,pickMotif(m),gap+c*cell,gap+r*cell);
  const cA=P.colorBias[0]+1;for(let x=0;x<cols;x++){grid[0][x]=cA;grid[rows-1][x]=cA;}for(let y=0;y<rows;y++){grid[y][0]=cA;grid[y][cols-1]=cA;}
  return {grid,cols,rows,palette:P};
}
```

- [ ] **Step 5: Test** — `/tmp/vy_ps_test.js` (harness +):
```js
// back-compat: medium == current deterministic dims (collar cols 150 @dens3, sampler cols 54 @dens3)
cfg0({panelSize:'medium'}); assert(VY.gen.composePanel('collar').cols===150,'collar medium cols 150 (back-compat)');
cfg0({panelSize:'medium'}); assert(VY.gen.sampler().cols===54,'sampler medium cols 54 (back-compat)');
// collar cols scales: small 90, large 232
cfg0({panelSize:'small'}); assert(VY.gen.composePanel('collar').cols===90,'collar small cols 90');
cfg0({panelSize:'large'}); assert(VY.gen.composePanel('collar').cols===232,'collar large cols 232');
// sampler grid scales: small 28 (G2), large 80 (G6)
cfg0({panelSize:'small'}); assert(VY.gen.sampler().cols===28,'sampler small cols 28');
cfg0({panelSize:'large'}); assert(VY.gen.sampler().cols===80,'sampler large cols 80');
// sleeve length (rows) grows with size (reps scaled), same seed
cfg0({panelSize:'small'});  const rs=VY.gen.composePanel('sleeve').rows;
cfg0({panelSize:'medium'}); const rm=VY.gen.composePanel('sleeve').rows;
cfg0({panelSize:'large'});  const rl=VY.gen.composePanel('sleeve').rows;
assert(rs<rm&&rm<rl,'sleeve rows grow small<medium<large');
// determinism
cfg0({panelSize:'large'}); const a=JSON.stringify(VY.gen.composePanel('collar').grid.map(r=>Array.from(r)));
cfg0({panelSize:'large'}); const b=JSON.stringify(VY.gen.composePanel('collar').grid.map(r=>Array.from(r)));
assert(a===b,'composePanel deterministic for same seed+config');
```
Run: `node --check generator.js && node /tmp/vy_ps_test.js && rm /tmp/vy_ps_test.js`
Expected: `ALL PASS`

- [ ] **Step 6: Commit**
```bash
git add generator.js
git commit -m "feat: panel size control scales each shape (medium=back-compat) + sampler grid"
```

---

## Task 2: `generator.js` — new shapes Cuff, Runner, Napkin

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add the cuff + runner + napkin branches to `composePanel`.** In the if-chain, insert these BEFORE the final `else return sampler();`:
```js
  else if(shape==="cuff"){cols=[27,31,35,39,43][dens-1];const reps=scaleN(1,1);B();S();for(let i=0;i<reps;i++){M();S();}B();}
  else if(shape==="runner"){cols=scaleN([160,190,220,250,280][dens-1],80);B();S();M();S();M();S();B();}
  else if(shape==="napkin") return napkinCloth();
```
(So the chain is sleeve / cuff / collar / runner / rushnyk / napkin / else→sampler. `scaleN` is already in scope from Task 1.)

- [ ] **Step 2: Add `napkinCloth()`** right after `composePanel` (before `sampler`):
```js
function napkinCloth(){
  const P=CFG.P, dens=CFG.dens, mul=SIZEMUL[CFG.panelSize]||1;
  const m=[7,9,9,11,13][dens-1], cm=m+6;                                  // central medallion (larger; m odd -> cm odd)
  const margin=Math.max(3,Math.round(m*0.7));
  const S=Math.max(cm+2*margin+6, Math.round((cm+2*m+4*margin)*mul));     // square side, scaled, floored
  const grid=newGrid(S,S), cA=P.colorBias[0]+1;
  for(let x=0;x<S;x++){grid[1][x]=cA;grid[S-2][x]=cA;} for(let y=0;y<S;y++){grid[y][1]=cA;grid[y][S-2]=cA;}  // inset border frame
  blit(grid, pickMotif(cm), (S-cm)>>1, (S-cm)>>1);                        // central medallion
  const co=pickMotif(m), off=margin+1;                                    // corner accents (same motif, 4 corners)
  blit(grid,co,off,off); blit(grid,co,S-off-m,off); blit(grid,co,off,S-off-m); blit(grid,co,S-off-m,S-off-m);
  return {grid,cols:S,rows:S,palette:P};
}
```

- [ ] **Step 3: Test** — `/tmp/vy_ps_test.js` (harness +):
```js
// new shapes return valid models
['cuff','runner','napkin'].forEach(sh=>{ cfg0({panelSize:'medium'});
  const r=VY.gen.composePanel(sh);
  assert(r&&r.grid&&r.cols>0&&r.rows>0&&r.palette===TP, sh+' returns valid model'); });
// napkin is square
cfg0({panelSize:'medium'}); const nk=VY.gen.composePanel('napkin'); assert(nk.cols===nk.rows,'napkin square');
// runner is wide (cols large) and scales with size
cfg0({panelSize:'small'}); const rsm=VY.gen.composePanel('runner').cols;
cfg0({panelSize:'large'}); const rlg=VY.gen.composePanel('runner').cols;
assert(rsm<rlg && rlg>200,'runner cols scale + wide');
// cuff is short (fewer rows than a sleeve at same size/seed)
cfg0({panelSize:'medium'}); const cuffRows=VY.gen.composePanel('cuff').rows;
cfg0({panelSize:'medium'}); const sleeveRows=VY.gen.composePanel('sleeve').rows;
assert(cuffRows<sleeveRows,'cuff shorter than sleeve');
// napkin scales with size + deterministic
cfg0({panelSize:'small'}); const ns=VY.gen.composePanel('napkin').cols;
cfg0({panelSize:'large'}); const nl=VY.gen.composePanel('napkin').cols;
assert(ns<nl,'napkin scales with size');
cfg0({panelSize:'medium'}); const j1=JSON.stringify(VY.gen.composePanel('napkin').grid.map(r=>Array.from(r)));
cfg0({panelSize:'medium'}); const j2=JSON.stringify(VY.gen.composePanel('napkin').grid.map(r=>Array.from(r)));
assert(j1===j2,'napkin deterministic');
```
Run: `node --check generator.js && node /tmp/vy_ps_test.js && rm /tmp/vy_ps_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add generator.js
git commit -m "feat: new panel shapes — cuff, runner (horizontal), napkin (medallion + corners)"
```

---

## Task 3: `app.js` + `index.html` — state, controls, seed/hash, shapes

**Files:** Modify `app.js`, `index.html`.

- [ ] **Step 1: `SHAPES` + `PANELSIZES` + DEFAULTS** (`app.js`). Change the `SHAPES` const (line ~5) to add three shapes:
```js
const SHAPES=[["sleeve","Sleeve band"],["cuff","Cuff"],["collar","Collar"],["runner","Runner"],["rushnyk","Rushnyk"],["napkin","Napkin / cloth"],["sampler","Sampler"]];
```
Add a new const right after `SYMS` (line ~9):
```js
const PANELSIZES=[["small","S"],["medium","M"],["large","L"]];
```
In `DEFAULTS` (line ~23-24) append `panelSize:"medium"` (the object currently ends `...,lattice:"auto",spacing:"normal"};`):
```js
             bgColor:null,threadCols:[],lattice:"auto",spacing:"normal",panelSize:"medium"};
```

- [ ] **Step 2: Build the size seg** (`app.js`). Append to the `buildSeg(...)` calls line (~33):
```js
buildSeg("panelSizeSeg",PANELSIZES,"panelSize");
```

- [ ] **Step 3: Conditional seed suffix + setConfig** (`app.js`). In `generate()`, extend the `setSeed(...)` tail (line ~86-87) — append the panel-mode-gated suffix after the existing lat/sp suffixes:
```js
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}|${state.tradition}|${state.symmetry}`
    + (state.lattice!=="auto"?"|lat"+state.lattice:"") + (state.spacing!=="normal"?"|sp"+state.spacing:"")
    + (state.mode==="panel"&&state.panelSize!=="medium"?"|psz"+state.panelSize:""));
```
Add `panelSize` to the `setConfig({...})` call (after `spacing:state.spacing,`):
```js
    panelSize:state.panelSize,
```

- [ ] **Step 4: Hash write + read** (`app.js`). In `writeHash()`, after the `o.sp=…` line, add:
```js
if(state.panelSize!=="medium")o.psz=state.panelSize;
```
In `readHash()`, after the `sp` parse, add:
```js
  const _ps=g("psz",""); if(["small","medium","large"].includes(_ps)) state.panelSize=_ps;
```

- [ ] **Step 5: syncUI segKey** (`app.js`, line ~65). Add `panelSizeSeg:"panelSize"` to the `segKey` map (which already has latticeSeg/spacingSeg):
```js
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry",latticeSeg:"lattice",spacingSeg:"spacing",panelSizeSeg:"panelSize"};
```

- [ ] **Step 6: index.html — add the size control** inside `#panelControls`, after the shape seg:
```html
        <div id="panelControls" class="hidden">
          <label>Panel shape</label>
          <div class="seg" id="shapeSeg" role="radiogroup" aria-label="Panel shape"></div>
          <label>Panel size</label>
          <div class="seg" id="panelSizeSeg" role="radiogroup" aria-label="Panel size"></div>
        </div>
```

- [ ] **Step 7: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c 'id="panelSizeSeg"' index.html               # 1
grep -c '"cuff"\|"runner"\|"napkin"' app.js           # >=3 (in SHAPES)
grep -c 'panelSize:state.panelSize' app.js            # 1 (setConfig)
grep -c 'psz"+state.panelSize\|o.psz=\|g("psz"' app.js # 3 (seed-suffix, write, read)
grep -c 'panelSizeSeg:"panelSize"' app.js             # 1
```
Confirm the base seed literal (before the `+ (...)` suffixes) is unchanged. Browser verification (the size seg appears in panel mode, the 3 new shapes render, sizes scale) is the controller's live pass — state you cannot run a browser.

- [ ] **Step 8: Commit**
```bash
git add app.js index.html
git commit -m "feat: Panel size control + 3 new shapes wired (state, seed-suffix, hash, UI)"
```

---

## Self-review notes

- **Spec coverage:** size scaling for existing shapes + sampler → Task 1; cuff/runner/napkin → Task 2; state/SHAPES/PANELSIZES/setConfig/seed-suffix(gated)/hash/UI/segKey → Task 3. SIZEMUL 0.6/1.0/1.55, napkin = frame+medallion+4 corners → Tasks 1-2. All spec sections mapped.
- **Back-compat:** medium ×1.0 → `round(base*1)==base` (collar 150 / sampler 54 / sleeve reps unchanged, asserted in Task 1); new shapes additive; `panelSize` seed-suffix gated to panel mode + non-medium; default panels `psz`-free. Verified live.
- **Type/name consistency:** `CFG.panelSize`, `SIZEMUL`, `scaleN`, `napkinCloth`, state `panelSize`, hash `psz`, `#panelSizeSeg`, `PANELSIZES`, `segKey.panelSizeSeg`. Shape keys cuff/runner/napkin consistent in SHAPES + composePanel branches. `composePanel`/`sampler` already exported on `VY.gen`.
- **Placeholder scan:** none — exact code, exact commands.
- **Live verification (controller, after deploy):** (1) existing panel link (e.g. `sh=rushnyk`, no psz) pixel-identical; (2) Panel size seg appears in panel mode, S/M/L visibly scales each shape; (3) cuff (short), runner (long horizontal), napkin (square: frame + central medallion + 4 corners) all render legibly; (4) `psz` round-trips the hash, default keeps URLs clean, switching to wallpaper/explore doesn't add psz to the seed; (5) wallpaper/explore unaffected; chart/PNG export work for new shapes; 0 console errors.
```
