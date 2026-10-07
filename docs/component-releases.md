# Component releases and scenery migration

Terrain Foundry releases have three independently versioned components:

- **Launcher** builds, signs and tests the launcher and installer. It does not build the editor or touch scenery.
- **Client** builds and signs the desktop editor. It does not regenerate or package scenery.
- **Content** regenerates and verifies scenery, then publishes changed per-piece files. The signed channel keeps unchanged file hashes and URLs, so the launcher preserves those installed files and downloads only changed or missing pieces.

The first file-level release uses the **Migration** component. It downloads the current signed scenery ZIPs, verifies the channel signature and each archive/file hash, then splits the existing mesh data into individual piece files. It does not generate new geometry. Existing installs extract and verify their already-installed pack data locally, so they do not download scenery again. Migration also publishes the current launcher and editor so old installations move to the new signed channel.

A normal full release intentionally rebuilds all components and scenery. Use it only when a coordinated full rebuild is needed. Do not use it for a client or launcher change.

All release files are signed or checksum-verified. The launcher downloads into a staging folder, verifies each file, then swaps the completed component into place; failures retain the prior working version.
