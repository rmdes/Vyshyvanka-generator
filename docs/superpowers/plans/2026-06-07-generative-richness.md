# Generative Richness (Pillar C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seed-driven, math-based "field-function" motif engine and blend it with the existing archetypes/hero motifs via a Tradition↔Invention dial, plus a two-tier control redesign (bipolar simple axes + a Lab panel) — all deterministic, shareable, and Canvas2D/buildless.

**Architecture:** A new pure renderer `makeFieldMotif(m, genome)` and a `sampleGenome(P, aim)` sampler live in `generator.js`. `pickMotif` becomes a weighted blend of three sources (field / hero / archetype) governed by `CFG.tradition`. `app.js` gains `tradition` + `symmetry` state (and later a `lab` override object), wired into the seed string and URL hash. The UI relabels the two existing sliders as bipolar axes and adds a Tradition slider, a Symmetry segmented control, and a collapsible Lab panel.

**Tech Stack:** Plain ES2017 JS, Canvas2D, classic `<script src>` under the `VY` namespace. No build, bundler, framework, or test runner. Served static on LAMP.

---

## Conventions for this plan

**No test runner exists.** Generator logic is pure JS and *is* headlessly testable by loading `generator.js` in a Node `vm` sandbox with `window`/`VY` shimmed. DOM-bound code (`app.js`, `index.html`) is verified with `node --check` + concrete browser checks. Generator-task tests are written to a **temp file under `/tmp` and never committed** (keeps the static site clean, consistent with the project's no-test-suite constraint).

**Reusable Node test harness** (each generator task writes its own `/tmp/vy_test.js` containing this preamble + that task's assertions, runs `node /tmp/vy_test.js`, expects `ALL PASS`, then deletes it):

```js
// preamble — loads generator.js into a sandbox where bare VY === window.VY
const fs=require('fs'), vm=require('vm');
const sb={Math,Int8Array,Array,Object,JSON,console,parseInt,isNaN,String,Number};
sb.window=sb; sb.VY={}; sb.window.VY=sb.VY;
vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/generator.js','utf8'), sb);
const VY=sb.VY;
let ok=true; const eq=(a,b,m)=>{const p=JSON.stringify(a)===JSON.stringify(b);if(!p){ok=false;console.log('FAIL',m,'got',a,'want',b);}};
const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
// a minimal palette for tests (mirrors REGIONS shape: threads + colorBias + bg)
const TP={bg:'#101010',threads:['#aa0000','#111111','#ddaa22','#207a4f','#d9762b'],colorBias:[0,1,2,3,4],densityBias:0};
// ... per-task assertions go here ...
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

**Determinism contract (must hold after every task):** the `generate()` seed string and the `writeHash`/`readHash` params together capture every output-affecting input; the per-cell render loop stays a pure function of `(x,y)` and the genome. Cross-version pixel identity is NOT promised (changing the generator changes RNG sequences); within-version reproduction + shareability IS.

---

## Task 1: Field-function renderer (`makeFieldMotif`)

Pure renderer: input `(m, genome)`, output an `m×m` `Int8Array`-row grid. Depends on nothing but its args (no `CFG`, no palette) so it's trivially testable and reusable for Pillar B later.

**Files:**
- Modify: `generator.js` (add helpers + `makeFieldMotif`; export on `VY.gen`)

- [ ] **Step 1: Add the field helpers + renderer to `generator.js`** (place after `makeFiller`, before the HERO MOTIFS section):

```js
/* ===================== FIELD-FUNCTION MOTIF ENGINE =====================
 * A motif = a stack of math "layers" summed into a scalar field over
 * symmetry-folded coordinates, then quantized to discrete stitches.
 * PURE: makeFieldMotif(m, genome) depends only on its args (no CFG). */
function fieldCoord(kind, ax, ay, R){
  switch(kind){
    case 'radial':    return Math.hypot(ax,ay)/R;
    case 'manhattan': return (ax+ay)/(2*R);
    case 'chebyshev': return Math.max(ax,ay)/R;
    case 'diagonal':  return Math.abs(ax-ay)/R;
    case 'angle':     return Math.atan2(ay,ax)/(Math.PI/2);   // 0..1 over a quadrant
    case 'lattice':   return ((ax%2)+(ay%2))/2;               // 0,0.5,1
    default:          return Math.hypot(ax,ay)/R;
  }
}
function fieldWave(kind, t){
  switch(kind){
    case 'cos': return Math.cos(t*2*Math.PI);
    case 'tri': { const p=((t%1)+1)%1; return 1-4*Math.abs(p-0.5); }
    case 'sq':  return Math.cos(t*2*Math.PI)>=0 ? 1 : -1;
    default:    return Math.cos(t*2*Math.PI);
  }
}
function applyCenter(g, c, style, col){
  if(style==='none') return;
  if(style==='dot'||style==='ring'){ g[c][c]=col; return; }
  g[c][c]=col; if(g[c-1])g[c-1][c]=col; if(g[c+1])g[c+1][c]=col;
  if(c-1>=0)g[c][c-1]=col; if(c+1<g.length)g[c][c+1]=col;
}
// genome = { sym:'d4'|'d2'|'loose', layers:[{coord,wave,freq,phase,weight,slot}], levels:Int, centerStyle:str }
function makeFieldMotif(m, G){
  const g=newGrid(m,m), c=(m-1)/2, R=Math.max(1,c);
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){
    let ax=Math.abs(x-c), ay=Math.abs(y-c);
    if(G.sym==='d4' && ax<ay){ const t=ax; ax=ay; ay=t; }   // fold diagonal -> 8-fold
    if(Math.hypot(x-c,y-c) > R+0.5) continue;               // clip to a disc
    let F=0, wsum=0;
    for(const L of G.layers){
      F += L.weight*fieldWave(L.wave, fieldCoord(L.coord,ax,ay,R)*L.freq + L.phase);
      wsum += Math.abs(L.weight);
    }
    F = wsum ? F/wsum : 0;                                   // normalize to ~[-1,1]
    const band = Math.floor(((F+1)/2)*G.levels);            // 0..levels
    if(band >= Math.ceil(G.levels/2)){
      const L = G.layers[band % G.layers.length];
      g[y][x] = L.slot;                                      // slot is already a 1-based thread index
    }
  }
  applyCenter(g, c, G.centerStyle, G.layers[0].slot);
  return g;
}
```

- [ ] **Step 2: Export it.** In the exported-entry-points block at the bottom of `generator.js`, add:

```js
VY.gen.makeFieldMotif = makeFieldMotif;
```

- [ ] **Step 3: Write the test** to `/tmp/vy_test.js` — the preamble above plus:

```js
const G={sym:'d4', levels:4, centerStyle:'dot', layers:[
  {coord:'radial',wave:'cos',freq:2,phase:0,weight:1,slot:1},
  {coord:'angle', wave:'tri',freq:4,phase:0,weight:0.6,slot:3}
]};
const m=15, g=VY.gen.makeFieldMotif(m,G);
// shape
assert(g.length===m && g.every(r=>r.length===m), 'square m×m');
// symmetry: mirror-x, mirror-y, and (d4) diagonal
let mx=true,my=true,di=true,nonempty=0,inrange=true;
for(let y=0;y<m;y++)for(let x=0;x<m;x++){
  const v=g[y][x]; if(v)nonempty++;
  if(v<0||v>5)inrange=false;
  if(g[y][x]!==g[y][m-1-x])mx=false;
  if(g[y][x]!==g[m-1-y][x])my=false;
  if(g[y][x]!==g[x][y])di=false;
}
assert(mx,'mirror-x symmetric'); assert(my,'mirror-y symmetric'); assert(di,'d4 diagonal symmetric');
assert(nonempty>0,'non-empty'); assert(inrange,'cells in 0..threads');
// purity/determinism: same args -> identical
eq(VY.gen.makeFieldMotif(m,G), g, 'pure: identical output for identical genome');
// d2 need not be diagonal-symmetric but must be axis-symmetric
const G2={...G,sym:'d2',layers:[{coord:'manhattan',wave:'cos',freq:3,phase:0.3,weight:1,slot:2}]};
const g2=VY.gen.makeFieldMotif(m,G2); let mx2=true,my2=true;
for(let y=0;y<m;y++)for(let x=0;x<m;x++){if(g2[y][x]!==g2[y][m-1-x])mx2=false;if(g2[y][x]!==g2[m-1-y][x])my2=false;}
assert(mx2&&my2,'d2 axis-symmetric');
```

- [ ] **Step 4: Run the test**

Run: `node --check generator.js && node /tmp/vy_test.js && rm /tmp/vy_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add generator.js
git commit -m "feat: pure field-function motif renderer (makeFieldMotif)"
```

---

## Task 2: Genome sampler (`sampleGenome`)

Draws a genome from the seeded module `RNG`, shaped by `aim = {ornate, wild, tradition, symmetry}` and palette `P` (for color slots via `colorBias`).

**Files:**
- Modify: `generator.js` (add `sampleGenome`; export)

- [ ] **Step 1: Add `sampleGenome` to `generator.js`** (right after `makeFieldMotif`):

```js
// aim = { ornate:1..5, wild:0..1, tradition:0..1, symmetry:'d4'|'d2'|'loose' }
function sampleGenome(P, aim){
  const tr=aim.tradition, wild=aim.wild, ornate=aim.ornate;
  const coordsTrad=['radial','manhattan','chebyshev'];
  const coordsInv =['radial','manhattan','chebyshev','diagonal','angle','lattice'];
  const nLayers=Math.max(1, Math.min(4, Math.round(1 + (ornate-1)*0.6 + tr*1.5)));
  const layers=[];
  for(let i=0;i<nLayers;i++){
    const coord = pick(tr>0.4 ? coordsInv : coordsTrad);
    const wave  = pick(tr>0.5 ? ['cos','tri','sq'] : ['cos','tri']);
    const freq  = tr<0.3 ? ri(1,3) : (1 + RNG()*wild*(1+tr*5));
    const phase = (tr<0.3?0:RNG()) * wild;
    const weight= 0.5 + RNG()*0.8;
    const slot  = pick(P.colorBias)+1;            // 1-based thread index
    layers.push({coord,wave,freq,phase,weight,slot});
  }
  const levels = 2 + Math.round(ornate*0.8 + tr*3);
  const centerStyle = pick(['dot','cross','ring','none']);
  return { sym: aim.symmetry||'d4', layers, levels, centerStyle };
}
```

- [ ] **Step 2: Export it.** Add to the entry-points block:

```js
VY.gen.sampleGenome = sampleGenome;
```

- [ ] **Step 3: Write the test** to `/tmp/vy_test.js` (preamble +):

```js
const aim={ornate:3, wild:0.5, tradition:0.2, symmetry:'d4'};
// determinism: same seed -> identical genome
VY.gen.setSeed('seedA'); const a=VY.gen.sampleGenome(TP,aim);
VY.gen.setSeed('seedA'); const b=VY.gen.sampleGenome(TP,aim);
eq(a,b,'same seed -> identical genome');
VY.gen.setSeed('seedB'); const cG=VY.gen.sampleGenome(TP,aim);
assert(JSON.stringify(cG)!==JSON.stringify(a),'different seed -> usually different genome');
// validity
const validCoord=['radial','manhattan','chebyshev','diagonal','angle','lattice'];
const validWave=['cos','tri','sq'];
function checkGenome(G,label){
  assert(G.layers.length>=1&&G.layers.length<=4, label+' 1..4 layers');
  assert(G.sym==='d4'||G.sym==='d2'||G.sym==='loose', label+' valid sym');
  assert(G.levels>=2, label+' levels>=2');
  for(const L of G.layers){
    assert(validCoord.includes(L.coord), label+' coord valid');
    assert(validWave.includes(L.wave), label+' wave valid');
    assert(L.slot>=1&&L.slot<=TP.threads.length, label+' slot in palette');
    assert(Number.isFinite(L.freq)&&Number.isFinite(L.phase)&&Number.isFinite(L.weight), label+' finite params');
  }
}
checkGenome(a,'A');
// tradition shaping: low tradition -> integer freqs
VY.gen.setSeed('t0'); const trad=VY.gen.sampleGenome(TP,{ornate:3,wild:0.5,tradition:0,symmetry:'d4'});
assert(trad.layers.every(L=>Number.isInteger(L.freq)), 'tradition=0 -> integer freqs');
checkGenome(trad,'trad');
// ornate raises average layer count: full-ornate >= minimal (sample a few seeds)
function avgLayers(orn){let s=0,n=8;for(let i=0;i<n;i++){VY.gen.setSeed('o'+orn+'_'+i);s+=VY.gen.sampleGenome(TP,{ornate:orn,wild:0.5,tradition:0.5,symmetry:'d4'}).layers.length;}return s/n;}
assert(avgLayers(5) >= avgLayers(1), 'ornate raises average layer count');
// genome feeds the renderer without error and stays symmetric
VY.gen.setSeed('rz'); const gg=VY.gen.makeFieldMotif(13, VY.gen.sampleGenome(TP,aim));
let sym=true; for(let y=0;y<13;y++)for(let x=0;x<13;x++)if(gg[y][x]!==gg[y][12-x])sym=false;
assert(sym,'sampled genome renders symmetric');
```

- [ ] **Step 4: Run the test**

Run: `node --check generator.js && node /tmp/vy_test.js && rm /tmp/vy_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add generator.js
git commit -m "feat: seed-driven genome sampler shaped by ornate/wild/tradition"
```

---

## Task 3: Source blend in `pickMotif` + CFG wiring

`pickMotif` becomes a weighted blend of field / hero / archetype driven by `CFG.tradition`. The selection decision is extracted into a pure `pickSource` helper so it's unit-testable.

**Files:**
- Modify: `generator.js` (`pickSource`, `pickMotif`, `setConfig`; export `pickSource`)

- [ ] **Step 1: Replace `pickMotif` and add `pickSource` in `generator.js`.** Replace the existing `pickMotif` (lines ~104–110) with:

```js
// pure selection: which source for a given roll r, tradition tr, hero availability
function pickSource(r, tr, hasHero){
  if(r < tr) return 'field';                 // tradition high -> more field (invention)
  const rest=r-tr, span=Math.max(1e-6, 1-tr);
  if(hasHero && rest < span*0.5) return 'hero';
  return 'archetype';
}
function genomeForCFG(m){
  const aim={ornate:CFG.dens, wild:CFG.variety, tradition:CFG.tradition, symmetry:CFG.symmetry};
  const base=sampleGenome(CFG.P, aim);
  return CFG.lab ? mergeGenome(base, CFG.lab) : base;
}
// merge partial lab overrides onto a sampled genome (overridden fields win)
function mergeGenome(base, lab){
  const out={ sym: lab.sym||base.sym, levels: lab.levels||base.levels,
              centerStyle: lab.centerStyle||base.centerStyle, layers: base.layers.map(l=>({...l})) };
  if(Array.isArray(lab.layers)){
    out.layers = lab.layers.map((lo,i)=>({ ...(base.layers[i]||base.layers[0]), ...lo }));
  }
  return out;
}
function pickMotif(m){
  const tr=CFG.tradition, pool=heroForRegion(CFG.region);
  const src=pickSource(RNG(), tr, pool.length>0);
  if(src==='field') return makeFieldMotif(m, genomeForCFG(m));
  if(src==='hero')  return remapHero(pick(pool).grid);
  return makeMotif(m);
}
```

- [ ] **Step 2: Extend `setConfig` defaults in `generator.js`.** The exported `setConfig` already does `Object.assign(CFG,cfg)`; ensure `CFG` has sane defaults so generator tests work without app.js. Change the `CFG` initializer (line 14) to:

```js
const CFG={variety:0.6,dens:3,tradition:0.2,symmetry:'d4',lab:null,region:''};
```

- [ ] **Step 3: Export `pickSource`.** Add to the entry-points block:

```js
VY.gen.pickSource = pickSource;
```

- [ ] **Step 4: Write the test** to `/tmp/vy_test.js` (preamble +):

```js
// pickSource boundaries
eq(VY.gen.pickSource(0.0, 0.0, true), 'hero', 'tr=0,r=0 -> hero (rest<0.5)');
eq(VY.gen.pickSource(0.9, 0.0, true), 'archetype', 'tr=0,r=0.9 -> archetype');
eq(VY.gen.pickSource(0.9, 0.0, false), 'archetype', 'no hero -> archetype');
eq(VY.gen.pickSource(0.1, 1.0, true), 'field', 'tr=1 -> field');
eq(VY.gen.pickSource(0.5, 0.6, true), 'field', 'r<tr -> field');
// at tradition=0 pickMotif never produces a field motif; at tradition=1 always field.
// detect field motifs by tagging makeFieldMotif via a probe: count over many rolls using pickSource directly
let fieldCount0=0, field1=0, N=200;
VY.gen.setSeed('mix');
for(let i=0;i<N;i++){ if(VY.gen.pickSource(Math.abs(Math.sin(i)*0.9999),0,true)==='field')fieldCount0++; }
assert(fieldCount0===0,'tradition=0 never field');
for(let i=0;i<N;i++){ if(VY.gen.pickSource(Math.abs(Math.sin(i))*0.9999,1,true)==='field')field1++; }
assert(field1===N,'tradition=1 always field');
// pickMotif runs deterministically and returns valid grids across tradition values
function gridsFor(tr){VY.gen.setConfig({P:TP,region:'',variety:0.5,dens:3,tradition:tr,symmetry:'d4',lab:null});VY.gen.setSeed('det');return [VY.gen.pickMotif(11),VY.gen.pickMotif(11),VY.gen.pickMotif(11)];}
const r1=gridsFor(0.5); VY.gen.setSeed('det'); VY.gen.setConfig({P:TP,region:'',variety:0.5,dens:3,tradition:0.5,symmetry:'d4',lab:null}); const r2=[VY.gen.pickMotif(11),VY.gen.pickMotif(11),VY.gen.pickMotif(11)];
eq(r1,r2,'pickMotif deterministic for same seed+config');
for(const tr of [0,0.2,0.5,1]){ for(const g of gridsFor(tr)){ assert(g.length===11&&g[0].length===11,'pickMotif tr='+tr+' valid grid'); } }
// lab override merges
VY.gen.setConfig({P:TP,region:'',variety:0.5,dens:3,tradition:1,symmetry:'d4',lab:{sym:'d2',levels:3,layers:[{coord:'lattice',wave:'sq',freq:2,phase:0,weight:1,slot:2}]}});
VY.gen.setSeed('lab'); const lg=VY.gen.pickMotif(11); assert(lg.length===11,'lab-overridden field motif renders');
```

- [ ] **Step 5: Run the test**

Run: `node --check generator.js && node /tmp/vy_test.js && rm /tmp/vy_test.js`
Expected: `ALL PASS`

- [ ] **Step 6: Commit**

```bash
git add generator.js
git commit -m "feat: blend field/hero/archetype in pickMotif via tradition dial"
```

---

## Task 4: State + seed/hash wiring in `app.js` (no new UI yet)

Add `tradition` and `symmetry` to state, feed them into `setConfig` and the seed string, and serialize to the URL hash. This makes the engine live (field motifs appear at the default tradition) before the UI controls land.

**Files:**
- Modify: `app.js` (state, `generate`, `writeHash`, `readHash`)

- [ ] **Step 1: Add state fields.** Change the `state` initializer (line 20–21) to include the two new fields (default `tradition:20` tradition-leaning, `symmetry:"d4"`, `lab:null`):

```js
const state={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:20,symmetry:"d4",lab:null};
```

- [ ] **Step 2: Feed them into generation.** In `generate()`, extend the seed string and the `setConfig` call. Replace the `VY.gen.setSeed(...)` line and the `VY.gen.setConfig({...})` block (lines 60–68) with:

```js
  VY.gen.setSeed(`${state.seed}|${state.region}|${state.mode}|${state.complexity}|${state.variety}|${state.layout}|${state.shape}|${state.bg}|${state.scale}|${state.res}|${state.tradition}|${state.symmetry}|${state.lab?JSON.stringify(state.lab):""}`);
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setConfig({
    P,
    region:state.region,
    variety:state.variety/100,
    dens,
    tradition:state.tradition/100,
    symmetry:state.symmetry,
    lab:state.lab,
  });
```

- [ ] **Step 3: Serialize to the hash.** Replace `writeHash` (line 109) with one that adds `tr`, `sym`, and `lab` (omitting `lab` when empty):

```js
function writeHash(){const o={m:state.mode,r:state.region,c:state.complexity,vy:state.variety,st:state.style,seed:state.seed,res:state.res,lay:state.layout,bg:state.bg,sc:state.scale,sh:state.shape,tr:state.tradition,sym:state.symmetry};if(state.lab)o.lab=JSON.stringify(state.lab);const p=new URLSearchParams(o);history.replaceState(null,"","#"+p.toString());}
```

- [ ] **Step 4: Parse from the hash with validation.** In `readHash`, after the existing `vi`/variety line and before `state.style=...`, the function ends with the layout/bg/scale/shape line (113). Replace that final line (113) with one that also reads `tr`/`sym`/`lab` defensively:

```js
  state.layout=g("lay",state.layout);state.bg=g("bg",state.bg);state.scale=g("sc",state.scale);state.shape=g("sh",state.shape);
  const ti=+g("tr",state.tradition); if(Number.isFinite(ti)) state.tradition=Math.max(0,Math.min(100,Math.round(ti)));
  const sy=g("sym",state.symmetry); if(sy==="d4"||sy==="d2"||sy==="loose") state.symmetry=sy;
  const lb=g("lab",""); if(lb){ try{ const o=JSON.parse(lb); if(o&&Array.isArray(o.layers)||o&&(o.sym||o.levels||o.centerStyle)) state.lab=o; }catch{} }}
