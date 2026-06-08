# Viewport Tile-Source Refactor (Pillar A correction) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the viewport's whole-piece `rasterAtCell(cell)` with a tile-addressed `rasterTile(cell, tileX, tileY)` source + a stage-sized tiled compositor — honoring the `TileSource` seam A promised B, and uncapping deep zoom.

**Architecture:** A new `piece.rasterTile(cell,tx,ty)` returns one 256px tile (bounded piece slices its grid; seamless piece pattern-fills). The viewport keeps a `(cell,tx,ty)` LRU cache, composites the visible tiles (+overscan) into a stage-sized `#cv` each frame at the current view center, and applies only a residual CSS scale for sub-LOD zoom. All input/settle/hash/HUD/export/clamp code is unchanged.

**Tech Stack:** Plain ES2017 JS, Canvas2D, CSS transforms, classic `<script src>` under `VY`. No build/test-runner. Served static on LAMP.

---

## Conventions

No test runner. The new viewport math is **pure** and node-testable in a `vm` sandbox (it must stay DOM-free at module load). `rasterTile` and the compositor are canvas/DOM — `node --check` for syntax, browser/Playwright for behavior. Test files go to `/tmp`, never committed.

**Reusable Node harness** (math tasks write `/tmp/vy_ts_test.js` = preamble + assertions, run, delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Object,JSON,Array,Map,console,Number,String,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout:()=>0,devicePixelRatio:2};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/viewport.js','utf8'), sb);
const VY=sb.VY;
let ok=true; const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

**Constants:** `TILE = 256` (device px per tile), `OVER = 256` (overscan, device px), `CACHE_MAX = 64`.

**Invariants (hold after every task):** seed string + `generate()` untouched; exports use the separate `VY.app._exportCanvas` (untouched); `vox/voy/voz` hash + `onSettle` + all input handlers unchanged; `viewport.js` stays DOM-free at module load (the pure math + function declarations only; DOM runs inside `init()`/`attach()`/`retile()` etc.).

**Staging so the app works after every task:** Task 1 adds unused pure math. Task 2 adds unused `rasterTile` to `render.js`. Task 3 switches `app.js` piece + the viewport compositor together (consistent). Task 4 removes the now-dead whole-piece code.

---

## Task 1: Pure tile/transform math (`viewport.js`, node-tested)

Add three pure helpers to `viewport.js` (inside the IIFE, near the other pure math, before the display state). They must not touch the DOM.

**Files:** Modify `viewport.js`.

- [ ] **Step 1: Add the helpers.** Insert after `transformFor` (line ~37):

```js
  // ---- tile-source math (pure; device-pixel tile grid at scale dCell) ----
  // inclusive tile-index range covering the visible stage (+overscan), centered on stitch (cx,cy)
  function tilesFor(cx, cy, W, H, dCell, DPR, TILE, over){
    const cxd=cx*dCell, cyd=cy*dCell, halfW=W*DPR/2+over, halfH=H*DPR/2+over;
    return { tx0:Math.floor((cxd-halfW)/TILE), tx1:Math.floor((cxd+halfW)/TILE),
             ty0:Math.floor((cyd-halfH)/TILE), ty1:Math.floor((cyd+halfH)/TILE) };
  }
  // top-left of tile (tx,ty) in the canvas backing store (device px)
  function tileDest(tx, ty, cx, cy, W, H, dCell, DPR, TILE){
    return { x: tx*TILE - cx*dCell + W*DPR/2, y: ty*TILE - cy*dCell + H*DPR/2 };
  }
  // residual CSS transform: a canvas painted at `renderCell` CSS px/stitch (centered on the view
  // center) shown at vp.zoom. transform-origin:0 0.
  function residualTransform(vp, renderCell, W, H){
    const S=vp.zoom/renderCell;
    return { S, Tx:(W/2)*(1-S), Ty:(H/2)*(1-S) };
  }
```

Add them to the `VY.viewport = {...}` export object (for testing) alongside the existing members:
```js
  VY.viewport = { LODS, ZMAX, cellForLod, lodForZoom, screenToPattern, patternToScreen,
                  fitView, clampView, zoomAt, transformFor, tilesFor, tileDest, residualTransform,
                  attach, init, fit, getView, isFit };
```
(Keep every member already exported; just add the three. If later tasks add more, keep these.)

