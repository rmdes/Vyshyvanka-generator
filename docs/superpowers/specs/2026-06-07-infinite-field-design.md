# Infinite Roamable Field (Pillar B) — Design

**Date:** 2026-06-08 (brainstormed/approved; supersedes the 2026-06-07 skeleton)
**Status:** Approved
**Branch/worktree:** `feature/infinite-field` (`/mnt/d/Private/Perso/vish-infinite-field`), based on `main` @ v1.2.0 (Pillars C + A merged).

## Summary

A new **"Explore" mode** (third option beside Wallpaper / Panel): an **infinite, roamable, seamless vyshyvanka fabric**. You pan/zoom across it forever with Pillar A's viewport; it is driven by the **existing Design controls** (region, Minimal↔Ornate, Calm↔Wild, Tradition↔Invention, Symmetry, Lab), which shape the plane **globally**. It is **one coherent fabric** (no biomes in v1). Bounded layouts (border/runner/medallion/panels) stay bounded-only.

B reuses A's viewport machinery almost entirely. The one genuinely new piece is a **position-addressable generation path**: each lattice cell's motif is a pure function of its world coordinates + the seed, so any tile can be generated in isolation (Minecraft-chunk style), without walking a global RNG stream.

## Roadmap context

- **C — generative engine** (merged, v1.1.0): `makeFieldMotif(m,G)` (pure), `sampleGenome(P,aim)`, `hashStr`/`mulberry32`, `newGrid`/`blit`. B reuses these.
- **A — explorable viewport** (merged, v1.2.0): the `piece.rasterTile(dCell,tx,ty)` tile seam, the tile cache, the GPU-composited viewport (`{cx,cy,zoom}` ↔ hash `vox/voy/voz`), all gestures, HUD. B reuses these; the *only* A code B changes is `fitView`/`clampView` (infinite relaxation).
- **B — this spec.**

## Non-negotiable invariants (carried from the engine)

- **Determinism & sharing:** the plane is a pure function of the seed string (region/aim/symmetry — the *fabric config*, NOT the viewport). The **viewport (center+zoom) stays a pure view transform**, serialized to the hash as `vox/voy/voz` (already built by A), so an Explore link reopens the exact spot. Two people with the same link see the identical plane.
- **Position-addressable, not stream-order:** every lattice cell's content derives from `hash(seed | latX | latY)` — never from a global RNG stream consumed in order. (Today's bounded `composeFabricTile` is stream-order and is **not** reused for Explore.)
- **Reuse, don't re-generate on pan/zoom:** the viewport re-rasterizes only tiles entering view; cell motifs are cached by `(latX,latY)`. Pan/zoom never rebuilds the fabric config.
- **Buildless / Canvas2D / classic `<script src>` under `VY`.** No WebGL/build/test-runner. Module-free.

## B1 — The fabric: a position-addressable lattice of self-contained motifs

The plane is a regular **lattice in absolute world-stitch space**:

- `period = mm + gap` (motif size `mm` + gap, from the scale/aim, fixed per fabric config). Optional **brick** half-period horizontal offset on odd `latY` (a coherence/variety choice baked into the config, not per-cell).
- Lattice cell `(latX, latY)` occupies the `period × period` block at world-stitch origin `(latX·period + rowOffset(latY), latY·period)`.
- Each cell holds **one self-contained motif** (size `mm`, centered in its block), generated purely from its own coordinates:

```
cellRNG       = mulberry32(hashStr(`${seed}|B|${latX}|${latY}`))
cellMotif(latX,latY) = build a motif from cellRNG + the global fabric config
```

**Seams are trivial:** a cell's motif is identical no matter which render tile draws it (pure function of `(latX,latY)`), so adjacent tiles always agree. Optional deterministic **filler** between motifs is seeded per gap-position the same way (`hash(seed|Bf|latX|latY)`).

### Per-cell motif construction (reuses C, via an injected RNG)

