# Generative Richness (Pillar C) — Design

**Date:** 2026-06-07
**Status:** Approved
**Part of a larger roadmap** (see "Roadmap & scope boundary"). This spec covers **Pillar C only**.

## Summary

Grow the motif engine from 8 fixed archetypes + a 14-entry hero library into a
**math-driven generative engine** capable of endlessly, structurally different
motifs, while staying recognizably vyshyvanka. Two parts:

1. A **field-function motif generator** driven by a seed-derived *genome*.
2. A **control redesign** exposing the variety as continuous "opposite" axes
   (simple tier) plus a collapsible **Lab** panel for driving the math directly.

The existing archetype generator and hero motifs are **kept** as the "Tradition"
anchor; a continuous **Tradition ↔ Invention** dial blends between them and the
new field engine. Everything stays Canvas2D, buildless, deterministic, and
shareable by URL.

## Roadmap & scope boundary

The full vision is a dual-mode, explorable, infinitely-variable engine. It
decomposes into three pillars, each its own spec/plan cycle:

- **A — Explorable viewport:** pan/zoom/LOD via cached offscreen tiles + a
  GPU-composited transform. *(Later spec.)*
- **B — Infinite roamable field:** unbounded plane generated per-tile from
  seed + coordinates. *(Later spec; only after prototyping deep-zoom on a
  bounded piece.)*
- **C — Generative richness:** THIS spec. The math engine + controls, on
  today's bounded canvas.

Dual-mode (compose-a-piece + explore-the-field) is the eventual shell; it is
**not** in this spec. C must not depend on A or B, and must leave the door open
to them (the genome must be a pure function of seed + params so it can later be
evaluated per-tile at arbitrary coordinates).

## Non-negotiable invariants (carried from the existing engine)

- **Determinism:** identical seed + settings → identical output, *within a
  released version*. (Cross-version identical reproduction is **not** promised —
  changing the generator necessarily changes RNG sequences. This was already
  true of every prior feature.)
- **Shareability:** every output-affecting input lives in BOTH the `generate()`
  seed string AND the `writeHash`/`readHash` URL params.
- **Symmetry/purity:** all randomness is drawn up front into the genome; the
  per-cell render loop is a pure function of `(x,y)` and the genome. No `RNG()`
  inside per-cell loops.
- **Idiom:** output is always discrete stitches on the counted grid, colored
  from the regional palette via `colorBias`.

## C1 — The field-function motif generator

New function in `generator.js`: `makeFieldMotif(m, G)` returning an
`Int8Array`-row grid (same shape as `makeMotif`), where `G` is a **genome**.

### Symmetry-invariant coordinates

For center `c=(m-1)/2` and cell offset `u=x-c, v=y-c`, derive (most already
exist in `makeMotif`):

- `ax=|u|`, `ay=|v|`
- `rE = Math.hypot(u,v)` — Euclidean radius (rings)
- `rM = ax+ay` — Manhattan (diamonds)
- `rC = Math.max(ax,ay)` — Chebyshev (squares)
- `dD = |ax-ay|` — diagonal bands
- `ang` — a **folded petal angle**: fold `atan2(ay,ax)` into `[0, π/4]` so it is
  D4-invariant; multiply by the symmetry order for "petals"
- `latU = ax`, `latV = ay` — for lattice/modular terms (kept as `|u|,|v|` so
  symmetry is preserved)

Every coordinate is a symmetric function of `(ax,ay)` → output is automatically
4-fold (D2: independent x/y mirror) or 8-fold (D4: also diagonal) symmetric.

### Genome

```js
genome = {
  sym: 'd2' | 'd4' | 'loose',      // symmetry group (loose = angular, not pixel-exact)
  layers: [                         // 1..4 layers
    { coord: 'radial'|'manhattan'|'chebyshev'|'diagonal'|'angle'|'lattice',
      wave:  'cos'|'tri'|'sq',      // basis waveform
      freq:  Number,                // spatial frequency
      phase: Number,                // phase offset
      weight:Number,                // contribution to the field
      slot:  Number }               // which palette color this layer inks (1..k)
  ],
  levels: Number,                   // quantization bands (how many color steps)
  centerStyle: 'dot'|'cross'|'ring'|'none'
}
```

### Render

```
F(u,v) = Σ_layers  weightₗ · waveₗ( coordₗ(u,v) · freqₗ + phaseₗ )
```

