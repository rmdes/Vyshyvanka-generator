# Sidebar Accordion Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the sidebar into a sticky action bar + single-open accordion, fix the Lab's horizontal overflow with a compact labeled editor, and add a Lab "🎲 Randomize" and a "Reset all" control — without changing any generation logic, determinism, or state shape.

**Architecture:** Pure UI refactor of `index.html` (aside markup), `styles.css` (accordion/sticky/lab-cell styles), and `app.js` (a small accordion controller + rebuilt Lab editor + two new handlers). Every existing control keeps its DOM id, so `syncUI`, events, the seed string, the URL hash, favorites, undo, and the field engine are untouched.

**Tech Stack:** Plain HTML/CSS/ES2017 JS, classic `<script src>` under `VY`. No build/test runner.

---

## Conventions

No test runner. Generator logic is unchanged, so there's nothing new to unit-test. Verification per task = `node --check app.js` + **id-inventory greps** (prove no control was lost in the markup move) + reading. The **visual** result is verified by the controller (me) via Playwright on the live site after the user redeploys — the sandbox can't serve the page. Browser-visual tuning (sticky offset, spacing) happens in that pass.

**Determinism contract is untouched** (no change to `generate`, the seed string, or `writeHash`/`readHash`). Re-confirm via a Playwright determinism check in the final QA.

---

## Task 1: Sidebar restructure — sticky action bar + single-open accordion

Move every control into a sticky action bar + five accordion sections. Behavior-preserving: all controls keep their ids and handlers; the Lab folds from its own toggle into an accordion section.

**Files:**
- Modify: `index.html` (replace the `<aside>` body)
- Modify: `styles.css` (add accordion/sticky styles)
- Modify: `app.js` (accordion controller; update the Lab open/refill logic; boot)

- [ ] **Step 1: Replace the `<aside>` inner markup in `index.html`.** Replace everything inside `<aside> … </aside>` (currently the brand div + the five `<fieldset>`s + the `.btns` div, roughly lines 13–107) with this — note the `drawerClose` button is kept, ids are all preserved, Undo moves into the sticky bar, and the Lab/exports become accordion sections:

```html
  <button class="drawerClose" id="drawerClose" aria-label="Close controls">✕</button>
  <div class="brand">
    <div class="flagbar"></div>
    <h1>Vyshyvanka</h1>
  </div>

  <div class="actionbar">
    <div class="row">
      <button class="primary" id="gen">🎲 New design</button>
      <button id="undo" title="Undo last design" aria-label="Undo">↶</button>
    </div>
    <input type="text" id="seed" placeholder="seed — type to reproduce" aria-label="Seed" />
  </div>

  <div class="acc">
    <section class="acc-sec" data-sec="design">
      <button class="acc-h" aria-expanded="true" aria-controls="sec-design">Design</button>
      <div class="acc-b" id="sec-design">
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
      </div>
    </section>

    <section class="acc-sec" data-sec="output">
      <button class="acc-h" aria-expanded="false" aria-controls="sec-output">Output</button>
      <div class="acc-b hidden" id="sec-output">
        <label>Mode</label>
        <div class="seg" id="modeSeg" role="radiogroup" aria-label="Output mode">
          <button data-mode="wallpaper" class="on">🖥 Wallpaper</button>
          <button data-mode="panel">🧵 Garment panel</button>
        </div>
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
    </section>

    <section class="acc-sec" data-sec="style">
      <button class="acc-h" aria-expanded="false" aria-controls="sec-style">Style</button>
      <div class="acc-b hidden" id="sec-style">
        <label>Stitch style</label>
        <div class="seg" id="styleSeg" role="radiogroup" aria-label="Stitch style">
          <button data-style="x" class="on">✕ Cross-stitch</button>
          <button data-style="sq">▢ Filled</button>
        </div>
        <label>Cloth background</label>
        <div class="seg" id="bgSeg" role="radiogroup" aria-label="Cloth background"></div>
      </div>
    </section>

    <section class="acc-sec" data-sec="lab">
      <button class="acc-h" aria-expanded="false" aria-controls="sec-lab">🧪 Lab</button>
      <div class="acc-b hidden" id="sec-lab">
        <label>Layers <span class="val" id="labNLayersVal"></span></label>
        <input type="range" id="labNLayers" min="1" max="4" step="1" />
        <label>Color bands (levels) <span class="val" id="labLevelsVal"></span></label>
        <input type="range" id="labLevels" min="2" max="10" step="1" />
        <div id="labLayers"></div>
        <div class="row">
          <button type="button" id="labReset">Reset to seed</button>
        </div>
        <div class="tag">Editing the Lab pins this exact genome (overrides the dice). Reset returns to seed-driven motifs.</div>
      </div>
    </section>

    <section class="acc-sec" data-sec="export">
      <button class="acc-h" aria-expanded="false" aria-controls="sec-export">Export &amp; saved</button>
      <div class="acc-b hidden" id="sec-export">
        <div class="row">
          <button id="png">Download PNG</button>
          <button id="share">Copy link</button>
        </div>
        <div class="row">
          <button id="tile">Download tile</button>
          <button id="chart">Download chart</button>
        </div>
        <div class="row">
          <button id="save">★ Save</button>
        </div>
        <div id="favs" class="favs" aria-label="Saved designs"></div>
      </div>
    </section>
  </div>
```

