# Motif Geometry Implementation Plan (cycle 3d)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Silhouette (auto/circle/square/diamond) and Border (off/on) knobs to field motifs.

**Architecture:** A pure `silhouetteInside` helper replaces `makeFieldMotif`'s single disc-clip line; a border pass draws the silhouette edge ring. Both are strings carried on the genome (set from the `aim` object), so they apply in every mode incl. per-cell Explore. `auto`/`off` reproduce current output; non-default appends to the seed string only when set. Hero/archetype motifs untouched.

**Tech Stack:** Plain ES2017 JS, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/motif-geometry` off `main` (incl. 3a+3b+3c).

---

## Conventions

No test runner. `makeFieldMotif`/`sampleGenomeFrom` are pure → node `vm`-sandbox testable. App/UI is DOM-bound → `node --check` + grep here, live Playwright after deploy. Temp tests `/tmp`, never committed.

**Back-compat:** `silhouette='auto'` (sym→disc/square, exactly the old clip on raw coords) + `border='off'` (no ring) → existing field motifs byte-identical. New genome fields default via `||'auto'`/`||'off'` so old `lab` links are unaffected.

**Generator harness** (`/tmp/vy_mg_test.js` preamble; run; delete):
```js
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,Number,String,Map};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const TP={name:'t',bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
function mk2(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}let a=h>>>0;
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const cnt=(g)=>{let n=0;for(const r of g)for(const v of r)if(v)n++;return n;};
// ... per-task assertions ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

---

## Task 1: `generator.js` — silhouetteInside + makeFieldMotif + genome carriers

**Files:** Modify `generator.js`.

- [ ] **Step 1: Add `silhouette:'auto', border:'off'` to `CFG`** (line ~14). It currently ends `...,panelSize:'medium'};`. Change to:
```js
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:'',lattice:'auto',spacing:'normal',panelSize:'medium',silhouette:'auto',border:'off'};
```

- [ ] **Step 2: Add the `silhouetteInside` helper** immediately above `makeFieldMotif` (just after the `applyCenter` function, line ~122):
```js
function silhouetteInside(sil, sym, dx, dy, R){
  const E=R+0.5, ax=Math.abs(dx), ay=Math.abs(dy);
  switch(sil){
    case 'circle':  return Math.hypot(dx,dy) <= E;
    case 'square':  return ax<=E && ay<=E;
    case 'diamond': return (ax+ay) <= E;
    default:        return sym==='loose' ? (ax<=E && ay<=E) : (Math.hypot(dx,dy) <= E);  // auto = current
  }
}
```

- [ ] **Step 3: Edit `makeFieldMotif`** (three targeted edits; leave the field-computation core untouched):
  - (a) Add `sil` to the first line: change `const g=newGrid(m,m), c=(m-1)/2, R=Math.max(1,c);` to:
```js
  const g=newGrid(m,m), c=(m-1)/2, R=Math.max(1,c), sil=G.silhouette||'auto';
```
  - (b) Replace the clip line `if(G.sym!=='loose' && Math.hypot(x-c,y-c) > R+0.5) continue;` with:
```js
    if(!silhouetteInside(sil, G.sym, x-c, y-c, R)) continue;
```
  - (c) Right after `applyCenter(g, c, G.centerStyle, G.layers[0].slot);` and BEFORE the non-empty-floor check, insert the border pass:
```js
  if(G.border==="on"){
    const bc=G.layers[0].slot;
    for(let y=0;y<m;y++)for(let x=0;x<m;x++){
      if(!silhouetteInside(sil,G.sym,x-c,y-c,R)) continue;
      if(!silhouetteInside(sil,G.sym,x+1-c,y-c,R)||!silhouetteInside(sil,G.sym,x-1-c,y-c,R)||
         !silhouetteInside(sil,G.sym,x-c,y+1-c,R)||!silhouetteInside(sil,G.sym,x-c,y-1-c,R)) g[y][x]=bc;
    }
  }
```

- [ ] **Step 4: Carry the fields on the genome (4 functions).**
  - `sampleGenomeFrom` return (line ~170): change to
```js
  return { sym: aim.symmetry||'d4', layers, levels, centerStyle, silhouette: aim.silhouette||'auto', border: aim.border||'off' };
```
  - `varyGenome` return (line ~208-209): change to
```js
  return { sym:lab.sym||CFG.symmetry, layers,
           levels:Math.max(2, Math.round((lab.levels||4) + j(1.5))), centerStyle:lab.centerStyle||"dot",
           silhouette:lab.silhouette||'auto', border:lab.border||'off' };
```
  - `varyGenomeFrom` return (line ~219-220): change to
```js
  return { sym:lab.sym||'d4', layers,
           levels:Math.max(2, Math.round((lab.levels||4) + j(1.5))), centerStyle:lab.centerStyle||"dot",
           silhouette:lab.silhouette||'auto', border:lab.border||'off' };
```
  - `genomeForCFG` (line ~196): add the two fields to the aim object:
```js
  return sampleGenome(CFG.P, {ornate:CFG.dens, wild:CFG.variety, tradition:CFG.tradition, symmetry:CFG.symmetry, silhouette:CFG.silhouette, border:CFG.border});
```
  (`sampleGenome` already delegates to `sampleGenomeFrom`, so it carries them.)

- [ ] **Step 5: Test** — `/tmp/vy_mg_test.js` (harness +):
```js
const M=11, mid=(M-1)/2;
const mk=(sil,border,sym)=>({sym:sym||'d4',layers:[{coord:'radial',wave:'cos',freq:1.4,phase:0,weight:1,slot:2}],levels:3,centerStyle:'dot',silhouette:sil,border:border||'off'});
// silhouette clipping
const circle=VY.gen.makeFieldMotif(M, mk('circle'));
assert(circle[0][0]===0 && circle[0][M-1]===0 && circle[M-1][0]===0,'circle clips corners');
assert(VY.gen.makeFieldMotif(M, mk('diamond'))[0][0]===0,'diamond clips corner');
const square=VY.gen.makeFieldMotif(M, mk('square'));
assert(cnt(square)>=cnt(circle),'square keeps >= circle');
// auto back-compat: d4 -> circle-like (corner clipped); loose -> square
assert(VY.gen.makeFieldMotif(M, mk('auto',null,'d4'))[0][0]===0,'auto+d4 clips corner (disc)');
assert(cnt(VY.gen.makeFieldMotif(M, mk('auto',null,'loose')))===cnt(VY.gen.makeFieldMotif(M, mk('square',null,'loose'))),'auto+loose == square');
// border ring
const noB=VY.gen.makeFieldMotif(M, mk('circle','off')), yesB=VY.gen.makeFieldMotif(M, mk('circle','on'));
assert(cnt(yesB)>=cnt(noB) && JSON.stringify(noB.map(r=>Array.from(r)))!==JSON.stringify(yesB.map(r=>Array.from(r))),'border changes/adds cells');
assert(yesB[0][mid]===2,'border ring set on disc top edge to primary slot');
// genome carriers
const g1=VY.gen.sampleGenomeFrom(mk2('z'), TP, {ornate:3,wild:0.5,tradition:0.4,symmetry:'d4',silhouette:'diamond',border:'on'});
assert(g1.silhouette==='diamond'&&g1.border==='on','sampleGenomeFrom carries fields');
const g2=VY.gen.sampleGenomeFrom(mk2('z'), TP, {ornate:3,wild:0.5,tradition:0.4,symmetry:'d4'});
assert(g2.silhouette==='auto'&&g2.border==='off','defaults auto/off');
```
(`varyGenome*` carry the fields too; they're internal, exercised via the Lab path in the live pass.)
Run: `node --check generator.js && node /tmp/vy_mg_test.js && rm /tmp/vy_mg_test.js`
Expected: `ALL PASS`

- [ ] **Step 6: Commit**
```bash
git add generator.js
git commit -m "feat: motif silhouette (auto/circle/square/diamond) + border ring on field motifs"
```

---

## Task 2: `app.js` + `index.html` — state, controls, seed/hash, explore aim

**Files:** Modify `app.js`, `index.html`.

- [ ] **Step 1: DEFAULTS + control data** (`app.js`). In `DEFAULTS` append (object currently ends `...,panelSize:"medium"};`):
```js
             bgColor:null,threadCols:[],lattice:"auto",spacing:"normal",panelSize:"medium",silhouette:"auto",border:"off"};
```
After the `PANELSIZES` const (~line 10) add:
```js
const SILHOUETTES=[["auto","Auto"],["circle","Circle"],["square","Square"],["diamond","Diamond"]];
const BORDERS=[["off","No border"],["on","Border"]];
```

- [ ] **Step 2: buildSeg** (`app.js`, the buildSeg calls line ~33). Append:
```js
buildSeg("silhouetteSeg",SILHOUETTES,"silhouette");buildSeg("borderSeg",BORDERS,"border");
```

- [ ] **Step 3: Seed suffix + setConfig + Explore aim** (`app.js` `generate()`).
  - Extend the `setSeed(...)` tail (after the existing lat/sp/psz suffixes):
```js
    + (state.silhouette!=="auto"?"|sil"+state.silhouette:"") + (state.border==="on"?"|bd":""));
```
  (i.e. append these two terms to the existing `+ (...)` chain, before the final `);`.)
  - Add to `setConfig({...})` (after `panelSize:state.panelSize,`):
```js
    silhouette:state.silhouette,
    border:state.border,
```
  - In the Explore branch's `buildFabricConfig` aim object, add the two fields:
```js
    const cfg=VY.gen.buildFabricConfig(P,
      {ornate:dens, wild:state.variety/100, tradition:state.tradition/100, symmetry:state.symmetry, silhouette:state.silhouette, border:state.border},
      state.lab, mm, state.seed);
```

- [ ] **Step 4: Hash write + read** (`app.js`).
  - `writeHash()`, after the `o.psz=…` line:
```js
if(state.silhouette!=="auto")o.sil=state.silhouette;
if(state.border==="on")o.bd=1;
```
  - `readHash()`, after the `psz` parse:
```js
  const _si=g("sil",""); if(["circle","square","diamond"].includes(_si)) state.silhouette=_si;
  if(g("bd","")==="1") state.border="on";
```

- [ ] **Step 5: syncUI segKey** (`app.js`, line ~66). Add the two segs:
```js
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry",latticeSeg:"lattice",spacingSeg:"spacing",panelSizeSeg:"panelSize",silhouetteSeg:"silhouette",borderSeg:"border"};
```

- [ ] **Step 6: index.html — two Design controls** after the Symmetry seg. Find (in `data-sec="design"`):
```html
        <label>Symmetry</label>
        <div class="seg" id="symSeg" role="radiogroup" aria-label="Symmetry"></div>
```
and insert after it:
```html
        <label>Motif silhouette</label>
        <div class="seg" id="silhouetteSeg" role="radiogroup" aria-label="Motif silhouette"></div>
        <label>Motif border</label>
        <div class="seg" id="borderSeg" role="radiogroup" aria-label="Motif border"></div>
```

- [ ] **Step 7: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c 'id="silhouetteSeg"\|id="borderSeg"' index.html   # 2
grep -c 'SILHOUETTES\|BORDERS' app.js                      # >=4 (consts + buildSeg)
grep -c 'silhouette:state.silhouette' app.js               # 2 (setConfig + explore aim)
grep -c 'sil"+state.silhouette\|o.sil=\|g("sil"' app.js     # 3
grep -c 'silhouetteSeg:"silhouette",borderSeg:"border"' app.js  # 1
```
Confirm the base seed template literal is unchanged. Browser verification (silhouette reshapes field motifs, border outlines them, in all modes) is the controller's live pass.

- [ ] **Step 8: Commit**
```bash
git add app.js index.html
git commit -m "feat: Motif silhouette + border controls (state, seed-suffix, hash, explore aim, UI)"
```

---

## Self-review notes

- **Spec coverage:** silhouetteInside + clip → Task 1 Step 2-3b; border ring → Task 1 Step 3c; genome carriers (sampleGenomeFrom/varyGenome*/genomeForCFG/CFG) → Task 1 Steps 1,4; state/controls/setConfig/seed-suffix/hash/explore-aim/syncUI → Task 2. Field-motifs-only (hero/archetype untouched — `remapHeroP`/`makeMotif` not modified). All spec sections mapped.
- **Back-compat:** `auto` clip = old disc(d4/d2)/square(loose) on raw coords; `off` = no ring; defaults append nothing to the seed; new genome fields default via `||`. Existing designs + old `lab` links byte-identical (verified node + live).
- **Type/name consistency:** strings throughout — `silhouette` ∈ auto/circle/square/diamond, `border` ∈ off/on; `silhouetteInside(sil,sym,dx,dy,R)`; genome `.silhouette`/`.border`; `CFG`/`aim`/state all carry them; hash `sil`/`bd`; ids `#silhouetteSeg`/`#borderSeg`; `SILHOUETTES`/`BORDERS`; segKey entries. Consistent across tasks.
- **Placeholder scan:** none — exact code, exact commands.
- **Live verification (controller, after deploy):** (1) a default link (auto/off) renders pixel-identical vs production; (2) circle/square/diamond visibly reshape field motifs independent of Symmetry; (3) Border on draws a clean outline around field motifs; (4) works in wallpaper + panel + Explore (per-cell across the plane); hero motifs unchanged; (5) `sil`/`bd` round-trip the hash, defaults keep URLs clean; 0 console errors.
```