- Normalize `F`, **quantize to `levels` bands**, map nonzero bands to a palette
  thread index (using the layer's `slot`, resolved through `colorBias`).
- Apply `centerStyle` to the central cell(s) (reuse existing center logic).
- Threshold so empty cells are 0 (no stitch). The render layer (cross/filled +
  aida/shading) is unchanged.

The 8 current archetypes are special cases (single radial cos = rings, angular =
star, lattice = grid); the continuum between them is the new space.

## C2 — Tradition ↔ Invention dial

A single `tradition` value (0 = pure Tradition … 100 = pure Invention) that does
two things:

**(a) Source mix in `pickMotif`.** Compute weights for the three sources from
`tradition` (and region — hero availability):
- Tradition end → mostly `hero` + `makeMotif` (archetypes).
- Invention end → mostly `makeFieldMotif`.
- Smooth blend; no hard switch. (Field motifs at the Tradition end use tame
  genomes that resemble archetypes, so there's no visual seam.)

**(b) Genome distribution shaping** in the genome sampler:
- Tradition: snap `freq` to integers, bias `coord` toward `radial`/`manhattan`,
  cap `layers` low, force strong central symmetry (`d4`), modest `levels`.
- Invention: free `freq`/`phase`, allow `angle`/`lattice`/exotic combos, more
  `layers`, off-integer everything, allow `loose` symmetry.

`tradition` interpolates the **ranges** these parameters are sampled from.

## C3 — Controls (two-tier)

### Simple tier (sidebar)

Reframe the two existing sliders and add two controls. Underlying state keeps the
existing `complexity`/`variety` fields (for hash back-compat) but relabeled:

- **Minimal ↔ Ornate** ← `complexity` (1–5): genome `layers` + density.
- **Calm ↔ Wild** ← `variety` (0–100): the **spread** the dice samples around
  each parameter's aim (genome variance / deviation).
- **Tradition ↔ Invention** — NEW `tradition` (0–100). Default **20**
  (tradition-leaning) so existing links and first impressions stay close to the
  current look.
- **Symmetry** — NEW `symmetry` (`d4` default, `d2`, `loose`), a segmented
  control.

Mental model surfaced in the UI copy: **sliders set the aim; "Wild" sets the
spread the dice explores.**

Everything else unchanged: Region, mode/layout/shape, resolution, stitch style,
seed + 🎲 New design, exports, favorites/undo.

### Lab tier (collapsible "🧪 Lab" panel, hidden by default)

Exposes the raw genome for power users:
- layer count; per-layer `coord` / `wave` / `freq` / `phase` / `weight` / `slot`;
- `levels`; `sym`; `centerStyle`.

When the Lab panel has **active overrides**, those values replace the
seed-sampled genome (partial overrides merge: overridden fields win, the rest
stay seed-derived). A "reset to seed" clears overrides. Lab state is serialized
(see C4) so a hand-tuned motif is reproducible and shareable.

## C4 — Integration, determinism, migration

- **`pickMotif(m)`** gains the field source and the C2 weighted mix. It already
  is the single chokepoint for full-motif placement (bands, wallpaper,
  fabric tile, panels), so new variety flows everywhere with no per-layout work.
- **Genome sampling** is a new pure function `sampleGenome(rng, region, aim)`
  where `aim` = {ornate, wild, tradition, symmetry} + lab overrides. It draws
  only from the seeded `RNG`, preserving determinism. (Pure-function design also
  sets up Pillar B: later it can be called with per-tile-seeded RNG.)
- **Seed string:** append `tradition`, `symmetry`, and a compact hash of any Lab
  overrides to the `generate()` seed concatenation.
- **URL hash:** add `tr` (tradition), `sym` (symmetry), and `lab` (compact
  encoded overrides, omitted when empty) to `writeHash`/`readHash`. Apply the
  same `Number.isFinite` + range-clamp hardening used for `c`/`vy`.
- **Migration:** old links lack `tr`/`sym`/`lab` → default `tradition=20`,
  `symmetry=d4`, no lab. With tradition low, output is hero/archetype-dominant =
  visually close to today. (Exact pixel reproduction across this version change
  is not promised, per the invariants.)
- **Everything keeps working:** all layouts/shapes, PNG/tile/chart+DMC export,
  favorites (state snapshot already captures all fields via `{...state}`),
  undo, a11y. New controls get ARIA parity (sliders `aria-valuetext`; Symmetry
  as a labelled radiogroup; Lab panel is a labelled, toggle-disclosed region).

## Components touched

- `generator.js` — `makeFieldMotif`, `sampleGenome`, the field coordinate/wave
  helpers, and the `pickMotif` source-mix update.
- `app.js` — new state fields + hash wiring + control events; Lab panel logic.
- `index.html` — relabel two sliders, add Tradition slider + Symmetry segmented
  control + the collapsible Lab panel markup.
- `styles.css` — Lab panel styles; minor label tweaks.
- `data.js` — unchanged (palettes/hero/DMC stay).

`generator.js` already concentrates the generative logic; adding the field
engine there is consistent. If `generator.js` grows unwieldy, the field engine
(`makeFieldMotif` + helpers + `sampleGenome`) is the natural seam to split into
`field.js` later — but not required for this spec.

## Out of scope (this spec)

- Pan/zoom/LOD viewport (Pillar A).
- Infinite roamable field (Pillar B).
- Dual-mode shell.
- Any move off Canvas2D / to WebGL.
- New build step, bundler, framework, or test runner.

## Open implementation notes (not blockers)

- 6/12-fold symmetry is approximate on a square grid; `loose` mode is labelled
  as such and won't be pixel-perfect — acceptable and disclosed.
- Lab override encoding should be compact (e.g. a short delimited string) to
  keep share URLs reasonable; exact encoding is an implementation detail.
- The genome→palette `slot` mapping reuses `colorBias` so field motifs honor
  regional color weighting like archetypes do.
