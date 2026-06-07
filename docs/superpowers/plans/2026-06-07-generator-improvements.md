# Vyshyvanka Generator Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-file generator into LAMP-served relative-linked assets, then add five improvements: hero motifs, seamless fabric + tile export, stitch/aida realism, counted-stitch chart with DMC mapping, and favorites/undo/accessibility.

**Architecture:** One HTML file is split into `index.html` + `styles.css` + four classic (non-module) scripts (`data.js`, `generator.js`, `render.js`, `app.js`) that share a single global `VY` namespace; load order is the only coupling. New features layer onto the existing grid-model pipeline (config → grid construction → canvas render) without changing the determinism contract.

**Tech Stack:** Plain HTML/CSS/ES2017 JavaScript, Canvas 2D, `localStorage`. No build step, bundler, framework, or test runner. Served as static assets over Apache/LAMP.

---

## Testing approach (read first)

There is no automated test runner. Every task's verification is a **manual browser check**. Run the site locally with any static server from the repo root, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

(`file://` also works for classic scripts, but use the server to mirror LAMP.)

**The determinism check** (run after any task that touches output): load a design, click around to note the canvas, then paste the same URL (with its `#hash`) into a fresh tab — the rendered pattern MUST be pixel-identical. A quick programmatic version, runnable in DevTools console:

```js
// deterministic? same seed string -> same first-1000 grid cells
VY.app.generate(false);
const a = VY.cv.toDataURL();
VY.app.generate(false);
const b = VY.cv.toDataURL();
console.assert(a === b, "NON-DETERMINISTIC render");
```

Keep `VY.cv` (the canvas) and `VY.app.generate` exposed on the namespace so this check works.

---

## Task 1: Restructure into six files (behavior-preserving)

No new behavior. Move the existing code out of `vyshyvanka-generator.html` into separate assets under a single `VY` namespace, verify the app behaves identically, then commit.

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `data.js`
- Create: `generator.js`
- Create: `render.js`
- Create: `app.js`
- Keep: `vyshyvanka-generator.html` for now (deleted in the final step of this task)

**Code mapping** (source line ranges refer to current `vyshyvanka-generator.html`):

- `styles.css` ← contents of `<style>` (lines 11–96), verbatim.
- `data.js` ← `REGIONS` + `applyBg` (lines 201–227). Wrap so they live on the namespace:
  ```js
  window.VY = window.VY || {};
  VY.REGIONS = { /* ...existing object... */ };
  VY.applyBg = function applyBg(P, bg) { /* ...existing body... */ };
  ```
- `generator.js` ← RNG + helpers (lines 189–199), grid helpers (229–235), motif engine (243–302), bands (304–346), panel composition (348–364), wallpaper composition (366–424). Keep `RNG`/`CFG` but hang the exported entry points on `VY`:
  ```js
  window.VY = window.VY || {};
  // keep module-local: hashStr, mulberry32, RNG, ri, pick, chance, shuffle, CFG, newGrid, blit, transpose, buildTheme, makeMotif, makeFiller, bands...
  VY.gen = { composeWallpaper, composePanel, sampler, setSeed, setConfig };
  ```
  Add two small helpers so `app.js` can drive generation without globals leaking:
  ```js
  VY.gen.setSeed = (str) => { RNG = mulberry32(hashStr(str)); };
  VY.gen.setConfig = (cfg) => { Object.assign(CFG, cfg); };
  ```
- `render.js` ← canvas refs + `lum` + `drawGrid` + `fitPreview` + resize handler (lines 427–449). Expose:
  ```js
  window.VY = window.VY || {};
  VY.cv = document.getElementById("cv");
  VY.ctx = VY.cv.getContext("2d");
  VY.render = { drawGrid, fitPreview, lum };
  ```
- `app.js` ← constants + state + UI build + `syncUI` + `generate` + hash + events + boot (lines 451–560). Replace direct calls to moved functions with namespaced ones (`VY.gen.*`, `VY.render.*`, `VY.applyBg`, `VY.REGIONS`). Expose `VY.app = { generate, state }`.
- `index.html` ← the `<body>` markup (lines 98–185) plus this head/script wiring:
  ```html
  <link rel="stylesheet" href="styles.css" />
  <!-- before </body>, in this exact order: -->
  <script src="data.js"></script>
  <script src="generator.js"></script>
  <script src="render.js"></script>
  <script src="app.js"></script>
  ```