(The Lab "🎲 Randomize" button is added in Task 3 and the "Reset all" button in Task 4 — leaving the row containers ready.)

- [ ] **Step 2: Add accordion + sticky styles to `styles.css`** (append after the existing `.labLayer label` rule, before `.val`):

```css
.brand{padding-top:2px}
.flagbar{height:6px;width:54px;border-radius:3px;overflow:hidden;margin-bottom:6px;background:linear-gradient(#0057B7 50%,#FFD700 50%)}
.actionbar{position:sticky;top:0;z-index:6;background:var(--panel);margin:0 -18px;padding:12px 18px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.actionbar .row{display:flex;gap:8px}
.actionbar #gen{flex:1}
.actionbar #undo{flex:0 0 auto;width:46px;font-size:16px;line-height:1}
.acc{display:flex;flex-direction:column;gap:8px}
.acc-sec{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.acc-h{width:100%;text-align:left;background:var(--panel2);border:0;color:var(--accent2);text-transform:uppercase;letter-spacing:.8px;font-size:11px;padding:11px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
.acc-h::after{content:"▸";color:var(--muted);font-size:12px}
.acc-h[aria-expanded="true"]::after{content:"▾"}
.acc-h[aria-expanded="true"]{color:#fff;background:var(--panel2)}
.acc-b{padding:12px}
aside{overflow-x:hidden}
```

