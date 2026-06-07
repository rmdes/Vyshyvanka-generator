# Explorable Viewport (Pillar A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive pan + zoom + level-of-detail viewport over the existing bounded piece — smooth via cached offscreen rasters + a GPU-composited CSS transform — reusing the current Canvas2D generator unchanged, with the pan/zoom view shareable in the URL.

**Architecture:** A new `viewport.js` (`VY.viewport.*`) owns a pure-math core (screen↔pattern mapping, an LOD ladder, fit/clamp/transform) plus the interaction + compositor. `generate()` hands the viewport a **`piece`** object `{cols, rows, bg, rasterAtCell(cell)→canvas}` (finite pieces reuse `buildTileCanvas`; the seamless layout tiles its tile into a finite wallpaper raster) and, separately, a full-resolution **export canvas** so PNG/tile/chart exports stay piece-level. Live gestures move/scale the last raster via a CSS transform (GPU); on settle or LOD-boundary cross, the visible piece is re-rastered crisply.

**Tech Stack:** Plain ES2017 JS, Canvas2D, CSS transforms, classic `<script src>` under `VY`. No WebGL, no build, no bundler, no test runner. Served static on LAMP.

**Baseline:** This plan is written against **`main` @ v1.1.0** (Pillar C + the sidebar-accordion refresh already merged). Line anchors below refer to that tree. `render.js` is unchanged from pre-C and exports `{ drawGrid, fitPreview, lum, buildTileCanvas, fillPattern, setCtx, renderChart }`. The sidebar is now an **accordion** (`.acc-sec` sections design/lab/output/style/export) — but it lives entirely in `<aside>`; the `<main>`/`.stage`/`.frame`/`#cv` area and the `data→generator→render→app` script tags are untouched, so the viewport's DOM hooks are unaffected by it.

---

## Conventions

**No test runner.** The viewport's coordinate/LOD math is pure and headlessly testable in a Node `vm` sandbox (`viewport.js` touches the DOM only inside `init()`/`attach()`, never at module load). Interaction + compositing are verified in the browser. Canvas code is browser-verified (`node --check` for syntax). Test files are written to `/tmp` and never committed.