- [ ] **Step 1: Create `styles.css`** by moving the `<style>` body out of the HTML verbatim.

- [ ] **Step 2: Create `data.js`** with `VY.REGIONS` and `VY.applyBg` as mapped above.

- [ ] **Step 3: Create `generator.js`** with the moved generation code, adding `VY.gen.setSeed` and `VY.gen.setConfig`, and exposing `VY.gen` entry points.

- [ ] **Step 4: Create `render.js`** with the moved render code exposing `VY.cv`, `VY.ctx`, `VY.render`.

- [ ] **Step 5: Create `app.js`** with the moved app code, repointing calls at `VY.*`, exposing `VY.app`. In `generate()`, replace the inline `RNG=mulberry32(hashStr(...))` with `VY.gen.setSeed(<the same string>)` and the `CFG.*=...` assignments with a `VY.gen.setConfig({...})` call.

- [ ] **Step 6: Create `index.html`** with the moved markup + the `<link>` and ordered `<script>` tags.

- [ ] **Step 7: Verify behavior is identical**

Run: `python3 -m http.server 8000`, open `http://localhost:8000/index.html`.
Expected: app loads with the same default Hutsul pattern; changing Region/Complexity/Variety/Layout/Seed all re-render; "New design", "Download PNG", "Copy link" all work; no console errors. Run the determinism console check above — passes.

- [ ] **Step 8: Delete the old monolith**

```bash
git rm vyshyvanka-generator.html
```

- [ ] **Step 9: Commit**

```bash
git add index.html styles.css data.js generator.js render.js app.js
git commit -m "refactor: split single-file generator into VY-namespaced assets"
```

---

## Task 2: Stitch & fabric rendering realism

Add aida-cloth texture, per-stitch shading, and deterministic per-stitch jitter to `drawGrid`. Jitter is hashed from `(x, y, seed)` so reloads stay identical.

**Files:**
- Modify: `render.js` (`drawGrid`)
- Modify: `app.js` (pass the active seed string into render for jitter)

- [ ] **Step 1: Add color + hash helpers to `render.js`** (module-local, above `drawGrid`):

```js
function hex2rgb(h){const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function rgb2css(r,g,b){return `rgb(${r|0},${g|0},${b|0})`;}
function shade(hex,f){const[r,g,b]=hex2rgb(hex);return f>=0?rgb2css(r+(255-r)*f,g+(255-g)*f,b+(255-b)*f):rgb2css(r*(1+f),g*(1+f),b*(1+f));}
// deterministic per-cell jitter in [-amt,amt], seeded by (x,y,seedNum)
function cellJitter(x,y,seedNum,amt){let h=(x*73856093)^(y*19349663)^seedNum;h=Math.imul(h^(h>>>13),1274126177);return((((h>>>0)/4294967296)*2-1)*amt);}
```

- [ ] **Step 2: Add a woven aida-texture pass and per-stitch shading to `drawGrid`.** Replace the existing faint-dot loop and the per-cell stroke/fill blocks. `drawGrid` gains a `seedNum` argument (a 32-bit number from the current seed string).

