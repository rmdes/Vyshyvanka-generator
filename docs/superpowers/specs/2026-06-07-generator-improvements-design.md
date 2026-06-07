# Vyshyvanka Generator — Improvements Design

**Date:** 2026-06-07
**Status:** Approved

## Summary

Five improvements to the vyshyvanka wallpaper generator, plus a one-time
restructure from a single HTML file into a small set of relative-linked assets
(served over a LAMP stack). The improvements:

1. Hand-charted "hero" motifs mixed into the procedural pool
2. Genuinely seamless `fabric` layout + single-tile PNG export
3. Stitch & fabric rendering realism (aida texture + per-stitch shading)
4. Counted-stitch chart export with DMC floss mapping
5. Favorites, undo, and accessibility passes

## Constraints & decisions

- **Deployment:** served over HTTP from a simple LAMP host. Assets are linked
  with relative paths from the same web root. No build step, no bundler.
- **Scripts:** classic `<script src>` (NOT ES modules) to avoid Apache
  MIME/CORS concerns and stay close to the existing code style.
- **DMC mapping:** auto nearest-match against an embedded floss table (RGB
  distance). Zero maintenance, works for any palette/background.
- **Hero motifs:** best-effort transcriptions researched from public sources,
  framed honestly as *interpretations of* documented regional motifs — not
  exact reproductions. Requires reworking the in-app disclaimer.
- **Determinism contract is sacred:** identical seed + settings must always
  reproduce the identical image, and every design must stay shareable/
  restorable via the URL hash. Any new output-affecting input MUST be added to
  BOTH the seed string in `generate()` AND the hash params in
  `writeHash`/`readHash`.

## File structure (the restructure)

The current single `vyshyvanka-generator.html` becomes:

```
index.html      markup; links styles.css + the 4 scripts in load order
styles.css      the current <style> block, extracted verbatim
data.js         REGIONS palettes · DMC floss table · HERO_MOTIFS charts
generator.js    RNG + helpers · motif engine · bands · composition · tiling
render.js       canvas render (stitch/aida realism) · counted-stitch chart export
app.js          state · UI · events · favorites · undo · share · boot
```

- All scripts attach to a single global namespace object `VY = {}` instead of
  today's loose globals. Load order is the only coupling:
  `data.js → generator.js → render.js → app.js`.
- `index.html` keeps the existing `vyshyvanka-generator.html` filename as well
  (or a redirect) only if convenient; primary entry is `index.html`.

Each file has one clear purpose:
- `data.js` — static data only, no behavior. Consumers read `VY.REGIONS`,
  `VY.DMC`, `VY.HERO_MOTIFS`.
- `generator.js` — pure pattern construction in grid space. Input: config;
  output: grid models. No DOM, no canvas.
- `render.js` — turns grid models into pixels (wallpaper, panel, chart). Owns
  the canvas. No state.
- `app.js` — owns `state`, wires the UI, serializes to/from the URL hash.

## Feature 1 — Hero motifs

**Data format** (`data.js`):
```js
VY.HERO_MOTIFS = [
  { id: "eight-point-star", regions: ["hutsul","bukovyna"], grid: [[...],[...]] },
  ...
];
```
- `grid` cells use **semantic color slots**, not literal palette indices:
  `0` empty, `1` primary, `2` secondary, `3` accent. At placement time slots
  remap to the active region's `threads` (via `colorBias`), so every motif
  recolors to any region.
- Motifs are square and odd-sized to match the existing centering math.

**Selection** (`generator.js`):
- A new builder assembles the per-generation motif pool by mixing
  region-tagged hero motifs with procedural `makeMotif` output.
- The **Variety** slider controls the ratio: low variety → mostly clean hero
  motifs (repetitive, coherent); high variety → more procedural deviation.
- Region filtering prefers motifs tagged for the active region, falling back to
  untagged/general motifs so every region has enough to draw from.
- Selection draws from `RNG` so it stays deterministic.

**Sourcing:** ~10–15 charts seeded from research (eight-point star/ruža,
rhombus-with-hooks, kalyna/berehynia-style florals, oak, etc.), transcribed
best-effort and labelled as interpretations.

