# Vyshyvanka Wallpaper Generator

A dependency-free web toy that procedurally generates **vyshyvanka-style
cross-stitch patterns** — as desktop / phone **wallpapers**, **garment panels**,
or an **infinite, zoomable field** you can roam forever.

Open `index.html` in any browser. No build step, no server, works offline.

## What it does

- **Three modes**: 🖥 **Wallpaper** (seamless, border frame, side runner,
  medallion, diagonal, scattered, wreath), 🧵 **Garment panel** (sleeve, cuff,
  collar, runner, rushnyk, napkin, sampler — at S/M/L size), and 🧭 **Explore** —
  an *infinite, seamless field* of distinct motifs you pan and zoom through endlessly.
- **Explorable everywhere**: every design renders on a pan/zoom viewport with
  level-of-detail tiles — scroll to zoom, drag to pan, `0` to reset. Zoom in to
  individual cross-stitches; zoom out to a sea of motifs.
- **6 styles named by their formal traits** (Red on white, Dense polychrome,
  Black-dominant, Lilac & bronze, Bold archaic red, Sparse white & red), each
  *inspired by* a documented regional tendency (Poltava, Hutsul,
  Borshchiv/Podillia, Bukovyna, Polissia, Chernihiv) — interpretations of
  tendencies, not definitive styles.
- **Generative "field-function" engine**: motifs are grown from a seed-derived
  *genome* — layers of math basis functions evaluated over symmetry-folded
  coordinates. These purely procedural fields are blended with the documented
  "hero" motifs and archetypes via a **Tradition ↔ Invention** dial, so you can
  slide from researched-shape-led patterns toward freely invented math ones.
- **Shaping controls**: **Detail (Minimal ↔ Ornate)** sets how much ornament
  fills each motif; **Variation (Calm ↔ Wild)** sets how far individual motifs
  deviate from the per-generation family (in Explore, how much each cell of the
  infinite plane differs); **Symmetry** chooses the fold (8-fold / 4-fold / Loose).
- **Motif geometry**: **Silhouette** (auto / circle / square / diamond) sets each
  field motif's outline; **Border** outlines it. **Arrangement** (straight / brick /
  diamond), **Spacing**, and **Motif scale** shape how motifs tile the seamless
  fabric and the Explore field.
- **🎨 Colour**: any **cloth background** colour, an **editable thread palette**
  (recolour each thread), and **saved palettes** appliable to any design — a pure
  recolour layer that never reshuffles the pattern.
- **🧪 Lab panel**: a collapsible panel for editing the underlying genome
  directly — tune the layers and basis functions that drive the field motifs.
  A pinned genome becomes the theme for the whole design (or the whole infinite plane).
- **Deterministic**: a seed + settings (genome included) always reproduce the
  exact same pattern; the infinite Explore plane is a pure function of the seed,
  so the same link shows everyone the identical field. Designs — and your exact
  pan/zoom spot — are fully shareable/restorable via the URL (`Copy link`).
- **Export**: full-resolution PNG (Explore captures the current view), plus
  seamless tile export and a printable counted-stitch chart with thread legend.
- **Favorites / undo**: lock a design you like and step back through recent changes.

## Interpretations, not authenticity

This is a formal/structural toy, not an authenticity tool. Alongside its
**best-effort interpretations of documented regional motifs** — researched and
transcribed by hand — it generates **field-function motifs that are pure
procedural math**, not drawn from any traditional chart. The **Tradition ↔
Invention** dial only ever moves *away* from the documented shapes, never toward
a claim that the invented ones are traditional. Neither kind is an exact
reproduction of a traditional chart, and neither makes **any claim** of
authoritative symbolic meaning. Vyshyvanka symbolism is regional, contested, and
not a fixed alphabet; the seed word is a reproducibility key, not a meaning.
Treat the output as an interpretation inspired by the tradition, not a substitute
for it.

## How it's built

Seven static files sharing one `VY` global, loaded as plain `<script>` tags — no
bundler, framework, or dependencies (deploys as static files on a LAMP host).
`data.js` (regional data) → `generator.js` (grid/motif construction) →
`render.js` (canvas drawing) → `viewport.js` (pan/zoom/LOD) → `app.js` (state,
UI, URL hash). See `CLAUDE.md` for the architecture and the determinism contract,
and `docs/superpowers/` for the per-feature design specs and plans.

## Recently added

- [x] **🎨 Colour control** — any cloth-background colour, an editable thread palette, saved reusable palettes
- [x] **Shape control** — motif **silhouette** + **border**; lattice **arrangement** + **spacing**; **panel size** + new shapes (cuff, runner, napkin); new wallpaper layouts (diagonal, scattered, wreath)
- [x] **Respectful regional framing** — formal-trait names + "inspired by", tendency-worded notes, source links
- [x] 🧭 **Explore** mode — an infinite, roamable, seamless field generated position-addressably (every tile deterministic)
- [x] Pan/zoom/level-of-detail **explorable viewport** for every mode
- [x] Generative "field-function" motif engine + **Tradition ↔ Invention** dial blending it with hand-charted "hero" motifs
- [x] **🧪 Lab** panel for editing the genome directly
- [x] Printable counted-stitch chart (numbered grid + thread legend); favorites + undo

## Ideas / backlog

- [ ] Explore **biomes** — palette / aim drifting across the infinite plane
- [ ] Coarse-zoom level-of-detail path (keep the zoomed-all-the-way-out field snappy)
- [ ] Per-region frame mat tinting in the preview
