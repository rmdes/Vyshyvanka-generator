# Infinite Roamable Field (Pillar B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Explore" mode — an infinite, roamable, seamless vyshyvanka fabric generated per-tile from world coordinates + seed — reusing Pillar A's viewport and Pillar C's pure renderer.

**Architecture:** A new **position-addressable** generation path: each lattice cell `(latX,latY)` seeds its own PRNG from `hash(seed|B|latX|latY)` and builds a self-contained motif from it (reusing `makeFieldMotif` via an rng-injected `sampleGenomeFrom`). An infinite `piece.rasterTile(dCell,tx,ty)` composes the lattice cells overlapping a tile's world-stitch window (`blit`, clipped) and draws them via `drawGrid`. A's viewport/tile-loop/cache/gestures/hash are reused unchanged except `fitView`/`clampView`, which gain an infinite branch + a medium-zoom "home".

**Tech Stack:** Plain ES2017 JS, Canvas2D, classic `<script src>` under `VY`. No build/test-runner/modules. On `main` @ v1.2.0 (C + A merged).

---

## Conventions

No test runner. The new generator functions are pure (or per-coordinate deterministic) and node-testable in a `vm` sandbox; `viewport.js` math is pure too. DOM/canvas code (`rasterWindowTile`, the app branch) gets `node --check` + the controller's Playwright pass after deploy. Temp tests go to `/tmp`, never committed.

**Generator harness** (`/tmp/vy_b_test.js` = this preamble + per-task assertions; run; delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,parseInt,isNaN,String,Number,Map};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY;
let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const eq=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
const TP={name:'t',bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
// (VY.HERO_MOTIFS is undefined here → heroPool empty → field path; fine for these tests)
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

**Viewport harness** (`/tmp/vy_vp_test.js`):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Object,JSON,Array,Map,console,Number,String,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout:()=>0,devicePixelRatio:2};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/viewport.js','utf8'), sb);
const VY=sb.VY; let ok=true; const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

**Invariants (hold after every task):** bounded Wallpaper/Panel generation, the module RNG stream, the seed string, exports, favorites/undo, and A's viewport tile loop are unchanged. The infinite path is purely additive except the two `viewport.js` branches and the `syncUI`/`generate()` explore additions.

---

## Task 1: rng-injected genome sampler (`generator.js`)

Factor genome sampling to accept an explicit `rng`, so per-cell generation never touches the module stream. Bounded mode is byte-identical (the existing `sampleGenome` delegates with the module `RNG`, same draw sequence).

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add `sampleGenomeFrom` and make `sampleGenome` delegate.** Replace the current `sampleGenome` (lines ~149-169) with:

```js
// aim = { ornate:1..5, wild:0..1, tradition:0..1, symmetry:'d4'|'d2'|'loose' }
// rng-injected core: all randomness comes from the passed-in rng() in [0,1).
function sampleGenomeFrom(rng, P, aim){
  const tr=aim.tradition, wild=aim.wild, ornate=aim.ornate;
  const rpick=(arr)=>arr[Math.floor(rng()*arr.length)];
  const rri=(a,b)=>a+Math.floor(rng()*(b-a+1));
  const coordsTrad=['radial','manhattan','chebyshev'];
  const coordsInv =['radial','manhattan','chebyshev','diagonal','angle','lattice'];
  const nLayers=Math.max(1, Math.min(4, Math.round(1 + (ornate-1)*0.6 + tr*1.5)));
  const layers=[];
  for(let i=0;i<nLayers;i++){
    const coord = rpick(tr>0.4 ? coordsInv : coordsTrad);
    const wave  = rpick(tr>0.5 ? ['cos','tri','sq'] : ['cos','tri']);
    const freq  = tr<0.3 ? rri(1,3) : (1 + rng()*wild*(1+tr*5));
    const phase = (tr<0.3?0:rng()) * wild;
    const weight= (1 - 0.5*wild) + rng()*wild*1.2;
    const slot  = rpick(P.colorBias)+1;
    layers.push({coord,wave,freq,phase,weight,slot});
  }
  const levels = 2 + Math.round(ornate*0.8 + tr*3);
  const centerStyle = rpick(['dot','cross','ring','none']);
  return { sym: aim.symmetry||'d4', layers, levels, centerStyle };
}
function sampleGenome(P, aim){ return sampleGenomeFrom(RNG, P, aim); }
```

- [ ] **Step 2: Add an rng-injected `varyGenomeFrom`** (for a pinned Lab theme per cell). Add right after the existing `varyGenome` (lines ~196-206):

