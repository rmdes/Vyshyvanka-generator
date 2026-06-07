# Explorable Viewport (Pillar A) — Design

**Date:** 2026-06-07
**Status:** Draft — for review (not yet through the interactive brainstorm/approval gate)
**Part of the larger roadmap** (Pillars A/B/C). This spec covers **Pillar A only**.

## Summary

Add an interactive **pan + zoom + level-of-detail (LOD)** viewport over the
existing canvas, GPU-assisted, while fully reusing the current Canvas2D
generator. The piece shown is exactly today's output; A adds the ability to
**move and zoom into it** smoothly — from "fit to stage" down to individual
stitches. The technique is **cached offscreen tile rasters + a GPU-composited
CSS transform**: live gestures move/scale an already-rasterized bitmap (60fps,
GPU), and on settle (or when crossing a LOD boundary) the visible region is
re-rasterized crisply via the existing `drawGrid`. No WebGL, no build step.

Scope is the **bounded current piece** (deep-zoom + pan within it). This
deliberately prototypes the interaction and the tile-source interface before
Pillar B (the infinite roamable field) reuses the same machinery.

## Roadmap context & boundary

- **A — Explorable viewport:** THIS spec. Pan/zoom/LOD on the bounded piece.
- **B — Infinite roamable field:** later; reuses A's `TileSource` interface but
  generates tiles per-coordinate from seed instead of slicing a finite model.
- **C — Generative richness:** separate, already specced/planned.

A must not depend on B or C, and must leave the door open to B: the rasterizer
is addressed by **(lod, tileX, tileY)** so the same call later maps to
on-demand infinite generation.

## Non-negotiable invariants (carried from the engine)

- **Determinism & sharing:** the *pattern* is unchanged and stays a pure
  function of the seed. The **viewport (center + zoom) is a pure view transform**
  layered on top — it does NOT feed the seed string. It IS serialized to the URL
  hash so a panned/zoomed view is shareable and restorable.
- **Reuse, don't re-generate:** pan/zoom never re-runs the generator. It only
  re-rasterizes from the already-computed grid model via `drawGrid` (whose
  per-stitch jitter is seeded from `hashStr(seed)`, so all LODs stay visually
  consistent).
- **Buildless / Canvas2D:** classic `<script src>` under `VY`, GPU help comes
  from CSS-transform compositing + `drawImage`, not shaders.

## Architecture

### Components

