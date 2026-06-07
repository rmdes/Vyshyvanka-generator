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
4. **🧪 Lab** — the genome editor (`#labNLayers`, `#labLevels`, `#labLayers`,
   `#labReset`). Its existing "pre-fill from seed when opened with no active lab"
   behavior fires when this section opens.
5. **Export & saved** — `#png`, `#tile`, `#chart`, `#share`, `#save`, and the
   `#favs` strip.

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

- No generation/engine changes, no determinism/hash changes, no new state.
- No change to the main preview canvas area, toolbar, or disclaimer.
- No new controls or features — purely reorganizing existing ones + the Lab fit.

## Verification

- Live (Playwright): sidebar has **no horizontal scrollbar**; total scroll height
  with the default (Design) section open fits comfortably; 🎲 New design + seed +
  Undo visible without scrolling at an 800px viewport; opening any section
  collapses the others; the open section persists across reload; the Lab editor
  fits the column with all six labeled knobs; mobile drawer still opens/closes and
  is usable. Re-confirm a determinism check + a couple of control round-trips
  (region/tradition/symmetry change, share link, favorite restore, Lab edit) still
  work after the markup move.
