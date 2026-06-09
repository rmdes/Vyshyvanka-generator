# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A dependency-free static web toy that procedurally generates vyshyvanka-style cross-stitch patterns. It runs in three output **modes** — desktop/phone **Wallpaper**, **Garment panel**, and an infinite roamable **Explore** field — and exports a full-resolution PNG, a seamless repeating tile, or a counted-stitch chart. Every design is **pan/zoom-explorable** on an LOD viewport, and is shaped by Design/Colour/Output controls (region, the aim sliders, symmetry, motif silhouette/border, cloth + thread colours, lattice arrangement/spacing, panel/layout shape). There is **no build step, no bundler, no dependencies, no test runner**. It is served as static files (deployed on a simple LAMP/Apache host); `index.html` is the entry point. To run locally: serve the folder (`python3 -m http.server`) and open `index.html`, or just open the file. To develop: edit a file and reload.

## Architecture

The app is split into **seven** relative-linked assets sharing **one global namespace object `VY`**. They are loaded as **classic `<script src>` tags** (NOT ES modules — so it works on LAMP with no MIME/CORS setup) in this order, which is the only coupling:

```
index.html   markup; <link> styles.css; loads data → generator → render → viewport → app
styles.css   all CSS
data.js      static data only: VY.REGIONS, VY.applyBg, VY.applyColors, VY.HERO_MOTIFS, VY.DMC
generator.js grid construction (no DOM): VY.gen.*
render.js    canvas drawing (owns the canvas): VY.cv, VY.ctx, VY.render.*
viewport.js  pan/zoom/LOD explorable view (DOM-free at load): VY.viewport.*
app.js       state, UI wiring, URL hash, favorites, undo, boot: VY.app.*
```

Each file has one responsibility; load-order means a file may only use `VY.*` members defined by an earlier file (or used inside a function that runs after full load). When adding code, respect that boundary and the file's responsibility.

### The generation pipeline (generator.js → render.js)

1. **Deterministic RNG** (`hashStr` + `mulberry32`). A seeded PRNG held in module-local `RNG`; `ri`/`pick`/`chance`/`shuffle` are the only randomness primitives. `VY.gen.setSeed(str)` reseeds it. **Determinism contract: same seed string + settings → identical pattern.**
2. **`VY.REGIONS`** (data.js) — six regional styles, each `{ formal, inspiredBy, note, src, bg, threads, colorBias, densityBias }`. Labels lead with the **formal trait** (e.g. "Red on white") with the region as *inspired by* (e.g. "Poltava") + a `src` further-reading link — interpretations of documented *tendencies*, not authoritative styles. The **key** (`poltava`, `hutsul`, …) is the seed/hash identity and must never change. `VY.applyBg(P, bg)` overlays a dark cloth background by remapping the palette (linen = unchanged); `VY.applyColors(P, bgColor, threadCols)` is a **pure recolour overlay** — it replaces only the bg + thread *hexes* (never `colorBias`/`densityBias`), so custom colours never change the grid.
3. **Grid layer** — patterns are `Int8Array`-row grids; cell value 0 = empty, N = `threads[N-1]`. `newGrid`/`blit`/`blitWrap`/`transpose` compose grids. `blitWrap` wraps modulo (seamless tiles); plain `blit` clips (used everywhere a motif is placed into a window).
4. **Motif engine** — two coexisting motif sources, blended by the **Tradition ↔ Invention** dial (`CFG.tradition`) in `pickSource`/`pickMotif`:
   - **Field motifs** — `sampleGenome(P, aim)` derives a *genome* (layers of math basis functions over symmetry-folded coords, plus `silhouette`/`border`) from the RNG; `makeFieldMotif(m, genome)` is a **pure** function of `(m, genome)` that rasterizes it. The boundary is `silhouetteInside(sil, sym, dx, dy, R)` (auto/circle/square/diamond; `auto` = the historic sym-derived disc/square), and an optional `border` draws the silhouette edge ring. A pinned **Lab** genome is applied as a *theme* every motif deviates from (`varyGenome`); silhouette/border stay live from `CFG` even under a pinned Lab (like `symmetry`).
   - **Hero / archetype** — hand-charted `VY.HERO_MOTIFS` (remapped to the palette via semantic slots, `remapHero`/`remapHeroP`) and the procedural `makeMotif` (which fixes a shared family via `buildTheme`, then deviates per motif scaled by `CFG.variety`). Silhouette/border apply to field motifs only. **Invariant: all random choices are made up-front; the per-cell motif loop is a pure function of (x,y).** Don't call `RNG()` inside that loop.