## Feature 2 — Seamless fabric + tile export

- For the `fabric` layout, `generator.js` produces one **wrap-around tile**: a
  grid of size `period_x × period_y` where motif placement uses modulo
  (`blit` wraps across edges) so the tile is a true torus.
- `render.js` renders the tile to an offscreen canvas once, then paints the
  wallpaper via `ctx.createPattern(tileCanvas, "repeat")` — genuinely seamless
  and faster than per-cell blitting across a 4K canvas.
- New **"Download tile"** button (`app.js`) exports just the single repeating
  tile as PNG (filename includes region + seed).
- Other layouts (bordered/runner/medallion) are unaffected.

## Feature 3 — Stitch & fabric realism

In `render.js`, `drawGrid` gains:
- **Aida cloth texture:** a subtle woven background (hole/weave pattern)
  replacing the current flat faint-dot grid, drawn when cell size is large
  enough to be visible.
- **Per-stitch shading:** each cross-stitch leg drawn as a darker base stroke
  plus a slightly offset lighter highlight stroke (the "raised floss" look).
- **Deterministic jitter:** small per-stitch hue/lightness variation hashed
  from `(x, y, seed)` — NOT drawn from the live `RNG` during render. This keeps
  output identical across reloads while breaking up flat fills.
- Filled-square style gets the same shading treatment, scaled down.

## Feature 4 — Counted-stitch chart + DMC

- **DMC table** (`data.js`): `VY.DMC = [{ code, name, hex }, ...]` covering a
  few hundred common flosses.
- **Nearest-match** (`generator.js` or a small helper): map each active-palette
  thread hex to the closest DMC by RGB euclidean distance. Cache per
  generation.
- **Chart render mode** (`render.js`): draws the grid model as a counted chart —
  white background, one **symbol per thread** in each occupied cell, thin grid
  lines with **bold lines every 10 cells**, and **row/column numbers** along the
  edges.
- **Legend:** symbol · DMC code · DMC name · color swatch · stitch count per
  thread.
- New **"Download chart"** button exports the chart as a PNG. Single-image
  output (no pagination).

## Feature 5 — Favorites, undo, accessibility

- **Favorites** (`app.js` + `localStorage`): "Save to favorites" stores the
  current full `state`. A favorites strip shows saved designs as clickable chips
  with tiny canvas thumbnails; clicking restores that design. Remove-favorite
  affordance included.
- **Undo:** an in-memory history stack of `state` snapshots; an Undo button
  restores the previous design (primarily to recover from "New design").
- **Accessibility:** `aria-valuetext` on the Complexity/Variety sliders;
  `role="radiogroup"` + `aria-pressed`/`aria-checked` on the segmented button
  groups (mode, layout, bg, scale, shape, style); ensure focus states are
  visible.

## Cross-cutting: determinism & disclaimer

- **Seed + hash wiring:** tiling mode, hero-motif selection inputs, and any new
  user-facing control must be appended to the `generate()` seed string and the
  `writeHash`/`readHash` params. This is the most fragile invariant — verify
  shared links reproduce exactly after each feature.
- **Disclaimer rework:** change the README note and the in-app `.disclaimer`
  text from "does not reproduce specific traditional motifs" to an honest
  framing: the generator now **includes interpretations of documented regional
  motifs** — best-effort, not exact reproductions, and not a claim of
  authoritative symbolic meaning.

## Out of scope

- No build step, bundler, framework, or test suite (single static site on LAMP).
- No server-side code (LAMP serves static assets only here).
- No multi-page/PDF chart export — single PNG only.
- No real-time collaborative or account features for favorites (localStorage only).

## Suggested build order

1. Restructure into the 6 files (behavior-preserving) — verify the app still
   works identically before adding features.
2. Feature 3 (realism) and Feature 2 (seamless+tile) — pure render/generator
   wins, low risk.
3. Feature 1 (hero motifs) — needs research time.
4. Feature 4 (chart + DMC) — largest new surface.
5. Feature 5 (favorites/undo/a11y) — UI layer, independent.