```

(Note: the `}` at the end closes `readHash`; ensure exactly one closing brace remains for the function.)

- [ ] **Step 5: Verify (node + browser)**

Run: `node --check app.js`
Expected: OK.

Browser (serve + load `index.html`): app loads, default view still looks grounded (tradition 20 → mostly hero/archetype with ~20% tame field motifs); no console errors. In DevTools:
```js
VY.app.state.tradition // 20
VY.app.generate(false); // re-renders without error
```
Determinism console check (same seed → identical):
```js
const a=VY.cv.toDataURL(); VY.app.generate(false); console.assert(a===VY.cv.toDataURL(),'deterministic');
```

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: wire tradition + symmetry state into generation, seed, and hash"
```

---

## Task 5: Simple-tier controls (relabel + Tradition slider + Symmetry)

Relabel the two sliders as bipolar axes, add a Tradition slider and a Symmetry segmented control, and wire events + `syncUI` + ARIA.

**Files:**
- Modify: `index.html` (Tradition fieldset markup)
- Modify: `app.js` (SYMS const, buildSeg call, events, `syncUI`)

- [ ] **Step 1: Update the "Tradition" fieldset markup in `index.html`.** Replace the current block (lines 33–43, the `<fieldset>` containing region/complexity/variety) with:

```html
  <fieldset>
    <legend>Tradition (formal traits)</legend>
    <label for="region">Regional style</label>
    <select id="region"></select>
    <div class="tag" id="regionNote"></div>
    <label>Detail — Minimal ↔ Ornate <span class="val" id="cxVal"></span></label>
    <input type="range" id="complexity" min="1" max="5" step="1" />
    <label>Variation — Calm ↔ Wild <span class="val" id="vyVal"></span></label>
    <input type="range" id="variety" min="0" max="100" step="1" />
    <label>Tradition ↔ Invention <span class="val" id="trVal"></span></label>
    <input type="range" id="tradition" min="0" max="100" step="1" />
    <label>Symmetry</label>
    <div class="seg" id="symSeg" role="radiogroup" aria-label="Symmetry"></div>
    <div class="tag">Sliders set the aim · Wild sets how far the 🎲 roams</div>
  </fieldset>
```