- [ ] **Step 2: Write the test** to `/tmp/vy_ts_test.js` (preamble +):

```js
const V=VY.viewport, TILE=256, DPR=2, OVER=256;
// a view centered at stitch (100,60), dCell=16 device px/stitch, stage 800x600 CSS
const cx=100,cy=60,W=800,H=600,dCell=16;
const r=V.tilesFor(cx,cy,W,H,dCell,DPR,TILE,OVER);
// center world device px = (1600,960); halfW=800*2/2+256=1056; so x in [544,2656] -> tx in [2,10]
assert(r.tx0===Math.floor((1600-1056)/256) && r.tx1===Math.floor((1600+1056)/256), 'tx range');
assert(r.ty0===Math.floor((960-(600*2/2+256))/256) && r.ty1===Math.floor((960+856)/256), 'ty range');
// tileDest: the tile containing the center maps so the center stitch lands at canvas center
const d=V.tileDest(0,0,cx,cy,W,H,dCell,DPR,TILE);
assert(near(d.x, 0 - cx*dCell + W*DPR/2) && near(d.y, 0 - cy*dCell + H*DPR/2), 'tileDest origin');
// stitch (cx,cy) world device px = cx*dCell; its canvas position = worldpx + dest-of-its-tile... check center maps to canvas center:
//   canvas x of stitch p = p*dCell + tileDest(0,0).x (since tile0 covers world px from 0) = p*dCell + (W*DPR/2 - cx*dCell)
const canvasXofCenter = cx*dCell + d.x; assert(near(canvasXofCenter, W*DPR/2), 'view center -> canvas center');
// residualTransform: at vp.zoom==renderCell, S=1, T=0 (no residual); zoomed-out (zoom<cell) S<1 centered
assert(near(V.residualTransform({zoom:16},16,W,H).S,1) && near(V.residualTransform({zoom:16},16,W,H).Tx,0), 'residual identity at zoom==cell');
const rt=V.residualTransform({zoom:8},16,W,H); assert(near(rt.S,0.5) && near(rt.Tx,W/4) && near(rt.Ty,H/4), 'residual half-scale centered');
// overscan widens the range by >=1 tile each side vs zero overscan
const r0=V.tilesFor(cx,cy,W,H,dCell,DPR,TILE,0);
assert(r.tx0<=r0.tx0 && r.tx1>=r0.tx1, 'overscan widens range');
```

- [ ] **Step 3: Run**