- [ ] **Step 3: Add the accordion controller to `app.js`.** Replace the existing `#labToggle` handler block (currently the `document.getElementById("labToggle").onclick = …` assignment, ~lines 231–236) with this controller (the Lab's pre-fill-on-open behavior moves into the `openSection` hook):

```js
/* ---- accordion (single-open, persisted) ---- */
const SEC_KEY="vy_openSection";
const SECTIONS=["design","output","style","lab","export"];
function openSection(key){
  if(!SECTIONS.includes(key)) key="design";
  SECTIONS.forEach(s=>{
    const sec=document.querySelector(`.acc-sec[data-sec="${s}"]`);
    const h=sec.querySelector(".acc-h"), b=sec.querySelector(".acc-b");
    const on=(s===key);
    b.classList.toggle("hidden",!on);
    h.setAttribute("aria-expanded",String(on));
  });
  try{localStorage.setItem(SEC_KEY,key);}catch{}
  if(key==="lab" && !state.lab) openLabFromSeed();
}
document.querySelectorAll(".acc-h").forEach(h=>{
  h.onclick=()=>openSection(h.closest(".acc-sec").dataset.sec);
});
```

- [ ] **Step 4: Update the Lab refill in `syncUI` (no force-open).** The current `syncUI` ends with a block that refills the Lab AND force-opens `#labBody`/`#labToggle` (those elements no longer exist). Replace that block (currently `if(state.lab && Array.isArray(state.lab.layers)){ … labBody … }`) with a refill-only version:

```js
  if(state.lab && Array.isArray(state.lab.layers)){
    document.getElementById("labNLayers").value=state.lab.layers.length;
    document.getElementById("labNLayersVal").textContent=state.lab.layers.length;
    document.getElementById("labLevels").value=state.lab.levels;
    document.getElementById("labLevelsVal").textContent=state.lab.levels;
    buildLabLayers(state.lab);
  }
```

- [ ] **Step 5: Auto-reveal the Lab on favorite restore.** In `renderFavs`, the chip click handler is `b.onclick=()=>{Object.assign(state,f.state);syncUI();generate();};`. Change it to open the Lab section when the restored favorite has a lab:

```js
    b.onclick=()=>{Object.assign(state,f.state);syncUI();generate();if(state.lab)openSection("lab");};
```

- [ ] **Step 6: Update boot to set the open section.** The boot line is `readHash();syncUI();generate(false);renderFavs();`. Replace it with:

```js
readHash();syncUI();generate(false);renderFavs();
let _open="design"; try{const k=localStorage.getItem(SEC_KEY); if(SECTIONS.includes(k)) _open=k;}catch{}
if(state.lab) _open="lab";
openSection(_open);
```

(`openSection`, `SECTIONS`, `SEC_KEY` are defined above this line in Step 3, so they're in scope; `openLabFromSeed`/`buildLabLayers` are hoisted function declarations.)

- [ ] **Step 7: Verify (node + id inventory)**

Run: `node --check app.js`
Expected: passes.

Run the id-inventory check (every control id must still be present exactly once in index.html — proves nothing was dropped in the move):
```bash
for id in region regionNote complexity cxVal variety vyVal tradition trVal symSeg \
  modeSeg wallControls res layoutSeg scaleSeg panelControls shapeSeg styleSeg bgSeg \
  seed gen undo png share tile chart save favs \
  labNLayers labNLayersVal labLevels labLevelsVal labLayers labReset drawerClose; do \
  c=$(grep -c "id=\"$id\"" index.html); [ "$c" = "1" ] && echo "ok $id" || echo "MISSING/DUP $id ($c)"; done
```
Expected: every line `ok …`. Confirm there is NO remaining reference to the removed ids `labToggle`/`labBody`/`labPanel` in app.js: `grep -n "labToggle\|labBody\|labPanel" app.js` → no matches.

(Visual verification — sticky bar pins, one-open accordion, no horizontal scroll, persistence — is done by the controller via Playwright after deploy.)

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: sticky action bar + single-open accordion sidebar"
```

---

## Task 2: Compact Lab editor (fix horizontal overflow)

Rebuild each layer's editor as labeled cells that shrink to the column, eliminating the 398px-wide row.

**Files:**
- Modify: `app.js` (`buildLabLayers`)
- Modify: `styles.css` (lab-cell layout)

- [ ] **Step 1: Rewrite `buildLabLayers` in `app.js`** to wrap each control in a labeled cell laid out 2-up. Replace the entire current `buildLabLayers` function with:

```js
function buildLabLayers(G){
  const host=document.getElementById("labLayers"); host.innerHTML="";
  G.layers.forEach((L,i)=>{
    const box=document.createElement("div"); box.className="labLayer";
    box.innerHTML=`<label>Layer ${i+1}</label>`;
    const grid=document.createElement("div"); grid.className="labgrid";
    const cell=(name,el)=>{const c=document.createElement("div");c.className="labf";
      const s=document.createElement("span");s.textContent=name;c.append(s,el);
      el.title=name; el.setAttribute("aria-label",`Layer ${i+1} ${name}`); return c;};
    const sel=(opts,val)=>{const s=document.createElement("select");opts.forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===val)op.selected=true;s.appendChild(op);});return s;};
    const num=(v,step,min,max)=>{const n=document.createElement("input");n.type="number";n.value=v;n.step=step;if(min!=null)n.min=min;if(max!=null)n.max=max;return n;};
    const coord=sel(LAB_COORDS,L.coord), wave=sel(LAB_WAVES,L.wave);
    const freq=num(L.freq,0.1), phase=num(L.phase,0.05), weight=num(L.weight,0.1,0), slot=num(L.slot,1,1);
    grid.append(cell("coord",coord),cell("wave",wave),cell("freq",freq),cell("phase",phase),cell("weight",weight),cell("slot",slot));
    box.appendChild(grid); host.appendChild(box);
    [coord,wave,freq,phase,weight,slot].forEach(el=>el.onchange=commitLab);
    box._get=()=>({coord:coord.value,wave:wave.value,freq:+freq.value,phase:+phase.value,weight:+weight.value,slot:Math.max(1,Math.round(+slot.value))});
  });
}
```

- [ ] **Step 2: Replace the lab-cell CSS in `styles.css`.** Replace the existing `.labLayer .lrow` and `.labLayer select,.labLayer input` rules with a grid of shrinking labeled cells:

```css
.labLayer{border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:6px}
.labLayer>label{margin:0 0 4px}
.labgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.labf{display:flex;flex-direction:column;min-width:0}
.labf span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.labf select,.labf input{width:100%;min-width:0;box-sizing:border-box;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:4px 6px;font:inherit}
```

(The old `.labLayer label` rule and `#labPanel legend button` rule are now dead — remove `#labPanel legend button` since `#labPanel` no longer exists; leave the rest.)