```js
function varyGenomeFrom(rng, lab, wild){
  const j=(amt)=>(rng()*2-1)*amt*wild;
  const layers=(lab.layers||[]).map(L=>({
    coord:L.coord, wave:L.wave, slot:L.slot,
    freq:Math.max(0.3, L.freq*(1+j(0.5))),
    phase:L.phase + j(0.5),
    weight:Math.max(0.1, L.weight*(1+j(0.5)))
  }));
  return { sym:lab.sym||'d4', layers,
           levels:Math.max(2, Math.round((lab.levels||4) + j(1.5))), centerStyle:lab.centerStyle||"dot" };
}
```

- [ ] **Step 3: Export the new sampler.** In the `VY.gen = {...}` / `VY.gen.x = ...` export block, add (keep all existing exports):
```js
VY.gen.sampleGenomeFrom = sampleGenomeFrom;
```

- [ ] **Step 4: Test** — `/tmp/vy_b_test.js` (harness +):
```js
const aim={ornate:3,wild:0.6,tradition:0.4,symmetry:'d4'};
const r1=VY.gen.sampleGenomeFrom(VY.gen.__mk?VY.gen.__mk('z'):mk('z'), TP, aim);  // see mk below
function mk(s){ // local mulberry32(hashStr(s)) mirror for the test rng
  let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} let a=h>>>0;
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
const A=VY.gen.sampleGenomeFrom(mk('z'),TP,aim), B=VY.gen.sampleGenomeFrom(mk('z'),TP,aim);
eq(A,B,'sampleGenomeFrom deterministic for same rng seed');
const C=VY.gen.sampleGenomeFrom(mk('zz'),TP,aim); assert(JSON.stringify(C)!==JSON.stringify(A),'different seed -> usually different');
assert(A.layers.length>=1&&A.layers.length<=4,'1..4 layers');
assert(A.layers.every(L=>L.slot>=1&&L.slot<=TP.threads.length&&Number.isFinite(L.freq)),'valid layers');
// bounded sampleGenome still works (uses module RNG via setSeed)
VY.gen.setSeed('b'); const D=VY.gen.sampleGenome(TP,aim); VY.gen.setSeed('b'); const E=VY.gen.sampleGenome(TP,aim);
eq(D,E,'sampleGenome (module RNG) still deterministic');
```
(The `mk` helper recreates `mulberry32(hashStr(s))` so the test owns its rng.)