```js
function drawGrid(model, cell, ox, oy, style, seedNum){
  const {grid, cols, rows, palette} = model, ins = cell*0.13, lw = Math.max(1, cell*0.26);
  // --- aida weave (only when cells are big enough to read) ---
  if (cell >= 5){
    const dark = lum(palette.bg) > 0.5;
    ctx.fillStyle = dark ? "rgba(90,70,40,.07)" : "rgba(240,231,214,.06)";
    for (let y=0;y<rows;y++) for (let x=0;x<cols;x++){
      const cx = ox+x*cell, cy = oy+y*cell, hole = Math.max(1, cell*0.16);
      ctx.fillRect(cx+cell/2-hole/2, cy+cell/2-hole/2, hole, hole); // weave hole
    }
  }
  ctx.lineCap = "round";
  for (let y=0;y<rows;y++){ const r = grid[y];
    for (let x=0;x<cols;x++){ const val = r[x]; if(!val) continue;
      const base = palette.threads[val-1];
      const j = cellJitter(x, y, seedNum, 0.10);   // ±10% lightness
      const col = shade(base, j*0.5);
      const X = ox+x*cell, Y = oy+y*cell;
      if (style === "x"){
        // dark base leg then offset highlight leg = raised-floss look
        ctx.lineWidth = lw;
        ctx.strokeStyle = shade(base, -0.28);
        ctx.beginPath();
        ctx.moveTo(X+ins,Y+ins); ctx.lineTo(X+cell-ins,Y+cell-ins);
        ctx.moveTo(X+cell-ins,Y+ins); ctx.lineTo(X+ins,Y+cell-ins); ctx.stroke();
        ctx.lineWidth = lw*0.6; ctx.strokeStyle = col;
        const o = lw*0.18;
        ctx.beginPath();
        ctx.moveTo(X+ins-o,Y+ins-o); ctx.lineTo(X+cell-ins-o,Y+cell-ins-o);
        ctx.moveTo(X+cell-ins-o,Y+ins-o); ctx.lineTo(X+ins-o,Y+cell-ins-o); ctx.stroke();
      } else {
        ctx.fillStyle = shade(base, -0.18);
        ctx.fillRect(X+ins, Y+ins, cell-2*ins, cell-2*ins);
        ctx.fillStyle = col;
        ctx.fillRect(X+ins, Y+ins, (cell-2*ins)*0.78, (cell-2*ins)*0.78);
      }
    }
  }
}
```

- [ ] **Step 3: Pass the seed number from `app.js`.** Compute `const seedNum = (s => {let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;})(state.seed);` in `generate()` and pass it as the final arg to both `VY.render.drawGrid(...)` calls. (Reuse the existing `hashStr` by exposing it as `VY.gen.hashStr` if preferred.)

- [ ] **Step 4: Verify in browser**

Open the site. Expected: stitches now show a subtle 3D/highlighted look and faint woven texture; pattern still reads clearly at all scales; toggling "Filled" style also shows shading. Run the determinism console check — passes (jitter is seed-derived, not `RNG`).

- [ ] **Step 5: Commit**

```bash
git add render.js app.js
git commit -m "feat: aida texture + per-stitch shading with deterministic jitter"
```

---

## Task 3: Seamless fabric layout + tile export

Make the `fabric` layout a true wrap-around tile rendered via `createPattern`, and add a "Download tile" button.

**Files:**
- Modify: `generator.js` (`blit` wrap option; new `composeFabricTile`)
- Modify: `render.js` (pattern fill path; tile-canvas builder)
- Modify: `index.html` (Download tile button)
- Modify: `app.js` (wire the button; route fabric layout through the tile path)

- [ ] **Step 1: Add a wrapping blit to `generator.js`** (do not change existing `blit`):

```js
function blitWrap(dst,src,ox,oy){ const H=dst.length,W=dst[0].length;
  for(let y=0;y<src.length;y++){const r=src[y];for(let x=0;x<r.length;x++){if(r[x]){
    dst[((oy+y)%H+H)%H][((ox+x)%W+W)%W]=r[x];}}}}
```

- [ ] **Step 2: Add `composeFabricTile` to `generator.js`** producing one torus-tileable grid. It mirrors the current `fabric` motif/lattice logic but on a fixed `period_x × period_y` grid using `blitWrap`:

```js
function composeFabricTile(scaleKey){
  const P=CFG.P, v=CFG.variety;
  const mm=[9,11,13][{small:0,medium:1,large:2}[scaleKey]];
  const gap=Math.max(2,Math.round(mm*0.35)), period=mm+gap;
  const latt=pick(v>0.5?["straight","brick","diamond"]:["straight","brick"]);
  const cols=latt==="straight"?period:period*2;             // 2 cols so brick/diamond tiles
  const rows=latt==="diamond"?Math.max(period, Math.round(period*1.1)):period;
  const grid=newGrid(cols,rows);
  const setN=Math.max(1,1+Math.round(v*3)), motifs=[];
  for(let i=0;i<setN;i++) motifs.push(VY.gen.makeMotif(mm)); // hero-aware in Task 4
  const filler=(CFG.dens>=3||v>0.45)?makeFiller():null;
  let row=0;
  for(let gy=0; gy<rows; gy+=period, row++){
    const off=(latt!=="straight"&&row%2)?Math.round(period/2):0;
    let i=0;
    for(let gx=off; gx<cols; gx+=period, i++){
      const idx=(row+i)%setN;
      blitWrap(grid, motifs[idx], gx, gy);
      if(filler) blitWrap(grid, filler, gx+Math.round(period/2), gy+Math.round(period/2));
    }
  }
  return {grid,cols,rows,palette:P};
}
VY.gen.composeFabricTile = composeFabricTile;
VY.gen.makeMotif = makeMotif; // expose for reuse
```

