# Terrain Foundry

An offline Windows desktop workshop for designing modular tabletop terrain and exporting STL print packs for Bambu Studio or another slicer.

**No account. No signup. No cloud saves.** Your scenes and imported models stay on your computer.

- 644 original built-in scenery pieces: dungeon rooms, castles, caves, outdoor terrain, rivers, bridges, trees and planted grass.
- Drag-and-drop building, movement and elevation, curved walls, 45-degree sections and broad two-tile-radius bends.
- Local editable projects and recovery files.
- Separate STL pieces, quantities and attributed non-commercial OpenLOCK clips in print exports.
- Small signed Windows launcher. Client and scenery downloads are cached separately and verified before activation. Offline opening remains available when an update cannot be downloaded.

[Website](https://terrainfoundry.co.uk) · [Downloads](https://github.com/MGN-Consultancy/TerrainFoundry/releases) · [Issues](https://github.com/MGN-Consultancy/TerrainFoundry/issues)

## Installation

Download the launcher MSI from Releases. The verified publisher must be **MGN CONSULTANCY LIMITED**. Follow the welcome, licence and folder-selection wizard. It adds desktop and Start menu shortcuts. When opened, the launcher automatically checks for updates. If one is available, choose **Update now** or **Not now**. A progress bar describes the download and verification, then the compact **Open Editor** button becomes available. The first run offers **Install now** and needs internet. You can continue with the installed editor after declining an update or when offline. Updates do not overwrite saved projects.

The launcher stores downloaded versions and self-updates in the installation folder selected in the wizard (default `%LOCALAPPDATA%\TerrainFoundryLauncher`). MSI upgrades remember that folder. Projects use your Documents\Terrain Foundry\Projects folder, or another location you choose. The editor preserves the historical `%APPDATA%\dnd-terrain-builder` recovery profile. The launcher installs alongside older standalone MSI versions; it does not silently uninstall them.

## Open source and connectors

Application code: **MIT**, except the attributed OpenLOCK profile. Original connector-free sculpture: **CC0-1.0**. OpenLOCK profiles, socketed derivatives and clips: **CC BY-NC 4.0**, non-commercial use with attribution. See [licence scope](LICENSE-SCOPE.md). Dependencies retain their own notices; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Version 1.5.0 adds category/subcategory browsing across the whole library and an Expand library window with larger previews.

Version 1.4.0 adds a first-start screenshot guide (also available from Guide or F1) and refreshed editing controls. Version 1.4.1 shows the offline guide on startup until “Skip this tutorial next time” is selected. Each release also shows bundled highlights until acknowledged with Got it. Preferences are stored locally. Release builds require matching src/release-highlights.json content.

Version 1.3.0 replaces the community socket implementation with geometry derived directly from Printable Scenery’s official templates. MGN Consultancy holds the commercial licence linked in LICENSE-SCOPE.md. Public non-commercial terms remain available to other users. Your saved scene coordinates and asset IDs are retained. Previously printed Foundry Link pin pieces are a different connection system and must not be mixed with these OpenLOCK pieces. Print the supplied floor/wall/clip fit test first: physical fit has not yet been verified. Preview colours and bump maps do not appear in STL; sculpted relief does.

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

## Optional print and ship service

The website now includes a print-pack quote form, separate from the offline editor. The service reads STL geometry and quantities, offers a chosen PLA colour, calculates a quote and integrates with PayPal and workshop email notifications. MGN Consultancy operates paid printing under its non-transferable Printable Scenery commercial licence. Imported models still require their own permissions. See [print-service/README.md](print-service/README.md) for local tests, the no-payment demo, hosting and activation requirements. Normal editor use never uploads a scene.

## Estimate printing from the editor

Click **Estimate print costs**, choose material, printer, colour, delivery country and an optional discount code, then calculate. The website prices locally measured part summaries; it receives no models, scene layout or personal details for this step. The estimate includes export quantities, clips and fit-test pieces. Weight and hours are estimates, not sliced measurements.

If offline, only an identical previously checked pack and print selection can show a cached, dated estimate. **Save pack & open website** saves a ZIP and opens the website; you choose whether to upload it. Current requests are test-only and cannot collect payment or start production.