Run: `node --check generator.js && node /tmp/vy_b_test.js && rm /tmp/vy_b_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**
```bash
git add generator.js
git commit -m "feat: rng-injected sampleGenomeFrom (sampleGenome delegates); varyGenomeFrom"
```

---

## Task 2: Fabric config + per-cell motif (`generator.js`)

The position-addressable core: a per-generation fabric config and a pure-per-coordinate `cellMotif` (LRU-cached). Reuses `makeFieldMotif`, `pickSource`, `hashStr`, `mulberry32`.

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add a palette-injected hero remap** so the fabric path doesn't depend on `CFG.P`. Replace the current `remapHero` (lines ~173-177) with:
```js
function remapHeroP(P, g){
  const slot=[0, P.colorBias[0]+1, (P.colorBias[1]??P.colorBias[0])+1, P.threads.length];
  return g.map(row=>{const r=new Int8Array(row.length);
    for(let x=0;x<row.length;x++){const s=row[x]; r[x]=s?slot[Math.min(s,3)]:0;} return r;});
}
function remapHero(g){ return remapHeroP(CFG.P, g); }
```

- [ ] **Step 2: Add the fabric config + cell motif.** Add after `pickMotif` (line ~214):
```js
/* ===================== INFINITE FABRIC (Pillar B) ===================== */
// One coherent infinite lattice of self-contained motifs, generated per-coordinate.
function buildFabricConfig(P, aim, lab, mm, seed){
  const gap=Math.max(2, Math.round(mm*0.35)), period=mm+gap;
  return { P, aim, lab:lab||null, mm, gap, period,
           heroPool: heroForRegion(CFG.region), seed,
           cacheMax: 1024, _cache: new Map() };
}
// pure per (latX,latY): identical grid for identical coords + cfg. cached (LRU) on cfg._cache.
function cellMotif(latX, latY, cfg){
  const key=latX+":"+latY, c=cfg._cache;
  if(c.has(key)){ const g=c.get(key); c.delete(key); c.set(key,g); return g; }
  const rng=mulberry32(hashStr(cfg.seed+"|B|"+latX+"|"+latY)), aim=cfg.aim;
  let g;
  if(cfg.lab){ g=makeFieldMotif(cfg.mm, varyGenomeFrom(rng, cfg.lab, aim.wild)); }
  else {
    const src=pickSource(rng(), aim.tradition, cfg.heroPool.length>0);
    if(src==='hero'){ g=remapHeroP(cfg.P, cfg.heroPool[Math.floor(rng()*cfg.heroPool.length)].grid); }
    else { g=makeFieldMotif(cfg.mm, sampleGenomeFrom(rng, cfg.P, aim)); }   // 'field' and 'archetype' both → field (v1)
  }
  c.set(key,g); while(c.size>cfg.cacheMax){ c.delete(c.keys().next().value); }
  return g;
}
VY.gen.buildFabricConfig = buildFabricConfig;
VY.gen.cellMotif = cellMotif;
```
(v1 scope decision per the spec: `'archetype'` source folds into `field` — Explore uses field + hero, avoiding `makeMotif`'s `CFG.theme`/module-RNG coupling.)

- [ ] **Step 3: Test** — `/tmp/vy_b_test.js` (harness +):
```js
const cfg=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.6,tradition:0.4,symmetry:'d4'},null,11,'seedA');
const m1=VY.gen.cellMotif(5,-3,cfg), m2=VY.gen.cellMotif(5,-3,cfg);
assert(m1===m2,'cellMotif cached: same instance for same coords');
const cfg2=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.6,tradition:0.4,symmetry:'d4'},null,11,'seedA');
const m3=VY.gen.cellMotif(5,-3,cfg2);
eq(m3.map(r=>Array.from(r)), m1.map(r=>Array.from(r)),'cellMotif pure: identical grid across configs with same seed/coords');
const m4=VY.gen.cellMotif(6,-3,cfg);
assert(JSON.stringify(m4.map(r=>Array.from(r)))!==JSON.stringify(m1.map(r=>Array.from(r))),'different coords -> usually different motif');
// shape: square mm, cells in 0..threads, symmetric (d4 → mirror-x), non-empty
const mm=11; assert(m1.length===mm&&m1.every(r=>r.length===mm),'mm×mm');
let mx=true,nonempty=0,inrange=true;
for(let y=0;y<mm;y++)for(let x=0;x<mm;x++){const v=m1[y][x]; if(v)nonempty++; if(v<0||v>TP.threads.length)inrange=false; if(m1[y][x]!==m1[y][mm-1-x])mx=false;}
assert(mx,'cell motif mirror-x symmetric'); assert(nonempty>0,'non-empty'); assert(inrange,'cells in range');
// negative + far coords work (no bounded assumptions)
assert(VY.gen.cellMotif(-1000,99999,cfg).length===mm,'far/negative coords ok');
```

Run: `node --check generator.js && node /tmp/vy_b_test.js && rm /tmp/vy_b_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add generator.js
git commit -m "feat: position-addressable fabric config + per-cell motif (cellMotif)"
```

---

## Task 3: Window composition + tile (`generator.js` + `render.js`)

Compose a tile's world-stitch window from overlapping cells, and draw it to a 256px tile.

**Files:** Modify `generator.js`, `render.js`.

- [ ] **Step 1: Add `composeInfiniteWindow` + `composeInfiniteTile` to `generator.js`** (after `cellMotif`):
```js
// build a {grid,cols,rows,palette} window of the infinite plane over world-stitch [wx0,wx0+wcols)×[wy0,wy0+wrows)
function composeInfiniteWindow(cfg, wx0, wy0, wcols, wrows){
  const g=newGrid(wcols, wrows), period=cfg.period, mm=cfg.mm, pad=Math.floor((period-mm)/2);
  const latX0=Math.floor((wx0-pad)/period)-1, latX1=Math.floor((wx0+wcols-pad)/period)+1;
  const latY0=Math.floor((wy0-pad)/period)-1, latY1=Math.floor((wy0+wrows-pad)/period)+1;
  for(let latY=latY0;latY<=latY1;latY++) for(let latX=latX0;latX<=latX1;latX++){
    blit(g, cellMotif(latX,latY,cfg), latX*period+pad - wx0, latY*period+pad - wy0);   // blit clips
  }
  return { grid:g, cols:wcols, rows:wrows, palette:cfg.P };
}
// the window + draw offsets for device-tile (tx,ty) at device cell dCell (TILE px)
function composeInfiniteTile(cfg, dCell, tx, ty, TILE){
  const wx0=Math.floor(tx*TILE/dCell)-1, wy0=Math.floor(ty*TILE/dCell)-1;
  const wx1=Math.ceil((tx+1)*TILE/dCell)+1, wy1=Math.ceil((ty+1)*TILE/dCell)+1;
  const model=composeInfiniteWindow(cfg, wx0, wy0, wx1-wx0, wy1-wy0);
  return { model, ox: wx0*dCell - tx*TILE, oy: wy0*dCell - ty*TILE };
}
VY.gen.composeInfiniteWindow = composeInfiniteWindow;
VY.gen.composeInfiniteTile = composeInfiniteTile;
```

- [ ] **Step 2: Add `rasterWindowTile` to `render.js`** (after `rasterTile`/`rasterSeamlessTile`; uses the module-local `ctx`/`setCtx`/`drawGrid`):
```js
// draw a precomposed window model into one TILE×TILE canvas at device cell dCell, offset (ox,oy)
function rasterWindowTile(model, dCell, ox, oy, style, seedNum, bg, TILE){
  const c=document.createElement("canvas"); c.width=TILE; c.height=TILE;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,TILE,TILE);
  const save=ctx; setCtx(g); drawGrid(model, dCell, ox, oy, style, seedNum); setCtx(save);
  return c;
}
```
Add to the `VY.render = {...}` export (keep all existing): `rasterWindowTile`.

- [ ] **Step 3: Test (seam consistency)** — `/tmp/vy_b_test.js` (harness +). This proves a world stitch has the SAME value regardless of which window renders it (the seam guarantee):
```js
const cfg=VY.gen.buildFabricConfig(TP,{ornate:3,wild:0.7,tradition:0.5,symmetry:'d4'},null,11,'seam');
// two overlapping windows; compare the overlap region cell-by-cell in WORLD coords
const A=VY.gen.composeInfiniteWindow(cfg, 0,0, 40,40);
const B=VY.gen.composeInfiniteWindow(cfg, 17,9, 40,40);
let same=true, checked=0;
for(let wy=9;wy<40;wy++)for(let wx=17;wx<40;wx++){
  const a=A.grid[wy-0][wx-0], b=B.grid[wy-9][wx-17]; if(a!==b)same=false; checked++;
}
assert(same && checked>0, 'overlap identical across windows (seam-consistent)');
// composeInfiniteTile returns a model + integer offsets
const t=VY.gen.composeInfiniteTile(cfg, 16, 3, -2, 256);
assert(t.model && t.model.grid && Number.isInteger(t.ox) && Number.isInteger(t.oy), 'composeInfiniteTile shape');
```

Run: `node --check generator.js && node --check render.js && node /tmp/vy_b_test.js && rm /tmp/vy_b_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add generator.js render.js
git commit -m "feat: composeInfiniteWindow/Tile + render.rasterWindowTile (seam-consistent)"
```

---

## Task 4: Viewport infinite relaxation (`viewport.js`)

The only A change: `fitView`/`clampView` branch on `piece.infinite` → a medium-zoom "home" + unbounded pan.

**Files:** Modify `viewport.js`.

- [ ] **Step 1: Add home/min constants.** After `const ZMAX=...` (line ~5):
```js
  const HOME_ZOOM=8, MIN_ZOOM=1;   // explore: open at ~8 px/stitch (a few motifs visible); zoom out to 1