1. **Viewport state** — `{ cx, cy, zoom }`: center in *pattern space* (stitch
   coordinates) and a zoom factor (screen px per stitch). Lives in `state`,
   serialized to the hash as `vx,vy,vz`. Default = "fit to stage" (reproduces
   today's static preview), so existing links and fresh loads look unchanged.

2. **`viewport.js`** (new classic script, `VY.viewport.*`) — owns interaction:
   wheel-zoom (anchored at the cursor), drag-pan, touch pinch+drag, keyboard
   (+/- zoom, arrows pan, `0` reset), double-click step-zoom. Maps screen ↔
   pattern coordinates, clamps pan to the piece bounds (+ margin), and schedules
   rasterization. Owns the live CSS transform and the raster cache.

3. **Tile cache + LOD** (in `viewport.js`, rasterizing through `render.js`) — a
   small **LOD ladder** by stitch cell size in screen px (e.g. `1,2,4,8,16,32`).
   For each LOD the visible region (+ overscan margin) is rasterized into
   offscreen canvas tile(s) keyed by `(lod, tileX, tileY)`, cached in a Map with
   **LRU eviction** to bound memory. For a bounded piece small enough, a LOD may
   be a single offscreen canvas; the tile interface is identical either way.

4. **`TileSource`** (interface, implemented in `render.js`) —
   `rasterTile(model, lod, tx, ty, style, seedNum) → HTMLCanvasElement`. For
   Pillar A it slices/draws the finite `model` at the LOD's cell size using the
   existing `drawGrid`. (Pillar B later supplies a different implementation that
   generates the tile's stitches from seed + world coordinates — same signature.)

5. **Compositor** — two-phase for smoothness:
   - **Live phase:** during a gesture, apply `transform: translate()/scale()` to
     the canvas (or a wrapper) → GPU-composited, buttery pan/zoom against the
     last crisp raster (may look soft mid-gesture).
   - **Settle phase:** on interaction-end (debounced ~120ms) or when zoom crosses
     a LOD boundary, re-rasterize the visible region at the correct LOD via the
     TileSource, blit to `VY.cv`, and reset the transform → crisp result.
   - `requestAnimationFrame` drives transform updates; rasterization is throttled.

### Data flow

```
generate() (unchanged) -> grid model (+ seedNum)
        │
        ▼
VY.viewport.attach(model, seedNum, style)   // called at end of generate()
        │   computes "fit" viewport, rasterizes initial LOD, draws to VY.cv
        ▼
user gesture ──live──> CSS transform on canvas (GPU)
        └──settle/LOD cross──> TileSource.rasterTile(...) -> blit -> reset transform
        └──> writeHash(vx,vy,vz)   // shareable view
```

### Coordinate model

- Pattern space: stitch `(sx, sy)`, origin at model top-left.
- Screen↔pattern: `screen = (pattern - center)*zoom + viewportCenterPx`.
- Zoom anchored at the pointer: keep the pattern point under the cursor fixed
  across a wheel step.
- Pan clamped so the piece can't be dragged entirely off-stage (allow a margin).
- High-DPI: rasterize at `devicePixelRatio` for crispness; transform math in CSS
  px.

## Integration with existing code

- **`render.js`:** add `rasterTile(model, lod, tx, ty, style, seedNum)` and a
  `cellForLod(lod)` helper, both thin wrappers over the existing `drawGrid`
  (which already accepts an arbitrary `cell` size and paints aida/shading). The
  existing `buildTileCanvas`/`fillPattern` (used by the seamless layout) are
  unaffected; `rasterTile` is the LOD-aware generalization for the viewport.
- **`fitPreview`** (today's CSS scale-to-fit) becomes the **initial viewport
  state** ("fit"); the viewport supersedes it for interaction. Keep a `fit()`
  that recomputes it on stage resize.
- **`app.js`:** after each branch of `generate()` computes its `model`, call
  `VY.viewport.attach(model, seedNum, state.style)` instead of the current
  direct `drawGrid` + `fitPreview` for the on-screen preview. (Full-res export
  still draws the whole model independently — see below.) Add `vx,vy,vz` to
  `state`, `writeHash`, and `readHash` (defensive parse like `tr`/`sym`). Wire a
  "Reset view / Fit" button.
- **`index.html`:** load `viewport.js` after `render.js`, before `app.js`. Add a
  small HUD (zoom %, reset-view button) over the stage; set `touch-action:none`
  on the canvas so custom gestures aren't hijacked by browser scroll/zoom.
- **`styles.css`:** `cursor:grab/grabbing` on the stage, HUD styling,
  `touch-action:none` on `#cv`.

### Exports stay piece-level

PNG / seamless-tile / counted-chart exports continue to operate on the **full
model**, not the current view — they export the whole piece as today. (An
optional "capture current view" export is a possible follow-on but is out of
scope here; it belongs more with Pillar B / the dual-mode "explore" identity.)

### What regenerate does to the view

- Changing the **seed/region/layout/etc.** (a new pattern) resets the viewport
  to "fit" (you're looking at a new piece).
- Changing only **style** (cross/filled) keeps the current view and just
  re-rasterizes.
- Restoring from a share link with `vx,vy,vz` applies that view after `attach`.

## Determinism & sharing details

- Pattern seed string: **unchanged** (viewport is not an output-of-the-pattern
  input).
- Hash: add `vx,vy,vz`. Omit when at the default fit (keeps URLs clean and old
  links identical). Parse defensively (`Number.isFinite`, clamp zoom to the LOD
  range, clamp center to bounds).
- All LODs rasterize through the same `drawGrid` + seed-derived jitter, so
  zooming changes detail, not the pattern.

## Risks / open questions

- **Memory:** the tile cache must be LRU-bounded (e.g. cap tiles or bytes);
  evict tiles outside the visible LOD + neighbors.
- **Mid-gesture blur:** CSS-scaling a bitmap is soft until re-raster; mitigate
  with a quick settle debounce and/or rasterizing one LOD finer than displayed
  for headroom.
- **`fitPreview` refactor:** today it sets the canvas CSS size directly; the
  viewport takes over that responsibility — needs a careful, behavior-preserving
  swap so the non-interactive baseline still looks identical.
- **Touch vs mobile drawer:** `touch-action:none` only on `#cv`; ensure the
  sidebar drawer gestures still work.
- **Export semantics:** confirm with the user that exports remain piece-level
  (recommended) vs. current-view.

## Out of scope (this spec)

- Infinite roamable field (Pillar B).
- Dual-mode shell.
- "Capture current view" export.
- WebGL/WebGPU/shaders (we stay Canvas2D + CSS-transform compositing).
- New build step, bundler, framework, or test runner.

## Suggested build order (for the eventual plan)

1. `rasterTile`/`cellForLod` in `render.js` (reuse `drawGrid`) + headless raster
   sanity (Node `vm`, like Pillar C's generator tests where feasible).
2. `viewport.js`: state math + screen↔pattern mapping + `fit()` (no input yet);
   `attach()` draws the initial fitted view. Behavior-preserving swap of the
   preview path in `generate()`.
3. Wheel-zoom (anchored) + drag-pan + the two-phase compositor + LOD ladder +
   bounded LRU tile cache.
4. Touch (pinch/drag), keyboard, double-click, HUD + reset/fit button.
5. `vx,vy,vz` in state/hash + share round-trip; regenerate-vs-view rules.
6. Polish: high-DPI raster, mid-gesture headroom, mobile-drawer coexistence.
