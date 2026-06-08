# Colour Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom cloth-background colour, editable per-thread colours, and saved reusable palettes — as a pure recolour overlay that's shareable (URL hash) but never reshuffles the pattern (not in the seed).

**Architecture:** A new pure `VY.applyColors(P, bgColor, threadCols)` recolours the built palette (bg + thread hexes only) right before composition; `bgColor`/`threadCols` live in `state` + the hash but NOT the seed string, so recolouring regenerates the same grid with new colours. A new "🎨 Colour" accordion section drives it; saved palettes live in localStorage. No generator/render/viewport changes.

**Tech Stack:** Plain ES2017 JS, Canvas2D, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/colour-control` off `main` (v1.3.0 + authenticity).

---

## Conventions

No test runner. `VY.applyColors` is pure → node `vm`-sandbox testable. The `app.js` plumbing + UI is DOM-bound → verified by `node --check` + grep here, and the controller's live Playwright pass after deploy. Temp tests in `/tmp`, never committed.

**Determinism invariant:** `bgColor`/`threadCols` must NEVER be added to the `generate()` seed string (line ~79). They go only in the hash. `applyColors` must change only `bg` + `threads` hexes — never `colorBias`/`densityBias` — so the grid is byte-identical and recolouring never re-randomises the pattern.

**Array-reference safety:** `state.threadCols` is an array; `state={...DEFAULTS}` and `Object.assign(state, ...)` copy the *reference*. The only in-place writer (the swatch handler) MUST clone-before-set (`const tc=state.threadCols.slice(); tc[i]=v; state.threadCols=tc;`) so it never mutates `DEFAULTS.threadCols` or a saved favourite/palette's array.

---

## Task 1: `data.js` — `VY.applyColors`

**Files:** Modify `data.js`.

- [ ] **Step 1: Add the function** right after `VY.applyBg` (the `applyBg` function ends ~line 160):
```js
// Pure recolour overlay: replaces bg + thread *hexes* only (never colorBias/densityBias),
// so the generated grid is unaffected. bgColor=null + empty threadCols => returns P unchanged.
VY.applyColors=function applyColors(P, bgColor, threadCols){
  if(!bgColor && !(threadCols && threadCols.length)) return P;
  return { ...P,
    bg: bgColor || P.bg,
    threads: P.threads.map((t,i)=> (threadCols && threadCols[i]) || t) };
};
```

- [ ] **Step 2: Test** `/tmp/vy_col_test.js`:
```js
const fs=require('fs'), vm=require('vm');
const sb={Object,JSON,console,Array}; sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/data.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const eq=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
const P={bg:"#101010", threads:["#aa0000","#111111","#ddaa22"], colorBias:[0,0,1,2], densityBias:1};
// no-op when no overrides
assert(VY.applyColors(P,null,[])===P, 'no overrides -> same object (no-op)');
assert(VY.applyColors(P,null,undefined)===P, 'undefined threadCols -> no-op');
// bg override only
const a=VY.applyColors(P,"#223344",[]);
eq(a.bg,"#223344",'bg overridden'); eq(a.threads,P.threads,'threads untouched when only bg set');
// sparse thread overrides
const b=VY.applyColors(P,null,["#ff0000","","#00ff00"]);
eq(b.threads,["#ff0000","#111111","#00ff00"],'threads 0,2 overridden; 1 default (empty kept)');
eq(b.bg,P.bg,'bg default when bgColor null');
// CRITICAL: grid-relevant fields never change
eq(b.colorBias,P.colorBias,'colorBias unchanged (grid invariant)');
assert(b.densityBias===P.densityBias,'densityBias unchanged');
assert(b.threads.length===P.threads.length,'thread count unchanged');
// original P not mutated
eq(P.threads,["#aa0000","#111111","#ddaa22"],'input P not mutated');
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

- [ ] **Step 3: Run** — `node --check data.js && node /tmp/vy_col_test.js && rm /tmp/vy_col_test.js`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**
```bash
git add data.js
git commit -m "feat: VY.applyColors pure recolour overlay (bg + thread hexes; colorBias untouched)"
```

---

## Task 2: `app.js` — recolour plumbing, hash, resets (no UI yet)

**Files:** Modify `app.js`.

- [ ] **Step 1: Add state defaults.** In `DEFAULTS` (lines ~21-23) add the two fields before the closing brace:
```js
             tradition:45,symmetry:"d4",lab:null,viewX:null,viewY:null,viewZoom:null,
             bgColor:null,threadCols:[]};
```
Then directly after `const state={...DEFAULTS};` (line ~24) add a fresh-array guard:
```js
state.threadCols=[];
```