**Reusable Node harness** (each math task writes `/tmp/vy_vp_test.js` = this preamble + that task's assertions, runs it, then deletes it):

```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Object,JSON,Array,console,Number,String}; sb.window=sb; sb.VY={}; sb.window.VY=sb.VY;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/viewport.js','utf8'), sb);
const VY=sb.VY;
let ok=true;
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

**Invariants (must hold after every task):**
- The **pattern is unchanged** and stays a pure function of the seed. The viewport is a pure *view* transform: it does NOT feed the seed string (C's seed string at app.js:73 stays byte-identical).
- The viewport **never re-runs the generator** — it only re-rasters the already-computed `piece` via `rasterAtCell`.
- Buildless / Canvas2D; GPU help is CSS-transform compositing only.

**Two intentional simplifications from the spec (both spec-sanctioned):**
1. The spec's `TileSource.rasterTile(model, lod, tx, ty, …)` is realized in v1 as **`piece.rasterAtCell(cell)`** returning a single whole-piece canvas per LOD (the spec explicitly allows "a LOD may be a single offscreen canvas"). Region tiling is deferred to Pillar B.
2. The LOD ladder / `cellForLod` live in `viewport.js` (not `render.js`) so the math is DOM-free testable; `render.js`'s existing `buildTileCanvas(model, cell, style, seedNum)` *is* the finite rasterizer and is reused as-is.

---

## Task 1: Viewport math core (pure, node-tested)

Create `viewport.js` with only pure functions + exports (no DOM at load). This is the testable heart: LOD ladder, screen↔pattern mapping, fit/clamp/zoom-at/transform.

**Files:**
- Create: `viewport.js`

- [ ] **Step 1: Create `viewport.js`** with the math core:

```js
"use strict";
window.VY = window.VY || {};
(function(){
  const LODS=[1,2,3,4,6,8,12,16,24,32,48];   // stitch cell sizes in CSS px
  const ZMAX=48;
  function cellForLod(i){ return LODS[Math.max(0,Math.min(LODS.length-1,i))]; }
  function lodForZoom(zoom){ for(let i=0;i<LODS.length;i++){ if(LODS[i]>=zoom) return i; } return LODS.length-1; }

  // viewport vp = { cx, cy, zoom, fitZoom } in PATTERN space (stitch units); zoom = CSS px per stitch
  function screenToPattern(vp, sx, sy, stageW, stageH){
    return { px:(sx-stageW/2)/vp.zoom + vp.cx, py:(sy-stageH/2)/vp.zoom + vp.cy };
  }
  function patternToScreen(vp, px, py, stageW, stageH){
    return { sx:(px-vp.cx)*vp.zoom + stageW/2, sy:(py-vp.cy)*vp.zoom + stageH/2 };
  }
  function fitView(piece, stageW, stageH){
    const zoom=Math.max(0.01, Math.min(stageW/piece.cols, stageH/piece.rows));
    return { cx:piece.cols/2, cy:piece.rows/2, zoom, fitZoom:zoom };
  }
  function clampView(vp, piece, stageW, stageH){
    const fz=vp.fitZoom||fitView(piece,stageW,stageH).fitZoom;
    const zoom=Math.max(fz, Math.min(ZMAX, vp.zoom));
    const cx=Math.max(0, Math.min(piece.cols, vp.cx));
    const cy=Math.max(0, Math.min(piece.rows, vp.cy));
    return { cx, cy, zoom, fitZoom:fz };
  }
  // zoom by `factor` keeping the pattern point under (sx,sy) fixed
  function zoomAt(vp, factor, sx, sy, stageW, stageH){
    const p=screenToPattern(vp, sx, sy, stageW, stageH);
    const zoom=Math.max(vp.fitZoom||0.01, Math.min(ZMAX, vp.zoom*factor));
    return { cx:p.px-(sx-stageW/2)/zoom, cy:p.py-(sy-stageH/2)/zoom, zoom, fitZoom:vp.fitZoom };
  }
  // transform that places the (cols*cell × rows*cell) raster on the stage
  function transformFor(vp, stageW, stageH){
    const lod=lodForZoom(vp.zoom), cell=cellForLod(lod), s=vp.zoom/cell;
    return { lod, cell, s, tx:stageW/2 - vp.cx*vp.zoom, ty:stageH/2 - vp.cy*vp.zoom };
  }

  VY.viewport = { LODS, ZMAX, cellForLod, lodForZoom, screenToPattern, patternToScreen,
                  fitView, clampView, zoomAt, transformFor };
})();
```

- [ ] **Step 2: Write the test** to `/tmp/vy_vp_test.js` (preamble +):

```js
const V=VY.viewport, piece={cols:100,rows:60}, W=800,H=600;
const f=V.fitView(piece,W,H);
assert(near(f.zoom, Math.min(W/100,H/60)), 'fit zoom = min ratio');
assert(f.cx===50&&f.cy===30, 'fit centers piece');
const vp={cx:50,cy:30,zoom:10,fitZoom:f.zoom};
const p=V.screenToPattern(vp,123,77,W,H); const s=V.patternToScreen(vp,p.px,p.py,W,H);
assert(near(s.sx,123)&&near(s.sy,77),'screen->pattern->screen round-trips');
const sc=V.patternToScreen(vp,vp.cx,vp.cy,W,H); assert(near(sc.sx,W/2)&&near(sc.sy,H/2),'center -> stage center');
const t=V.transformFor(vp,W,H); const rx=vp.cx*t.cell;
assert(near(t.tx+rx*t.s, W/2),'transform places center at stage center');
assert(near(t.s, vp.zoom/t.cell),'scale = zoom/cell');
assert(V.cellForLod(V.lodForZoom(7))===8,'zoom 7 -> cell 8');
assert(V.cellForLod(V.lodForZoom(8))===8,'zoom 8 -> cell 8');
assert(V.cellForLod(V.lodForZoom(9))===12,'zoom 9 -> cell 12');
const pp=V.screenToPattern(vp,200,150,W,H); const z=V.zoomAt(vp,2,200,150,W,H);
const after=V.patternToScreen(z,pp.px,pp.py,W,H);
assert(near(after.sx,200,1e-4)&&near(after.sy,150,1e-4),'zoomAt anchors cursor');
const c=V.clampView({cx:999,cy:-5,zoom:9999,fitZoom:f.zoom},piece,W,H);
assert(c.zoom===V.ZMAX&&c.cx===100&&c.cy===0,'clampView bounds zoom + center');
const c2=V.clampView({cx:50,cy:30,zoom:0.001,fitZoom:f.zoom},piece,W,H);
assert(near(c2.zoom,f.zoom),'clampView floors zoom at fit');
```

- [ ] **Step 3: Run the test**

Run: `node --check viewport.js && node /tmp/vy_vp_test.js && rm /tmp/vy_vp_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**

```bash
git add viewport.js
git commit -m "feat: viewport math core (LOD ladder, screen<->pattern, fit/clamp/zoom)"
```

---

## Task 2: Decouple exports + build the `piece` object (no viewport display yet)

Make `generate()` render the full-resolution piece to an **offscreen export canvas** (so exports stop depending on the on-screen canvas) and build a `piece={cols,rows,bg,rasterAtCell}` for the viewport — while still drawing to `#cv` exactly as today, so nothing visibly changes yet. Export-canvas resolution must match today's PNG exactly (wallpaper `W×H`; panel `W*dpr × H*dpr`).

**Files:**
- Modify: `render.js` (add `rasterSeamless`; export it)
- Modify: `app.js` (`generate()` builds export canvas + `piece`; PNG handler uses export canvas)

- [ ] **Step 1: Add a seamless piece rasterizer to `render.js`.** After `fillPattern` (ends at line 75) add:

```js
// raster a seamless wallpaper piece of (pcols x prows) stitches at a given cell,
// by tiling the seamless tile (rendered at that cell) across an offscreen canvas
function rasterSeamless(tileModel, pcols, prows, cell, style, seedNum, bg){
  const tile=buildTileCanvas(tileModel, cell, style, seedNum);
  const c=document.createElement("canvas"); c.width=pcols*cell; c.height=prows*cell;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,c.width,c.height);
  const p=g.createPattern(tile,"repeat"); g.fillStyle=p; g.fillRect(0,0,c.width,c.height);
  return c;
}
```
And add `rasterSeamless` to the `VY.render` export object (line 112):

```js
VY.render = { drawGrid, fitPreview, lum, buildTileCanvas, fillPattern, setCtx, renderChart, rasterSeamless };
```

- [ ] **Step 2: In `app.js` `generate()`, build an offscreen export canvas + a `piece` per branch.** Replace the block from `VY.app._lastTile=null;` (line 86) through the end of the three branches (line 120) with the following. Each branch (a) computes its `model`, (b) draws the **full-resolution** piece to an offscreen `exp` canvas with identical pixels to today, (c) defines `piece`, then still blits `exp` onto `#cv` for now:

```js
  VY.app._lastTile=null;
  let piece, exp;
  if(state.mode==="wallpaper"&&state.layout==="fabric"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const tileModel=VY.gen.composeFabricTile(state.scale);
    const base={small:5,medium:8,large:12}[state.scale];
    const cell=Math.max(4,Math.round(base*H/1080));
    const pcols=Math.round(W/cell), prows=Math.round(H/cell);
    const tileCanvas=VY.render.buildTileCanvas(tileModel,cell,state.style,seedNum);
    exp=document.createElement("canvas"); exp.width=W; exp.height=H;
    const eg=exp.getContext("2d"); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    const pat=eg.createPattern(tileCanvas,"repeat"); eg.fillStyle=pat; eg.fillRect(0,0,W,H);
    VY.app._lastTile=tileCanvas; VY.app._lastModel=tileModel;
    piece={cols:pcols, rows:prows, bg:P.bg,
           rasterAtCell:(cl)=>VY.render.rasterSeamless(tileModel,pcols,prows,cl,state.style,seedNum,P.bg)};
    document.getElementById("dims").textContent=`${W}×${H}px · seamless tile ${tileModel.cols}×${tileModel.rows}`;
  }else if(state.mode==="wallpaper"){
    const [, ,W,H]=RES.find(r=>r[0]===state.res);
    const model=VY.gen.composeWallpaper(W,H,state.layout,state.scale);
    exp=document.createElement("canvas"); exp.width=W; exp.height=H;
    const eg=exp.getContext("2d"); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    const ox=Math.round((W-model.cols*model.cell)/2),oy=Math.round((H-model.rows*model.cell)/2);
    VY.render.setCtx(eg); VY.render.drawGrid(model,model.cell,ox,oy,state.style,seedNum); VY.render.setCtx(VY.ctx);
    VY.app._lastModel=model;
    piece={cols:model.cols, rows:model.rows, bg:P.bg,
           rasterAtCell:(cl)=>VY.render.buildTileCanvas(model,cl,state.style,seedNum)};
    document.getElementById("dims").textContent=`${W}×${H}px · ${model.cols}×${model.rows} stitches`;
  }else{
    const model=VY.gen.composePanel(state.shape);
    const cell=Math.max(3,Math.min(22,Math.floor(Math.min(720/model.cols,720/model.rows))));
    const W=model.cols*cell,H=model.rows*cell;
    exp=document.createElement("canvas"); exp.width=W*dpr; exp.height=H*dpr;
    const eg=exp.getContext("2d"); eg.setTransform(dpr,0,0,dpr,0,0); eg.fillStyle=P.bg; eg.fillRect(0,0,W,H);
    VY.render.setCtx(eg); VY.render.drawGrid(model,cell,0,0,state.style,seedNum); VY.render.setCtx(VY.ctx);
    VY.app._lastModel=model;
    piece={cols:model.cols, rows:model.rows, bg:P.bg,
           rasterAtCell:(cl)=>VY.render.buildTileCanvas(model,cl,state.style,seedNum)};
    document.getElementById("dims").textContent=`${model.cols}×${model.rows} stitches · cell ${cell}px`;
  }
  VY.app._exportCanvas=exp; VY.app._piece=piece;
  // (temporary) keep today's on-screen behavior: blit the export canvas to #cv
  VY.cv.width=exp.width; VY.cv.height=exp.height; VY.ctx.setTransform(1,0,0,1,0,0);
  VY.ctx.drawImage(exp,0,0);
  VY.render.fitPreview(exp.width,exp.height);
  if(updateHash)writeHash();
```

(`setCtx`/`VY.ctx` retargeting mirrors the existing `buildTileCanvas` pattern; always restored to `VY.ctx`.)

- [ ] **Step 3: Point PNG export at the export canvas.** Replace the `#png` handler (lines 147–149) so it exports the piece-level canvas, not `#cv`:

```js
document.getElementById("png").onclick=()=>{const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_${state.mode==="wallpaper"?state.layout+"_"+state.res:state.shape}_${state.seed}.png`;
  a.href=(VY.app._exportCanvas||VY.cv).toDataURL("image/png");a.click();};