Run: `node --check viewport.js && node /tmp/vy_ts_test.js && rm /tmp/vy_ts_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Confirm still DOM-free at load**

Run: `node -e "const fs=require('fs'),vm=require('vm');const sb={Math,Object,JSON,Array,Map,console,Number,String,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout:()=>0,devicePixelRatio:2};sb.window=sb;sb.VY={};sb.window.VY=sb.VY;vm.createContext(sb);vm.runInContext(fs.readFileSync('viewport.js','utf8'),sb);console.log(typeof sb.VY.viewport.tilesFor==='function'?'LOAD OK':'MISSING')"`
Expected: `LOAD OK`

- [ ] **Step 5: Commit**

```bash
git add viewport.js
git commit -m "feat: pure tile-source math (tilesFor/tileDest/residualTransform)"
```

---

## Task 2: `rasterTile` source in `render.js`

Add the tile rasterizers. Both return a `TILE×TILE` canvas of the piece at a given **device** cell `dCell` for tile `(tx,ty)`. Additive — nothing calls them yet.

**Files:** Modify `render.js`.

- [ ] **Step 1: Add the rasterizers** after the existing `rasterSeamless` (or after `buildTileCanvas`/`fillPattern`). Read `render.js` to place them near the other raster helpers; they use the existing module-local `ctx`/`setCtx`/`drawGrid`/`buildTileCanvas`:

```js
// one 256px tile of a finite piece at device cell dCell, by slicing the grid (drawGrid clips to the tile)
function rasterTile(model, dCell, tx, ty, style, seedNum, bg, TILE){
  const c=document.createElement("canvas"); c.width=TILE; c.height=TILE;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,TILE,TILE);
  const save=ctx; setCtx(g);
  drawGrid(model, dCell, -tx*TILE, -ty*TILE, style, seedNum);
  setCtx(save);
  return c;
}
// one 256px tile of a seamless wallpaper, pattern-filled with the world-correct phase so tiles join
function rasterSeamlessTile(tileModel, dCell, tx, ty, style, seedNum, bg, TILE){
  const tile=buildTileCanvas(tileModel, dCell, style, seedNum);   // one repeat at dCell
  const c=document.createElement("canvas"); c.width=TILE; c.height=TILE;
  const g=c.getContext("2d"); g.fillStyle=bg; g.fillRect(0,0,TILE,TILE);
  const ox=((tx*TILE)%tile.width+tile.width)%tile.width, oy=((ty*TILE)%tile.height+tile.height)%tile.height;
  g.save(); g.translate(-ox,-oy);
  g.fillStyle=g.createPattern(tile,"repeat"); g.fillRect(0,0,TILE+tile.width,TILE+tile.height);
  g.restore();
  return c;
}
```

Add both to the `VY.render` export object (keep all existing members):
```js
VY.render = { drawGrid, lum, buildTileCanvas, setCtx, renderChart, rasterSeamless, rasterTile, rasterSeamlessTile };
```
(Confirm the current export line's members by reading — keep whatever is there and add `rasterTile, rasterSeamlessTile`.)

- [ ] **Step 2: Verify (node + reasoning)**

Run: `node --check render.js`
Expected: OK.

Reason through correctness (browser runtime likely unavailable in sandbox — state so): a finite tile draws the whole grid offset by `(-tx*TILE,-ty*TILE)` at `dCell`, so only cells whose `dCell`-scaled position lands in `[0,TILE)` paint; adjacent tiles share the same grid+offset math → continuous. A seamless tile fills with the repeating pattern phased by the world offset `(tx*TILE,ty*TILE) mod tile size` → continuous across tiles. Confirm the export line still lists `drawGrid, buildTileCanvas, setCtx, renderChart, rasterSeamless` plus the two new ones.

- [ ] **Step 3: Commit**

```bash
git add render.js
git commit -m "feat: tile-addressed rasterTile + rasterSeamlessTile in render.js"
```

---

## Task 3: Switch `app.js` piece + the viewport compositor to tiles

The integration. `app.js`'s `piece` exposes `rasterTile(dCell,tx,ty)` instead of `rasterAtCell(cell)`, and `viewport.js`'s raster/compositor (`rasterFor`/`reraster`/`applyTransform` + the `cell`-keyed cache) is replaced by the tiled compositor using Task 1's math + Task 2's rasterizers. After this task the app renders via tiles.

**Files:** Modify `app.js` (piece definitions), `viewport.js` (compositor).

- [ ] **Step 1: `app.js` — `piece.rasterTile`.** In `generate()`, in each branch replace the `rasterAtCell:(cl)=>...` property with a `rasterTile`. Read the three branches; the replacements are:

Fabric/seamless branch:
```js
    piece={cols:pcols, rows:prows, bg:P.bg,
           rasterTile:(dCell,tx,ty)=>VY.render.rasterSeamlessTile(tileModel,dCell,tx,ty,state.style,seedNum,P.bg,256)};
```
Non-fabric wallpaper branch and panel branch (both finite, identical shape — repeat it in each, do NOT factor out):
```js
    piece={cols:model.cols, rows:model.rows, bg:P.bg,
           rasterTile:(dCell,tx,ty)=>VY.render.rasterTile(model,dCell,tx,ty,state.style,seedNum,P.bg,256)};
```
(Leave `_exportCanvas`, `_lastTile`, `_lastModel`, dims text exactly as they are.)

- [ ] **Step 2: `viewport.js` — replace the raster/compositor core.** Replace the block from `let cache=new Map(); const CACHE_MAX=6;` through the end of `reraster()` (i.e. the `rasterFor` + `reraster` functions and the cache decl) AND the body of `applyTransform` with the tiled versions. Concretely:

Replace the `applyTransform` function (line ~44-46) with a residual-only transform:
```js
  function applyTransform(){ if(!rasterCanvas||!VP) return; const [W,H]=stageSize();
    const {S,Tx,Ty}=residualTransform(VP, renderCell, W, H);
    rasterCanvas.style.transform=`translate(${Tx}px,${Ty}px) scale(${S})`; updateHud(); }