- [ ] **Step 2: Apply the overlay in `generate()`.** Change the palette line (~80) from `const P=…` to `let P=…` and recolour + stash. Replace:
```js
  const P=(state.mode==="wallpaper"||state.mode==="explore")?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
```
with:
```js
  let P=(state.mode==="wallpaper"||state.mode==="explore")?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  P=VY.applyColors(P, state.bgColor, state.threadCols);
  VY.app._palette=P;
```
(The seed string on line ~79 is ABOVE this and is NOT touched — colours never enter the seed. `dens` on the next line reads `P.densityBias`, which `applyColors` preserves.)

- [ ] **Step 3: Hash — write.** In `writeHash()` (line ~149), after the `if(state.lab)…` clause and before `const p=new URLSearchParams(o);`, add:
```js
if(state.bgColor)o.bgc=state.bgColor.replace(/^#/,"");
if(state.threadCols&&state.threadCols.some(Boolean))o.thr=state.threadCols.map(c=>c?c.replace(/^#/,""):"").join(",");
```

- [ ] **Step 4: Hash — read.** In `readHash()` (after the `lab` parse line ~156, before the `vox` line ~157), add:
```js
  const _hx=s=>/^[0-9a-fA-F]{6}$/.test(s)?("#"+s.toLowerCase()):null;
  const bgc=_hx(g("bgc","")); if(bgc) state.bgColor=bgc;
  const thr=g("thr",""); if(thr) state.threadCols=thr.split(",").map(s=>_hx(s)||"");
```

- [ ] **Step 5: `resetColors()` + wire into the three palette-changing handlers.** Add near `resetView` (line ~161):
```js
function resetColors(){ state.bgColor=null; state.threadCols=[]; }
```
Then:
- Mode (line ~162): `[...document.getElementById("modeSeg").children].forEach(b=>b.onclick=()=>{resetView();resetColors();state.mode=b.dataset.mode;syncUI();generate();});`
- Region (line ~164): `regionSel.onchange=e=>{resetView();resetColors();state.region=e.target.value;syncUI();generate();};`
- `buildSeg` (line ~30): change its `onclick` to reset colours only for the bg seg:
```js
function buildSeg(id,items,key){const el=document.getElementById(id);items.forEach(([v,lbl])=>{const b=document.createElement("button");b.dataset.v=v;b.textContent=lbl;b.onclick=()=>{resetView();if(key==="bg")resetColors();state[key]=v;syncUI();generate();};el.appendChild(b);});}
```

- [ ] **Step 6: Verify.** Run `node --check app.js` (expect pass). Then:
```bash
grep -n 'applyColors' app.js          # expect 1 (in generate)
grep -n 'bgc\|thr' app.js | head      # bgc/thr in writeHash + readHash
grep -n 'state\.bgColor\|state\.threadCols' app.js   # seed line ~79 must NOT appear
```
Confirm the seed string line (`VY.gen.setSeed(...)`) does NOT contain `bgColor`/`threadCols`. Live determinism is the controller's pass.

- [ ] **Step 7: Commit**
```bash
git add app.js
git commit -m "feat: recolour plumbing — applyColors in generate, bgc/thr hash, resetColors on region/bg/mode"
```

---

## Task 3: Colour UI — section, custom bg, thread swatches, reset

**Files:** Modify `index.html`, `app.js`, `styles.css`.

- [ ] **Step 1: Move the cloth-bg control out of Style and into a new Colour section** (`index.html`). In the Style section, DELETE these two lines:
```html
        <label>Cloth background</label>
        <div class="seg" id="bgSeg" role="radiogroup" aria-label="Cloth background"></div>
```
Then INSERT a new section immediately after the Style `</section>` (before the Export section):
```html
    <section class="acc-sec" data-sec="colour">
      <button class="acc-h" aria-expanded="false" aria-controls="sec-colour">🎨 Colour</button>
      <div class="acc-b hidden" id="sec-colour">
        <label>Cloth background</label>
        <div class="seg" id="bgSeg" role="radiogroup" aria-label="Cloth background"></div>
        <label for="bgColor">Custom cloth colour</label>
        <input type="color" id="bgColor" class="wide" aria-label="Custom cloth colour" />
        <label>Thread colours</label>
        <div id="threadSwatches" class="swatches" aria-label="Thread colours"></div>
        <button id="resetColors" class="wide">↺ Reset colours</button>
      </div>
    </section>
```
(`#bgSeg` keeps its id, so `buildSeg("bgSeg",…)` still finds it.)

