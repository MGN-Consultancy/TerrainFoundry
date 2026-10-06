# Terrain Foundry 1.11.0

Adds native premium pack activation: verify the purchase email, enter the emailed code, and download an encrypted pack. Signed inventories, device-bound entitlements, ciphertext and per-file hashes are checked before an atomic installation. Content keys use Windows protected storage; asset data is decrypted in memory when needed.

Installed pieces appear in the existing categories and retain stable IDs in saved scenes and worlds. Updates cannot remove existing IDs or downgrade installed versions. Rendering and full-detail print reads work after an offline restart. Closing activation cancels pending network work without replacing a working pack.

The free 50-piece Deepstone starter and Campaign Studio remain included. This client feature does not enable premium sales; collections become purchasable separately after their checks are complete. No paid model content is included in public client source or releases.

# Terrain Foundry 1.10.0

Adds local Campaign Studio with startup campaign/world/scene choices, saved story and session context, editable records, relationships, maps/pins and characters. Optional OpenAI/Claude requests use separately entered OS-encrypted API keys, explicit confirmation and reviewed encounter proposals.

Run campaigns fullscreen with persistent inline audio cues, original starter sounds, dice/initiative and linked terrain. Export DM/player books, duplex cards and player-approved JSON. Online portal hosting is not configured; the portal handoff does not enable live invitations. No provider credits are included.

Existing terrain scenes, worlds and installed asset identities are preserved. Includes the committed Deepstone floor-height corrections. Physical connector fit remains unverified.

# Terrain Foundry 1.9.1

Corrects the free Deepstone Caverns floor carriers: standard floor surfaces are lowered from 12 mm to 8.4 mm, and the concealed pit trap surface to 8.6 mm to preserve its printable mesh. The original 0–8 mm connector zone, port counts and port positions are retained, including six ports on the long floor. Editor geometry and all full-resolution print meshes are rebuilt from the pinned sculpts with matching height transforms and refreshed hashes. All 1,502 release tests pass; physical print fit remains to be verified.

# Terrain Foundry 1.9.0

Adds the free 50-piece Deepstone Cave & Grotto starter collection with integrated OpenLOCK sockets. Categorised, coloured editor meshes and full-resolution print STLs are cached locally. Door and pit-trap exports include separate inserts. Existing asset identities, saved scenes and worlds are preserved.

Geometry, editor imports and nominal joining heights checked in software; physical print fit remains to be tested.

# Terrain Foundry 1.8.1

Saved encounters now appear in **Encounters & scenes…** with a rendered preview of their complete build. Save updates the same library entry; old scene files can be added with **Add existing scene…**. The searchable library is paginated and persists locally across editor restarts.

Click a library scene to place it in a world or reopen it as an editable encounter. Drag a preview onto a world for direct grouped placement. World encounter cards also display complete-build previews. Scene files embed PNG previews and the local library retains independent snapshots, including imported geometry. Existing world files remain compatible; scenery packs are unchanged.

## Terrain Foundry 1.8.0


Build a whole gaming table from reusable locally saved scenes. Add scenes to a world library and place independent encounter groups; move, rotate, duplicate and elevate complete buildings together, with individual scenery and roads between them.

- Rectangular table presets and custom dimensions, with a Fit table camera.
- Named elevation levels, independent visibility, and scene export for a complete level or selected encounter.
- Local version-2 world files embed templates and imported meshes. Version-1 scenes remain supported; recovery and backups support both formats.
- World grids retain the 25.4 mm OpenLOCK spacing. Group movement preserves internal connector alignment; sockets can still snap between individual pieces.
- Three existing grotto walls are trimmed flat at the print plane; this is a print-preparation correction, not the pending detailed grotto remaster.

World building and scene reuse work without internet. Hidden levels remain in print packs. Print a connector fit test before a full build; physical fit remains unverified. The detailed grotto remaster and replacement website animation assets are still awaiting an actual-mesh quality prototype.

# Terrain Foundry 1.7.0

Adds Ironbrook blacksmith: thirteen original modular pieces and an assembled example scene. Includes worn flagstone, braced walls, doorway and service window, two removable tiled roof variants, gable, forge/chimney, anvil, workbench, quenching trough, tool rack and yard canopy.

Search **blacksmith** or load **Ironbrook blacksmith** from Example scenes. Floors and walls use integrated OpenLOCK; furniture is freestanding and roofs rest on the walls. Sculpted wood grain and masonry export with the geometry. Preview colours do not export to STL. All thirteen STLs pass geometry validation; physical fit and supports still need a test print. Existing asset IDs and connector layouts remain unchanged.
