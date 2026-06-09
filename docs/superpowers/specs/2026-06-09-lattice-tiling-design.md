# Lattice & Tiling — Design (cycle 3a of 4)

**Date:** 2026-06-09
**Status:** Approved
**Branch:** `feature/lattice-tiling` (off `main` @ v1.3.0 + authenticity + colour + panel-bg fix)

## Summary

Turn the hidden/random/fixed lattice values into real controls for the two repeating surfaces — the **seamless wallpaper tile** and the **infinite Explore field**: motif **Arrangement** (Auto / Straight / Brick / Diamond), **Spacing** (Tight / Normal / Airy), and **Motif size** (the existing S/M/L scale, now driving Explore too). First of four "shape" sub-cycles (3a lattice → 3b panel dims → 3c wallpaper layouts → 3d motif geometry), after which a single tag is cut.

## Why / current state

- **Seamless** (`composeFabricTile`): the lattice is **randomly** picked per seed (`pick([...])`), gap is a fixed `mm*0.35`, and **Brick and Diamond currently render identically** (both just half-drop odd rows).
- **Explore** (`composeInfiniteWindow`/`buildFabricConfig`): **straight only**, no offset; gap fixed `mm*0.35`; motif size hardwired `mm=11`.

Neither surface lets the user shape the tiling. 3a exposes it.

## The determinism convention (load-bearing — reused by all of cycle 3)

These settings **change the pattern**, so they must be reproducible from the seed — but naively appending them to the seed string would change every existing seed and reshuffle all shared links. Therefore:

> **A pattern-affecting setting is appended to the `generate()` seed string ONLY when it is non-default.** A design left at `Auto` arrangement + `Normal` spacing produces the **byte-identical old seed string**, so every existing share link renders exactly as before. Choosing `Brick`, or `Tight` spacing, appends a suffix (e.g. `|latbrick|sptight`) → a new pattern. All values are still written to the **hash** (for sharing), and `readHash` defaults them when absent.

`scale` is **already** in the seed string (default `medium`), so driving Explore's `mm` from it is automatically back-compatible (existing Explore links default to `medium` → `mm=11`, unchanged).

## State

Add to `state`/`DEFAULTS`:
- `lattice: "auto"` — `"auto" | "straight" | "brick" | "diamond"`.
- `spacing: "normal"` — `"tight" | "normal" | "airy"`.

(`scale` already exists; its visibility extends to Explore.)

## Controls (UI)

Two new segmented controls in the **Output** accordion section, plus extending Scale's reach:

| Control | Values | Shown when | Drives |
|---|---|---|---|
| **Motif scale** (existing `#scaleSeg`) | S / M / L → mm 9/11/13 | `wallpaper` **or** `explore` | mm for seamless tile + Explore field |
| **Arrangement** (`#latticeSeg`, new) | Auto · Straight · Brick · Diamond | `(wallpaper && layout==="fabric")` **or** `explore` | lattice type |
| **Spacing** (`#spacingSeg`, new) | Tight · Normal · Airy | `(wallpaper && layout==="fabric")` **or** `explore` | gap |

- **Visibility:** `res`/`layout` stay wallpaper-only; `scale` becomes `wallpaper||explore`; `arrangement`+`spacing` show for `(wallpaper&&fabric)||explore`; `shape` stays panel-only. The **Output section now also shows in Explore** (it currently hides) — it holds scale/arrangement/spacing there.
- **Framed layouts** (bordered/runner/medallion) are NOT lattice tilings → Arrangement/Spacing don't apply (hidden); Scale still does.
- Changing any of the three calls `resetView()`+`generate()` (they change the pattern, like Detail/Variation/Symmetry).

## Generator changes (`generator.js`)

A shared spacing map and arrangement offsets:
```js
const SPACING={tight:0.2, normal:0.35, airy:0.6};   // gap = max(2, round(mm*ratio)); normal=current
// offset of lattice cell (col,row) for an arrangement, in stitch units (half-period drops):
//   straight: none ; brick: odd rows shift X by half ; diamond: brick + odd cols shift Y by half
```

1. **`CFG`** gains `lattice` + `spacing` (set via `setConfig`). Default `lattice:"auto"`, `spacing:"normal"`.