- [ ] **Step 3: Verify**

Run: `node --check app.js`
Expected: passes.

Confirm structure: `grep -n "labgrid\|labf" styles.css` shows the new rules; `grep -c "_get" app.js` ≥ 1 (the per-layer getter is preserved so `commitLab` still reads complete layers). The horizontal-overflow fix is confirmed visually in the post-deploy Playwright pass (column has no horizontal scrollbar with the Lab open).

- [ ] **Step 4: Commit**

```bash
git add app.js styles.css
git commit -m "feat: compact labeled Lab editor that fits the column (no h-scroll)"
```

---

## Task 3: Lab "🎲 Randomize" button

A button that re-rolls a fresh random genome from the current aim and pins it.

**Files:**
- Modify: `index.html` (button in the Lab section)
- Modify: `app.js` (handler)

- [ ] **Step 1: Add the button to `index.html`.** In the Lab section's button row (currently `<div class="row"><button type="button" id="labReset">Reset to seed</button></div>`), add Randomize before Reset:

```html
        <div class="row">
          <button type="button" id="labRandom">🎲 Randomize</button>
          <button type="button" id="labReset">Reset to seed</button>
        </div>
```

- [ ] **Step 2: Add the handler in `app.js`.** Immediately after the `#labReset` handler (`document.getElementById("labReset").onclick = …`), add:

```js
document.getElementById("labRandom").onclick=()=>{
  const P=state.mode==="wallpaper"?VY.applyBg(VY.REGIONS[state.region],state.bg):VY.REGIONS[state.region];
  const dens=Math.max(1,Math.min(5,+state.complexity+P.densityBias));
  VY.gen.setSeed(Math.random().toString(36).slice(2)+"|labrnd");  // transient; generate() reseeds before render
  const G=VY.gen.sampleGenome(P,{ornate:dens,wild:state.variety/100,tradition:state.tradition/100,symmetry:state.symmetry});
  state.lab={ levels:G.levels, centerStyle:G.centerStyle, layers:G.layers };
  document.getElementById("labNLayers").value=G.layers.length;
  document.getElementById("labNLayersVal").textContent=G.layers.length;
  document.getElementById("labLevels").value=G.levels;
  document.getElementById("labLevelsVal").textContent=G.levels;
  buildLabLayers(G);
  generate();
};
```

(This mirrors `labCurrentGenome` but seeds from `Math.random()` for a fresh roll, pins a fresh immutable `state.lab`, refills the editors, and renders. The produced genome is concrete, so it serializes to the hash and stays shareable.)

- [ ] **Step 3: Verify**

Run: `node --check app.js`
Expected: passes.

