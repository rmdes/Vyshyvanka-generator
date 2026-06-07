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
- **Procedural motif engine**: combinatorial, 8-fold-symmetric motifs built from
  geometric primitives. A per-generation *theme* keeps a coherent family; the
  **Variety** slider controls how far individual motifs deviate.
- **Deterministic**: a seed + settings always reproduce the exact same pattern.
  Designs are fully shareable/restorable via the URL (the `Copy link` button).
- **Export**: full-resolution PNG at standard screen sizes (incl. auto-detected screen).

## Important: this is not an authenticity tool

It generates patterns *inspired by* documented regional traits of Ukrainian
embroidery. It does **not** define what a "true" vyshyvanka is, encode symbolic
meaning, or reproduce specific traditional motifs. Vyshyvanka symbolism is
regional, contested, and not a fixed alphabet — the seed word is a reproducibility
key, not a meaning.

## Ideas / backlog

- Hand-authored regional "hero" motifs (biggest quality jump vs. the generic procedural look)
- Printable counted-stitch chart (numbered grid + thread legend)
- "Favorites" / lock-a-design affordance
- Per-region frame mat tinting in the preview