2. **`composeFabricTile(scaleKey)`** —
   - `gap = Math.max(2, Math.round(mm*SPACING[CFG.spacing]))` (was fixed `*0.35`).
   - `latt = CFG.lattice==="auto" ? pick(v>0.5?["straight","brick","diamond"]:["straight","brick"]) : CFG.lattice;` (Auto = today's random pick → back-compat; explicit = pinned).
   - **Diamond** becomes distinct: in the placement loop, `offX = (latt!=="straight" && row%2) ? round(period/2) : 0`; `offY = (latt==="diamond" && col%2) ? round(period/2) : 0`. Tile stays `period*2 × period*2` for non-straight (so the 2-cell repeat tiles seamlessly via `blitWrap`).

3. **`buildFabricConfig(P, aim, lab, mm, seed)`** — read `CFG.lattice`/`CFG.spacing`; compute `gap = Math.max(2, Math.round(mm*SPACING[CFG.spacing]))`; store `lattice` (resolving `"auto"` → `"straight"` for Explore, its established default) + `gap`/`period` in the returned `cfg`.

4. **`composeInfiniteWindow(cfg, …)`** — place each cell with the arrangement offset (position-addressable, so seams stay consistent):
   ```js
   const offX = (cfg.lattice!=="straight" && (latY&1)) ? Math.round(cfg.period/2) : 0;
   const offY = (cfg.lattice==="diamond" && (latX&1)) ? Math.round(cfg.period/2) : 0;
   blit(g, motif, latX*cfg.period+offX+pad - wx0, latY*cfg.period+offY+pad - wy0);
   ```
   The existing ±1-cell lattice-range margin already covers the ≤½-period shift, so no coverage gap.

## app.js changes

- `DEFAULTS`: `lattice:"auto", spacing:"normal"`.
- `generate()`:
  - **Seed suffix (conditional):** append `(state.lattice!=="auto"?"|lat"+state.lattice:"")` and `(state.spacing!=="normal"?"|sp"+state.spacing:"")` to the existing `setSeed(...)` string. Nothing else in the seed changes.
  - `setConfig({... lattice:state.lattice, spacing:state.spacing})`.
  - **Explore mm from scale:** replace the hardwired `const mm=11;` with `const mm=[9,11,13][{small:0,medium:1,large:2}[state.scale]];`.
- `writeHash`/`readHash`: `lat` (when `lattice!=="auto"`) and `sp` (when `spacing!=="normal"`); `readHash` validates against the allowed sets, else defaults.
- New segmented controls wired via `buildSeg("latticeSeg", …, "lattice")` and `buildSeg("spacingSeg", …, "spacing")` (both already `resetView()`+`generate()` through buildSeg).
- `syncUI`: the visibility rules above + reflect `.on` state for the two new segs.

## index.html

In the Output section: add `#latticeSeg` (Arrangement) + `#spacingSeg` (Spacing) controls with labels; the existing `#scaleSeg` stays. Ensure the Output section's body shows the right controls per mode (scale/arrangement/spacing for Explore; res/layout/scale/arrangement/spacing for fabric wallpaper).

## Out of scope (later 3b–3d)

Panel dimensions/shapes (3b), more framed wallpaper layouts (3c), per-motif geometry knobs — border/outline (3d). No colour/region/generator-engine changes beyond the lattice.

## Verification

- **Back-compat (critical):** an existing share link (no `lat`/`sp`, scale `medium`) renders **pixel-identical** before/after — for both a seamless wallpaper link and an Explore link. (Auto+Normal must reproduce the exact old seed string and RNG stream.)
- **Arrangement:** Straight / Brick / Diamond are three visibly distinct tilings in both seamless wallpaper and Explore; Diamond ≠ Brick. Auto still varies per New-design (seamless).
- **Spacing:** Tight/Normal/Airy visibly change motif density; Normal == current.
- **Motif size in Explore:** S/M/L changes the field's motif size (was fixed).
- **Seam integrity:** Explore brick/diamond have no seams/gaps when roaming (the offset is position-addressable; node-test a cell appears identically across overlapping windows under each arrangement).
- **Determinism:** `lat`/`sp` round-trip via the hash; changing them reshuffles (they're in the seed when non-default); leaving them default keeps the URL param-free.
- Framed layouts unaffected; panel unaffected; 0 console errors; `node --check` clean.

## Files

`generator.js` (SPACING + composeFabricTile + buildFabricConfig + composeInfiniteWindow), `app.js` (state/DEFAULTS, generate seed-suffix + setConfig + Explore mm, hash, control wiring, syncUI visibility), `index.html` (two segmented controls). No render/viewport changes.