```

- [ ] **Step 2: Branch `fitView`.** Replace `fitView` (lines ~16-19) with:
```js
  function fitView(piece, stageW, stageH){
    if(piece.infinite) return { cx:0, cy:0, zoom:HOME_ZOOM, fitZoom:MIN_ZOOM };
    const zoom=Math.max(0.01, Math.min(stageW/Math.max(1,piece.cols), stageH/Math.max(1,piece.rows)));
    return { cx:piece.cols/2, cy:piece.rows/2, zoom, fitZoom:zoom };
  }
```

- [ ] **Step 3: Branch `clampView`.** Replace `clampView` (lines ~20-26) with:
```js
  function clampView(vp, piece, stageW, stageH){
    if(piece.infinite){ return { cx:vp.cx, cy:vp.cy, zoom:Math.max(MIN_ZOOM, Math.min(ZMAX, vp.zoom)), fitZoom:vp.fitZoom||MIN_ZOOM }; }
    const fz=vp.fitZoom||fitView(piece,stageW,stageH).fitZoom;
    const zoom=Math.max(fz, Math.min(ZMAX, vp.zoom));
    const cx=Math.max(0, Math.min(piece.cols, vp.cx));
    const cy=Math.max(0, Math.min(piece.rows, vp.cy));
    return { cx, cy, zoom, fitZoom:fz };
  }
