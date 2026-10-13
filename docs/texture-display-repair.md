# Repairing local scenery display textures

These tools produce new display candidates. They do not modify print geometry,
cut sockets, approve a model or publish an asset pack. Keep model inputs, atlases,
outputs and receipts under ignored local authoring folders.

Python requires NumPy; the regression tests also require Pillow. Provider-surface
mapping recipes may additionally require Trimesh and SciPy.

For a selected single-primitive floor and its saved top-down PNG albedo:

```powershell
python scripts/premium-packs/texture-selected-floor.py --input selected.glb --atlas saved-top-albedo.png --output new-textured-floor.glb
```

This embeds the image, gives scenic upward faces explicit UVs, and retains the
material on vertical mechanical faces and undersides. It keeps the exact triangle
positions and winding. Choose the atlas that belongs to that floor: corner and
junction composites must use their matching composite image. Inspect the top,
perspective colour and grey geometry renders before selecting a result.

For existing per-face provider UV mappings on exactly matching indexed geometry:

```powershell
python scripts/premium-packs/apply-source-texture-to-glb.py --mapped-mesh mapped.npz --atlas source-albedo.png --target-glb selected.glb --output-glb new-textured.glb
python scripts/premium-packs/compact-display-glb.py new-textured.glb new-compact.glb
```

Mappings may be JSON or compressed NPZ with `positions`, `indices`,
`sourceTextureUv` and `sourceTextureFallbackFaces`. UVs use the Trimesh convention;
the writer reverses Trimesh's V flip when exporting glTF. The tool splits UV seams
instead of averaging them into vertex colours. New ground and wall cut surfaces
need a documented projection recipe, not an arbitrary relaxed distance threshold.
`--neutral-engineered-surfaces` is an explicit material choice for new mechanical
faces and high roof seats. Review all visible elevations, including repaired walls.

Compaction removes unreferenced binary data and embeds data-URI images in the BIN
chunk. It supports static, single-buffer meshes. Independently compare triangle
multisets and embedded image bytes after compaction. Preserve the original dense
master and current selected input; use a fresh output filename.

Regression checks:

```powershell
python tests/texture-display-tools.test.py
```

Only select a candidate after exact geometry comparison, unchanged working/STL
hashes and visual review. Update both the per-piece selection and pack inventory.
Keep human acceptance, physical fit and publication status explicit and separate.
