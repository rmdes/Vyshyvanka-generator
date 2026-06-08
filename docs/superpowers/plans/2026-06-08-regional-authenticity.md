# Regional Authenticity Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the six regional styles as formal-trait names with the region demoted to "inspired by", tendency-worded notes, per-region further-reading links, a strengthened disclaimer, and looser place-named motif tags — without changing any region key, palette, or bias (so seeds/share links stay identical).

**Architecture:** Pure labelling/data/copy change. `data.js` restructures `VY.REGIONS` (keys + palettes + biases byte-identical) and re-tags three hero motifs; `app.js` reads the new `formal`/`inspiredBy`/`note`/`src` fields at its three existing consumer sites; `index.html` + `README.md` get the strengthened framing. No generator/render/viewport changes.

**Tech Stack:** Plain ES2017 JS, classic `<script src>` under `VY`, no build/test-runner/modules. On `feature/regional-authenticity` off `main` @ v1.3.0.

---

## Conventions

No test runner. `data.js` is pure data + `applyBg`; testable in a Node `vm` sandbox. `app.js`/`index.html`/`README.md` changes are DOM/copy — verified by `node --check` + grep here, and by the controller's live Playwright pass after deploy.

**The determinism guard (most important test):** Task 1's test asserts every region's `threads`/`colorBias`/`densityBias`/`bg` is **byte-identical to the current values** after the restructure — that is what keeps existing share links reproducing pixel-identically. Region keys must stay exactly `poltava, hutsul, borshchiv, bukovyna, polissia, chernihiv`.

---

## Task 1: `data.js` — restructure REGIONS + loosen 3 motif tags

**Files:** Modify `data.js`.

- [ ] **Step 1: Replace the `VY.REGIONS={...}` object** (current lines ~135-154) with (keys, palettes, colorBias, densityBias, bg all preserved exactly; `name` → `formal`+`inspiredBy`; notes reworded; `src` added):

```js
VY.REGIONS={
  poltava  :{formal:"Red on white", inspiredBy:"Poltava",
             note:"Often sparse and restrained — single-colour red on light linen.",
             src:"https://en.wikipedia.org/wiki/Poltava_Oblast", bg:"#f3ece0",
             threads:["#b3271e","#7a1a16","#5c5c5c"], colorBias:[0,0,0,1,2], densityBias:-1},
  hutsul   :{formal:"Dense polychrome", inspiredBy:"Hutsul",
             note:"Tends to dense, high-contrast polychrome — red, black, gold, green, orange.",
             src:"https://en.wikipedia.org/wiki/Hutsuls", bg:"#efe7d6",
             threads:["#c0271f","#141414","#e0a92e","#2f7d4f","#d9762b"], colorBias:[0,1,2,3,4], densityBias:+1},
  borshchiv:{formal:"Black-dominant", inspiredBy:"Borshchiv / Podillia",
             note:"Often heavy black grounds with red accents.",
             src:"https://en.wikipedia.org/wiki/Podilia", bg:"#efe8d9",
             threads:["#161616","#0c0c0c","#a02620","#3a3a3a"], colorBias:[0,0,1,0,2], densityBias:+1},
  bukovyna :{formal:"Lilac & bronze", inspiredBy:"Bukovyna",
             note:"Fine geometry; often red & black with lilac and metallic bronze.",
             src:"https://en.wikipedia.org/wiki/Bukovina", bg:"#f0e9da",
             threads:["#b0241d","#161616","#7a5cab","#b08a2e","#2c6e63"], colorBias:[0,1,2,3,4], densityBias:0},
  polissia :{formal:"Bold archaic red", inspiredBy:"Polissia",
             note:"Bold red; archaic geometric banding.",
             src:"https://en.wikipedia.org/wiki/Polesia", bg:"#f4eee2",
             threads:["#bf2118","#7a140f","#3a3a3a"], colorBias:[0,0,0,1,2], densityBias:0},
  chernihiv:{formal:"Sparse white & red", inspiredBy:"Chernihiv",
             note:"Often sparse and delicate — red with grey on a white ground.",
             src:"https://en.wikipedia.org/wiki/Chernihiv_Oblast", bg:"#f6f1e7",
             threads:["#b8281f","#9c9c9c","#5c5c5c"], colorBias:[0,0,1,2], densityBias:-1},
};
```
(Leave `VY.applyBg` directly below it unchanged.)

- [ ] **Step 2: Loosen the three weakest place-named hero motifs.** Make these exact edits in the `VY.HERO_MOTIFS` array (comment line + the `{ id… }` opening line only; the grid rows stay):

`borshchiv-cross` →
- comment `  // Borshchiv black cross — black-dominant Podillia, dense cross with red accents.` becomes `  // Dense black/red cross — black-dominant geometric (associated with Podillia).`
- line `  { id:"borshchiv-cross", regions:["borshchiv","bukovyna"], src:"https://en.wikipedia.org/wiki/Borshchiv", grid:[` becomes `  { id:"black-cross", regions:["borshchiv","bukovyna","hutsul","polissia"], src:"https://en.wikipedia.org/wiki/Podilia", grid:[`

