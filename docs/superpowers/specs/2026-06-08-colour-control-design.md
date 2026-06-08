# Colour Control — Design (cycle 2 of 3)

**Date:** 2026-06-08
**Status:** Approved
**Branch:** `feature/colour-control` (off `main` @ v1.3.0 + authenticity pass)

## Summary

Give the user full colour control across all three modes: a **custom cloth-background colour**, **editable per-thread colours**, and **saved, reusable palettes**. Colour is modelled as a **pure recolour overlay** — appearance only, serialized to the URL hash but **excluded from the seed string**, so recolouring never reshuffles the pattern and existing share links render identically. Second of three creative-control cycles (authenticity ✓ → **colour** → shape).

## The determinism model (the core decision)

The pattern grid — *which* stitches are filled and *which palette slot* each uses — is a function of the genome + `colorBias` (slot **indices**), not the literal thread hex values. So a thread's colour is **appearance**, not structure. Therefore:

- **`bgColor` and `threadCols` live in the URL hash (for sharing) but NOT in the seed string.** Recolouring regenerates the *same* grid with new colours; it never re-randomises the embroidery, and the current pan/zoom is preserved.
- Existing links (no colour params) render exactly as before — fully back-compatible.
- This mirrors how the Lab genome and the viewport view are already handled (hash, applied purely; not in the seed). Consistent with the sacred invariant: *pattern-affecting settings → seed + hash; appearance/view-only → hash only.*

The recolour must touch **only** `P.bg` and `P.threads` hexes — never `colorBias`/`densityBias` — or it would change the grid.

## State

Add to `state` / `DEFAULTS`:
- `bgColor: null` — custom cloth hex (e.g. `"#101820"`) or `null` (use the bg preset's default).
- `threadCols: []` — sparse array of per-thread hex overrides, indexed into the **built** palette `P.threads`; `threadCols[i]` falsy = use the palette default at `i`.

Both are appearance-only. Neither enters the `generate()` seed string.

## Application point (`data.js` + `app.js`)

New pure function in `data.js`, next to `applyBg`:
```js
VY.applyColors=function applyColors(P, bgColor, threadCols){
  if(!bgColor && !(threadCols && threadCols.length)) return P;
  return { ...P,
    bg: bgColor || P.bg,
    threads: P.threads.map((t,i)=> (threadCols && threadCols[i]) || t) };
};
```
In `generate()`, apply it to the built palette **right after `applyBg`/region selection and before `setConfig`** so the recoloured `P` flows into `CFG.P`, the model's `palette`, and the piece's `bg` — with `colorBias` untouched. The seed string built just above is unchanged.

Because composition reads `colorBias`/genome (indices) for the grid and only the hexes for drawing, the grid is byte-identical; only colours change.

## Determinism / sharing — hash encoding

`writeHash`/`readHash` gain two **hash-only** params (NOT added to the seed string):
- `bgc` — custom bg hex without `#` (e.g. `bgc=101820`); absent = none.
- `thr` — positional comma-joined thread overrides without `#`, empty slot = default (e.g. `thr=aa0000,,ffd23f` overrides threads 0 and 2). Absent = none.

`readHash` validates each as `/^[0-9a-fA-F]{3,6}$/` before accepting, re-adds `#`, and clamps `thr` length. Malformed → ignored (no throw).

## Reset behaviour

- Changing **region**, **bg preset**, or **mode** clears both overrides (`bgColor=null; threadCols=[]`) — you get that palette's natural colours. (Region/bg/mode all rebuild the palette — mode because panel uses the raw region palette while wallpaper/explore run `applyBg`, so thread-override indices would otherwise misalign. The handlers already call `resetView()`+`generate()`; add a `resetColors()` alongside.)
- A **Reset colours** button clears overrides manually.
- Saved palettes are the deliberate way to re-apply a scheme.

## Saved palettes (universal, localStorage)

- `localStorage["vy_palettes"]` → array of `{name, bgColor, threadCols}`.
- **Save** captures the current *effective* colours (current `bgColor` or the palette's bg, and the current effective thread hexes) under a prompted name.
- The list renders name chips with **apply** + **✕**. **Apply** sets `state.bgColor`/`state.threadCols` (clamped to the current palette's thread count) and regenerates.
- Universal: a saved scheme applies over any region/design. Guard `localStorage` writes with try/catch (quota), mirroring the favourites code.

## UI — a new "🎨 Colour" accordion section

A dedicated `data-sec="colour"` accordion section (Style keeps only stitch-style). Contents:
- **Cloth background:** the existing 4 presets (`#bgSeg`) **+ a custom colour** — an `<input type="color" id="bgColor">` with a "Reset" affordance. Picking a custom colour sets `state.bgColor`; the presets clear it.
- **Threads:** a dynamically-built row of `<input type="color">` swatches, one per `P.threads` entry of the **effective** palette (built in `syncUI`/after `generate`, like the Lab layers are built). Editing swatch `i` sets `threadCols[i]`. Use the `change` event to regenerate (not `input`, to avoid a regen per drag-frame).
- **Reset colours** button (`#resetColors`).
- **Saved palettes:** **Save palette** button + `#palettes` list (name + apply + ✕).

`app.js` stashes the effective palette (`VY.app._palette = P`) in `generate()` so the swatch renderer can read it. Colour-change handlers call `generate()` **without** `resetView()` (preserve the pan/zoom; same grid, new colours).

## Files

- `data.js` — `VY.applyColors`.
- `app.js` — `state.bgColor`/`threadCols` in DEFAULTS; the `applyColors` call in `generate()`; `bgc`/`thr` in `writeHash`/`readHash`; `resetColors()` wired into the region, bg-preset, and mode handlers; the custom-bg picker handler; dynamic thread-swatch render + handlers; saved-palette CRUD; `#resetColors`.
- `index.html` — the "🎨 Colour" accordion section markup (custom bg picker, threads container, reset, save + list).
- `styles.css` — swatch row + palette-chip styling.
- **No `generator.js` / `render.js` / `viewport.js` changes** — recolour is purely at the palette level; `drawGrid` already reads `model.palette.threads` and tiles fill `piece.bg`.

## Out of scope (cycle 3 — shape)

Per-mode dimensions/aspect, more layouts & panel presets, motif-geometry knobs, lattice/tiling control. No `colorBias`/genome/structural changes here.

## Verification

- **Recolour ≠ reshuffle (the key test):** with a fixed seed, set `bgColor` + a `threadCols` override → the grid (filled cells + slots) is identical; only colours differ; the viewport stays put. Node-test `applyColors` purity (colorBias/densityBias/grid-relevant fields untouched; only bg + thread hexes change; no-op when no overrides).
- **Back-compat:** an existing share link (no `bgc`/`thr`) renders pixel-identical to pre-change.
- **Sharing:** a link with `bgc`/`thr` restores the exact colours; malformed values are ignored without throwing.
- **Reset:** switching region/bg clears overrides; Reset colours clears; saved palette applies over a different region (clamped) and persists across reload.
- All three modes recolour (wallpaper, panel, explore); 0 console errors; `node --check` clean.