```

- [ ] **Step 4: Verify (node + browser)**

Run: `node --check render.js && node --check app.js`
Expected: OK.

Browser: app looks **identical** to before (fit-to-stage). PNG download still produces the full-resolution piece (wallpaper `W×H`; panel `W*dpr`). Tile + chart export still work (unchanged, use `_lastTile`/`_lastModel`). Lab/accordion unaffected. Determinism console check passes. DevTools: `VY.app._piece` has `{cols,rows,bg,rasterAtCell}`; `VY.app._piece.rasterAtCell(8)` returns a canvas.

- [ ] **Step 5: Commit**

```bash
git add render.js app.js
git commit -m "refactor: piece-level export canvas + piece.rasterAtCell (behavior-preserving)"
```

---

## Task 3: Viewport display pipeline (static fitted view via raster + transform)

Add `attach(piece, restoreView)` + raster-display + transform to `viewport.js`, and switch `generate()`'s on-screen path to use it. Still no user input — a fitted view that looks like today, rendered through the viewport (the on-screen `#cv` becomes the transformed raster).

**Files:**
- Modify: `viewport.js` (state, `attach`, `applyTransform`, `reraster`, `getView`)
- Modify: `app.js` (call `VY.viewport.attach` instead of the temporary blit)
- Modify: `index.html` (load `viewport.js`)
- Modify: `styles.css` (`.stage{overflow:hidden}`, `#cv{transform-origin:0 0}`)