```
Replace the `cache`/`rasterFor`/`reraster` block (lines ~47-63) with:
```js
  const TILE=256, OVER=256; let cache=new Map(); const CACHE_MAX=64; let renderCell=0;
  function tileFor(dCell,tx,ty){ const k=dCell+":"+tx+":"+ty;
    if(cache.has(k)){ const c=cache.get(k); cache.delete(k); cache.set(k,c); return c; }
    const c=PIECE.rasterTile(dCell,tx,ty);
    cache.set(k,c); while(cache.size>CACHE_MAX){ cache.delete(cache.keys().next().value); } return c;
  }
  // paint the visible tiles (+overscan) into the stage-sized canvas at the view center, using `cell`
  function retile(cell){
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    const [W,H]=stageSize(); renderCell=cell; const dCell=Math.round(cell*DPR);
    const bw=Math.round(W*DPR), bh=Math.round(H*DPR);
    if(VY.cv.width!==bw||VY.cv.height!==bh){ VY.cv.width=bw; VY.cv.height=bh; }
    VY.cv.style.width=W+"px"; VY.cv.style.height=H+"px";
    VY.ctx.setTransform(1,0,0,1,0,0); VY.ctx.clearRect(0,0,bw,bh);
    const {tx0,tx1,ty0,ty1}=tilesFor(VP.cx,VP.cy,W,H,dCell,DPR,TILE,OVER);
    for(let ty=ty0;ty<=ty1;ty++) for(let tx=tx0;tx<=tx1;tx++){
      const d=tileDest(tx,ty,VP.cx,VP.cy,W,H,dCell,DPR,TILE);
      VY.ctx.drawImage(tileFor(dCell,tx,ty), Math.round(d.x), Math.round(d.y));
    }
    rasterCanvas=VY.cv; curDeviceCell=dCell; applyTransform();
  }
```
(`rasterCanvas`, `curDeviceCell`, `DPR`, `raf` already exist. `maxCellFor` is now unused — leave it for Task 4 to delete.)

- [ ] **Step 3: `viewport.js` — point the callers at `retile`.** Update `attach`, `fit`, `settle`, `liveCommit`, `schedule` to use `retile`:

```js
  function attach(piece, restoreView){
    cache=new Map(); PIECE=piece; const [W,H]=stageSize();
    VP = restoreView ? clampView({...restoreView, fitZoom:fitView(piece,W,H).fitZoom}, piece, W,H)
                     : fitView(piece, W, H);
    retile(transformFor(VP,W,H).cell);
  }
```
```js
  function fit(){ if(!PIECE) return; const [W,H]=stageSize(); VP=fitView(PIECE,W,H); retile(transformFor(VP,W,H).cell);
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), true); }
```
```js
  function schedule(){ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; retile(renderCell); }); }   // repaint at fixed LOD during a gesture (pan = no blank, zoom = residual scale)
  function settle(){ clearTimeout(settleT); settleT=setTimeout(()=>{ const [W,H]=stageSize();
    retile(transformFor(VP,W,H).cell);                                                              // crisp at the correct LOD
    if(VY.viewport.onSettle) VY.viewport.onSettle(getView(), isFit()); }, 130); }
  function liveCommit(){ const [W,H]=stageSize(); VP=clampView(VP,PIECE,W,H); schedule(); settle(); }
