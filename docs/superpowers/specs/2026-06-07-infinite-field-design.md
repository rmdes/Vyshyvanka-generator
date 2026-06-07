# Infinite Roamable Field (Pillar B) — Design

**Date:** 2026-06-07
**Status:** DRAFT — skeleton pending the interactive brainstorm/approval gate
**Branch/worktree:** `feature/infinite-field` (`/mnt/d/Private/Perso/vish-infinite-field`)

> This is a starting skeleton, not an approved spec. The Generative Richness
> (Pillar C) design defers this: *"Later spec; only after prototyping deep-zoom
> on a bounded piece."* Flesh it out via the brainstorming skill before planning.

## Inherited definition (from the Pillar C roadmap)

**B — Infinite roamable field:** an unbounded plane generated **per-tile from
seed + coordinates** — pan/zoom anywhere forever; tiles are produced on demand
and deterministically from the seed and their (lod, tx, ty) address.

## Prerequisites / dependencies

- **Pillar A — Explorable viewport** (pan/zoom/LOD over a bounded piece via
  cached offscreen tile rasters + GPU-composited transform). B reuses A's
  tile-addressed viewport; A must land (and deep-zoom on a bounded piece must
  feel right) before B is built. A is being designed separately
  (`feature/explorable-viewport` / `.claude/worktrees/explorable-viewport`).
- **Pillar C — Generative engine** (merged to `main` as v1.1.0): the genome
  sampler `sampleGenome(P, aim)` and the pure renderer `makeFieldMotif(m, G)` are
  already pure functions, which is what makes per-tile deterministic generation
  feasible.

## Core idea to design (chunk-style determinism)

The existing engine already seeds a PRNG from a string hash
(`hashStr`+`mulberry32`) and makes all motif choices up front so the per-cell
loop is a pure function of position. Extend that to an **unbounded field**:

- Each tile at address `(lod, tx, ty)` is generated from a PRNG seeded by
  `hash(seed | lod | tx | ty)` — so any tile is reproducible in isolation
  without generating its neighbours (Minecraft-chunk style).
- The motif/field content for a tile is a pure function of that per-tile seed +
  the global aim (region palette, the C axes), so the plane is globally
  deterministic and **shareable as (seed + viewport position)**.
- Seams: adjacent tiles must align where motifs/bands cross tile boundaries —
  decide between independent self-contained tiles vs. cross-tile continuity
  (border motifs spanning a boundary need deterministic agreement from both
  sides).

## Open questions for the brainstorm (not yet decided)

1. **Determinism contract for an infinite plane:** a "design" becomes
   *(seed + viewport rect)*. How does the URL hash encode pan/zoom so a shared
   link reopens the exact same view? (Extends C's hash-everything rule.)
2. **Tile addressing & LOD:** tile size in stitches; how LOD levels map
   (coarser motifs when zoomed out vs. true mip-style downsampling of fine
   tiles); cache eviction as you roam.
3. **Coherence vs. variety across the plane:** is the whole plane one coherent
   "fabric" (a single theme/aim everywhere) or do regions/biomes vary by
   coordinate? Does Tradition↔Invention/Wild apply globally or spatially?
4. **Seam strategy:** self-contained per-tile motifs (easy, grid-locked) vs.
   continuous bands/borders/medallions that span tiles (needs boundary
   agreement).
5. **Export from an infinite plane:** "capture current view" PNG; can you still
   export a seamless tile or a counted-stitch chart of a bounded crop?
6. **Performance:** on-demand tile generation + GPU compositing budget while
   panning; reuse of A's cached-tile machinery.
7. **Dual-mode shell:** how "explore the infinite field" coexists with the
   bounded "compose a piece" mode (the agreed dual-mode destination).

## Scope boundary (when this becomes a real spec)

- In scope: the infinite per-tile generator + addressing + the roam/zoom UX on
  top of A's viewport + determinism/shareability of (seed + viewport).
- Out of scope: re-opening the C engine internals; any non-Canvas2D/WebGL
  decision already settled for A; bounded-mode behaviour (unchanged).

## Next step

Run the brainstorming skill against this skeleton (after A is prototyped) to
turn the open questions into decisions, then writing-plans.