- [ ] **Step 1: Add display state + attach to `viewport.js`.** Inside the IIFE, after the math (before the `VY.viewport = {...}` export), add:

```js
  let PIECE=null, VP=null, rasterCanvas=null, curCell=0;
  function stageSize(){ const s=document.querySelector(".stage"); return [s.clientWidth, s.clientHeight]; }
  function applyTransform(){
    if(!rasterCanvas) return;
    const [W,H]=stageSize(); const t=transformFor(VP,W,H);
    const k=t.cell/curCell; // raster rendered at curCell vs the LOD cell
    rasterCanvas.style.transform=`translate(${t.tx}px,${t.ty}px) scale(${t.s*k})`;
  }
  function reraster(){
    const [W,H]=stageSize(); const t=transformFor(VP,W,H); curCell=t.cell;
    const c=PIECE.rasterAtCell(curCell);
    VY.cv.width=c.width; VY.cv.height=c.height; VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.clearRect(0,0,c.width,c.height); VY.ctx.drawImage(c,0,0);
    VY.cv.style.width=c.width+"px"; VY.cv.style.height=c.height+"px"; rasterCanvas=VY.cv;
    applyTransform();
  }
  function attach(piece, restoreView){
    PIECE=piece; const [W,H]=stageSize();
    VP = restoreView ? clampView({...restoreView, fitZoom:fitView(piece,W,H).fitZoom}, piece, W,H)
                     : fitView(piece, W, H);
    reraster();
  }
  function getView(){ return VP?{cx:VP.cx,cy:VP.cy,zoom:VP.zoom}:null; }
```

And extend the export object:

```js
  VY.viewport = { LODS, ZMAX, cellForLod, lodForZoom, screenToPattern, patternToScreen,
                  fitView, clampView, zoomAt, transformFor, attach, getView };
```

- [ ] **Step 2: Switch `generate()` to the viewport.** In `app.js`, replace the temporary blit block (the 4 lines from `// (temporary) keep today's on-screen behavior` through `VY.render.fitPreview(exp.width,exp.height);`) with:

```js
  VY.viewport.attach(piece);
```
(`fitPreview` is no longer used for the on-screen preview; the viewport owns canvas sizing now.)

- [ ] **Step 3: Load order + canvas/stage styles.** In `index.html`, add `<script src="viewport.js"></script>` immediately before `<script src="app.js"></script>` (line 143).

In `styles.css` the canvas must become an absolutely-positioned, transform-origin-top-left layer that fills the stage, so `translate(tx,ty)` maps to stage pixels. The current rules (lines 84–92) flex-center a padded, shadowed `.frame` around `#cv` — that offset would break the transform math. Change them:
  1. Edit the `.stage{` rule (lines 84–87): change `overflow:auto` → `overflow:hidden`, change `padding:24px` → `padding:0`, and add `position:relative` (keep the flex + background-gradient).
  2. Edit the `.frame{` rule (lines 88–91) to fill the stage as a bare positioning box (the framed-thumbnail look is intentionally dropped — the piece now lives in a pan/zoom window):
  ```css
  .frame{ position:absolute; inset:0; padding:0; background:none; box-shadow:none; border-radius:0; }
  ```
  3. Add a `#cv` rule:
  ```css
  #cv{ position:absolute; top:0; left:0; transform-origin:0 0; }
  ```
  4. In the mobile media query, change the `.stage{padding:12px}` rule (≈ line 113) to `.stage{padding:0}` so the stage content box equals the viewport (the transform + `stageSize()` read `.stage.clientWidth/Height` with no padding).

(`stageSize()` reads `.stage` `clientWidth/clientHeight`; with `padding:0` that equals the viewport window, and `#cv` absolute at `0,0` of the stage-filling `.frame` means `translate(tx,ty)` is in stage coordinates.)

- [ ] **Step 4: Verify (node + browser)**

Run: `node --check viewport.js && node --check app.js`
Expected: OK.

Browser: the piece appears **fitted and centered in the stage**, now filling the viewport window (the old decorative `.frame` shadow/border is intentionally gone — this is the expected visual change). Window resize stays sensible. No console errors; accordion + Lab still work. PNG/tile/chart still export the full piece. Determinism check passes. (No pan/zoom yet.)

- [ ] **Step 5: Commit**