- [ ] **Step 2: Add the SYMS constant + segmented control in `app.js`.** After the `SCALES` const (line 8) add:

```js
const SYMS=[["d4","8-fold"],["d2","4-fold"],["loose","Loose"]];
```
And in the `buildSeg(...)` calls line (28), append a build for `symSeg` bound to `symmetry`:

```js
buildSeg("shapeSeg",SHAPES,"shape");buildSeg("layoutSeg",LAYOUTS,"layout");buildSeg("bgSeg",BGS,"bg");buildSeg("scaleSeg",SCALES,"scale");buildSeg("symSeg",SYMS,"symmetry");
```

- [ ] **Step 3: Sync the new controls in `syncUI`.** After the variety aria block (lines 35–40), add tradition value + aria, and include `symSeg` in the segmented-sync map. Insert after line 40:

```js
  document.getElementById("tradition").value=state.tradition;
  document.getElementById("trVal").textContent=state.tradition+"%";
  document.getElementById("tradition").setAttribute("aria-valuetext",`Tradition to invention ${state.tradition} percent`);
```
And change the `segKey` object (line 50) to include `symSeg`:

```js
  const segKey={shapeSeg:"shape",layoutSeg:"layout",bgSeg:"bg",scaleSeg:"scale",symSeg:"symmetry"};
```