`bukovyna-geometric` →
- comment `  // Bukovyna geometric — fine interlocking diamonds.` becomes `  // Fine interlocking diamonds — geometric fill.`
- line `  { id:"bukovyna-geometric", regions:["bukovyna","borshchiv"], src:"https://en.wikipedia.org/wiki/Bukovina", grid:[` becomes `  { id:"interlocking-diamonds", regions:["bukovyna","borshchiv","hutsul"], src:"https://en.wikipedia.org/wiki/Bukovina", grid:[`

`chernihiv-cross` →
- comment `  // Chernihiv delicate cross — sparse white/red, fine geometry.` becomes `  // Sparse, delicate cross in red — fine white-ground geometry.`
- line `  { id:"chernihiv-cross", regions:["chernihiv","poltava"], src:"https://en.wikipedia.org/wiki/Chernihiv", grid:[` becomes `  { id:"fine-cross", regions:["chernihiv","poltava","polissia"], src:"https://en.wikipedia.org/wiki/Chernihiv_Oblast", grid:[`

- [ ] **Step 3: Write the test** `/tmp/vy_auth_test.js`:
```js
const fs=require('fs'), vm=require('vm');
const sb={Object,JSON,console,Array}; sb.window=sb; sb.VY={}; sb.window.VY=sb.VY; vm.createContext(sb);
vm.runInContext(fs.readFileSync(process.cwd()+'/data.js','utf8'), sb);
const VY=sb.VY; let ok=true; const assert=(c,m)=>{if(!c){ok=false;console.log('FAIL',m);}};
const eq=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
// keys unchanged (exact set + order-independent)
eq(Object.keys(VY.REGIONS).sort(), ["borshchiv","bukovyna","chernihiv","hutsul","poltava","polissia"], 'region keys unchanged');
// DETERMINISM GUARD: palettes/biases/bg byte-identical to current values
const PAL={
  poltava  :{bg:"#f3ece0", threads:["#b3271e","#7a1a16","#5c5c5c"], colorBias:[0,0,0,1,2], densityBias:-1},
  hutsul   :{bg:"#efe7d6", threads:["#c0271f","#141414","#e0a92e","#2f7d4f","#d9762b"], colorBias:[0,1,2,3,4], densityBias:1},
  borshchiv:{bg:"#efe8d9", threads:["#161616","#0c0c0c","#a02620","#3a3a3a"], colorBias:[0,0,1,0,2], densityBias:1},
  bukovyna :{bg:"#f0e9da", threads:["#b0241d","#161616","#7a5cab","#b08a2e","#2c6e63"], colorBias:[0,1,2,3,4], densityBias:0},
  polissia :{bg:"#f4eee2", threads:["#bf2118","#7a140f","#3a3a3a"], colorBias:[0,0,0,1,2], densityBias:0},
  chernihiv:{bg:"#f6f1e7", threads:["#b8281f","#9c9c9c","#5c5c5c"], colorBias:[0,0,1,2], densityBias:-1},
};
for(const k in PAL){const R=VY.REGIONS[k];
  eq(R.bg,PAL[k].bg,k+' bg unchanged'); eq(R.threads,PAL[k].threads,k+' threads unchanged');
  eq(R.colorBias,PAL[k].colorBias,k+' colorBias unchanged'); assert(R.densityBias===PAL[k].densityBias,k+' densityBias unchanged');
  assert(typeof R.formal==='string'&&R.formal.length,k+' has formal');
  assert(typeof R.inspiredBy==='string'&&R.inspiredBy.length,k+' has inspiredBy');
  assert(typeof R.note==='string'&&/often|tends|associated|archaic|delicate/i.test(R.note),k+' note reads as tendency');
  assert(/^https:\/\/en\.wikipedia\.org\//.test(R.src),k+' has wikipedia src');
  assert(R.name===undefined,k+' old .name removed');
}
// motif re-tags: new ids present, old ids gone, regions broadened, grids intact
const ids=VY.HERO_MOTIFS.map(m=>m.id);
['black-cross','interlocking-diamonds','fine-cross'].forEach(id=>assert(ids.includes(id),'new id '+id));
['borshchiv-cross','bukovyna-geometric','chernihiv-cross'].forEach(id=>assert(!ids.includes(id),'old id gone '+id));
const bc=VY.HERO_MOTIFS.find(m=>m.id==='black-cross');
eq(bc.regions,["borshchiv","bukovyna","hutsul","polissia"],'black-cross regions broadened');
assert(bc.grid.length===9&&bc.grid[0].length===9,'black-cross grid intact 9x9');
// applyBg still works (uses threads[0])
const ab=VY.applyBg(VY.REGIONS.hutsul,'charcoal'); assert(ab.bg==='#241d16'&&ab.threads[1]==='#c0271f','applyBg intact');
console.log(ok?'ALL PASS':'FAILURES ABOVE');
```

- [ ] **Step 4: Run** — `node --check data.js && node /tmp/vy_auth_test.js && rm /tmp/vy_auth_test.js`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**
```bash
git add data.js
git commit -m "feat: regional labels as formal-trait + inspired-by; loosen 3 place-named motif tags"
```

