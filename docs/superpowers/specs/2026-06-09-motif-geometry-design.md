# Motif Geometry — Design (cycle 3d of 4)

**Date:** 2026-06-09
**Status:** Approved
**Branch:** `feature/motif-geometry` (off `main` @ 9fc51d3, includes 3a+3b+3c)

## Summary

Two per-motif geometry knobs for **field motifs** (`makeFieldMotif`): a **Silhouette** boundary (`auto / circle / square / diamond`) and a **Border** outline (`off / on`). Global aim params, threaded through the genome so they apply in every mode (incl. per-cell in Explore). Hero/archetype motifs keep their charted shapes. Final shape sub-cycle; the tag follows.

## Current state

`makeFieldMotif(m, G)` (pure: `m` + genome `{sym, layers, levels, centerStyle}`) computes a summed wave field over symmetry-folded coords, bands it, and fills cells above the mid-band with a layer's slot. Its boundary is a single line: `if(G.sym!=='loose' && Math.hypot(x-c,y-c) > R+0.5) continue;` — so d4/d2 clip to a disc, loose fills the square. There's no independent boundary shape and no outline. `sym` conflates the fold (8/4-fold/loose) with the clip.

## The two knobs (field motifs only)

1. **Silhouette** — `auto / circle / square / diamond`. The boundary the field is clipped to, independent of the fold. **`auto` reproduces current** (sym-derived: disc for d4/d2, square for loose) → back-compat. A new pure helper:
```js
function silhouetteInside(sil, sym, dx, dy, R){
  const E=R+0.5, ax=Math.abs(dx), ay=Math.abs(dy);
  switch(sil){
    case 'circle':  return Math.hypot(dx,dy) <= E;
    case 'square':  return ax<=E && ay<=E;
    case 'diamond': return (ax+ay) <= E;
    default:        return sym==='loose' ? (ax<=E && ay<=E) : (Math.hypot(dx,dy) <= E);  // auto
  }
}
```
The clip line in `makeFieldMotif` becomes `if(!silhouetteInside(G.silhouette||'auto', G.sym, x-c, y-c, R)) continue;`. (`sym` stays the fold control.)

2. **Border** — `off / on` (default off). When on, after the field + `applyCenter`, draw the **silhouette edge ring** (cells inside the silhouette with a 4-neighbour outside it) in the motif's **primary slot** `G.layers[0].slot` — a clean outline:
```js
if(G.border==="on"){
  const sil=G.silhouette||'auto', bc=G.layers[0].slot;
  for(let y=0;y<m;y++)for(let x=0;x<m;x++){
    if(!silhouetteInside(sil,G.sym,x-c,y-c,R)) continue;
    if(!silhouetteInside(sil,G.sym,x+1-c,y-c,R)||!silhouetteInside(sil,G.sym,x-1-c,y-c,R)||
       !silhouetteInside(sil,G.sym,x-c,y+1-c,R)||!silhouetteInside(sil,G.sym,x-c,y-1-c,R)) g[y][x]=bc;
  }
}
```
(Drawn before the existing non-empty-floor check, so the ring counts as content.)

## Threading (genome carries both; strings throughout)

`silhouette` and `border` are strings on the `aim` object → written onto the genome by `sampleGenome`/`sampleGenomeFrom` (`silhouette: aim.silhouette||'auto', border: aim.border||'off'`) → read by `makeFieldMotif` (`G.silhouette||'auto'`, `G.border==="on"`). `varyGenome`/`varyGenomeFrom` preserve them from the pinned Lab genome (`silhouette: lab.silhouette||'auto', border: lab.border||'off'`); an old `lab` link lacking them defaults cleanly.

- `CFG` gains `silhouette:'auto', border:'off'` (set via `setConfig`).
- Bounded path: `genomeForCFG(m)`'s `sampleGenome(CFG.P, {...})` aim gains `silhouette:CFG.silhouette, border:CFG.border`.
- Explore path: `app.js` `generate()`'s `buildFabricConfig` aim gains `silhouette:state.silhouette, border:state.border`; `cellMotif` → `sampleGenomeFrom(rng, cfg.P, cfg.aim)` picks them up.

## Determinism (3a convention)

They change the grid → appended to the seed string **only when non-default**: `(state.silhouette!=="auto"?"|sil"+state.silhouette:"") + (state.border==="on"?"|bd":"")`. Hash: `sil` (when ≠auto) and `bd=1` (when on). Defaults (`auto`/`off`) → byte-identical to existing designs (the clip reduces to the old disc/square, no border). `readHash` validates `sil` ∈ {circle,square,diamond} and `bd==="1"`.

## State / UI

- `state`/`DEFAULTS`: `silhouette:"auto"`, `border:"off"`.
- `SILHOUETTES=[["auto","Auto"],["circle","Circle"],["square","Square"],["diamond","Diamond"]]`, `BORDERS=[["off","No border"],["on","Border"]]`; `buildSeg("silhouetteSeg",SILHOUETTES,"silhouette")`, `buildSeg("borderSeg",BORDERS,"border")`; `setConfig({... silhouette:state.silhouette, border:state.border})`; `syncUI` `segKey` gains both.
- `index.html`: two segmented controls in the **Design** section (motif-shape aim params, relevant in all modes), after Symmetry: "Motif silhouette" + "Motif border".
- Changing either calls `resetView()`+`generate()` (via `buildSeg`).

## Scope

Field motifs only (`makeFieldMotif`). Hero charts (`remapHeroP`) and the procedural `makeMotif` (archetype) are **not** clipped/outlined — their shapes are intentional. No render/viewport/colour/lattice/panel/layout changes.

## Verification

- **Back-compat:** existing designs (`auto`/`off`) render pixel-identical — node-test that `makeFieldMotif(m, genome-with-silhouette:'auto',border:'off')` equals the pre-change output for d4/d2 (disc) and loose (square); live cross-check a default link vs production.
- **Silhouette:** circle/square/diamond visibly change the field-motif boundary independent of `sym`; node-test each clip (a diamond corner cell empty, a square corner filled-where-field-is, circle clipped at corners).
- **Border:** `on` adds a continuous edge ring in the primary slot around the silhouette (node-test: with border on, edge cells of the silhouette are set; with a circle a ring exists; off = no ring).
- **Determinism:** `sil`/`bd` round-trip the hash; non-default reshuffles (in seed); defaults keep URLs clean; works in wallpaper + panel + Explore (Explore per-cell shows the silhouette across the plane).
- 0 console errors; `node --check` clean; hero/archetype motifs unchanged.

## Files

`generator.js` (`silhouetteInside` helper, `makeFieldMotif` clip+border, `sampleGenome`/`sampleGenomeFrom`/`varyGenome`/`varyGenomeFrom` carry fields, `CFG` defaults, `genomeForCFG`), `app.js` (state/DEFAULTS, `SILHOUETTES`/`BORDERS`, buildSeg, setConfig, seed-suffix, hash, Explore aim, syncUI segKey), `index.html` (2 Design controls). No render/viewport changes.
