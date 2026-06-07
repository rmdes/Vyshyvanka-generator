# Vyshyvanka Wallpaper Generator

A single-file, dependency-free web toy that procedurally generates
**vyshyvanka-style cross-stitch patterns** and exports them as desktop / phone
**wallpapers**.

Open `vyshyvanka-generator.html` in any browser. No build step, no server, works offline.

## What it does

- **6 regional styles** (Poltava, Hutsul, Borshchiv/Podillia, Bukovyna, Polissia, Chernihiv)
  expressed as *formal traits* only: palette, density, geometry.
- **Wallpaper layouts**: seamless fabric, border frame, side runner, medallion —
  plus garment-panel shapes (sleeve, collar, rushnyk, sampler).
- **Generative "field-function" engine**: motifs are grown from a seed-derived
  *genome* — layers of math basis functions evaluated over symmetry-folded
  coordinates. These purely procedural fields are blended with the documented
  "hero" motifs and archetypes via a **Tradition ↔ Invention** dial, so you can
  slide from researched-shape-led patterns toward freely invented math ones.
- **Shaping controls**: **Detail (Minimal ↔ Ornate)** sets how much ornament
  fills each motif; **Variation (Calm ↔ Wild)** sets how far individual motifs
  deviate from the per-generation family; **Symmetry** chooses the fold
  (8-fold / 4-fold / Loose).
- **🧪 Lab panel**: a collapsible panel for editing the underlying genome
  directly — tune the layers and basis functions that drive the field motifs.
- **Deterministic**: a seed + settings (genome included) always reproduce the
  exact same pattern.
  Designs are fully shareable/restorable via the URL (the `Copy link` button).
- **Export**: full-resolution PNG at standard screen sizes (incl. auto-detected screen),
  plus seamless tile export and a printable counted-stitch chart with thread legend.
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

## Recently added

- [x] Generative "field-function" motif engine (math layers over symmetry-folded coordinates)
- [x] **Tradition ↔ Invention** dial blending hero/archetype motifs with the generative fields
- [x] Relabeled axes: **Detail (Minimal ↔ Ornate)** and **Variation (Calm ↔ Wild)**
- [x] **Symmetry** control (8-fold / 4-fold / Loose)
- [x] **🧪 Lab** panel for editing the genome directly
- [x] Hand-authored regional "hero" motifs (biggest quality jump vs. the generic procedural look)
- [x] Printable counted-stitch chart (numbered grid + thread legend)
- [x] "Favorites" / lock-a-design affordance

## Ideas / backlog

- [ ] Per-region frame mat tinting in the preview