5. **Bands** (`borderBand`, `separator`, `mainBand`, `borderStrip`) — 1-D strips for panels/frames.
6. **Composition** — all return a model `{grid, cols, rows, palette, ...}`:
   - `composePanel(shape)` / `sampler` / `napkinCloth` — 7 garment shapes (sleeve, cuff, collar, runner, rushnyk, napkin, sampler), scaled by a **Panel size** control (`CFG.panelSize` × `SIZEMUL`).
   - `composeWallpaper(W,H,layout,scale)` — finite framed/all-over layouts: bordered, runner, medallion, diagonal, scattered, wreath.
   - `composeFabricTile(scale)` — a torus-tileable tile for the seamless layout; honours the **Arrangement** (`CFG.lattice` straight/brick/diamond, `auto`=per-seed pick) + **Spacing** (`CFG.spacing` × `SPACING` gap) controls.
7. **Render** (render.js) — `drawGrid` paints a model onto a target context (cross-stitch or filled, with aida texture + per-stitch shading). `renderChart` draws a counted-stitch chart (symbols + 10-cell grid + DMC legend via `nearestDMC`). The viewport's tile callbacks live here too (next section).

### The explorable viewport (viewport.js) — Pillar A

Every mode renders into a **pan/zoom/LOD viewport** instead of a static image. The contract between `app.js` and the viewport is a **`piece`**:

```
piece = { cols, rows, bg, rasterTile(dCell, tx, ty) }          // finite (wallpaper/panel)
piece = { infinite:true, bg, rasterTile(dCell, tx, ty) }       // Explore
```

- `rasterTile(dCell, tx, ty)` returns one `TILE`×`TILE` (256px) device-pixel tile at device cell size `dCell`, for device-tile index `(tx, ty)`. World stitch `s` maps to device px `s*dCell − tx*TILE`. Tile coords can be **negative/arbitrary** (the loop handles it). render.js provides three implementations: `rasterTile` (slice a finite model), `rasterSeamlessTile` (phase-fill a seamless tile), `rasterWindowTile` (draw a precomposed window — used by Explore).
- The viewport keeps view state `{cx, cy, zoom}` in **stitch space** (zoom = CSS px/stitch), an LOD ladder (`LODS`), an LRU tile cache keyed `dCell:tx:ty`, and composites visible tiles (+overscan) into `VY.cv` then applies a GPU CSS transform for the residual sub-LOD scale. `attach(piece, restoreView)` swaps in a new piece; gestures (wheel/drag/pinch/keyboard/dblclick) + the HUD + `onSettle` (writes the view hash) are all coordinate-based and mode-agnostic. `fitView`/`clampView` branch on `piece.infinite` (a medium-zoom "home" + unbounded pan for Explore; fit-to-stage + bounds for finite).

### The infinite Explore field (generator.js) — Pillar B

Explore is an **infinite lattice of self-contained motifs**, generated **position-addressably** so any tile materializes in isolation (chunk-style), with no global RNG stream:

- `buildFabricConfig(P, aim, lab, mm, seed)` → a per-generation `cfg` (palette, aim axes incl. silhouette/border, lattice arrangement + `mm`/`gap`/`period` from `CFG.lattice`/`CFG.spacing`, hero pool, base seed, an LRU `_cache`).
- `cellMotif(latX, latY, cfg)` → the motif at lattice cell `(latX,latY)`, built from a **per-cell PRNG** `mulberry32(hashStr(seed|"B"|latX|latY))` (never the module `RNG`), via the rng-injected `sampleGenomeFrom(rng, P, aim)` / `varyGenomeFrom` + the pure `makeFieldMotif` (field) or `remapHeroP` (hero). Cached by `(latX,latY)`.
- `composeInfiniteWindow(cfg, wx0,wy0,wcols,wrows)` assembles a world-stitch window by `blit`ting overlapping cached cell motifs (centered by each motif's own size, offset by the arrangement); `composeInfiniteTile(cfg, dCell, tx, ty, TILE)` returns that window model + integer draw offsets, which `rasterWindowTile` draws into a tile. Seams are automatic: a cell's motif (and its lattice offset) is identical regardless of which tile renders it.

The Design/Output controls shape the plane globally: **Calm↔Wild** = per-cell variety, **Tradition↔Invention** = field/hero mix, **Arrangement/Spacing/Scale** = the lattice, **Silhouette/Border** = motif geometry, pinned **Lab** = global theme, **Symmetry** global. (v1: one coherent fabric — archetype source folds into field; biomes and a coarse-zoom LOD path are noted future work.)

### Creative controls & colour overlay (cycle 3 / v1.4.0)

- **Colour** (appearance-only): `state.bgColor` (custom cloth hex) + `state.threadCols` (per-thread hex overrides), applied via `VY.applyColors` after `applyBg` in `generate()`. They recolour without touching the grid, so they live in the **hash, not the seed** (recolouring never reshuffles). Saved named palettes live in `localStorage["vy_palettes"]`.
- **Shape** (pattern-affecting): Arrangement + Spacing (seamless tile + Explore), Motif scale (also drives Explore mm), Panel size + the new shapes, the new wallpaper layouts, and Motif silhouette + border. All flow through `CFG` (set in `setConfig`) and the field-motif `aim`/genome.

### Key state

- `RNG`, `CFG` — module-local to generator.js; `CFG` (`.P`, `.variety`, `.dens`, `.region`, `.tradition`, `.symmetry`, `.lab`, `.theme`, `.lattice`, `.spacing`, `.panelSize`, `.silhouette`, `.border`) is set fresh each `generate()` via `VY.gen.setConfig(...)` before composition. The infinite-fabric path does NOT use the module stream — it is purely per-cell seeded.
- `VY.ctx` is `let` in render.js so `setCtx` can retarget `drawGrid` to an offscreen canvas (tile/chart). It is always restored to the main canvas afterward — keep that save/restore invariant.
- `VY.viewport` holds module-private `VP` (view), `PIECE`, and the tile cache; reset per `attach`. `VY.app._palette` holds the current effective (recoloured) palette for the colour-swatch UI.
- `state` (app.js) — UI source of truth (`mode, region, complexity, variety, style, seed, res, layout, bg, scale, shape, tradition, symmetry, lab, bgColor, threadCols, lattice, spacing, panelSize, silhouette, border`, and the view `viewX/viewY/viewZoom`), serialized to/from the URL hash. `generate()` is central: reseeds RNG, builds + recolours `CFG.P`, builds the per-mode `piece` + an export canvas, `attach`es the piece to the viewport, writes the hash.

### Determinism & sharing — the sacred invariant

`generate()` reseeds RNG from a string of every **pattern**-affecting setting; `writeHash`/`readHash` serialize `state` to the URL hash (Copy link). Two rules keep shared links stable:

1. **A pattern-affecting setting is appended to the seed string ONLY when it is non-default.** The base seed string is the original 12 tokens (`seed|region|mode|complexity|variety|layout|shape|bg|scale|res|tradition|symmetry`); cycle-3 settings append suffixes only when set away from default — `|lat<x>` (≠auto), `|sp<x>` (≠normal), `|psz<x>` (≠medium, panel mode only), `|sil<x>` (≠auto), `|bd` (border on). So a design at defaults produces the byte-identical historic seed → every old share link reproduces exactly.
2. **Appearance-only settings live in the hash, NOT the seed** — the viewport view (`vox/voy/voz`), the pinned Lab genome (`lab`, applied purely), and the colours (`bgc`, `thr`). They restore on load but never reshuffle the pattern.

Full hash params: `m,r,c,vy,st,seed,res,lay,bg,sc,sh,tr,sym` + `lab` + `vox/voy/voz` + `bgc/thr` + `lat/sp/psz/sil/bd`. **When adding a setting: pattern-affecting → conditional seed suffix (non-default only) AND a hash param; appearance-only → hash only.** Per-stitch render jitter derives from `hashStr(state.seed)` (not live `RNG`). Never use `Date`/`Math.random` for output (the "New design" button is the one allowed `Math.random`, only to mint a fresh seed).

## Constraints to respect

- **Stay buildless and module-free.** Classic scripts, one `VY` namespace, relative paths — so it deploys as static files on LAMP. Don't introduce a bundler, framework, ES modules, or a test runner. (Pure `generator.js`/`viewport.js` functions are node-testable in a `vm` sandbox; DOM/canvas paths are verified live with Playwright — and, for pattern-affecting changes, cross-checked byte-for-byte against the deployed prod build.)
- **Framing:** the app includes *best-effort interpretations of* documented regional *tendencies* — **not** exact reproductions, and no claim of authoritative symbolic meaning (see README and the in-app `.disclaimer`). Region names lead with the formal trait + "inspired by"; don't add features that assert authenticity or fixed meaning.
- `v0/`–`v3/` (server-side old-release snapshots) and `*.png` are gitignored — old builds and generated exports are never committed.

## Specs & plans

Design/implementation docs live in `docs/superpowers/specs/` and `docs/superpowers/plans/` — one pair per feature (generator improvements, generative richness, sidebar accordion, explorable viewport, infinite field, regional authenticity, colour control, and the four cycle-3 "shape" features: lattice & tiling, panel shapes, wallpaper layouts, motif geometry). Released as git tags `v1.0.0`–`v1.4.0`.