- [ ] **Step 3: Add a tile-canvas builder + pattern fill to `render.js`:**

```js
function buildTileCanvas(model, cell, style, seedNum){
  const c=document.createElement("canvas");
  c.width=model.cols*cell; c.height=model.rows*cell;
  const tctx=c.getContext("2d");
  tctx.fillStyle=model.palette.bg; tctx.fillRect(0,0,c.width,c.height);
  const save=ctx; // drawGrid uses module ctx; temporarily retarget
  setCtx(tctx); drawGrid(model, cell, 0, 0, style, seedNum); setCtx(save);
  return c;
}
function fillPattern(W,H,tileCanvas){
  const p=ctx.createPattern(tileCanvas,"repeat");
  ctx.fillStyle=p; ctx.fillRect(0,0,W,H);
}
VY.render.buildTileCanvas=buildTileCanvas;
VY.render.fillPattern=fillPattern;
```

Add a tiny `setCtx` so `drawGrid` can be retargeted: declare `let ctx = VY.ctx;` (already module-level) and `function setCtx(c){ctx=c;} VY.render.setCtx=setCtx;`.

- [ ] **Step 4: Route the fabric layout through tiling in `app.js` `generate()`.** When `state.mode==="wallpaper" && state.layout==="fabric"`:

```js
const tileModel = VY.gen.composeFabricTile(state.scale);
const cell = /* same cell calc as composeWallpaper */;
const tileCanvas = VY.render.buildTileCanvas(tileModel, cell, state.style, seedNum);
cv.width=W; cv.height=H; ctx.setTransform(1,0,0,1,0,0);
ctx.fillStyle=P.bg; ctx.fillRect(0,0,W,H);
VY.render.fillPattern(W,H,tileCanvas);
VY.render.fitPreview(W,H);
VY.app._lastTile = tileCanvas;  // for tile download
```
Non-fabric layouts keep the existing `composeWallpaper` path.

- [ ] **Step 5: Add the button to `index.html`** in the `.row` under the PNG/share buttons:

```html
<button id="tile">Download tile</button>
```

- [ ] **Step 6: Wire the button in `app.js`:**

