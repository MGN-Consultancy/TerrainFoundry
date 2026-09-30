# Terrain Foundry

An offline Windows desktop workshop for designing modular tabletop terrain and exporting STL print packs for Bambu Studio or another slicer.

**No account. No signup. No cloud saves.** Your scenes and imported models stay on your computer.

- 644 original built-in scenery pieces: dungeon rooms, castles, caves, outdoor terrain, rivers, bridges, trees and planted grass.
- Drag-and-drop building, movement and elevation, curved walls, 45-degree sections and broad two-tile-radius bends.
- Local editable projects and recovery files.
- Separate STL pieces, quantities and original Foundry Link connectors in print exports.
- Small signed Windows launcher. Client and scenery downloads are cached separately and verified before activation. Offline opening remains available when an update cannot be downloaded.

[Website](https://terrainfoundry.co.uk) · [Downloads](https://github.com/MGN-Consultancy/TerrainFoundry/releases) · [Issues](https://github.com/MGN-Consultancy/TerrainFoundry/issues)

## Installation

Download the launcher MSI from Releases. The verified publisher must be **MGN CONSULTANCY LIMITED**. Follow the welcome, licence and folder-selection wizard. It adds desktop and Start menu shortcuts. When opened, the launcher checks for updates, shows release details and download size, and waits for **Install / update** before downloading. The first run needs internet. **Open installed editor / continue offline** remains available after installation. Updates do not overwrite saved projects.

The launcher stores downloaded versions and self-updates in the installation folder selected in the wizard (default `%LOCALAPPDATA%\TerrainFoundryLauncher`). MSI upgrades remember that folder. Projects use your Documents\Terrain Foundry\Projects folder, or another location you choose. The editor preserves the historical `%APPDATA%\dnd-terrain-builder` recovery profile. The launcher installs alongside older standalone MSI versions; it does not silently uninstall them.

## Open source and connectors

Code: **MIT**. Original scenery and Foundry Link designs: **CC0-1.0**. Dependencies retain their own notices; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

The public release replaces the legacy non-commercial OpenLOCK socket/clip with **Foundry Link**, an original round split friction pin. Existing scene coordinates and IDs remain readable, but old printed OpenLOCK parts are not claimed compatible. Print the included fit test before a large batch. Physical print fit is not yet verified. Preview colours and bump maps do not appear in STL; sculpted relief does.

## Build from source

Requires Windows, Node.js 24, pnpm 11, and Python 3 for deterministic release archives. The launcher uses the Windows .NET Framework compiler; official publication additionally uses Azure Artifact Signing.

1. `pnpm install --frozen-lockfile`
2. `node scripts/release/generate-all.mjs` — builds original scenery from procedural source.
3. `node --test tests/*.test.mjs`
4. `pnpm build`
5. `pnpm start`

Generated meshes and installers are intentionally excluded from Git. No commercial asset download is required. The committed scenery metadata and generators are the source of truth.

## Publish an update

See [PUBLISHING.md](PUBLISHING.md). GitHub Actions builds and checks the client/scenery, signs official Windows binaries, packages scenery separately, signs the update manifest and uploads assets to GitHub Releases. The website reads the latest public release. MSI/EXE/ZIP files belong in Releases, never in source history.

## Privacy

The editor saves locally and has no telemetry, cloud project storage or account system. The launcher contacts GitHub for release downloads and Windows verifies certificate trust for newly downloaded executables. The website queries public release metadata. GitHub, Microsoft and hosting providers process ordinary network requests.
