# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A dependency-free static web toy that procedurally generates vyshyvanka-style cross-stitch patterns and exports them as wallpapers/garment panels, a seamless repeating tile, or a counted-stitch chart. There is **no build step, no bundler, no dependencies, no test runner**. It is served as static files (deployed on a simple LAMP/Apache host); `index.html` is the entry point. To run locally: serve the folder (`python3 -m http.server`) and open `index.html`, or just open the file. To develop: edit a file and reload.

## Architecture

The app is split into six relative-linked assets sharing **one global namespace object `VY`**. They are loaded as **classic `<script src>` tags** (NOT ES modules — so it works on LAMP with no MIME/CORS setup) in this order, which is the only coupling:

```
index.html   markup; <link> styles.css; loads data → generator → render → app
styles.css   all CSS (was the old inline <style>)
data.js      static data only: VY.REGIONS, VY.applyBg, VY.HERO_MOTIFS, VY.DMC
generator.js grid construction (no DOM): VY.gen.*
render.js    canvas drawing (owns the canvas): VY.cv, VY.ctx, VY.render.*
app.js       state, UI wiring, URL hash, favorites, undo, boot: VY.app.*
```

Each file has one responsibility; load-order means a file may only use `VY.*` members defined by an earlier file (or used inside a function that runs after full load). When adding code, respect that boundary and the file's responsibility.

### The generation pipeline

Conceptually unchanged from the original single-file version, now spread across `generator.js`/`render.js`/`app.js`:

1. **Deterministic RNG** (`hashStr` + `mulberry32`, generator.js). A seeded PRNG held in module-local `RNG`; `ri`/`pick`/`chance`/`shuffle` are the only randomness primitives. `VY.gen.setSeed(str)` reseeds it. **Determinism contract: same seed string + settings → identical pattern.**
2. **`VY.REGIONS`** (data.js) — 6 regional styles as *formal traits* (palette `threads`, `colorBias`, `densityBias`). `VY.applyBg` overlays a dark cloth background by remapping the palette.
3. **Grid layer** (generator.js) — patterns are `Int8Array`-row grids; cell value 0 = empty, N = `threads[N-1]`. `newGrid`/`blit`/`blitWrap`/`transpose` compose grids. `blitWrap` wraps modulo (used for seamless tiles); plain `blit` clips. Built in grid space first, rendered last.
4. **Motif engine** (generator.js) — `buildTheme` fixes a shared family once per generation; `makeMotif` produces a symmetric motif that *deviates* from the theme scaled by `CFG.variety`. **Invariant: all random choices are made up-front, then the per-cell loop is a pure function of (x,y).** Don't call `RNG()` inside that per-cell loop. `pickMotif` chooses between a hand-charted `VY.HERO_MOTIFS` entry (remapped to the palette via semantic slots) and a procedural `makeMotif`, with the ratio driven by Variety — route *full-motif* placements through `pickMotif`, not band generators.
5. **Bands** (`borderBand`, `separator`, `mainBand`, `borderStrip`) — 1-D strips for panels/frames.
6. **Composition** — `composePanel`/`sampler`, `composeWallpaper` (bordered/runner/medallion + the legacy fabric path), and `composeFabricTile` (a torus-tileable tile for the seamless layout). All return a model `{grid, cols, rows, palette, ...}`.
7. **Render** (render.js) — `drawGrid` paints a model onto the canvas (cross-stitch or filled, with aida texture + per-stitch shading). Seamless wallpaper uses `buildTileCanvas` + `fillPattern` (`ctx.createPattern`). `renderChart` draws a counted-stitch chart (symbols + 10-cell grid + DMC legend via `VY.gen.nearestDMC`).
8. **State + UI** (app.js) — a single `state` object is the source of truth. `generate()` is the central function: reseeds RNG, builds `CFG`, composes per mode, renders, stashes `VY.app._lastModel`/`_lastTile` for the export buttons, and writes the URL hash.

### Key state

- `RNG`, `CFG` — module-local to generator.js; `CFG` (`.P`, `.variety`, `.dens`, `.region`, `.theme`) is set fresh each `generate()` via `VY.gen.setConfig(...)` before composition; motif/band functions read it implicitly.
- `VY.ctx` is `let` in render.js so `setCtx` can retarget `drawGrid` to an offscreen canvas (tile/chart). It is always restored to the main canvas afterward — keep that save/restore invariant if you touch it.
- `state` (app.js) — UI source of truth, serialized to/from the URL hash.

### Determinism & sharing — the sacred invariant

`generate()` reseeds RNG from a string concatenating every output-affecting setting, and `writeHash`/`readHash` serialize `state` to the URL hash (Copy link). **When adding any setting that affects output, add it to BOTH the seed string in `generate()` AND the hash params in `writeHash`/`readHash`**, or shared links break. Per-stitch render jitter is derived from `hashStr(state.seed)` (not live `RNG`) so it stays reproducible. Never use `Date`/`Math.random` for output (the "New design" button is the one allowed `Math.random`, only to mint a fresh seed).

## Constraints to respect

- **Stay buildless and module-free.** Classic scripts, one `VY` namespace, relative paths — so it deploys as static files on LAMP. Don't introduce a bundler, framework, ES modules, or a test runner.
- **Framing:** the app includes *best-effort interpretations of* documented regional motifs — **not** exact reproductions, and no claim of authoritative symbolic meaning (see README and the in-app `.disclaimer`). Don't add features that assert authenticity or fixed meaning.
- `*.png` is gitignored — generated exports are never committed.

## Specs & plans

Design/implementation docs live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.