```js
document.getElementById("tile").onclick=()=>{
  if(!VY.app._lastTile){alert("Tile export is available for the Seamless layout.");return;}
  const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_tile_${state.seed}.png`;
  a.href=VY.app._lastTile.toDataURL("image/png"); a.click();
};
```

- [ ] **Step 7: Verify in browser**

Select Wallpaper → Seamless. Expected: pattern fills the canvas with no seams/clipping at edges (motifs continue across boundaries). "Download tile" saves a small PNG that, set as a repeated CSS background, tiles with no visible seam. Switching to other layouts still works. Determinism check passes.

- [ ] **Step 8: Commit**

```bash
git add generator.js render.js index.html app.js
git commit -m "feat: true seamless fabric layout via wrap-around tile + tile PNG export"
```

---

## Task 4: Hero motifs

Add a `HERO_MOTIFS` chart library and mix it into the per-generation motif pool, with the Variety slider controlling the hero/procedural ratio.

**Files:**
- Modify: `data.js` (`VY.HERO_MOTIFS`)
- Modify: `generator.js` (`pickMotif` selector; route motif creation through it)

- [ ] **Step 1: Research and transcribe charts.** Web-search documented regional motifs (eight-point star/ruža, rhombus-with-hooks, kalyna, oak, poppy, Hutsul polychrome rosette). For each, hand-transcribe a small odd-sized grid using **semantic slots** (0 empty, 1 primary, 2 secondary, 3 accent). Record the source URL in a comment for honesty. Add to `data.js`:

```js
window.VY = window.VY || {};
// Best-effort INTERPRETATIONS of documented motifs, not exact reproductions.
VY.HERO_MOTIFS = [
  { id:"eight-point-star", regions:["hutsul","bukovyna","polissia"], src:"<url>", grid:[
    [0,0,0,1,0,0,0],
    [0,2,0,1,0,2,0],
    [0,0,3,1,3,0,0],
    [1,1,1,1,1,1,1],
    [0,0,3,1,3,0,0],
    [0,2,0,1,0,2,0],
    [0,0,0,1,0,0,0],
  ]},
  // ...~10-15 total; tag each with applicable regions ([] = any region)
];
```
(The grid above is the literal seed example; add the rest from research, each odd-sized and square.)

- [ ] **Step 2: Add the semantic-slot remapper + selector to `generator.js`:**

```js
// map semantic slots (1=primary,2=secondary,3=accent) -> palette thread indices
function remapHero(g){
  const P=CFG.P, slot=[0, P.colorBias[0]+1, (P.colorBias[1]??P.colorBias[0])+1, P.threads.length];
  return g.map(row=>{const r=new Int8Array(row.length);
    for(let x=0;x<row.length;x++){const s=row[x]; r[x]=s?slot[Math.min(s,3)]:0;} return r;});
}
function heroForRegion(region){
  return (VY.HERO_MOTIFS||[]).filter(h=>!h.regions.length||h.regions.includes(region));
}
// unified motif source: hero vs procedural, ratio driven by Variety
function pickMotif(m){
  const v=CFG.variety, pool=heroForRegion(CFG.region);
  // low variety -> favor clean hero motifs; high variety -> favor procedural
  const useHero = pool.length && RNG() > (0.25 + v*0.6);
  if(useHero){ return remapHero(pick(pool).grid); }
  return makeMotif(m);
}
VY.gen.pickMotif = pickMotif;
```

- [ ] **Step 3: Record `CFG.region` and route callers.** In `setConfig`/`generate` ensure `CFG.region` is set (add `region: state.region` to the `setConfig` object in `app.js`). Replace the motif-creation calls that should be hero-aware — in `composeFabricTile` (Task 3 Step 2), `mainBand`, `sampler`, and the wallpaper `bordered`/`medallion`/`runner` motif spots — with `pickMotif(m)` where a full motif (not a band primitive) is wanted. Leave `makeFiller` and band generators as-is.

Note: hero grids are fixed-size; when a caller needs size `m`, `pickMotif` may return a differently-sized grid. `blit`/`blitWrap` already clip safely, and placement math centers by the caller's `m`, so a hero motif simply occupies its own footprint. Acceptable for this toy.

- [ ] **Step 4: Verify in browser**

Set Variety low (≈10%): expect clean, repeated recognizable motifs (the hero charts) dominating. Set Variety high (≈90%): expect more procedural/varied motifs. Switch regions: hero motifs recolor to each palette. Determinism check passes (selection uses `RNG`).

- [ ] **Step 5: Commit**

```bash
git add data.js generator.js app.js
git commit -m "feat: hero motif library mixed into procedural pool by variety"
```

---

## Task 5: Counted-stitch chart + DMC mapping

Embed a DMC floss table, map palette colors to nearest DMC, and add a chart render + "Download chart" button.

**Files:**
- Modify: `data.js` (`VY.DMC`)
- Modify: `generator.js` (`nearestDMC`)
- Modify: `render.js` (`renderChart`)
- Modify: `index.html` (Download chart button)
- Modify: `app.js` (wire button; build chart from current grid model)

- [ ] **Step 1: Embed a DMC table in `data.js`.** Add a representative set (start with ~60–80 common floss colors; expandable). Each entry `{code, name, hex}`:

```js
window.VY = window.VY || {};
VY.DMC = [
  {code:"310", name:"Black",        hex:"#000000"},
  {code:"blanc", name:"White",      hex:"#ffffff"},
  {code:"321", name:"Red",          hex:"#c72b3b"},
  {code:"498", name:"Dark Red",     hex:"#a7283a"},
  {code:"666", name:"Bright Red",   hex:"#e31d42"},
  {code:"783", name:"Med Topaz",    hex:"#cc9900"},
  {code:"729", name:"Med Old Gold", hex:"#c9a356"},
  {code:"890", name:"Ultra Dk Pistachio", hex:"#1b4a2b"},
  {code:"909", name:"Emerald",      hex:"#2b7a4b"},
  {code:"720", name:"Dk Orange Spice", hex:"#ca5a23"},
  {code:"333", name:"Blue Violet",  hex:"#5c5096"},
  {code:"3371", name:"Black Brown", hex:"#1e1208"},
  {code:"413", name:"Dk Pewter Grey", hex:"#565656"},
  {code:"318", name:"Lt Steel Grey", hex:"#999999"},
  {code:"822", name:"Lt Beige Grey", hex:"#e8e0cf"},
  // ...continue to ~60-80 entries spanning the palette gamut
];
```

- [ ] **Step 2: Add nearest-match to `generator.js`:**

```js
function nearestDMC(hex){
  const t=hex2rgbG(hex); let best=null, bd=Infinity;
  for(const f of (VY.DMC||[])){const c=hex2rgbG(f.hex);
    const d=(c[0]-t[0])**2+(c[1]-t[1])**2+(c[2]-t[2])**2;
    if(d<bd){bd=d; best=f;}}
  return best;
}
function hex2rgbG(h){if(h.toLowerCase()==="blanc")return[255,255,255];
  const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
VY.gen.nearestDMC = nearestDMC;
```

- [ ] **Step 3: Add `renderChart` to `render.js`.** Draws the supplied grid model as a counted chart onto a fresh canvas and returns it. Symbols come from a fixed set indexed by thread.

```js
const CHART_SYMBOLS = ["✚","◆","▲","●","■","✖","★","◐","◢","✦","◇","▼"];
function renderChart(model){
  const {grid,cols,rows,palette}=model;
  const cell=18, padL=46, padT=46, legendH=24*(palette.threads.length)+40;
  const c=document.createElement("canvas");
  c.width=padL+cols*cell+20; c.height=padT+rows*cell+legendH;
  const g=c.getContext("2d");
  g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height);
  g.textAlign="center"; g.textBaseline="middle"; g.font=`${cell-4}px monospace`;
  // count stitches per thread
  const counts=new Array(palette.threads.length+1).fill(0);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const v=grid[y][x]; if(v){counts[v]++;
    g.fillStyle="#222"; g.fillText(CHART_SYMBOLS[(v-1)%CHART_SYMBOLS.length], padL+x*cell+cell/2, padT+y*cell+cell/2);}}
  // grid lines, bold every 10
  for(let x=0;x<=cols;x++){g.strokeStyle=(x%10===0)?"#333":"#ccc"; g.lineWidth=(x%10===0)?1.4:0.5;
    g.beginPath(); g.moveTo(padL+x*cell,padT); g.lineTo(padL+x*cell,padT+rows*cell); g.stroke();}
  for(let y=0;y<=rows;y++){g.strokeStyle=(y%10===0)?"#333":"#ccc"; g.lineWidth=(y%10===0)?1.4:0.5;
    g.beginPath(); g.moveTo(padL,padT+y*cell); g.lineTo(padL+cols*cell,padT+y*cell); g.stroke();}
  // row/col numbers every 10
  g.fillStyle="#555"; g.font="11px monospace";
  for(let x=0;x<=cols;x+=10) g.fillText(String(x), padL+x*cell, padT-12);
  for(let y=0;y<=rows;y+=10) g.fillText(String(y), padL-22, padT+y*cell);
  // legend
  let ly=padT+rows*cell+28; g.textAlign="left";
  for(let i=1;i<=palette.threads.length;i++){
    if(!counts[i]) continue;
    const dmc=VY.gen.nearestDMC(palette.threads[i-1]);
    g.fillStyle=palette.threads[i-1]; g.fillRect(padL, ly-9, 18, 18);
    g.strokeStyle="#333"; g.strokeRect(padL, ly-9, 18, 18);
    g.fillStyle="#222"; g.font="14px monospace"; g.textAlign="center";
    g.fillText(CHART_SYMBOLS[(i-1)%CHART_SYMBOLS.length], padL+34, ly);
    g.textAlign="left";
    g.fillText(`DMC ${dmc?dmc.code:"?"} — ${dmc?dmc.name:""}  ×${counts[i]}`, padL+52, ly);
    ly+=24;
  }
  return c;
}
VY.render.renderChart = renderChart;
```

- [ ] **Step 4: Add the button to `index.html`** (next to tile/PNG):

```html
<button id="chart">Download chart</button>
```

- [ ] **Step 5: Wire it in `app.js`.** Build the *grid model* for the current design (reuse the model already computed in `generate()` — stash it as `VY.app._lastModel`; for the fabric layout use the tile model), then:

```js
document.getElementById("chart").onclick=()=>{
  const model=VY.app._lastModel;
  if(!model){return;}
  const c=VY.render.renderChart(model);
  const a=document.createElement("a");
  a.download=`vyshyvanka_${state.region}_chart_${state.seed}.png`;
  a.href=c.toDataURL("image/png"); a.click();
};
```
In `generate()`, set `VY.app._lastModel = model;` (or the tile model for fabric) right after composition.

- [ ] **Step 6: Verify in browser**

Generate any design, click "Download chart". Expected: PNG with a white numbered grid, one symbol per color per occupied cell, bold lines every 10 cells, edge numbers, and a legend listing each used color with its symbol, nearest DMC code/name, and stitch count. Switch regions/backgrounds — DMC codes change to track the palette.

- [ ] **Step 7: Commit**

```bash
git add data.js generator.js render.js index.html app.js
git commit -m "feat: counted-stitch chart export with nearest-DMC floss mapping"
```

---

## Task 6: Favorites, undo, and accessibility

**Files:**
- Modify: `index.html` (favorites strip container; undo button; aria attributes)
- Modify: `styles.css` (favorites strip + chip styles)
- Modify: `app.js` (favorites persistence, undo stack, aria sync)

- [ ] **Step 1: Add markup to `index.html`.** Under the buttons block:

```html
<div class="row">
  <button id="save">★ Save</button>
  <button id="undo">↶ Undo</button>
