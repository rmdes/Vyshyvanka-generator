# Wallpaper Layouts — Design (cycle 3c of 4)

**Date:** 2026-06-09
**Status:** Approved
**Branch:** `feature/wallpaper-layouts` (off `main` @ ef5f444, includes 3a+3b)

## Summary

Add three new finite wallpaper layouts to `composeWallpaper` — **Scattered** (jittered-grid toss), **Diagonal** (sheared diagonal stripes), **Wreath** (central focal + ring) — and remove the dead `fabric` branch from that function. Third of four "shape" sub-cycles. Wallpaper-only; additive.

## Current state

`composeWallpaper(W,H,layout,scaleKey)` renders a finite `cols×rows` grid at the chosen resolution. Branches: `fabric` (a lattice fill — **dead/unreachable**, since `generate()` routes `layout==="fabric"` to `composeFabricTile`), `bordered` (frame + 4 corner medallions), `runner` (side ribbon), and the `else` = `medallion` (central `makeMotif` + corners + side frames). `LAYOUTS` (app.js) drives the `#layoutSeg` buttons; `layout` is in the seed string.

## New layouts (3 branches in composeWallpaper)

Each is a finite composition using the seeded RNG (`pickMotif`/`makeMotif`/`ri`), deterministic per seed. `m=[7,9,9,11,13][dens-1]`, `v=CFG.variety`.

- **Scattered** (jittered grid, no overlap): a loose grid `step=mm+gap` (`mm=m+2`, `gap≈mm*0.6`); at each cell, blit `pickMotif(mm)` offset by a random jitter `±jit` with `jit=max(1,floor(gap*0.45))` (so `2·jit < gap` → motifs never overlap). Even coverage with an organic tossed feel.
- **Diagonal** (sheared stripes): rows at `step=mm+gap` (`gap=max(3,round(mm*(0.35+v*0.3)))`); each row's start shifts by an accumulating `dshift=max(2,round(step/3))` taken `mod step`, so successive rows' motifs drift sideways and line up along diagonals. `pickMotif(mm)` per position; start `gx` one step left of the edge for full coverage.
- **Wreath / ring**: a central focal `makeMotif(big)` (`big≈0.26·min(W,H)`, odd) centred, surrounded by a ring of `count=max(8, 6+dens*2)` motifs placed via `cos/sin` at radius `R≈0.32·min(W,H)`; each ring position gets a **fresh** `pickMotif(m)` (varies with Calm↔Wild).

## Dead-code removal

Delete the `if(layout==="fabric"){ … }` block in `composeWallpaper` (~20 lines). It is unreachable (`generate()` sends `fabric` to `composeFabricTile`). The if-chain then begins with `bordered`. No behaviour change for any reachable layout.

## Determinism / scope

- **Additive:** the three new values join `LAYOUTS`; `layout` is already in the seed, so new values are new designs and **every existing wallpaper link (fabric/bordered/runner/medallion) is byte-identical** — the only generator change to reachable code is the three added branches.
- No new state, controls, hash params, or seed-suffix. The `#layoutSeg` buttons auto-build from `LAYOUTS`; `generate()`'s existing "non-fabric wallpaper → `composeWallpaper`" routing already dispatches the new layouts.
- Does **not** touch 3a's Arrangement/Spacing (those stay fabric+explore-only), panel (3b), colour, render, or viewport. The new layouts derive their own spacing from Variety, like `runner`/`medallion` already do.

## UI

`LAYOUTS` (app.js) gains `["diagonal","Diagonal"]`, `["scattered","Scattered"]`, `["wreath","Wreath"]` → 7 layouts. They appear in the existing Layout segmented control (wallpaper mode). No index.html change.

## Out of scope (3d)

Per-motif geometry knobs (border on/off, outline shape). No motif-engine changes here — these layouts only *place* existing motifs.

## Verification

- **Back-compat:** existing wallpaper links (bordered/runner/medallion/fabric) render pixel-identical — node-test that each reachable layout's output is unchanged vs before (and a live cross-check against production for one bordered + one medallion link). Removing the dead `fabric` branch must not change any reachable output.
- **New layouts:** scattered (even jittered coverage, no overlapping motifs), diagonal (visible diagonal stripes), wreath (central focal + ring of motifs) all render and fill the canvas sensibly across densities/scales; node-test each returns `{grid,cols,rows,cell,palette,W,H}` with content (`>0` set cells) and is deterministic per seed.
- **Determinism:** same seed+layout → identical; switching layout reshuffles (layout in seed); the 7 buttons all generate.
- Wallpaper exports (PNG/tile/chart) work; fabric/panel/explore unaffected; 0 console errors; `node --check` clean.

## Files

`generator.js` (`composeWallpaper`: remove fabric branch, add scattered/diagonal/wreath), `app.js` (`LAYOUTS` += 3). No render/viewport/index.html changes.
