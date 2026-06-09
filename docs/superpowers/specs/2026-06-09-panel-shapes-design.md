# Panel Dimensions & Shapes — Design (cycle 3b of 4)

**Date:** 2026-06-09
**Status:** Approved
**Branch:** `feature/panel-shapes` (off `main` @ ec49612, includes 3a)

## Summary

Give the **Garment panel** mode custom proportions and more shapes: a **Panel size** control (Small/Medium/Large) that scales each shape's primary dimension independent of Detail, plus three new shapes — **Cuff**, **Runner**, **Napkin** (square cloth). Second of four "shape" sub-cycles. Panel-only — no wallpaper/explore/render/viewport changes.

## Current state

`composePanel(shape)` builds a panel from 1-D bands (`borderBand`/`separator`/`mainBand`). The four shapes have **fixed width + band structure per density**: sleeve (vertical repeating band), collar (wide horizontal band), rushnyk (vertical 3-band towel), sampler (square motif grid). Motif size `m=[7,9,9,11,13][dens-1]` comes from Detail/density; there is no independent size/proportion axis.

## Panel size control

New state `panelSize` ∈ `small|medium|large`, default `medium`. A multiplier scales each shape's **primary length dimension** (not the motif size — that stays from Detail):

```js
const SIZEMUL={small:0.6, medium:1.0, large:1.55};
// inside composePanel/sampler/napkinCloth:
const mul=SIZEMUL[CFG.panelSize]||1;                       // unknown value -> 1.0
const scaleN=(base,min)=>Math.max(min, Math.round(base*mul));
```

| Shape | Scaled dimension |
|---|---|
| sleeve / cuff (vertical bands) | repeat count (length) |
| collar / runner (horizontal bands) | `cols` (length) |
| rushnyk (vertical towel) | `cols` (width) |
| sampler | grid count `G` |
| napkin | square side |

**`medium` (×1.0) reproduces the exact current values** for the four existing shapes (`Math.round(base*1)==base`), floored so Small never degenerates. → existing panel links render byte-identically.

## Three new shapes (reuse `borderBand`/`separator`/`mainBand`/`pickMotif`)

- **Cuff** — short narrow band: `B S M S B` with small `cols` (`[27,31,35,39,43][dens-1]`) and `reps=scaleN(1,1)` (1 at S/M, 2 at L). A wrist-cuff strip.
- **Runner** — long **horizontal** multi-band band: like collar but wide (`cols=scaleN([160,190,220,250,280][dens-1],80)`) with an extra main band: `B S M S M S B`. A table-runner / hem strip.
- **Napkin** (square cloth) — a new `napkinCloth()` helper: a square `S×S` grid (`S=scaleN(base,min)` from the medallion + margins), a 2-px inset **border frame**, one large **central medallion** (`pickMotif(cm)`, `cm=m+6`) centered, and a **corner accent** (`pickMotif(m)`) blitted into each of the 4 corners (inset by a margin). Structurally distinct from the sampler's even grid.

`SHAPES` (app.js) gains `["cuff","Cuff"]`, `["runner","Runner"]`, `["napkin","Napkin / cloth"]` → 7 shapes.

## Determinism (reuses the 3a convention)

- **`shape` is already in the seed string**, so the three new shape values are purely additive — existing links (sleeve/collar/rushnyk/sampler) are untouched.
- **`panelSize` appends to the seed string only when non-`medium` AND mode is panel:** `(state.mode==="panel" && state.panelSize!=="medium" ? "|psz"+state.panelSize : "")`. Gating by panel mode keeps wallpaper/explore seeds clean (panelSize is irrelevant there). Default panels (`medium`) get no suffix → byte-identical to before.
- **Hash:** `psz` written when `panelSize!=="medium"`; `readHash` validates against `small|medium|large`, else default. (`mode` is already in the hash.)

## State / CFG / UI

- `CFG` (generator.js) gains `panelSize:'medium'` default; `composePanel`/`sampler`/`napkinCloth` read `CFG.panelSize`.
- `app.js`: `panelSize:"medium"` in DEFAULTS; `setConfig({... panelSize:state.panelSize})`; the conditional seed-suffix; hash `psz`; `SHAPES` += 3; `buildSeg("panelSizeSeg", PANELSIZES, "panelSize")` with `PANELSIZES=[["small","S"],["medium","M"],["large","L"]]`; `syncUI` `segKey` gains `panelSizeSeg:"panelSize"`.
- `index.html`: in `#panelControls`, add a "Panel size" label + `<div class="seg" id="panelSizeSeg" …>`. The three new shape buttons appear automatically (built from `SHAPES` by `buildSeg("shapeSeg",…)`).
- **Visibility:** `#panelControls` already shows only in panel mode (unchanged) — both the shape seg and the new size seg live inside it.
- Changing shape or panelSize calls `resetView()`+`generate()` (via `buildSeg`).

## Out of scope (3c, 3d)

Wallpaper layouts (3c), motif geometry knobs (3d). No changes to wallpaper/explore/colour/lattice, render, or viewport.

## Verification

- **Back-compat:** an existing panel link (e.g. `#m=panel&sh=rushnyk&…`, no `psz`) renders pixel-identical (medium ×1.0 = current `cols`/`reps`/`G`); confirm via node test that each existing shape at `panelSize:'medium'` yields the same `cols`/`rows` as before.
- **Size control:** Small/Medium/Large visibly change each shape's length/size; Medium == current; Small never degenerate (floors hold).
- **New shapes:** cuff (short band), runner (long horizontal), napkin (frame + central medallion + 4 corners) all render with sensible dimensions and contrast; node-test they return `{grid,cols,rows,palette}` with `rows>0`/`cols>0` and are deterministic per seed.
- **Determinism:** `psz` round-trips the hash; a non-medium panel reshuffles+resizes; switching to wallpaper/explore does NOT put `psz` in the seed (gated); default panels keep URLs `psz`-free.
- Wallpaper/Explore unaffected; 0 console errors; `node --check` clean; chart/PNG export work for the new shapes (large panels may hit the existing chart-size warning — fine).

## Files

`generator.js` (`composePanel` size scaling + cuff/runner branches + `napkinCloth()` + sampler size), `app.js` (state/DEFAULTS/setConfig/seed-suffix/hash/SHAPES/PANELSIZES/buildSeg/syncUI), `index.html` (`#panelSizeSeg`). No render/viewport changes.
