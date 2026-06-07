# Sidebar Accordion Refactor — Design

**Date:** 2026-06-07
**Status:** Approved
**Branch:** `feature/generative-richness` (UX fix bundled with Pillar C before it merges to main)

## Problem

Pillar C added Tradition, Symmetry, and the Lab panel to the sidebar. Measured on
the live site (800px viewport):

- The sidebar is **2131px tall** — controls run ~3× the viewport.
- The **🎲 New design** button sits at the very bottom (the `.btns` block is 354px
  tall, after the 515px Lab panel) — you must scroll to find the primary action.
- The Lab causes a **horizontal scrollbar**: a `.labLayer` editor renders **398px
  wide inside a 284px column** because its number inputs/selects don't shrink.

## Goal

Reorganize the sidebar so it fits a narrow column without horizontal overflow and
keeps the primary action always reachable — a **sticky action bar** + a
**single-open accordion**, plus a **compact Lab editor**. Pure UI refactor: no
generation, determinism, state, or hash changes.

## Non-negotiables

- **No logic change.** Generation, determinism (seed string + hash), the field
  engine, favorites, undo, and exports behave identically.
- **Every control keeps its existing DOM id** (`region`, `complexity`, `variety`,
  `tradition`, `symSeg`, `modeSeg`, `layoutSeg`, `bgSeg`, `scaleSeg`, `shapeSeg`,
  `styleSeg`, `res`, `seed`, `gen`, `undo`, `png`, `tile`, `chart`, `share`,
  `save`, `favs`, and all `lab*` ids). `syncUI`, events, and hash wiring are
  unchanged; controls only move in the markup.
- Mobile drawer keeps working (the sticky bar + accordion live inside `aside`).

## Layout

```
┌─ aside (300px, scrolls vertically only) ─┐
│ ░ STICKY action bar (top:0) ░            │
│   🎲 New design          ↶ Undo          │
│   seed: [____________]                   │
├──────────────────────────────────────────┤
│ ▾ Design            (default open)       │
│ ▸ Output                                 │
│ ▸ Style                                  │
│ ▸ 🧪 Lab                                  │
│ ▸ Export & saved                         │
└──────────────────────────────────────────┘
```

### Sticky action bar

- `position: sticky; top: 0` inside the scrolling `aside`, with a solid panel
  background + `z-index` so accordion content scrolls under it.
- Contains: **🎲 New design** (primary, `#gen`), **↶ Undo** (`#undo`), and the
  **seed** input (`#seed`). The small flag/brand strip + title may sit above it
  (non-sticky) or be dropped to save height — keep it minimal.

### Accordion (single-open)

- Five sections; each is a header button + a collapsible body. Exactly **one body
  open at a time** — opening a section collapses the others.
- The open section is **persisted to `localStorage`** (key e.g. `vy_openSection`)
  and restored on load; default **`design`** when none stored.
- A header shows an open/closed affordance (▾ / ▸) and toggles
  `aria-expanded`; bodies use a `.hidden` class (reuse existing pattern).
- Keyboard/a11y: each header is a real `<button>` with `aria-expanded` and
  `aria-controls` pointing at its body.

### Section contents (relocated, ids preserved)

1. **Design** — `#region` + `#regionNote`; Detail (`#complexity`), Variation
   (`#variety`), Tradition (`#tradition`) sliders; Symmetry (`#symSeg`).
2. **Output** — mode (`#modeSeg`); then `#wallControls` (resolution `#res`,
   layout `#layoutSeg`, scale `#scaleSeg`) OR `#panelControls` (`#shapeSeg`),
   toggled by mode exactly as today.
