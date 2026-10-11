# Required scenery metadata

All newly authored scenery, personal designs, imported models and new official scenery IDs must carry `design.scenery` using the versioned contract in `desktop/scenery-metadata.mjs`. Keep identity, pack, source, licence, model revision, concepts and thumbnail in the asset manifest alongside this contract.

Required information:

- Purpose and visual style in `design`; scenery category, environment, era and intended scale.
- Materials and functional tags: for example tavern, cave entrance, trap, market, railway platform or race marshal post.
- Width, depth, height, project grid, floor datum and minimum spacing in millimetres.
- Floor/surface type, placement support, connector system and compatibility family.
- Edge/seam matching rules and allowed orientations; independent pieces must explicitly say so.
- Entrance position, opening width and approach clearance, or `none` for pieces without entrances.
- Traversal, barriers and usable routes; elevations and stair/landing relationships.
- Visual quality tier. This is separate from engineering or print verification.

Drafts contain every contract field, with missing text marked `unknown` and missing measurements `null`. The companion gathers information progressively; the collapsed required-metadata editor also supports manual completion. Do not fabricate missing information to pass a gate. `sceneryReadiness(design)` computes eligibility; no editable ready flag exists. Incomplete personal scenery remains available manually but cannot be placed automatically by the world/encounter agent. Measured mesh footprints, rather than claimed dimensions, determine placement bounds. Declared spacing is checked conservatively before accepting a batch.

The contract travels with personal library backups, project asset references, AI inventory and context, and premium catalogue delivery. OpenLOCK specifications must refer to the approved template and 8 mm joining datum; never add an extra 8 mm tray. Metadata does not certify wall thickness, watertight geometry, connector fit, structural support or physical print quality.

## Publication gates

`scripts/asset-catalog.mjs` rejects any new scenery ID without complete metadata. Existing 1.18.0 IDs are explicitly recorded in `installer/legacy-scenery-ids.json` to preserve installed projects; do not add new IDs to that frozen baseline. Once an ID is outside the baseline, later revisions must retain complete metadata as well. New catalogue definitions use `design: {purpose, style, scenery}`.

`scripts/premium-packs/build-private-pack.mjs` requires complete metadata for every source piece and every delivered `catalogue.json` asset before encryption. Pack-level descriptions cannot substitute for individual piece metadata. Existing human approval, licence, geometry and sale-readiness gates still apply. Imported third-party models are initially drafts requiring review; do not infer verified compatibility from filenames or source branding.

Legacy content is not silently relabelled as metadata-complete. Curate its metadata separately, without regenerating geometry as part of a client update.
