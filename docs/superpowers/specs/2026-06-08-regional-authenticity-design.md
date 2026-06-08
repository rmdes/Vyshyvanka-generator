# Regional Authenticity Pass — Design

**Date:** 2026-06-08
**Status:** Approved
**Branch:** `feature/regional-authenticity` (off `main` @ v1.3.0)

## Summary

Reframe the six regional styles so the app is respectful and defensible for Ukrainian visitors, **without** stripping the Ukrainian heritage that gives it meaning. The chosen approach is **hybrid: formal-trait names lead, the region appears as "inspired by," notes are reworded as documented *tendencies*, each region links to further reading, the disclaimer is strengthened, and the three weakest place-named motif tags are loosened.** This is a labelling/framing/data change only — no generator, render, or viewport logic changes.

First of three planned creative-control cycles (authenticity → colour → shape); colour and shape are out of scope here.

## Non-negotiable invariant

**The region keys (`poltava`, `hutsul`, `borshchiv`, `bukovyna`, `polissia`, `chernihiv`) DO NOT change.** They are part of the seed string and the `r=` URL hash param, so every existing shared design must still reproduce identically. This pass changes only **display labels, notes, sources, the disclaimer, and motif region-tags** — never a key, palette, `colorBias`, `densityBias`, or `bg`. No seed/hash change; determinism is untouched.

## Why this framing (rationale, for the spec record)

The six regional *tendencies* are genuinely documented (Poltava white/red restraint; Hutsul polychrome geometry; Borshchiv/Podillia black-dominant; Polissia archaic red; Bukovyna fine geometry/beadwork; Chernihiv white/red fine work). The risk is *precision*, not the broad association: authoritative-sounding notes, one palette standing for a whole region's range, and place-named motifs implying transcription. Leading with the formal trait and demoting the region to "inspired by" — plus tendency-phrasing, sources, and a clear disclaimer — keeps the heritage visible while making no authoritative claim. Removing the regional names entirely was rejected: for a solidarity-flagged app it risks reading as erasure.

## Changes

### 1. `data.js` — `VY.REGIONS` restructure (keys unchanged)

Each entry gains `formal` + `inspiredBy` + `src`, keeps `bg`/`threads`/`colorBias`/`densityBias` **byte-identical**, and rewords `note` as a tendency. Drop the old `name` field (replaced by `formal`/`inspiredBy`).

| key | `formal` (lead) | `inspiredBy` | `note` (tendency) | `src` |
|---|---|---|---|---|
| poltava | `Red on white` | `Poltava` | `Often sparse and restrained — single-colour red on light linen.` | `https://en.wikipedia.org/wiki/Poltava_Oblast` |
| hutsul | `Dense polychrome` | `Hutsul` | `Tends to dense, high-contrast polychrome — red, black, gold, green, orange.` | `https://en.wikipedia.org/wiki/Hutsuls` |
| borshchiv | `Black-dominant` | `Borshchiv / Podillia` | `Often heavy black grounds with red accents.` | `https://en.wikipedia.org/wiki/Podilia` |
| bukovyna | `Lilac & bronze` | `Bukovyna` | `Fine geometry; often red & black with lilac and metallic bronze.` | `https://en.wikipedia.org/wiki/Bukovina` |
| polissia | `Bold archaic red` | `Polissia` | `Bold red; archaic geometric banding.` | `https://en.wikipedia.org/wiki/Polesia` |
| chernihiv | `Sparse white & red` | `Chernihiv` | `Often sparse and delicate — red with grey on a white ground.` | `https://en.wikipedia.org/wiki/Chernihiv_Oblast` |

### 2. `data.js` — loosen the three weakest place-named hero-motif tags

These three currently imply a transcription of a specific town's charts. Rename their internal `id` to a generic descriptor, broaden the `regions` tag to a plausible *style* set (not a single town), and reword the comment to "associated with" rather than "is". (Hero `id` is internal — never rendered, never referenced in logic — so renaming is safe. The other motifs keep their tags; the strengthened disclaimer + existing `src` comments frame all motifs as interpretations.)

| old `id` | new `id` | old `regions` | new `regions` | reworded comment lead |
|---|---|---|---|---|
| `borshchiv-cross` | `black-cross` | `["borshchiv","bukovyna"]` | `["borshchiv","bukovyna","hutsul","polissia"]` | `Dense black/red cross — black-dominant geometric (associated with Podillia).` |
| `bukovyna-geometric` | `interlocking-diamonds` | `["bukovyna","borshchiv"]` | `["bukovyna","borshchiv","hutsul"]` | `Fine interlocking diamonds — geometric fill.` |
| `chernihiv-cross` | `fine-cross` | `["chernihiv","poltava"]` | `["chernihiv","poltava","polissia"]` | `Sparse, delicate cross in red — fine white-ground geometry.` |

(The grids themselves are unchanged. The `src` links on these entries stay.)

### 3. `app.js` — consume the new fields (3 sites; all currently read `.name`/`.note`)

- **Region dropdown population:** option text → `` `${R.formal} · ${R.inspiredBy}` `` (formal leads, region follows). The `<option value>` stays the key.
- **`#regionNote`:** show the reworded `note`, then a subtle "inspired by {inspiredBy}" with a small **ⓘ** link to `R.src` (`target="_blank" rel="noopener"`). e.g. `<note text> · inspired by Poltava ⓘ`.
- **Toolbar title:** replace `VY.REGIONS[state.region].name.split(" — ")[0]` with `VY.REGIONS[state.region].formal` (e.g. "Red on white · Seamless wallpaper").

There are no other readers of `.name` — grep `VY.REGIONS[...]\.name` to confirm before/after; all must move to `.formal`/`.inspiredBy`.

### 4. `index.html` — strengthen the disclaimer

Add a sentence to `.disclaimer` explicitly covering the regional framing, e.g.:
> Regional names mark documented **tendencies** we interpret — not definitive or exhaustive styles, and no claim of authoritative symbolic meaning.

(Keep the existing "best-effort interpretations of documented regional motifs … not exact reproductions" sentence.)

### 5. `README.md` — update the region list

Reframe the "6 regional styles" bullet to the formal-lead + "inspired by" + tendency wording, consistent with the in-app copy. Keep the existing "Interpretations, not authenticity" section.

## Out of scope (later cycles)

- **Colour control** (cycle 2): custom cloth-bg colour, editable thread palette, saved custom palettes.
- **Shape control** (cycle 3): per-mode dimensions/aspect, more layouts & panel presets, motif-geometry knobs, lattice/tiling control.
- Any palette/`colorBias`/`densityBias`/`bg` value change, generator/render/viewport logic, new motifs.

## Verification

- **Determinism (the critical check):** an existing share link (e.g. `#m=wallpaper&r=hutsul&…`) renders **pixel-identical** before and after (keys + palettes + biases unchanged). Confirm `r=` values still map.
- Region dropdown shows formal-lead labels (`Red on white · Poltava`, …); selecting each updates the note + ⓘ link to the right `src`; title shows the formal lead.
- No `VY.REGIONS[...].name` references remain (grep); `node --check` clean; 0 console errors; ⓘ links open the right pages.
- Hero motifs still render (the three re-tagged ones appear in their broadened region pools); a `hutsul` design can surface the renamed `black-cross`/`interlocking-diamonds`.
- Disclaimer + README reflect the tendency framing.

## Files

`data.js` (REGIONS restructure + 3 motif re-tags), `app.js` (3 consumer sites), `index.html` (disclaimer), `README.md` (region list). No other files.