```
(Delete the old `reraster`-based bodies of these. `transformFor` still provides `.cell` for choosing the LOD.)

- [ ] **Step 4: Verify (node + the load check)**

Run: `node --check viewport.js && node --check app.js`
Expected: OK.

Run the DOM-free load check (must print `LOAD OK`):
`node -e "const fs=require('fs'),vm=require('vm');const sb={Math,Object,JSON,Array,Map,console,Number,String,requestAnimationFrame:()=>0,cancelAnimationFrame:()=>0,setTimeout:()=>0,clearTimeout:()=>0,devicePixelRatio:2};sb.window=sb;sb.VY={};sb.window.VY=sb.VY;vm.createContext(sb);vm.runInContext(fs.readFileSync('viewport.js','utf8'),sb);console.log(typeof sb.VY.viewport.attach==='function'?'LOAD OK':'MISSING')"`

Confirm by reading: no remaining references to `rasterFor`, `reraster`, or `piece.rasterAtCell` in `viewport.js`/`app.js`; `attach`/`fit`/`settle`/`liveCommit`/`schedule` all call `retile`; the seed string + `writeHash`/`readHash` + `_exportCanvas` are unchanged (`git diff` shows only the intended lines).

Browser runtime verification is likely impossible in this sandbox — say so; the controller will run a full Playwright pass after deploy.

- [ ] **Step 5: Commit**

```bash
git add app.js viewport.js
git commit -m "feat: stage-sized tiled compositor + piece.rasterTile (replaces whole-piece raster)"
```

---

## Task 4: Remove dead whole-piece code + cleanup

Now that nothing rasters the whole piece, delete the leftovers.

**Files:** Modify `viewport.js` (`maxCellFor`), `render.js` (`rasterSeamless` if now unused).

- [ ] **Step 1: Remove `maxCellFor` from `viewport.js`.** First confirm it is unused after Task 3: `grep -n maxCellFor viewport.js` — it should appear only at its definition (the old `reraster`/`settle`/`liveCommit` callers were replaced). If only the definition remains, delete the `function maxCellFor(){...}` line. If any caller remains, do NOT delete — report it.

- [ ] **Step 2: Remove `rasterSeamless` from `render.js` if unused.** `grep -rn "rasterSeamless\b" *.js` (word-boundary, NOT `rasterSeamlessTile`). It should appear only at its definition + the `VY.render` export (the old `app.js` `rasterAtCell` seamless closure that used it is gone). If unused, delete the `function rasterSeamless(...)` definition and remove `rasterSeamless` from the `VY.render` export object (keep `rasterSeamlessTile`). If still referenced, leave it and report.

- [ ] **Step 3: Verify**

Run: `node --check viewport.js && node --check render.js && node --check app.js`
Expected: OK.
Run the DOM-free load check again (`LOAD OK`).
`grep` confirms `maxCellFor` and (if removed) `rasterSeamless` are gone; `rasterTile`/`rasterSeamlessTile`/`buildTileCanvas`/`drawGrid`/`renderChart`/`setCtx`/`lum` remain exported.

- [ ] **Step 4: Commit**

```bash
git add viewport.js render.js
git commit -m "cleanup: drop dead whole-piece raster path (maxCellFor, rasterSeamless)"
```

---

## Self-review notes

- **Spec coverage:** tile contract `rasterTile(cell,tx,ty)` → Task 2 (render) + Task 3 (piece); finite slice + seamless pattern-fill → Task 2; stage-sized tiled compositor + `(cell,tx,ty)` LRU + visible-window + overscan → Task 3; pure `tilesFor`/`tileDest`/`residualTransform` math (node-tested) → Task 1; uncap (drop whole-piece + `maxCellFor`/16000 clamp) → Tasks 3–4; preserved inputs/settle/hash/HUD/exports/clamp → untouched by design (verified in Task 3 Step 4); B-readiness (same signature, swap the source) → the `rasterTile` contract. All spec sections mapped.
- **Determinism:** seed string + `generate()` + `_exportCanvas` untouched; tile content is a pure function of (model, dCell, tx, ty, style, seedNum); per-stitch jitter still flows through `drawGrid`. Verified in Task 3 Step 4.
- **Type/name consistency:** `piece.rasterTile(dCell,tx,ty)`, `VY.render.rasterTile`/`rasterSeamlessTile`, `tilesFor`/`tileDest`/`residualTransform`, `retile(cell)`/`tileFor(dCell,tx,ty)`/`renderCell`, `TILE=256`/`OVER=256`/`CACHE_MAX=64` — used consistently across tasks. The cache key is `${dCell}:${tx}:${ty}` (device cell), matching `tileFor`/`tilesFor` which work in device px.
- **Staging:** app works after each task (1 + 2 additive; 3 switches piece + compositor together; 4 deletes dead code).
- **Browser-verification nature:** only Task 1's math is node-tested; the compositor is canvas-bound and gets a Playwright pass after deploy — confirming smooth gestures, **crisp/uncapped deep zoom on a 4K piece**, no blank within overscan on normal pans, unchanged share-links + exports, mobile drawer/accordion intact, 0 console errors. The compositor constants (`TILE`, `OVER`, settle 130ms) may want a tuning pass during that verification.