`cellMotif` chooses a source and builds the motif from **`cellRNG`** (never the module stream):
- **Source mix** via `pickSource(cellRNG(), tradition, hasHero)` (already pure given the roll).
- **field** → `makeFieldMotif(mm, genome)` where `genome = sampleGenomeFrom(cellRNG, P, aim)` — see the rng-injected sampler below. (`makeFieldMotif` is already pure.)
- **hero** → `remapHero(pick-from(cellRNG, heroPool).grid)` (remapHero is pure given `P`).
- **archetype** → reuse `makeMotif`'s shapes but seeded from `cellRNG` + the shared theme. *(If cleanly isolating `makeMotif` from the module RNG/theme proves invasive, v1 may restrict Explore's non-field sources to field+hero and treat archetype as a field variant — decided in the plan after reading `makeMotif`. The user-visible effect is minor; field+hero already span the Tradition↔Invention range.)*

The Design axes map exactly as in bounded mode: **Calm↔Wild** = how far each cell's genome deviates (Calm → tight family, the plane reads as a coherent repeat; Wild → every cell distinct, infinite non-repeating variety); **Tradition↔Invention** = the per-cell field/hero/archetype ratio; **Minimal↔Ornate** = genome layer count/density; **Symmetry** = global; a pinned **Lab** genome = the shared theme every cell deviates from (matches the A-era "Lab is a theme" behavior).

### The rng-injected genome sampler (confirmed decision **a**)

Add a variant `sampleGenomeFrom(rng, P, aim)` that draws from an **explicit `rng`** instead of the module-global `RNG`. The existing `sampleGenome(P, aim)` (module-stream) stays for bounded modes. Implementation approach: factor the genome-sampling body to use a passed-in `rng`, and have `sampleGenome(P,aim)` call `sampleGenomeFrom(RNG, P, aim)`. (Do NOT temporarily swap the module `RNG` — explicit injection keeps the bounded path untouched and the per-cell path pure/parallel-safe.)

## B2 — Rendering a tile (reuses A's seam)

B's `piece` is **infinite**: `{ infinite:true, bg, rasterTile(dCell, tx, ty) }`.

`rasterTile(dCell, tx, ty)` (returns a 256px device-px tile):
1. Compute the tile's **world-stitch window** from `(dCell, tx, ty)`: `wx0 = floor(tx·256 / dCell)`, similarly `wy0`; window covers `ceil(256/dCell)+1` stitches per side.
2. `composeInfiniteWindow(cfg, wx0, wy0, wcols, wrows)` builds a `{grid, cols, rows, palette}` window model: find the lattice cells overlapping the window, fetch each `cellMotif(latX,latY)` (LRU-cached), and `blit` it into the window grid at `(cellWorldX − wx0, cellWorldY − wy0)` (blit already clips). Add filler.
3. `drawGrid(windowModel, dCell, ox, oy, style, seedNum)` into the 256 tile, with `ox,oy` aligning `wx0,wy0` to the tile origin. Reuses `drawGrid` (aida/shading/jitter intact).

The world↔stitch model is **stitch-space**: a lattice cell renders the same stitches at every zoom; only `dCell` changes. So `(latX,latY)` motif grids cache across LODs; A's `(dCell,tx,ty)` tile cache handles pan/zoom reuse.

## B3 — Viewport integration (only `fitView`/`clampView` change)

A's tile loop, `(dCell,tx,ty)` cache, compositor, wheel/drag/pinch/keyboard/dblclick, HUD, and `vox/voy/voz` hash are reused **unchanged** (coordinate-based; already handle arbitrary/negative `tx,ty`).

The **only** `viewport.js` change: `fitView`/`clampView` branch on `piece.infinite`:
- `fitView` → a **"home" view** (confirmed decision **b**): a **medium zoom** showing a handful of motifs (e.g. a default px/stitch around the mid LOD so several lattice cells are visible), centered at world origin `(0,0)`. So opening Explore immediately reads as a fabric, not a single motif.
- `clampView` → **zoom-only clamp** (clamp to the LOD range; no `cx,cy` bounds — infinite pan).
- Reset-view (`vpReset`) → home view. The HUD `%` is relative to the home zoom.

## B4 — Determinism, share, export

- **Seed string:** the Explore fabric config (seed, region, the aim axes, symmetry, scale) feeds `generate()`'s seed string exactly like bounded modes; the viewport does NOT (it's `vox/voy/voz`). A pinned Lab applies purely (as today), shared via the `lab` hash param.
- **Share = seed + viewport.** Reuses A's `onSettle → vox/voy/voz` + `readHash`. No new hash mechanics.
- **Export:** Explore's PNG export = **the current view** (the visible viewport window, rasterized at the current LOD). Bounded modes keep today's piece-level PNG / seamless-tile / chart untouched. (Bounded-crop chart + fabric repeat-tile export are out of scope for v1.)