- [ ] **Step 4: Wire the tradition slider events in `app.js`.** After the variety `onchange` handler (line 123) add:

```js
document.getElementById("tradition").oninput=e=>{state.tradition=+e.target.value;document.getElementById("trVal").textContent=state.tradition+"%";};
document.getElementById("tradition").onchange=()=>generate();
```
(The Symmetry segmented buttons get their handlers automatically from `buildSeg`, which calls `syncUI();generate();`.)

- [ ] **Step 5: Verify (node + browser)**

Run: `node --check app.js`
Expected: OK.

Browser: the sidebar shows **Detail (Minimal↔Ornate)**, **Variation (Calm↔Wild)**, **Tradition↔Invention**, and a **Symmetry** segmented control (8-fold/4-fold/Loose). Dragging Tradition from 0→100 visibly shifts from clean hero/archetype motifs toward novel field forms; Symmetry changes the fold; Wild changes how varied successive 🎲 rolls are. Copy-link includes `tr=` and `sym=`. Determinism check passes.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js
git commit -m "feat: bipolar simple-tier controls + Tradition slider + Symmetry"
```

---

## Task 6: Lab panel (genome overrides + reset)

A collapsible "🧪 Lab" panel exposing the genome: symmetry, levels, layer count, and per-layer `coord/wave/freq/phase/weight/slot`. Active overrides feed `state.lab` (applied via `mergeGenome` from Task 3). A "Reset to seed" clears them.

**Files:**
- Modify: `index.html` (Lab fieldset markup)
- Modify: `styles.css` (Lab panel styles)
- Modify: `app.js` (Lab build/read/apply/reset + disclosure)

- [ ] **Step 1: Add the Lab markup to `index.html`.** Insert this fieldset immediately before the `<div class="btns">` block (currently line 75):

```html
  <fieldset id="labPanel">
    <legend><button type="button" id="labToggle" aria-expanded="false">🧪 Lab ▸</button></legend>
    <div id="labBody" class="hidden">
      <label>Layers <span class="val" id="labNLayersVal"></span></label>
      <input type="range" id="labNLayers" min="1" max="4" step="1" />
      <label>Color bands (levels) <span class="val" id="labLevelsVal"></span></label>
      <input type="range" id="labLevels" min="2" max="10" step="1" />
      <div id="labLayers"></div>
      <button type="button" id="labReset">Reset to seed</button>
      <div class="tag">Editing the Lab pins this exact genome (overrides the dice). Reset returns to seed-driven motifs.</div>
    </div>
  </fieldset>
