# Viewport Tile-Source Refactor (Pillar A correction) — Design

**Date:** 2026-06-08
**Status:** Approved
**Branch/worktree:** `worktree-explorable-viewport` (== `main`, v1.2.0). Lands on `main` as an A correction.

## Why

Pillar A's spec specified a **tile-addressed `TileSource` — `rasterTile(model, lod, tx, ty)`** — and stated its explicit purpose: so Pillar B could later swap finite-model slicing for per-coordinate generation. The merged A implementation **collapsed this to whole-piece `piece.rasterAtCell(cell)`** (rasters the entire bounded piece into one canvas per LOD, cached by cell, clamped to ~16000px). That was a documented "simplification," but it removed the one part of A that existed purely as B's plug-in seam, and it also **caps A's own deep zoom** (the whole piece is rastered at the LOD cell even when only a corner is visible, and the 16000px clamp loses detail on large pieces at high zoom).

This refactor restores the tile-addressed source. It is an **A-internal correction** — the bounded-mode UX is unchanged; it just (a) honors the `TileSource` seam so B is a genuine "swap the source," and (b) uncaps/cheapens deep zoom by rastering only the visible window.

## The tile contract

```
piece.rasterTile(cell, tileX, tileY) → HTMLCanvasElement (TILE × TILE device px)
```
- `TILE` is a fixed constant (256 device px). At a given device cell `dCell`, tile `(tileX,tileY)` covers raster pixels `[tileX*TILE, (tileX+1)*TILE) × [tileY*TILE, (tileY+1)*TILE)` — i.e. stitches `[tileX*TILE/dCell, …)`.
- Returns that tile's pixels, with the piece's background filled.
- **Bounded finite piece** implements it by slicing its grid: fill `bg`, then `drawGrid(model, cell, -tileX*TILE, -tileY*TILE, style, seedNum)` into the tile context (cells outside the tile are clipped by the canvas bounds). Reuses the existing `setCtx` retarget pattern (restored to `VY.ctx` after).
- **Seamless piece** implements it by pattern-filling the tile region from the seamless tile (the existing `buildTileCanvas`-based `createPattern`, offset for the tile's world position so the repeat is continuous across tiles).
- **Pillar B (future, not in this spec)** implements the *same signature* by generating the tile's stitches per-coordinate from `hash(seed | cell | tileX | tileY)` + the global aim. Nothing in the viewport changes.

The viewport caches tiles keyed by `${cell}:${tileX}:${tileY}` in an LRU map (cap by count, sized to comfortably hold the visible window + overscan across one or two LODs), evicting tiles that roam out of view.

## Compositor

`#cv` stops being the whole-piece raster and becomes **stage-sized** (stage W×H CSS px; backing store `W*DPR × H*DPR`).

- **`tilesFor(vp, stageW, stageH, dCell)`** (pure, testable): from the visible world-pixel rect (derived from `vp`, stage size, `dCell`) plus an overscan margin, return the inclusive tile-index range `{tx0,tx1,ty0,ty1}` and the screen offset for each tile.
- **`retile()`** (replaces `reraster`): for the current `VP` + `dCell`, fetch each visible tile (cache or `rasterTile`) and `drawImage` it into `#cv` at its screen position; record the painted `renderVP`/`renderCell`; reset `#cv`'s CSS transform to identity.
- **Two-phase, preserving today's feel:**
  - **Pan:** re-composite cached tiles into `#cv` per `requestAnimationFrame` at the new offsets (cheap — `drawImage` of cached canvases; only newly-exposed tiles miss the cache). No blank edges within overscan.
  - **Zoom:** keep the live CSS transform on `#cv` for instant feedback, then `retile()` crisply at the new `dCell` on settle (130ms) or when the LOD cell changes — exactly as today.
- **Slippy transform** (when transforming `#cv` painted at `renderVP` to show the gesture `VP`): `scale S = VP.zoom / renderVP.zoom`; `translateX = (renderVP.cx − VP.cx)*VP.zoom + (W/2)*(1−S)` (and analogously Y). `transform-origin:0 0`. (Derived so any pattern point keeps its on-screen position; verified in the math test.)

`maxCellFor()`'s role in the raster goes away — tiles are always `TILE`-sized regardless of piece size, so `dCell = round(cell*DPR)` is used directly (no whole-piece clamp). `ZMAX` still bounds zoom.

## Preserved (must not change)

- All input handlers: wheel (cursor-anchored, deltaMode-normalized), drag-pan, touch pinch/one-finger drag, keyboard (+/−/arrows/0), double-click, the HUD reset button, the resize handler.
- `settle()` timing/debounce, `liveCommit()`, `schedule()`.
- View state `{cx,cy,zoom}` ↔ hash `vox/voy/voz`, the `onSettle` hook, `isFit`, `fit`, `getView`.
- The zoom-% HUD.
- **Exports** — PNG/tile/chart use `VY.app._exportCanvas` (the separate full-resolution piece canvas built in `generate()`); this refactor does **not** touch it. Exports stay piece-level and byte-identical.
- **Bounded clamp/fit** — `fitView`/`clampView` keep their bounded behavior so bounded-mode pan/zoom limits are unchanged. (B will add unbounded variants; not here.)
- Determinism — the seed string and `generate()` are untouched; tile content is a pure function of the model + cell + tile address (and, for B, the per-tile seed). Per-stitch jitter still derives from `hashStr(state.seed)` via the shared `drawGrid`.

## Scope boundary

- **In scope:** the `rasterTile(cell,tx,ty)` source on the bounded/seamless pieces; the tiled visible-window compositor + cache; removal of the whole-piece raster + 16000px cap; node-tested tile-range + slippy-transform math.
- **Out of scope:** relaxing bounds to an infinite plane, a "home" vs "fit", unbounded clamp, per-coordinate tile generation — all Pillar B. The dual-mode shell, biomes, seams-across-infinity — all B. C engine internals — untouched.

## Files touched

- `render.js` — add `rasterTile(model, cell, tileX, tileY, style, seedNum, bg, TILE)` (finite slice) and a seamless tile rasterizer; export them. `drawGrid`/`buildTileCanvas`/`setCtx` reused.
- `app.js` — `generate()` builds `piece.rasterTile(cell,tx,ty)` per mode (finite vs seamless) instead of `rasterAtCell(cell)`. The `_exportCanvas` path is unchanged.
- `viewport.js` — replace `rasterFor`/`reraster`/`applyTransform` + the cache with `tilesFor`/`retile` + the tiled compositor + slippy transform + `(cell,tx,ty)` LRU. Everything else (inputs, settle, hash, HUD, fit/clamp) stays.

## Risks & verification

- Viewport-critical and gesture-sensitive. Verify:
  - **Node tests (pure math):** `tilesFor` returns the correct inclusive tile range + per-tile screen offsets for representative VPs; the slippy transform keeps a sample pattern point fixed across a zoom and a pan; determinism of `rasterTile` addressing.
  - **Browser/Playwright (post-deploy):** wheel/drag/pinch/keyboard still smooth; **deep zoom on a 4K piece is now crisp (no 16000px clamp), no blank edges within overscan during a normal pan**; share-link round-trip (`vox/voy/voz`) unchanged; PNG/tile/chart exports byte-identical to pre-refactor; mobile drawer + accordion unaffected; no console errors.
- Known tradeoff: a very fast fling-pan can briefly outrun the overscan until the next settle re-tiles; acceptable and mirrors any tiled viewer. Overscan margin tuned to keep this rare.