---

## Task 2: `app.js` — consume the new region fields

**Files:** Modify `app.js`.

- [ ] **Step 1: Region dropdown** — line ~27. Replace:
```js
for(const k in VY.REGIONS){const o=document.createElement("option");o.value=k;o.textContent=VY.REGIONS[k].name;regionSel.appendChild(o);}
```
with:
```js
for(const k in VY.REGIONS){const o=document.createElement("option");o.value=k;o.textContent=VY.REGIONS[k].formal+" · "+VY.REGIONS[k].inspiredBy;regionSel.appendChild(o);}
```

- [ ] **Step 2: Region note + source link** — line ~35. Replace:
```js
  document.getElementById("regionNote").textContent=VY.REGIONS[state.region].note;
```
with:
```js
  const _R=VY.REGIONS[state.region];
  document.getElementById("regionNote").innerHTML=`${_R.note} · inspired by ${_R.inspiredBy} <a href="${_R.src}" target="_blank" rel="noopener" title="Further reading">ⓘ</a>`;
```
(Our own static data — safe to use `innerHTML` here.)

- [ ] **Step 3: Toolbar title** — line ~59. Replace:
```js
  const name=VY.REGIONS[state.region].name.split(" — ")[0];
```
with:
```js
  const name=VY.REGIONS[state.region].formal;
```

- [ ] **Step 4: Verify** — Run `node --check app.js` (expect pass). Then confirm no stale readers remain:
```bash
grep -n 'VY\.REGIONS\[[^]]*\]\.name' app.js
```
Expected: **no output** (all `.name` reads on REGIONS are gone). Browser rendering of the ⓘ link is the controller's live pass — state that you can't run a browser.

- [ ] **Step 5: Commit**
```bash
git add app.js
git commit -m "feat: app reads formal/inspiredBy/note/src region fields (dropdown, note, title)"
```

---

## Task 3: `index.html` disclaimer + `README.md` region list

**Files:** Modify `index.html`, `README.md`.

- [ ] **Step 1: Strengthen the disclaimer.** In `index.html`, find:
```html
    traditional charts and make <b>no claim</b> of authoritative symbolic meaning.
    &nbsp;·&nbsp; <a class="ghlink" href="https://github.com/rmdes/Vyshyvanka-generator" target="_blank" rel="noopener">⟲ Source on GitHub ↗</a>
```
and insert the regional sentence before the GitHub link:
```html
    traditional charts and make <b>no claim</b> of authoritative symbolic meaning.
    Regional names mark documented <b>tendencies</b> we interpret — not definitive or exhaustive styles.
    &nbsp;·&nbsp; <a class="ghlink" href="https://github.com/rmdes/Vyshyvanka-generator" target="_blank" rel="noopener">⟲ Source on GitHub ↗</a>
```

- [ ] **Step 2: Update the README region bullet.** In `README.md`, replace the bullet:
```markdown
- **6 regional styles** (Poltava, Hutsul, Borshchiv/Podillia, Bukovyna, Polissia, Chernihiv)
  expressed as *formal traits* only: palette, density, geometry.
```
with:
```markdown
- **6 styles named by their formal traits** (Red on white, Dense polychrome,
  Black-dominant, Lilac & bronze, Bold archaic red, Sparse white & red), each
  *inspired by* a documented regional tendency (Poltava, Hutsul,
  Borshchiv/Podillia, Bukovyna, Polissia, Chernihiv) — interpretations of
  tendencies, not definitive styles.
```

- [ ] **Step 3: Verify** —
```bash
grep -c "documented <b>tendencies</b>" index.html   # expect 1
grep -c "inspired by\* a documented regional tendency\|inspired by" README.md  # expect >=1
```
Expected: the disclaimer sentence present once; the README bullet updated.

- [ ] **Step 4: Commit**
```bash
git add index.html README.md
git commit -m "docs: strengthen regional-tendency framing in disclaimer + README"
```

---

## Self-review notes

- **Spec coverage:** REGIONS restructure (formal/inspiredBy/note/src, palettes preserved) → Task 1 Step 1; 3 motif re-tags → Task 1 Step 2; app consumers (dropdown/note/title) → Task 2; disclaimer → Task 3 Step 1; README → Task 3 Step 2; sources = per-region Wikipedia → in the data; determinism guard → Task 1 test. All spec sections mapped.
- **Determinism:** region keys + every palette/colorBias/densityBias/bg asserted byte-identical (Task 1 test). No seed/hash change. Existing share links unaffected — confirmed live in the controller's pass.
- **Type/name consistency:** `formal`, `inspiredBy`, `note`, `src` used identically across data + all three app sites; new motif ids `black-cross`/`interlocking-diamonds`/`fine-cross`; `_R` local in the note site.
- **Placeholder scan:** none — exact code, exact strings, exact commands.
- **Live verification (controller, after deploy):** load a pre-existing `r=hutsul` share link and confirm pixel-identical render; dropdown shows `Red on white · Poltava` etc.; each region's note + ⓘ opens the right Wikipedia page; title shows the formal lead; a Hutsul design can surface the renamed motifs; 0 console errors.