```

- [ ] **Step 2: Add Lab styles to `styles.css`** (after the `.favs` rules):

```css
#labPanel legend button{background:none;border:0;color:var(--accent2);font:inherit;cursor:pointer;padding:0;text-transform:uppercase;letter-spacing:.8px;font-size:11px}
#labBody{display:flex;flex-direction:column;gap:6px}
.labLayer{border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:6px}
.labLayer .lrow{display:flex;gap:6px;align-items:center}
.labLayer select,.labLayer input{background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit;min-width:0;flex:1}
.labLayer label{margin:6px 0 2px}
```

- [ ] **Step 3: Add Lab logic to `app.js`.** Insert this block after the undo block (after line 166), before the mobile-drawer block. It builds the per-layer editors, reads them into `state.lab`, applies, and resets:

```js
/* ---- Lab panel (genome overrides) ---- */
const LAB_COORDS=["radial","manhattan","chebyshev","diagonal","angle","lattice"];
const LAB_WAVES=["cos","tri","sq"];
function labCurrentGenome(){
  // derive a starting genome from the current seed+aim so the Lab opens pre-filled
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setSeed(state.seed+"|lab");
  return VY.gen.sampleGenome(P,{ornate:dens,wild:state.variety/100,tradition:state.tradition/100,symmetry:state.symmetry});
}
function buildLabLayers(G){
  const host=document.getElementById("labLayers"); host.innerHTML="";
  G.layers.forEach((L,i)=>{
    const box=document.createElement("div"); box.className="labLayer";
    const sel=(opts,val)=>{const s=document.createElement("select");opts.forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);});return s;};
    const num=(v,step,min,max)=>{const n=document.createElement("input");n.type="number";n.value=v;n.step=step;if(min!=null)n.min=min;if(max!=null)n.max=max;return n;};
    const coord=sel(LAB_COORDS,L.coord), wave=sel(LAB_WAVES,L.wave);
    const freq=num(L.freq,0.1), phase=num(L.phase,0.05), weight=num(L.weight,0.1,0), slot=num(L.slot,1,1);
    box.innerHTML=`<label>Layer ${i+1}</label>`;
    const row1=document.createElement("div");row1.className="lrow";row1.append(coord,wave);
    const row2=document.createElement("div");row2.className="lrow";row2.append(freq,phase);
    const row3=document.createElement("div");row3.className="lrow";row3.append(weight,slot);
    box.append(row1,row2,row3); host.appendChild(box);
    [coord,wave,freq,phase,weight,slot].forEach(el=>el.onchange=commitLab);
    box._get=()=>({coord:coord.value,wave:wave.value,freq:+freq.value,phase:+phase.value,weight:+weight.value,slot:Math.max(1,Math.round(+slot.value))});
  });
}
function commitLab(){
  const layers=[...document.querySelectorAll("#labLayers .labLayer")].map(b=>b._get());
  state.lab={ sym:state.symmetry, levels:+document.getElementById("labLevels").value, centerStyle:"dot", layers };
  generate();
}
function openLabFromSeed(){
  const G=labCurrentGenome();
  document.getElementById("labNLayers").value=G.layers.length;
  document.getElementById("labNLayersVal").textContent=G.layers.length;
  document.getElementById("labLevels").value=G.levels;
  document.getElementById("labLevelsVal").textContent=G.levels;
  buildLabLayers(G);
}
document.getElementById("labToggle").onclick=()=>{
  const body=document.getElementById("labBody"), open=body.classList.toggle("hidden")===false;
  document.getElementById("labToggle").setAttribute("aria-expanded",String(open));
  document.getElementById("labToggle").textContent=open?"🧪 Lab ▾":"🧪 Lab ▸";
  if(open && !state.lab) openLabFromSeed();
};
document.getElementById("labNLayers").oninput=e=>{document.getElementById("labNLayersVal").textContent=e.target.value;};
document.getElementById("labNLayers").onchange=e=>{
  const n=+e.target.value, G=state.lab||labCurrentGenome();
  const layers=[]; for(let i=0;i<n;i++) layers.push(G.layers[i]||G.layers[G.layers.length-1]);
  buildLabLayers({...G,layers}); commitLab();
};
document.getElementById("labLevels").oninput=e=>{document.getElementById("labLevelsVal").textContent=e.target.value;};
document.getElementById("labLevels").onchange=commitLab;
document.getElementById("labReset").onclick=()=>{ state.lab=null; generate(); };
```

- [ ] **Step 4: Verify (node + browser)**

Run: `node --check app.js`
Expected: OK.

Browser: clicking "🧪 Lab ▸" expands the panel pre-filled from the current seed. Changing a layer's coord/wave/freq/phase/weight/slot or the layer-count/levels re-renders immediately and **pins** the genome (every placed motif uses it). "Reset to seed" returns to seed-driven variety. Determinism check still passes with a lab active.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: Lab panel for direct genome editing (overrides + reset)"
```