Confirm: `grep -c 'id="labRandom"' index.html` = 1; `grep -c 'labRandom").onclick' app.js` = 1. Functional check (Randomize pins a new lab, re-renders) is verified in the post-deploy Playwright pass.

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "feat: Lab Randomize button (re-roll genome from current aim)"
```

---

## Task 4: "Reset all" button + shared DEFAULTS

A button that clears our localStorage, resets state to defaults, clears the URL hash, and re-renders.

**Files:**
- Modify: `app.js` (DEFAULTS object; state from it; reset handler)
- Modify: `index.html` (button in Export & saved)

- [ ] **Step 1: Introduce a shared `DEFAULTS` object in `app.js`.** Replace the current `state` initializer:

```js
const state={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:20,symmetry:"d4",lab:null};
```
with a `DEFAULTS` constant + a state copy (single source of truth for both init and reset):

```js
const DEFAULTS={mode:"wallpaper",region:"hutsul",complexity:3,variety:45,style:"x",seed:"vyshyvanka",
             res:"screen",layout:"fabric",bg:"charcoal",scale:"medium",shape:"sleeve",
             tradition:20,symmetry:"d4",lab:null};
const state={...DEFAULTS};
```

- [ ] **Step 2: Add the button to `index.html`.** In the Export & saved section's `★ Save` row, add Reset all next to it:

```html
        <div class="row">
          <button id="save">★ Save</button>
          <button id="resetAll">Reset all</button>
        </div>
```

- [ ] **Step 3: Add the reset handler in `app.js`.** After the `#save` handler block, add:

```js
document.getElementById("resetAll").onclick=()=>{
  if(!confirm("Reset everything? This clears your saved favorites and returns all controls to defaults.")) return;
  try{localStorage.removeItem(FAV_KEY);localStorage.removeItem(SEC_KEY);}catch{}
  Object.assign(state,DEFAULTS,{lab:null});
  history.replaceState(null,"",location.pathname+location.search);
  syncUI(); generate(false); renderFavs(); openSection("design");
};
```

(`FAV_KEY` and `SEC_KEY` are defined earlier in the file; `Object.assign(state,DEFAULTS,{lab:null})` resets in place so the existing `state` reference everywhere stays valid; clearing the hash uses `location.pathname+location.search` to drop only the `#…` fragment.)

- [ ] **Step 4: Verify**

Run: `node --check app.js`
Expected: passes.

Confirm: `grep -c 'id="resetAll"' index.html` = 1; `grep -c "DEFAULTS" app.js` ≥ 3 (definition, `{...DEFAULTS}`, reset `Object.assign`); `grep -c 'resetAll").onclick' app.js` = 1. Functional check (confirm dialog, favorites cleared, state defaulted, hash cleared, accordion back to design) is verified in the post-deploy Playwright pass.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "feat: Reset all (clear storage + restore defaults) via shared DEFAULTS"
```

---

## Self-review notes

- **Spec coverage:** sticky action bar + single-open accordion + persistence → Task 1; section grouping (Design/Output/Style/Lab/Export) → Task 1 markup; compact Lab editor (labeled cells, no h-scroll) → Task 2; Lab "🎲 Randomize" → Task 3; "Reset all" + shared DEFAULTS + hash clear → Task 4. All spec sections mapped.
- **Id preservation:** Task 1 Step 7 greps every control id to prove the markup move dropped nothing; removed ids (`labToggle`/`labBody`/`labPanel`) are grep-checked absent from app.js.
- **No logic change:** `generate`, the seed string, `writeHash`/`readHash`, favorites/undo, and the field engine are untouched; only the Lab open/refill wiring changes (force-open removed from `syncUI`; open-on-restore moved to boot + favorite click + the accordion hook). Determinism re-confirmed in the final Playwright QA.
- **Type/name consistency:** `openSection`, `SECTIONS`, `SEC_KEY`, `FAV_KEY`, `DEFAULTS`, `buildLabLayers`, `openLabFromSeed`, `commitLab`, `labCurrentGenome`, `state.lab` shape `{levels,centerStyle,layers}`, and the new ids `labRandom`/`resetAll` are used consistently across tasks.
- **Shippable increments:** Task 1 leaves the app fully working with the new layout; Tasks 2–4 are additive polish/features.
- **Browser-visual caveat:** sticky-bar pixel offset and spacing are tuned in the post-deploy Playwright pass; the structural correctness (ids, controller, no-logic-change) is what the per-task greps + `node --check` guarantee.
```