```bash
git add viewport.js app.js index.html styles.css
git commit -m "feat: render the piece through the viewport pipeline (static fitted view)"
```

---

## Task 4: Wheel-zoom + drag-pan + two-phase compositor + LOD re-raster + LRU cache

Add interaction: cursor-anchored wheel zoom and drag pan. During a gesture only the CSS transform updates (GPU, smooth); on settle (debounced) or when the LOD cell changes, re-raster crisply. Cache rasters per cell with LRU eviction.

**Files:**
- Modify: `viewport.js` (LRU cache, `init()` with wheel + pointer handlers, rAF transform, settle debounce)
- Modify: `app.js` (call `VY.viewport.init()` at boot)

- [ ] **Step 1: Add an LRU raster cache to `viewport.js`.** Above `reraster`, add:

```js
  let cache=new Map(); const CACHE_MAX=6;
  function rasterFor(cell){
    if(cache.has(cell)){ const c=cache.get(cell); cache.delete(cell); cache.set(cell,c); return c; }
    const c=PIECE.rasterAtCell(cell);
    cache.set(cell,c); while(cache.size>CACHE_MAX){ cache.delete(cache.keys().next().value); }
    return c;
  }
```
Update `reraster` to use it:

```js
  function reraster(){
    const [W,H]=stageSize(); const t=transformFor(VP,W,H); curCell=t.cell;
    const c=rasterFor(curCell);
    VY.cv.width=c.width; VY.cv.height=c.height; VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.clearRect(0,0,c.width,c.height); VY.ctx.drawImage(c,0,0);
    VY.cv.style.width=c.width+"px"; VY.cv.style.height=c.height+"px"; rasterCanvas=VY.cv;
    applyTransform();
  }
```
In `attach`, clear the cache for the new piece — add `cache=new Map();` as the first line of `attach`.

- [ ] **Step 2: Add `init()` with wheel + pointer handlers + a settle debounce.** Inside the IIFE add:

```js
  let raf=0, settleT=0;
  function schedule(){ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; applyTransform(); }); }
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    if(transformFor(VP,W,H).cell!==curCell) reraster(); else applyTransform(); }, 130); }
  function liveCommit(){ const [W,H]=stageSize(); VP=clampView(VP,PIECE,W,H);
    if(transformFor(VP,W,H).cell!==curCell){ reraster(); } else { schedule(); }
    settle(); }
  function init(){
    const stage=document.querySelector(".stage");
    stage.addEventListener("wheel",(e)=>{ if(!PIECE) return; e.preventDefault();
      const r=stage.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top;
      const factor=Math.exp(-e.deltaY*0.0015);
      VP=zoomAt(VP, factor, sx, sy, r.width, r.height); liveCommit();
    },{passive:false});
    let dragging=false, lastX=0, lastY=0;
    stage.addEventListener("pointerdown",(e)=>{ if(!PIECE||e.pointerType==="touch") return; dragging=true; lastX=e.clientX; lastY=e.clientY;
      stage.setPointerCapture(e.pointerId); stage.classList.add("grabbing"); });
    stage.addEventListener("pointermove",(e)=>{ if(!dragging) return;
      const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
      VP={...VP, cx:VP.cx-dx/VP.zoom, cy:VP.cy-dy/VP.zoom}; liveCommit(); });
    const up=()=>{ if(!dragging) return; dragging=false; stage.classList.remove("grabbing"); settle(); };
    stage.addEventListener("pointerup",up); stage.addEventListener("pointercancel",up);
  }
```
Add `init` to the export object: `VY.viewport = { … , attach, init, getView };`

- [ ] **Step 3: Call `init()` at boot in `app.js`.** The boot line is `readHash();syncUI();generate(false);renderFavs();` (line 288). Insert `VY.viewport.init();` **before** it so handlers are live:

```js
VY.viewport.init();
readHash();syncUI();generate(false);renderFavs();
```

- [ ] **Step 4: Verify (browser)**

Run: `node --check viewport.js && node --check app.js`
Expected: OK.

Browser: scroll wheel **zooms toward the cursor**; **drag pans**; smooth during the gesture, **crisp** after ~130ms; deep zoom shows individual stitches sharply (LOD re-raster); zoom-out floors at "fit". Cursor grab/grabbing. PNG/tile/chart unaffected. Determinism check passes.

- [ ] **Step 5: Commit**

```bash
git add viewport.js app.js
git commit -m "feat: wheel-zoom + drag-pan with two-phase LOD compositor + LRU raster cache"
```

---

## Task 5: Touch (pinch/drag) + keyboard + double-click + HUD/reset

Round out interaction: touch pinch-zoom + drag, keyboard (`+`/`-` zoom, arrows pan, `0` reset), double-click step-zoom, and a small HUD (zoom %, Reset/Fit button). Also update the toolbar hint copy (it currently reads "scroll to pan tall panels").

**Files:**
- Modify: `viewport.js` (touch, keyboard, dblclick, `fit()`, HUD updater)
- Modify: `index.html` (HUD markup in `.stage`)
- Modify: `styles.css` (HUD styles, grab cursor, touch-action)
- Modify: `app.js` (toolbar hint copy)

- [ ] **Step 1: Add `fit()` + zoom-% + extra handlers in `viewport.js`.** Add these inside `init()` (after the pointer handlers):