---

## Task 7: Lab share-link round-trip + favorites safety

Ensure a hand-tuned Lab genome survives Copy-link and favorites without aliasing bugs.

**Files:**
- Modify: `app.js` (syncUI re-fills Lab on restore; immutable lab updates)

- [ ] **Step 1: Re-fill the Lab UI when state is restored.** In `syncUI`, at the end of the function (after the title block, before the closing brace ~line 56), add a sync of the Lab body to `state.lab` when present:

```js
  if(state.lab){
    document.getElementById("labNLayers").value=state.lab.layers.length;
    document.getElementById("labNLayersVal").textContent=state.lab.layers.length;
    document.getElementById("labLevels").value=state.lab.levels;
    document.getElementById("labLevelsVal").textContent=state.lab.levels;
    buildLabLayers(state.lab);
    const body=document.getElementById("labBody");
    if(body.classList.contains("hidden")){ body.classList.remove("hidden"); document.getElementById("labToggle").setAttribute("aria-expanded","true"); document.getElementById("labToggle").textContent="🧪 Lab ▾"; }
  }
```
(`buildLabLayers` is hoisted via function declaration, so referencing it from `syncUI` defined earlier is fine — both are top-level in the same script and only called at event/boot time, not during parse.)

- [ ] **Step 2: Make `commitLab` write an immutable lab object** so favorites snapshots (`{...state}`) don't alias a later-mutated object. It already builds a fresh `state.lab={...}` each call — confirm by reading; no change needed if so. If `commitLab` mutates in place, change it to assign a brand-new object. (As written in Task 6 it assigns a fresh object — verify this holds.)