## B5 — File structure & scope

- **`generator.js`** (additive; the new position-addressable path lives with the engine it reuses):
  - `sampleGenomeFrom(rng, P, aim)` (+ refactor `sampleGenome` to delegate to it).
  - `buildFabricConfig(P, aim, lab, scale, seed)` → the per-generation global config (palette, aim, lattice `mm`/`gap`/`period`/brick, hero pool, pinned theme, base seed).
  - `cellMotif(latX, latY, cfg)` → pure-per-coordinate motif (LRU-cached by `(latX,latY)`; cache lives in the fabric config or a module map cleared per generate()).
  - `composeInfiniteWindow(cfg, wx0, wy0, wcols, wrows)` → window model via cached cells + `blit`.
  - Export `VY.gen.buildFabricConfig`, `VY.gen.composeInfiniteWindow` (+ the sampler) on `VY.gen`.
- **`app.js`:** an `state.mode==="explore"` branch in `generate()` that builds `fabricCfg` + the infinite `piece` (`rasterTile` → `composeInfiniteWindow` → `drawGrid` into a 256 tile) and `attach`es it; the mode segmented control gains **"🧭 Explore"**; explore PNG-export = current view; `resetView` on mode switch (already wired). Seed string unchanged in shape (the fabric config fields are already in it).
- **`viewport.js`:** the `fitView`/`clampView` infinite branch + home view.
- **`index.html`:** the Explore mode button; minor HUD label.
- **`render.js`:** likely unchanged (B composes a window model and reuses `drawGrid`); add a thin tile helper only if the offset math is cleaner there.

**Out of scope (v1):** biomes / spatial drift of palette or aim; continuous bands/borders/medallions spanning the plane; "capture a bounded crop" as chart or seamless-tile; a dual-mode shell beyond the mode button; any non-Canvas2D path; new build step/bundler/framework/test-runner.

## Risks / open questions (resolve in the plan)

- **`makeMotif` (archetype) per-cell isolation:** it reads `CFG.theme` + the module `RNG`. Cleanly seeding it from `cellRNG` may be invasive; the plan decides whether to (i) make it rng-injectable too, or (ii) restrict Explore v1 to field+hero sources (archetype folded into field). Low user-visible impact.
- **Perf:** per-tile work = build window grid (blit a few cached cell-motifs) + one `drawGrid`. Cell motifs cached by `(latX,latY)`; tiles cached by A's `(dCell,tx,ty)`. New-tile generation per frame is bounded by the visible window; verify smooth pan/zoom on a 4K stage in the Playwright pass. Tune cell-cache size + the LOD where coarse zoom would request very many tiny cells (cap by switching to a coarser representation or a max cells/tile guard).
- **Home zoom constant** + the HUD `%` reference for an infinite plane — pick a sensible default, tune in the live pass.

## Verification (live, after deploy)

- Switching to Explore shows an infinite fabric at a medium home zoom; pan/zoom roams smoothly in all directions (incl. negative coords) with no seams and no blank tiles within overscan.
- Determinism: same seed → identical plane at the same world coords across reloads (check a deep-panned view via console pixel hash). Different seed → different plane.
- Share: copy link mid-roam, reload → exact same spot + plane. Calm↔Wild visibly changes per-cell variety; Tradition↔Invention shifts the field/hero mix; a pinned Lab themes the whole plane; Symmetry global.
- Regression: Wallpaper/Panel modes, their exports, favorites/undo, the accordion, mobile drawer all unchanged. 0 console errors.

## Suggested build order (for the plan)

1. `sampleGenomeFrom(rng,P,aim)` + `sampleGenome` delegation (node-tested: same seed→same genome; bounded path unchanged).
2. `buildFabricConfig` + `cellMotif` (node-tested: pure per `(latX,latY)`; same coords→identical grid; symmetric/non-empty) + `composeInfiniteWindow` (node-tested: a cell appears identically regardless of which window/offset renders it → seam-consistency).
3. `viewport.js` infinite `fitView`/`clampView` + home (node-tested math).
4. `app.js` Explore branch + infinite `piece` + mode button + view-PNG export.
5. Live Playwright pass: roam/zoom/determinism/share/regression + perf tuning.