```js
    stage.addEventListener("dblclick",(e)=>{ if(!PIECE) return; const r=stage.getBoundingClientRect();
      VP=zoomAt(VP, e.shiftKey?0.5:2, e.clientX-r.left, e.clientY-r.top, r.width, r.height); liveCommit(); });
    let pts=new Map(), pinch0=0, pinchVP=null, pmid=null;
    stage.addEventListener("pointerdown",(e)=>{ if(e.pointerType!=="touch")return; pts.set(e.pointerId,e); });
    stage.addEventListener("pointermove",(e)=>{ if(e.pointerType!=="touch"||!pts.has(e.pointerId))return; pts.set(e.pointerId,e);
      const arr=[...pts.values()];
      if(pts.size===2){ const [a,b]=arr; const r=stage.getBoundingClientRect();
        const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
        const mx=(a.clientX+b.clientX)/2-r.left, my=(a.clientY+b.clientY)/2-r.top;
        if(!pinch0){ pinch0=dist; pinchVP=VP; pmid=[mx,my]; }
        else { VP=zoomAt(pinchVP, dist/pinch0, pmid[0], pmid[1], r.width, r.height); liveCommit(); }
      } else if(pts.size===1){ const a=arr[0]; if(a._lx!=null){ VP={...VP, cx:VP.cx-(a.clientX-a._lx)/VP.zoom, cy:VP.cy-(a.clientY-a._ly)/VP.zoom}; liveCommit(); } a._lx=a.clientX; a._ly=a.clientY; }
    });
    const tup=(e)=>{ if(e.pointerType!=="touch")return; pts.delete(e.pointerId); if(pts.size<2){ pinch0=0; pinchVP=null; } };
    stage.addEventListener("pointerup",tup); stage.addEventListener("pointercancel",tup);
    window.addEventListener("keydown",(e)=>{ if(!PIECE) return; const tag=(e.target.tagName||"").toLowerCase();
      if(tag==="input"||tag==="select"||tag==="textarea") return; const [W,H]=stageSize();
      if(e.key==="+"||e.key==="="){ VP=zoomAt(VP,1.25,W/2,H/2,W,H); liveCommit(); }
      else if(e.key==="-"||e.key==="_"){ VP=zoomAt(VP,0.8,W/2,H/2,W,H); liveCommit(); }
      else if(e.key==="0"){ fit(); }
      else if(e.key==="ArrowLeft"){ VP={...VP,cx:VP.cx-20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowRight"){ VP={...VP,cx:VP.cx+20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowUp"){ VP={...VP,cy:VP.cy-20/VP.zoom}; liveCommit(); }
      else if(e.key==="ArrowDown"){ VP={...VP,cy:VP.cy+20/VP.zoom}; liveCommit(); }
      else return; e.preventDefault(); });
    const rb=document.getElementById("vpReset"); if(rb) rb.onclick=fit;
```
Add `fit()` + `updateHud()` near `attach`, and call `updateHud()` at the end of `applyTransform()`:

```js
  function fit(){ if(!PIECE) return; const [W,H]=stageSize(); VP=fitView(PIECE,W,H); reraster(); }
  function updateHud(){ const el=document.getElementById("vpZoom"); if(el&&VP) el.textContent=Math.round(VP.zoom/(VP.fitZoom||VP.zoom)*100)+"%"; }
```
Add `fit` to the exports: `VY.viewport = { … , attach, init, fit, getView };`

- [ ] **Step 2: Add the HUD to `index.html`.** Inside `<div class="stage">` (line 128), before `<div class="frame">`, add:

```html
    <div class="vphud"><span id="vpZoom">100%</span><button id="vpReset" type="button">Reset view</button></div>
```

- [ ] **Step 3: Add HUD + touch styles to `styles.css`:**

```css
.vphud{position:absolute;top:10px;right:12px;z-index:5;display:flex;gap:8px;align-items:center;
  background:rgba(8,18,38,.7);border:1px solid var(--line);border-radius:8px;padding:4px 8px;font-size:12px;color:var(--ink)}
.vphud button{background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:3px 8px;cursor:pointer;font:inherit}
#cv{touch-action:none;cursor:grab}
.stage.grabbing #cv{cursor:grabbing}
```

- [ ] **Step 4: Update the toolbar hint in `app.js`.** In `syncUI` the hint line (line 52) currently sets `"scroll to pan tall panels"` for panel mode. Replace that line so both modes describe the viewport:

```js
  document.getElementById("hint").textContent="scroll = zoom · drag = pan · 0 = fit";
```

- [ ] **Step 5: Verify (browser, incl. touch emulation)**

Run: `node --check viewport.js && node --check app.js`
Expected: OK.