- [ ] **Step 3: Verify (browser, real reloads)**

Open a fresh load, open Lab, tweak a layer → Copy link. Then:
1. Navigate `about:blank`, then paste the copied URL (forces a real reload). Confirm the Lab genome is restored: the panel re-opens pre-filled with the tweaked values and the canvas matches.
   Console: `JSON.stringify(VY.app.state.lab)` equals the `lab=` payload in the URL.
2. With a Lab active, click ★ Save, then 🎲 New design, then click the saved favorite chip → the Lab genome restores (panel re-fills, render matches).

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: restore Lab genome from share links and favorites"
```

---

## Task 8: Docs — README + in-app note

Reflect the new generative engine honestly.

**Files:**
- Modify: `README.md`
- Modify: `index.html` (optional one-line hint near controls — only if it reads naturally; otherwise skip)

- [ ] **Step 1: Update `README.md`.** In the features list, add a bullet describing the generative engine: math-driven "field-function" motifs blended with the documented hero motifs/archetypes via a **Tradition↔Invention** dial, with **Calm↔Wild** and **Minimal↔Ornate** axes, a **Symmetry** control, and a **Lab** panel for editing the underlying genome directly. Note it stays deterministic/shareable. Keep the existing "Interpretations, not authenticity" framing intact (it remains accurate — field motifs are math, not claimed-traditional).

- [ ] **Step 2: Verify**

`README.md` renders; the new capabilities are described accurately and the authenticity framing is unchanged.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe the generative field-function engine + Lab"
```

