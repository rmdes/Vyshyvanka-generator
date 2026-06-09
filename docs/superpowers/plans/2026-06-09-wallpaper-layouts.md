# Wallpaper Layouts Implementation Plan (cycle 3c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new finite wallpaper layouts (Scattered, Diagonal, Wreath) to `composeWallpaper` and remove its dead `fabric` branch.

**Architecture:** Additive — three new `else if` branches in `composeWallpaper` that place existing motifs (`pickMotif`/`makeMotif`) on the finite canvas; `layout` is already in the seed, so existing wallpaper links are byte-identical. The unreachable `fabric` branch (fabric routes to `composeFabricTile`) is deleted. `LAYOUTS` in app.js gains the three values; the `#layoutSeg` buttons auto-build.

**Tech Stack:** Plain ES2017 JS, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/wallpaper-layouts` off `main` (incl. 3a+3b).

---

## Conventions

No test runner. `composeWallpaper` is a generator function testable in a Node `vm` sandbox (reads `CFG` via `setConfig`, consumes the seeded module RNG). The app/UI is DOM-bound → `node --check` + grep here, live Playwright after deploy. Temp tests `/tmp`, never committed.

**Back-compat:** the new layouts are new `layout` values (additive); reachable layouts (bordered/runner/medallion/fabric) are unchanged. Removing the dead `fabric` branch from `composeWallpaper` doesn't change any reachable output (generate() routes fabric to `composeFabricTile`). Confirmed live via a cross-check against production.

**Generator harness** (`/tmp/vy_wl_test.js` preamble; run; delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,Number,String,Map};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const TP={name:'t',bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
const cfg0=()=>{ VY.gen.setSeed('w'); VY.gen.setConfig({P:TP,region:'',variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,lattice:'auto',spacing:'normal',panelSize:'medium'}); };
const content=(m)=>{let n=0;for(const r of m.grid)for(const x of r)if(x)n++;return n;};
const dump=(m)=>JSON.stringify(m.grid.map(r=>Array.from(r)));
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

---

## Task 1: `generator.js` — remove dead fabric branch + add 3 layouts

**Files:** Modify `generator.js` (`composeWallpaper`, lines ~358-416).

- [ ] **Step 1: Delete the dead `fabric` branch.** In `composeWallpaper`, remove the entire `if(layout==="fabric"){ … }` block (the ~20 lines from `if(layout==="fabric"){` through its closing `}`), and change the following `else if(layout==="bordered"){` to `if(layout==="bordered"){`. The setup lines above (`const P=…m=[7,9,9,11,13][dens-1];`) and the `bordered`/`runner`/`else`(medallion) branches + the final `return {grid,cols,rows,cell,palette:P,W,H};` stay exactly as-is.

- [ ] **Step 2: Add the three new branches** between the `runner` branch and the final `else` (medallion). Insert:
```js
  else if(layout==="diagonal"){
    const mm=m+2, gap=Math.max(3,Math.round(mm*(0.35+v*0.3))), step=mm+gap, dshift=Math.max(2,Math.round(step/3));
    let row=0;
    for(let gy=-mm; gy<rows; gy+=step, row++){
      const shift=(row*dshift)%step;
      for(let gx=-mm+shift-step; gx<cols; gx+=step) blit(grid,pickMotif(mm),gx,gy);
    }
  }
  else if(layout==="scattered"){
    const mm=m+2, gap=Math.max(4,Math.round(mm*0.6)), step=mm+gap, jit=Math.max(1,Math.floor(gap*0.45));
    for(let gy=2; gy+mm<=rows; gy+=step) for(let gx=2; gx+mm<=cols; gx+=step)
      blit(grid,pickMotif(mm),gx+ri(-jit,jit),gy+ri(-jit,jit));
  }
  else if(layout==="wreath"){
    const cx=cols/2, cy=rows/2, R=Math.round(Math.min(cols,rows)*0.32), count=Math.max(8,6+dens*2);
    const big=(Math.round(Math.min(cols,rows)*0.26)|1);
    blit(grid,makeMotif(big),Math.round(cx-big/2),Math.round(cy-big/2));
    for(let i=0;i<count;i++){const a=i/count*2*Math.PI;
      blit(grid,pickMotif(m),Math.round(cx+Math.cos(a)*R-m/2),Math.round(cy+Math.sin(a)*R-m/2));}
  }
```
(`jit=floor(gap*0.45)` → `2·jit < gap` so scattered motifs never overlap. `makeMotif`/`pickMotif`/`blit`/`ri` are all in scope.)

- [ ] **Step 3: Test** — `/tmp/vy_wl_test.js` (harness +):
```js
// reachable + new layouts all produce content and are deterministic
['bordered','runner','medallion','diagonal','scattered','wreath'].forEach(L=>{
  cfg0(); const a=VY.gen.composeWallpaper(800,600,L,'medium');
  assert(a&&a.grid&&a.cols>0&&a.rows>0&&a.palette===TP&&a.W===800&&a.H===600, L+' valid model');
  assert(content(a)>0, L+' has content');
  cfg0(); const b=VY.gen.composeWallpaper(800,600,L,'medium');
  assert(dump(a)===dump(b), L+' deterministic');
});
// the three new layouts differ from each other (same seed)
cfg0(); const d=dump(VY.gen.composeWallpaper(800,600,'diagonal','medium'));
cfg0(); const s=dump(VY.gen.composeWallpaper(800,600,'scattered','medium'));
cfg0(); const w=dump(VY.gen.composeWallpaper(800,600,'wreath','medium'));
assert(d!==s&&s!==w&&d!==w,'diagonal/scattered/wreath all differ');
// scattered no-overlap: collect motif boxes (jittered grid) and assert none intersect
cfg0();
// (geometry guaranteed by 2*jit<gap; sanity: scattered has multiple motifs)
assert(content(VY.gen.composeWallpaper(800,600,'scattered','medium'))>50,'scattered well-populated');
// wreath: central focal region non-empty (center has the big makeMotif)
cfg0(); const wm=VY.gen.composeWallpaper(400,400,'wreath','medium');
let cc=0; for(let y=160;y<240;y++)for(let x=160;x<240;x++) if(wm.grid[y][x]) cc++;
assert(cc>0,'wreath central focal present');
```
Run: `node --check generator.js && node /tmp/vy_wl_test.js && rm /tmp/vy_wl_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add generator.js
git commit -m "feat: wallpaper layouts — scattered/diagonal/wreath; remove dead fabric branch"
```

---

## Task 2: `app.js` — add the three layouts to `LAYOUTS`

**Files:** Modify `app.js`.

- [ ] **Step 1: Extend `LAYOUTS`** (line ~6). Current:
```js
const LAYOUTS=[["fabric","Seamless"],["bordered","Border frame"],["runner","Side runner"],["medallion","Medallion"]];
```
Replace with:
```js
const LAYOUTS=[["fabric","Seamless"],["bordered","Border frame"],["runner","Side runner"],["medallion","Medallion"],["diagonal","Diagonal"],["scattered","Scattered"],["wreath","Wreath"]];
```

- [ ] **Step 2: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c '"diagonal","Diagonal"\|"scattered","Scattered"\|"wreath","Wreath"' app.js   # >=1 (one line; grep -o to confirm 3)
grep -c 'buildSeg("layoutSeg",LAYOUTS' app.js                                          # 1 (unchanged wiring builds the new buttons)
```
Confirm no other change. Browser verification (the 3 new layout buttons appear in wallpaper mode and render distinct patterns) is the controller's live pass — state you cannot run a browser.

- [ ] **Step 3: Commit**
```bash
git add app.js
git commit -m "feat: expose diagonal/scattered/wreath in the Layout control"
```

---

## Self-review notes

- **Spec coverage:** scattered (jittered grid) + diagonal (sheared stripes) + wreath (focal+varied ring) → Task 1 Step 2; dead fabric branch removal → Task 1 Step 1; `LAYOUTS` += 3 → Task 2. No new state/controls/hash (additive, layout already in seed). All spec sections mapped.
- **Back-compat:** new layouts are additive `layout` values; reachable bordered/runner/medallion branches untouched; dead fabric removal can't change reachable output (generate routes fabric→composeFabricTile). Live cross-check vs production for a bordered + medallion link.
- **Type/name consistency:** layout keys `diagonal`/`scattered`/`wreath` identical in `composeWallpaper` branches + `LAYOUTS`; uses existing `pickMotif`/`makeMotif`/`blit`/`ri`/`m`/`v`/`cols`/`rows`/`grid`. The `#layoutSeg` is built by the existing `buildSeg("layoutSeg",LAYOUTS,"layout")` call — no wiring change.
- **Placeholder scan:** none — exact code, exact commands.
- **Scattered no-overlap** is a geometry guarantee (`2·jit < gap`), noted rather than asserted cell-by-cell; the node test confirms it's well-populated + deterministic, and the live pass eyeballs the toss.
- **Live verification (controller, after deploy):** (1) a bordered + a medallion wallpaper link render pixel-identical vs production (dead-branch removal safe); (2) Layout control shows 7 options; diagonal (visible diagonal stripes), scattered (even tossed coverage, no clumped overlaps), wreath (central focal + ring) all render across regions/scales; (3) same seed+layout deterministic, switching reshuffles; (4) PNG/chart export work; fabric/panel/explore unaffected; 0 console errors.
```