Browser: double-click zooms in (shift = out); `+`/`-` zoom, arrows pan, `0` refits; HUD shows live zoom % and "Reset view" refits. Touch-emulation: two-finger pinch zooms about the midpoint, one-finger drag pans. The mobile **drawer still opens** (its gestures aren't captured — `touch-action:none` is only on `#cv`). Typing in the seed field isn't hijacked by keys. Determinism check passes.

- [ ] **Step 6: Commit**

```bash
git add viewport.js index.html styles.css app.js
git commit -m "feat: touch pinch/drag, keyboard, double-click, and viewport HUD"
```

---

## Task 6: Shareable view (`vox/voy/voz`) + regenerate-vs-view rules

Serialize the viewport to the URL hash so a link reopens at the exact pan/zoom, and define when a regenerate keeps vs. resets the view. Hash keys are **`vox/voy/voz`** (the existing `vy` key is variety — do not collide).

**Files:**
- Modify: `viewport.js` (settle hook; `isFit`)
- Modify: `app.js` (`DEFAULTS` view fields; `writeHash`/`readHash`; onSettle; `resetView` in pattern-changing handlers; restore on attach)

- [ ] **Step 1: Have the viewport report its settled view.** In `viewport.js`, replace `settle()` with one that fires a hook, and add `isFit()`; also fire the hook from `fit()`:

```js
  function isFit(){ if(!PIECE||!VP) return true; const [W,H]=stageSize(); const f=fitView(PIECE,W,H);
    return Math.abs(VP.zoom-f.zoom)<1e-3 && Math.abs(VP.cx-f.cx)<1e-3 && Math.abs(VP.cy-f.cy)<1e-3; }
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    if(transformFor(VP,W,H).cell!==curCell) reraster(); else applyTransform();
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), isFit()); }, 130); }
```
In `fit()`, after `reraster();` add: `if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), true);`. Add `isFit` to the export object.

- [ ] **Step 2: Add view fields to `DEFAULTS` + hash wiring in `app.js`.** Extend `DEFAULTS` (lines 21–23) to include null view fields:

```js
const DEFAULTS={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:20,symmetry:"d4",lab:null,vx:null,vy:null,vz:null};
```
Extend `writeHash` (line 125) to add the view when present — append before `const p=new URLSearchParams(o);`:

```js
if(state.vz){o.vox=state.vx;o.voy=state.vy;o.voz=state.vz;}
```
In `readHash`, before the function's final `}` (end of line 132), add a defensive view parse:

```js
  const vox=+g("vox","x"),voy=+g("voy","x"),voz=+g("voz","x");
  if(Number.isFinite(vox)&&Number.isFinite(voy)&&Number.isFinite(voz)&&voz>0){ state.vx=vox;state.vy=voy;state.vz=voz; }
```

- [ ] **Step 3: Record the settled view + apply restores.** After the boot `VY.viewport.init();` (Task 4), wire the settle hook:

```js
VY.viewport.onSettle=(view,fit)=>{ if(fit){ state.vx=state.vy=state.vz=null; } else { state.vx=+view.cx.toFixed(2); state.vy=+view.cy.toFixed(2); state.vz=+view.zoom.toFixed(3); } writeHash(); };
```
In `generate()`, pass a restore view into attach — replace `VY.viewport.attach(piece);` with:

```js
  const rv=(state.vz)?{cx:state.vx,cy:state.vy,zoom:state.vz}:null;
  VY.viewport.attach(piece, rv);
```

- [ ] **Step 4: Reset the view on pattern changes (not on style).** Add a helper near the events block and call it in every **pattern-changing** handler, leaving the style handler alone. Add after the events comment (line 134):

```js
function resetView(){ state.vx=state.vy=state.vz=null; }
```
Add `resetView();` at the start of these handlers: `modeSeg` click (line 135), `regionSel.onchange` (137), `resSel.onchange` (138), `complexity.onchange` (140), `variety.onchange` (142), `tradition.onchange` (144), `seed.onchange` (145), `gen.onclick` (146). Add it inside `buildSeg`'s `b.onclick` (line 30) so layout/bg/scale/shape/symmetry also reset the view. Do **NOT** add it to `styleSeg` (line 136). The Lab handlers (`commitLab`, `labRandom`, `labReset`) call `generate()`; add `resetView();` before their `generate()` too so a genome change refits. `resetAll` already restores `DEFAULTS` (view → null) — no change needed. Favorites restore (`Object.assign(state,f.state)`) carries the saved view because `{...state}` now includes `vx/vy/vz` — correct, no change.

- [ ] **Step 5: Verify (browser, real reloads)**

Run: `node --check app.js && node --check viewport.js`
Expected: OK.

Browser:
1. Zoom/pan into a corner → URL gains `vox/voy/voz`. Navigate `about:blank`, paste the URL → reopens at that exact view. At "fit", the params are absent and old links open fitted.
2. New design / change region/layout/Lab → view refits. Toggle **stitch style** → view preserved.
3. Save a zoomed favorite, New design, click the chip → restores pattern **and** its view (and opens the Lab section if it had a lab).
Determinism check passes (seed string unchanged — view not in it).

- [ ] **Step 6: Commit**

```bash
git add app.js viewport.js
git commit -m "feat: shareable viewport (vox/voy/voz) + regenerate-vs-view rules"
```

---

## Task 7: Polish — high-DPI rasters, mid-gesture headroom, raster-size guard

Crispness on retina, less mid-gesture blur, and a guard so extreme zoom on big pieces can't allocate an oversized canvas.

**Files:**
- Modify: `viewport.js`

- [ ] **Step 1: Render rasters at devicePixelRatio + size guard.** Add module vars and a cap, and rework `reraster`/`applyTransform` to raster in device px while keeping transform math in CSS px:

```js
  const DPR=Math.max(1, Math.min(3, window.devicePixelRatio||1));
  let curDeviceCell=0;
  function maxCellFor(){ if(!PIECE) return 9999; return Math.max(1, Math.floor(16000/Math.max(PIECE.cols,PIECE.rows))); }
  function reraster(){
    const [W,H]=stageSize(); const t=transformFor(VP,W,H); curCell=t.cell;
    const dCell=Math.min(t.cell*DPR, maxCellFor());
    const c=rasterFor(dCell); rasterCanvas=VY.cv;
    VY.cv.width=c.width; VY.cv.height=c.height; VY.ctx.setTransform(1,0,0,1,0,0);
    VY.ctx.clearRect(0,0,c.width,c.height); VY.ctx.drawImage(c,0,0);
    VY.cv.style.width=(c.width/DPR)+"px"; VY.cv.style.height=(c.height/DPR)+"px";
    curDeviceCell=dCell; applyTransform();
  }
  function applyTransform(){ if(!rasterCanvas) return; const [W,H]=stageSize(); const t=transformFor(VP,W,H);
    const shownCell=curDeviceCell/DPR; const k=t.cell/shownCell;
    rasterCanvas.style.transform=`translate(${t.tx}px,${t.ty}px) scale(${t.s*k})`; updateHud(); }
```
(`rasterFor`'s cache key becomes the device cell, which already varies with DPR/cap.)

- [ ] **Step 2: Make `settle()` re-raster at the displayed device LOD.** Replace `settle()` so it compares against `curDeviceCell`:

```js
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    const want=Math.min(transformFor(VP,W,H).cell*DPR, maxCellFor());
    if(want!==curDeviceCell) reraster(); else applyTransform();
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), isFit()); }, 130); }
```
And in `liveCommit`, change the cell-changed check to the device cell:

```js
  function liveCommit(){ const [W,H]=stageSize(); VP=clampView(VP,PIECE,W,H);
    const want=Math.min(transformFor(VP,W,H).cell*DPR, maxCellFor());
    if(want!==curDeviceCell){ reraster(); } else { schedule(); } settle(); }
```

- [ ] **Step 3: Verify (browser)**

Run: `node --check viewport.js`
Expected: OK.

Browser (retina or DPR-emulated): zoomed-in stitches are **crisp** (DPR raster); pan/zoom stays smooth and re-sharpens on settle; zooming to max on a 4K-resolution piece does **not** freeze or error (size guard caps the raster). Mobile drawer still works; PNG/tile/chart unaffected; determinism check passes.

- [ ] **Step 4: Commit**

```bash
git add viewport.js
git commit -m "polish: high-DPI viewport rasters + raster-size guard"
```

---

## Self-review notes

- **Spec coverage:** viewport state `{cx,cy,zoom}` + math → Task 1; `piece`/TileSource + export decoupling (piece-level PNG, panel keeps `W*dpr`) → Task 2; raster+transform display + `attach` + `fitPreview` superseded → Task 3; two-phase compositor + LOD + LRU + wheel/drag → Task 4; touch/keyboard/double-click/HUD → Task 5; `vox/voy/voz` hash share + regenerate-vs-view → Task 6; high-DPI + headroom + memory guard → Task 7. Exports-stay-piece-level → Task 2. All spec sections mapped.
- **Re-baselined to v1.1.0:** anchors updated for the merged Pillar C + accordion (`generate()` lines 86–120, `writeHash` 125, `readHash` 126–132, PNG handler 147–149, boot 288, `DEFAULTS` 21–23, `buildSeg` 30). The viewport's DOM lives over `.stage`/`#cv` (unchanged by the accordion). `resetView()` is added to C's expanded handler set incl. `tradition` and the Lab handlers; `resetAll` resets the view via `DEFAULTS`.
- **Determinism:** the seed string (app.js:73) is never touched; the viewport is view-only and serialized to the hash separately. Determinism console check repeated in Tasks 2–7.
- **Hash key collision avoided:** existing `vy` = variety; viewport uses `vox/voy/voz`. Verified against `writeHash`/`readHash`.
- **Type/name consistency:** `piece={cols,rows,bg,rasterAtCell}`, `VY.app._piece`/`_exportCanvas`/`_lastTile`/`_lastModel`, `VY.viewport.{attach,init,fit,getView,onSettle,isFit,fitView,clampView,zoomAt,transformFor,cellForLod,lodForZoom,screenToPattern,patternToScreen}`, internals `VP/PIECE/curCell/curDeviceCell/rasterFor/reraster/applyTransform/liveCommit/settle` — consistent across tasks.
- **Behavior-preserving staging:** Task 2 changes plumbing, screen identical; Task 3 swaps the on-screen path to the fitted viewport (still looks like today); interaction lands in Task 4+. Each task independently shippable.
- **Browser-verification nature:** only Task 1's math is node-testable; the rest is inherently interaction/canvas (consistent with the project's no-test-suite constraint). A Playwright pass after the build exercises gestures + the share round-trip.
- **Visual-tuning caveat:** wheel sensitivity (`0.0015`), settle delay (`130ms`), the LOD ladder, and zoom limits are reasonable defaults that may want a tuning pass during Tasks 4–5.
```