```
(No other viewport changes: `retile`/`tileFor`/`tilesFor`/`tileDest`/inputs already work for arbitrary `tx,ty`. `zoomAt`'s `vp.fitZoom||0.01` floor becomes `MIN_ZOOM` for an infinite piece since `fitZoom=MIN_ZOOM`. `isFit` returns true at home → onSettle nulls `vox/voy/voz` → clean URL.)

- [ ] **Step 4: Test** — `/tmp/vy_vp_test.js` (viewport harness +):
```js
const V=VY.viewport;
const inf={infinite:true}, fin={cols:100,rows:60};
const h=V.fitView(inf,800,600); assert(h.cx===0&&h.cy===0&&h.zoom===8&&h.fitZoom===1,'infinite home view');
const f=V.fitView(fin,800,600); assert(Math.abs(f.cx-50)<1e-9&&f.fitZoom===f.zoom,'finite fit unchanged');
const ci=V.clampView({cx:9999,cy:-9999,zoom:99,fitZoom:1},inf,800,600);
assert(ci.cx===9999&&ci.cy===-9999&&ci.zoom===48,'infinite: no pan clamp, zoom clamped to ZMAX');
const cz=V.clampView({cx:0,cy:0,zoom:0.1,fitZoom:1},inf,800,600); assert(cz.zoom===1,'infinite: zoom floored at MIN_ZOOM');
const cf=V.clampView({cx:200,cy:200,zoom:5,fitZoom:2},fin,800,600); assert(cf.cx===100&&cf.cy===60,'finite clamp unchanged');
```
Run: `node --check viewport.js && node /tmp/vy_vp_test.js && rm /tmp/vy_vp_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**
```bash
git add viewport.js
git commit -m "feat: viewport infinite-piece support (home view + unbounded pan)"
```

---

## Task 5: Explore mode wiring (`app.js` + `index.html`)

Add the mode, the generate() branch building the infinite piece, the control visibility, and view-PNG export.

**Files:** Modify `app.js`, `index.html`.

- [ ] **Step 1: Add the Explore mode button** in `index.html`'s `#modeSeg` (after the panel button, ~line 72):
```html
          <button data-mode="explore">🧭 Explore</button>
```

- [ ] **Step 2: `generate()` — use a dark cloth palette for explore too.** Change the `P=` line (~line 77) to:
```js
  const P=(state.mode==="wallpaper"||state.mode==="explore")?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
```

- [ ] **Step 3: `generate()` — add the explore branch.** It's a wallpaper-class mode; add an `else if` BEFORE the final panel `else` (i.e. after the `else if(state.mode==="wallpaper")` block, ~line 127). Insert:
```js
  }else if(state.mode==="explore"){
    const mm=11;   // fixed medium lattice for v1 (zoom is the user's scale control)
    const cfg=VY.gen.buildFabricConfig(P,
      {ornate:dens, wild:state.variety/100, tradition:state.tradition/100, symmetry:state.symmetry},
      state.lab, mm, state.seed);
    exp=null;                       // export = current view (the #png handler falls back to VY.cv)
    VY.app._lastModel=null; VY.app._lastTile=null;
    piece={infinite:true, bg:P.bg,
      rasterTile:(dCell,tx,ty)=>{ const w=VY.gen.composeInfiniteTile(cfg,dCell,tx,ty,256);
        return VY.render.rasterWindowTile(w.model,dCell,w.ox,w.oy,state.style,seedNum,P.bg,256); }};
    document.getElementById("dims").textContent=`Infinite fabric · roam to explore`;
```
(The existing tail `VY.app._exportCanvas=exp; VY.app._piece=piece; …attach(piece, rv); writeHash()` runs for all branches, so explore attaches the infinite piece and restores `vox/voy/voz` like the others.)

- [ ] **Step 4: `syncUI()` — control visibility + title for 3 modes.** In `syncUI`, change the panelControls toggle and the title. Replace the `wall`/visibility/title block (lines ~49-61) so:
  - `wallControls` shows only for wallpaper (unchanged: `!wall`);
  - `panelControls` shows only for panel: change to `state.mode!=="panel"`;
  - title handles explore.