3. **Style** — stitch style (`#styleSeg`), cloth background (`#bgSeg`).
4. **🧪 Lab** — the genome editor (`#labNLayers`, `#labLevels`, `#labLayers`),
   plus a `#labRandom` ("🎲 Randomize") and the existing `#labReset` ("Reset to
   seed"). Its "pre-fill from seed when opened with no active lab" behavior fires
   when this section opens.
5. **Export & saved** — `#png`, `#tile`, `#chart`, `#share`, `#save`, the `#favs`
   strip, and a `#resetAll` ("Reset all") button.

Note: **Cloth background** moves out of the Wallpaper block into **Style**; it
already applies only in wallpaper mode via `applyBg`, so no behavior change — it
just lives in Style now. (If simpler to keep `#bgSeg` inside Output, that is
acceptable; the grouping is the only flexible part.)

## Lab compact editor (fixes horizontal overflow)

Rebuild each layer's editor so all six controls fit the ~248px content width:

- Each control sits in a **labeled cell**: a micro-label (`coord`, `wave`, `freq`,
  `phase`, `weight`, `slot`) above a full-width field.
- Cells laid out **2-up** (three rows of two). Cells use `flex:1; min-width:0`;
  fields use `width:100%; min-width:0; box-sizing:border-box` so they shrink
  instead of forcing the row wide.
- The micro-labels also serve as the accessible field names (supersede the
  prior `aria-label`-only approach; keep an `aria-label` too for safety).
- Result: `.labLayer` width ≤ column width; **no horizontal scrollbar**.

## New controls

### Lab "🎲 Randomize" (re-roll the genome)

A button in the Lab section, alongside "Reset to seed", that pins a **fresh
random genome** so the user can explore without hand-editing every field:

- On click: reseed the RNG with a random value (`Math.random()` — the same
  source the main 🎲 New design uses to mint a seed), then call
  `VY.gen.sampleGenome(P, aim)` with the current aim
  (`{ornate: dens, wild: variety/100, tradition: tradition/100, symmetry}`) and
  the active palette `P`, exactly as `labCurrentGenome` already derives `P`/`dens`.
- Assign the result as a fresh `state.lab` object (immutable, same shape
  `{levels, centerStyle, layers}` `commitLab` produces), rebuild the layer
  editors to show the new values, and `generate()`.
- Because the produced genome is concrete and serialized into the hash, a
  randomized Lab stays deterministic and shareable.
- Determinism note: `generate()` always reseeds before rendering, so the
  transient `Math.random()`-seeded RNG used to sample the genome never leaks
  into the render (same invariant as `labCurrentGenome` today).

### "Reset all" (clear saved data + return to defaults)

A button in the **Export & saved** section, by the favorites strip, for a clean
"start fresh":

- Behind a `confirm()` (it deletes favorites), it:
  1. Removes our `localStorage` keys (`vy_favorites`, `vy_openSection`).
  2. Resets `state` to the default initializer values (mode `wallpaper`, region
     `hutsul`, complexity 3, variety 45, tradition 20, symmetry `d4`, style `x`,
     seed `vyshyvanka`, res `screen`, layout `fabric`, bg `charcoal`, scale
     `medium`, shape `sleeve`, `lab: null`). Centralize these defaults in one
     `DEFAULTS` object so the initializer and reset share a single source.
  3. Clears the URL hash (`history.replaceState(null,"",location.pathname)`).
  4. Re-renders: `syncUI()`, `generate(false)` (no hash write — fresh default
     state), and `renderFavs()` (now empty).
- The accordion returns to its default open section (`design`) since the
  persisted key was cleared.

## Accordion controller (app.js)

- A small controller: a list of section keys → {headerEl, bodyEl}. `openSection(key)`
  shows that body, hides the rest, updates each header's `aria-expanded` + caret,
  persists `key` to `localStorage`, and runs an optional per-section on-open hook
  (Lab uses it to pre-fill from seed).
- Header click → `openSection(thatKey)`.
- Boot: read persisted key (default `design`) → `openSection(key)` after `syncUI`.
- The existing standalone Lab toggle logic is folded into this controller (Lab is
  just one section now); the Lab's on-open prefill becomes the Lab section's hook.

## Defenses

- Add `overflow-x: hidden` (or `overflow: hidden auto`) on `aside` as a backstop,
  but the real fix is the Lab cells shrinking — verify the column has no
  horizontal scroll after the Lab fix even without the backstop.

## Files touched

- `index.html` — restructure the `<aside>` markup into the sticky bar + accordion
  sections (controls relocated, ids preserved).
- `styles.css` — sticky bar, accordion header/body, single-open behavior styles,
  compact Lab cell layout, overflow backstop.
- `app.js` — accordion controller + `localStorage` persistence + rebuilt
  `buildLabLayers` (labeled cells). No changes to `generate`, `syncUI` data flow,
  hash, or events beyond relocating element references that stay id-stable.

## Out of scope

- No generation/engine changes, no determinism/hash changes, no new state fields.
- No change to the main preview canvas area, toolbar, or disclaimer.
- Aside from the two small additive controls (Lab "🎲 Randomize" and "Reset
  all"), no new features — purely reorganizing existing controls + the Lab fit.
  Both new controls reuse existing machinery (`sampleGenome`/`commitLab` flow and
  the favorites/localStorage helpers); neither adds generation logic or state
  fields.

## Verification

- Live (Playwright): sidebar has **no horizontal scrollbar**; total scroll height
  with the default (Design) section open fits comfortably; 🎲 New design + seed +
  Undo visible without scrolling at an 800px viewport; opening any section
  collapses the others; the open section persists across reload; the Lab editor
  fits the column with all six labeled knobs; mobile drawer still opens/closes and
  is usable. Re-confirm a determinism check + a couple of control round-trips
  (region/tradition/symmetry change, share link, favorite restore, Lab edit) still
  work after the markup move.