---

## Self-review notes

- **Spec coverage:** C1 field engine → Tasks 1–2; C2 Tradition↔Invention blend + genome shaping → Tasks 2–3; C3 simple-tier controls → Task 5, Lab tier → Tasks 6–7; C4 integration/determinism/hash/migration → Tasks 3–4 (+7 for lab round-trip); docs → Task 8. All spec sections mapped.
- **Determinism:** new inputs (`tradition`, `symmetry`, `lab`) are added to BOTH the seed string and the hash in Task 4; jitter/render unchanged; genome sampling consumes only the seeded RNG. Determinism console check is repeated in Tasks 4–7 verifications.
- **Type/name consistency:** `makeFieldMotif(m,G)`, `sampleGenome(P,aim)`, `pickSource(r,tr,hasHero)`, `genomeForCFG(m)`, `mergeGenome(base,lab)`, genome shape `{sym,layers:[{coord,wave,freq,phase,weight,slot}],levels,centerStyle}`, CFG fields `{tradition,symmetry,lab,region,variety,dens,P}`, state fields `{tradition,symmetry,lab}`, hash keys `tr/sym/lab` — used consistently across tasks.
- **Migration:** old links lack `tr/sym/lab` → defaults `tradition=20, symmetry=d4, lab=null` (Task 4 step 4 validates/defaults), keeping old links tradition-dominant ≈ today's look (exact pixels not promised across this version, per the spec).
- **Shippable increments:** after Task 5 the field engine + simple controls are fully usable; Lab (6–7) and docs (8) are additive.
- **Visual tuning caveat:** the genome→field aesthetics (Tasks 1–2) are a correct, deterministic, symmetric baseline; the browser-verification steps in Tasks 5–7 are where the look gets eyeballed and the sampler constants tuned if needed.