Concretely, change line ~51 to:
```js
  document.getElementById("panelControls").classList.toggle("hidden",state.mode!=="panel");
```
and the title block (lines ~59-61) to:
```js
  document.getElementById("title").textContent =
      state.mode==="explore" ? `${name} · Infinite fabric`
    : wall                   ? `${name} · ${LAYOUTS.find(l=>l[0]===state.layout)[1]} wallpaper`
    :                          `${name} · ${SHAPES.find(s=>s[0]===state.shape)[1]}`;
```
(So in Explore both `#wallControls` and `#panelControls` hide — Design/Style/Lab/Export remain, which is the full explore control set. `mode` seg `.on` state already handled by the existing `setOn` loop over `#modeSeg`.)

- [ ] **Step 5: `#png` filename for explore.** Update the png handler (line ~161-163) filename to:
```js
document.getElementById("png").onclick=()=>{const a=document.createElement("a");
  const tag=state.mode==="wallpaper"?state.layout+"_"+state.res:state.mode==="explore"?"explore":state.shape;
  a.download=`vyshyvanka_${state.region}_${tag}_${state.seed}.png`;
  a.href=(VY.app._exportCanvas||VY.cv).toDataURL("image/png");a.click();};
```
(Explore set `exp=null` → `_exportCanvas` null → exports `VY.cv` = the current view. The favorites `save` thumb already uses a fallback; confirm it reads `(VY.app._exportCanvas||VY.cv)` — if it reads only `_exportCanvas`, change it to the fallback so explore favorites get a view thumbnail.)

- [ ] **Step 6: Verify (node + greps)**

Run: `node --check app.js`
Expected: passes.

Confirm: `grep -c 'data-mode="explore"' index.html` = 1; `grep -c 'mode==="explore"' app.js` ≥ 3 (P line, generate branch, png/title); the explore branch calls `buildFabricConfig`/`composeInfiniteTile`/`rasterWindowTile`. Browser verification (the actual roam) is the controller's Playwright pass after deploy — state that you could not run a browser.

- [ ] **Step 7: Commit**
```bash
git add app.js index.html
git commit -m "feat: Explore mode — infinite roamable fabric piece + controls + view export"
```

---

## Self-review notes

- **Spec coverage:** rng-injected sampler (decision a) → Task 1; position-addressable per-cell fabric + cache → Task 2; window/tile composition + seam-consistency → Task 3; viewport infinite + medium-zoom home (decision b) → Task 4; Explore mode + controls + current-view export → Task 5; share via `vox/voy/voz` → reuses A (Task 5 attach + existing writeHash/readHash). Bounded-mode determinism preserved (Task 1 delegation). All spec sections mapped.
- **v1 scope honored:** one coherent fabric (single cfg, no biomes); self-contained lattice motifs (no cross-tile bands); current-view PNG only; `archetype`→`field` fallback (no `makeMotif` coupling); straight lattice (brick offset deferred); optional filler deferred. All noted.
- **Type/name consistency:** `sampleGenomeFrom(rng,P,aim)`, `varyGenomeFrom(rng,lab,wild)`, `remapHeroP(P,g)`, `buildFabricConfig(P,aim,lab,mm,seed)`, `cellMotif(latX,latY,cfg)`, `composeInfiniteWindow(cfg,wx0,wy0,wcols,wrows)`, `composeInfiniteTile(cfg,dCell,tx,ty,TILE)`, `VY.render.rasterWindowTile(model,dCell,ox,oy,style,seedNum,bg,TILE)`, `piece={infinite,bg,rasterTile(dCell,tx,ty)}`, `HOME_ZOOM=8`/`MIN_ZOOM=1` — consistent across tasks. `cfg._cache` LRU keyed `latX:latY`; A's tile cache keyed `dCell:tx:ty` (separate layers).
- **Determinism:** plane = pure function of (seed, region, aim, symmetry, lab) via per-cell `hash(seed|B|latX|latY)` + cfg; viewport is `vox/voy/voz` only. No `Date`/unseeded `Math.random` in the fabric path.
- **Browser-verification nature:** Tasks 1–4 are node-tested (purity, seam-consistency, viewport math); Task 5 is DOM-bound and verified live. The controller runs a Playwright pass after deploy: roam/zoom in all directions (incl. negative), no seams/blanks, determinism (same link → same plane+spot), Calm↔Wild variety, Tradition↔Invention mix, pinned-Lab theme, regression of bounded modes/exports/favorites, perf on a 4K stage; tune `HOME_ZOOM`, `cacheMax`, and the coarse-zoom cells-per-tile guard there.
```