- [ ] **Step 2: Register the section** (`app.js`, line ~271). Change:
```js
const SECTIONS=["design","lab","output","style","export"];
```
to:
```js
const SECTIONS=["design","lab","output","style","colour","export"];
```

- [ ] **Step 3: Swatch + custom-bg rendering** (`app.js`). Add this function near the other render helpers (e.g. after `renderFavs`, ~line 198):
```js
function renderSwatches(){
  const P=VY.app._palette; if(!P) return;
  const bgInp=document.getElementById("bgColor"); if(bgInp) bgInp.value=state.bgColor||P.bg;
  const host=document.getElementById("threadSwatches"); if(!host) return; host.innerHTML="";
  P.threads.forEach((hex,i)=>{
    const inp=document.createElement("input"); inp.type="color"; inp.value=hex;
    inp.title="Thread "+(i+1); inp.setAttribute("aria-label","Thread "+(i+1)+" colour");
    inp.onchange=()=>{ const tc=state.threadCols.slice(); tc[i]=inp.value; state.threadCols=tc; generate(); };
    host.appendChild(inp);
  });
}
```

- [ ] **Step 4: Call `renderSwatches()` at the end of `generate()`** so swatches track the live palette. At the very end of `generate()` (after `if(updateHash)writeHash();`, before the closing `}`, ~line 145) add:
```js
  renderSwatches();
```

- [ ] **Step 5: Wire the custom-bg picker + Reset colours** (`app.js`, near the other event handlers, ~line 166). Add:
```js
document.getElementById("bgColor").oninput=e=>{ state.bgColor=e.target.value; generate(); };
document.getElementById("resetColors").onclick=()=>{ resetColors(); generate(); };
```
(These call `generate()` WITHOUT `resetView()` — same grid, new colours, pan/zoom preserved. `generate()` reseeds from the unchanged seed string, so the pattern is identical.)

- [ ] **Step 6: Styles** (`styles.css`). Add near the other control styles (e.g. after the `.favs` block, ~line 45):
```css
.swatches{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.swatches input[type=color]{width:34px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px;background:var(--panel2);cursor:pointer}
#bgColor{height:32px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);cursor:pointer}
```

- [ ] **Step 7: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c 'data-sec="colour"' index.html        # expect 1
grep -c 'id="bgSeg"' index.html               # expect 1 (moved, not duplicated)
grep -c 'renderSwatches' app.js               # expect >=2 (def + call)
```
Browser verification (swatches recolour without reshuffling, bg picker, reset) is the controller's live pass — state you cannot run a browser.

- [ ] **Step 8: Commit**
```bash
git add index.html app.js styles.css
git commit -m "feat: Colour section — custom cloth picker + per-thread swatches + reset"
```

---

## Task 4: Saved palettes (localStorage)

**Files:** Modify `index.html`, `app.js`.

- [ ] **Step 1: Markup** (`index.html`). Inside `#sec-colour`, after the `#resetColors` button (before the closing `</div>` of the section body), add:
```html
        <label>Saved palettes</label>
        <button id="palSave" class="wide">★ Save palette</button>
        <div id="palettes" class="pals" aria-label="Saved palettes"></div>
```

- [ ] **Step 2: Styles** (`styles.css`, after the `.swatches` block from Task 3):
```css
.pals{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.pals .pal{display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:4px 8px}
.pals .pal .nm{flex:1;cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pals .pal .sw{display:flex;gap:2px}
.pals .pal .sw i{width:12px;height:12px;border-radius:2px;display:block}
.pals .pal .rm{background:none;border:0;color:var(--muted);cursor:pointer;padding:0 2px;font-size:12px}
```