</div>
<div id="favs" class="favs" aria-label="Saved designs"></div>
```
Add `aria-valuetext` is set dynamically (Step 5); add `role="radiogroup"` to each `.seg` container in markup, e.g. `<div class="seg" id="layoutSeg" role="radiogroup" aria-label="Layout"></div>` (do this for modeSeg, layoutSeg, bgSeg, scaleSeg, shapeSeg, styleSeg).

- [ ] **Step 2: Add styles to `styles.css`:**

```css
.favs{display:flex;gap:6px;flex-wrap:wrap}
.favs .fav{position:relative;width:54px;height:36px;border:1px solid var(--line);
  border-radius:6px;overflow:hidden;cursor:pointer;padding:0;background:#000}
.favs .fav img{width:100%;height:100%;object-fit:cover;display:block}
.favs .fav .rm{position:absolute;top:0;right:0;background:rgba(0,0,0,.6);color:#fff;
  font-size:10px;line-height:1;padding:1px 3px;border:0;border-radius:0 0 0 4px}
```

- [ ] **Step 3: Add favorites persistence in `app.js`:**

```js
const FAV_KEY="vy_favorites";
const loadFavs=()=>{try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch{return[];}};
const saveFavs=(f)=>localStorage.setItem(FAV_KEY,JSON.stringify(f));
function renderFavs(){
  const wrap=document.getElementById("favs"); wrap.innerHTML="";
  loadFavs().forEach((f,idx)=>{
    const b=document.createElement("button"); b.className="fav"; b.title=f.seed;
    const img=document.createElement("img"); img.src=f.thumb; img.alt=`${f.region} ${f.seed}`;
    const rm=document.createElement("button"); rm.className="rm"; rm.textContent="✕";
    rm.onclick=(e)=>{e.stopPropagation();const arr=loadFavs();arr.splice(idx,1);saveFavs(arr);renderFavs();};
    b.appendChild(img); b.appendChild(rm);
    b.onclick=()=>{Object.assign(state,f.state);syncUI();generate();};
    wrap.appendChild(b);
  });
}
document.getElementById("save").onclick=()=>{
  const thumb=cv.toDataURL("image/png");           // small preview source
  const arr=loadFavs();
  arr.unshift({seed:state.seed, region:state.region, state:{...state}, thumb});
  saveFavs(arr.slice(0,12)); renderFavs();
};
```

- [ ] **Step 4: Add the undo stack in `app.js`.** Push a snapshot before each design-changing action:

```js
const HIST=[]; let restoring=false;
function pushHistory(){ if(restoring) return; HIST.push(JSON.stringify(state)); if(HIST.length>30) HIST.shift(); }
document.getElementById("undo").onclick=()=>{
  if(HIST.length<2){return;} HIST.pop();           // discard current
  const prev=JSON.parse(HIST[HIST.length-1]);
  restoring=true; Object.assign(state,prev); syncUI(); generate(); restoring=false;
};
```
Call `pushHistory()` at the top of `generate()` (guarded by `restoring`).

- [ ] **Step 5: Accessibility sync in `app.js` `syncUI()`.** After setting slider values:

```js
const cx=document.getElementById("complexity");
cx.setAttribute("aria-valuetext", `Complexity ${state.complexity} of 5`);
const vy=document.getElementById("variety");
vy.setAttribute("aria-valuetext", `Variety ${state.variety} percent`);
```
And where seg buttons get their `on` class, also set `b.setAttribute("aria-checked", String(isOn))` and `b.setAttribute("role","radio")`.

- [ ] **Step 6: Call `renderFavs()` at boot** (after `syncUI(); generate(false);`).

- [ ] **Step 7: Verify in browser**

Click "★ Save" → a thumbnail chip appears; reload the page → chip persists (localStorage); click chip → that design restores. Click "New design" then "↶ Undo" → previous design returns. Tab through controls → focus visible; inspect a slider → `aria-valuetext` present; inspect a seg button → `role="radio"` + `aria-checked`.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: favorites (localStorage), undo history, and a11y attributes"
```

---

## Task 7: Disclaimer rework

Update both the in-app text and the README to honestly reflect that the generator now includes best-effort interpretations of documented motifs.

**Files:**
- Modify: `index.html` (`.disclaimer` block)
- Modify: `README.md`

- [ ] **Step 1: Update the in-app `.disclaimer` in `index.html`:**

```html
<div class="disclaimer">
  <b>Interpretations, not authenticity.</b> A formal/structural toy. It now
  includes <i>best-effort interpretations of</i> documented regional motifs
  (alongside procedural ones) — these are <b>not</b> exact reproductions of
  traditional charts and make <b>no claim</b> of authoritative symbolic meaning.
</div>
```

- [ ] **Step 2: Update README.md.** Replace the "Important: this is not an authenticity tool" paragraph so it states the generator includes best-effort interpretations of documented motifs, not exact reproductions, and update the "Ideas / backlog" list to check off the now-implemented items (hero motifs, counted-stitch chart, favorites).

- [ ] **Step 3: Verify**

Open the site → disclaimer reads the new text. `README.md` renders with the updated framing.

- [ ] **Step 4: Commit**

```bash
git add index.html README.md
git commit -m "docs: rework disclaimer for best-effort motif interpretations"
```

---

## Self-review notes

- **Spec coverage:** restructure (Task 1), Feature 3 realism (Task 2), Feature 2 seamless+tile (Task 3), Feature 1 hero motifs (Task 4), Feature 4 chart+DMC (Task 5), Feature 5 favorites/undo/a11y (Task 6), disclaimer rework (Task 7). All spec sections mapped.
- **Determinism:** Tasks 2 (seed-hashed jitter) and 4 (RNG-driven selection) both preserve the contract; the determinism console check is repeated in each output-affecting task's verification. No new *user-facing control* is added except buttons that don't alter the seeded output (downloads/favorites/undo), so no `generate()` seed-string or hash-param changes are required — confirmed against the spec's cross-cutting rule.
- **Type/name consistency:** `VY.gen.makeMotif`, `VY.gen.pickMotif`, `VY.gen.nearestDMC`, `VY.render.drawGrid(…, seedNum)`, `VY.render.buildTileCanvas`, `VY.render.renderChart`, `VY.app._lastModel`/`_lastTile`, `cellJitter`, `remapHero`, `hex2rgbG` used consistently across tasks.
- **Ordering caveat:** `composeFabricTile` (Task 3) references `VY.gen.makeMotif`; it is switched to `pickMotif` in Task 4 Step 3 — noted there explicitly.
