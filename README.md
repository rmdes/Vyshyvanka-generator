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
- **Export**: full-resolution PNG at standard screen sizes (incl. auto-detected screen),
  plus seamless tile export and a printable counted-stitch chart with thread legend.
- **Favorites / undo**: lock a design you like and step back through recent changes.

## Interpretations, not authenticity

This is a formal/structural toy, not an authenticity tool. Alongside its
procedural motifs, it now includes **best-effort interpretations of documented
regional motifs** — researched and transcribed by hand. These are **not** exact
reproductions of traditional charts, and they make **no claim** of authoritative
symbolic meaning. Vyshyvanka symbolism is regional, contested, and not a fixed
alphabet; the seed word is a reproducibility key, not a meaning. Treat the output
as an interpretation inspired by the tradition, not a substitute for it.

## Recently added

- [x] Hand-authored regional "hero" motifs (biggest quality jump vs. the generic procedural look)
- [x] Printable counted-stitch chart (numbered grid + thread legend)
- [x] "Favorites" / lock-a-design affordance

## Ideas / backlog

- [ ] Per-region frame mat tinting in the preview