- [ ] **Step 3: Palette CRUD + render** (`app.js`, after `renderSwatches`). Add:
```js
const PAL_KEY="vy_palettes";
const loadPals=()=>{try{return JSON.parse(localStorage.getItem(PAL_KEY))||[];}catch{return[];}};
const savePals=(a)=>{try{localStorage.setItem(PAL_KEY,JSON.stringify(a));return true;}catch{return false;}};
function renderPalettes(){
  const wrap=document.getElementById("palettes"); if(!wrap) return; wrap.innerHTML="";
  loadPals().forEach((pal,idx)=>{
    const row=document.createElement("div"); row.className="pal";
    const sw=document.createElement("div"); sw.className="sw";
    [pal.bgColor,...(pal.threadCols||[])].filter(Boolean).slice(0,6).forEach(hx=>{const i=document.createElement("i");i.style.background=hx;sw.appendChild(i);});
    const nm=document.createElement("span"); nm.className="nm"; nm.textContent=pal.name; nm.title="Apply "+pal.name;
    nm.onclick=()=>{ const P=VY.app._palette;
      state.bgColor=pal.bgColor||null;
      state.threadCols=(pal.threadCols||[]).slice(0, P?P.threads.length:6);
      generate(); };
    const rm=document.createElement("button"); rm.className="rm"; rm.textContent="✕"; rm.title="Delete";
    rm.onclick=()=>{ const a=loadPals(); a.splice(idx,1); savePals(a); renderPalettes(); };
    row.append(sw,nm,rm); wrap.appendChild(row);
  });
}
document.getElementById("palSave").onclick=()=>{
  const P=VY.app._palette; if(!P) return;
  const name=(prompt("Name this palette:","palette "+(loadPals().length+1))||"").trim(); if(!name) return;
  const a=loadPals();
  a.unshift({ name, bgColor: state.bgColor||P.bg, threadCols: P.threads.slice() });
  if(!savePals(a.slice(0,24))) alert("Couldn't save palette (storage full or unavailable).");
  renderPalettes();
};
```
(Save captures the *effective* colours: the displayed bg + the full displayed thread list — so it's a complete, universally-applicable scheme. Apply clamps `threadCols` to the current palette's thread count. Both `generate()` calls omit `resetView` to keep the view.)

- [ ] **Step 4: Render on boot.** In the boot line (~319) add `renderPalettes()`:
```js
readHash();syncUI();generate(false);renderFavs();renderPalettes();
```

- [ ] **Step 5: Clear saved palettes in Reset all.** In the `#resetAll` handler (~line 211), add `PAL_KEY` to the removed keys:
```js
  try{localStorage.removeItem(FAV_KEY);localStorage.removeItem(SEC_KEY);localStorage.removeItem(PAL_KEY);}catch{}
```
and add `renderPalettes();` to that handler's final line alongside `renderFavs();`.

- [ ] **Step 6: Verify.** `node --check app.js` (expect pass). Greps:
```bash
grep -c 'id="palSave"' index.html      # expect 1
grep -c 'PAL_KEY' app.js               # expect >=4 (def, load, save, resetAll)
grep -c 'renderPalettes' app.js        # expect >=4 (def, boot, palSave-path via render, resetAll)
```
Live pass (save/apply across regions, persist across reload, delete) by the controller.

- [ ] **Step 7: Commit**
```bash
git add index.html app.js styles.css
git commit -m "feat: saved universal palettes (localStorage) — save/apply/delete"
```

---

## Self-review notes

- **Spec coverage:** `applyColors` pure overlay → Task 1; state + generate recolour + hash + resets → Task 2; custom bg + thread swatches + reset + Colour section → Task 3; saved universal palettes → Task 4. Determinism (hash-not-seed) enforced in Task 2 (seed line untouched; grep guard). Reset-on-region/bg/mode → Task 2 Step 5. No generator/render/viewport edits anywhere. All spec sections mapped.
- **Determinism:** `bgColor`/`threadCols` never added to the seed string; `applyColors` leaves `colorBias`/`densityBias`; colour-change handlers call `generate()` without `resetView` (same grid, view kept). Back-compat: no `bgc`/`thr` in a link → `applyColors` no-ops → identical render.
- **Array-ref safety:** `state.threadCols=[]` after `{...DEFAULTS}`; the swatch handler clones-before-set; apply/readHash assign fresh arrays — `DEFAULTS.threadCols` and saved entries never mutated.
- **Type/name consistency:** `bgColor` (string|null), `threadCols` (array of hex|""), `VY.applyColors(P,bgColor,threadCols)`, `VY.app._palette`, `renderSwatches`, `renderPalettes`, `resetColors`, `PAL_KEY`, ids `#bgColor`/`#threadSwatches`/`#resetColors`/`#palSave`/`#palettes`, section `data-sec="colour"`. Consistent across tasks.
- **Placeholder scan:** none — exact code, exact commands.
- **Live verification (controller, after deploy):** (1) fix a seed, recolour a thread + bg → grid identical, only colours change, viewport unmoved; (2) old share link pixel-identical; (3) `bgc`/`thr` link restores colours, malformed ignored; (4) region/bg/mode switch resets overrides; (5) save a palette, switch region, apply it (clamped), reload → persists; (6) all 3 modes recolour; 0 console errors.
```
