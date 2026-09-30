# Publishing Terrain Foundry

Official repository: `MGN-Consultancy/TerrainFoundry`. The repository is public. Public downloads and anonymous launcher updates become available when a non-prerelease GitHub Release is published. The Azure website is already public and handles an unavailable release gracefully.

## Normal release

1. Make source/scenery changes in a branch and review the pull request.
2. Update `package.json` to a new three-part version and edit `RELEASE-NOTES.md`.
3. Merge into `main`.
4. In GitHub Actions, run **Publish editor and scenery**. Leave **publish** off to prepare a draft, or enable it to publish after successful checks.
5. Inspect the release assets, then publish the draft. The website and installed launchers read the latest published release automatically.

The workflow regenerates original assets, runs geometry/connector checks, builds the editor, signs the Windows executables and small MSI with MGN Consultancy, creates deterministic scenery ZIPs, and signs `channel.json`. All release binaries are uploaded to GitHub Releases, not committed to Git. **Never force-move a published version tag or replace an existing release's files.** Correct mistakes with a new release.

Scenery is split into separately hashed packages. Unchanged packages retain identical hashes across releases and are reused by installed launchers. Updated geometry for an existing asset ID can have different vertex counts: the desktop reader uses the downloaded pack index. New IDs or layout changes require a matching client/catalogue update. Existing published IDs and socket positions must remain stable.

## Launcher changes

The launcher version is in `release-config/product.json`. Increase `launcherVersion` when changing launcher behaviour. The build, MSI, manifest and running assembly use that version automatically. A verified newer launcher replaces itself after its current process exits. Keep the embedded update key stable; key rotation needs a planned signed migration.

For a scenery-only update, change existing geometry, bump the release version in `package.json`, and enable **scenery_only** in the release workflow. The manifest reuses the previous client download only if its source/catalogue compatibility hash is unchanged. New asset IDs, material code or connector-layout changes fail this check and require a normal release. Unchanged scenery packs are reused in either mode.

## Signing and access

- Azure workload identity: `terrainfoundry-github-release`, restricted to `repo:MGN-Consultancy@196059455/TerrainFoundry@1397243331:environment:release`.
- Azure role: Artifact Signing Certificate Profile Signer, scoped to the existing `dotrsigningb0f36990/dotr-public` profile. It cannot provision Azure infrastructure.
- GitHub `release` environment only permits `main`.
- `TERRAIN_RELEASE_KEY` is an encrypted environment secret, separate from the Microsoft publisher certificate. It signs update manifests. The public verification key is committed; the private key is not.
- Azure identifiers are repository secrets. Website deployment uses a separate Static Web Apps deployment token.
- Forks can build open-source binaries but cannot sign as MGN Consultancy. Fork maintainers must change the repository, publisher and update key together before distributing their own launcher.

## Offline behaviour and rollback

The launcher stages new client and scenery directories under content hashes, validates the complete signed file inventory, then atomically replaces its active-state pointer. A failed update leaves the previous installation selected. The previous state is retained in `state.json.previous`. Downloaded versions do not share mutable files with a running editor. Projects and recovery files live outside these directories and are never part of an update archive.

The offline button can cancel an update and open the installed editor. The first installation needs internet. No GitHub token, account login, cloud project storage or analytics is added to the launcher or editor. Windows verifies the publisher certificate for newly downloaded executables; subsequent offline opening verifies the signed file inventory locally.

## Legacy transition

The source repository and release packages exclude the old non-commercial OpenLOCK SCAD, clip and generated connector meshes. The original CC0 Foundry Link design is a different physical system. Saved scene IDs/positions remain usable, but old printed components are not claimed compatible. The new launcher installs alongside old standalone MSI installations and does not delete them or their saves.

Hosting uses Azure Static Web Apps **Free**. Large client/scenery downloads are served from GitHub Releases. The existing Azure Artifact Signing account remains on its existing billing plan; no new paid signing account or hosting tier was provisioned.


## Website domain

The public website uses https://terrainfoundry.co.uk/ with Azure Static Web Apps hosting and Cloudflare DNS. Keep the Azure ownership TXT record in DNS so certificate renewal can verify the domain. Website deployments continue through the website workflow; the desktop update channel remains on GitHub Releases.

## Launcher-only releases

For launcher, icon or installer-only changes, advance both the package version and `launcherVersion`, update release notes, and run **Publish launcher update** on main. It verifies the previous signed channel and reuses its immutable client and scenery references, avoiding unnecessary downloads. Keep all older releases whose packages are referenced by the current channel. Use the full editor/scenery workflow when changing client or scenery content. Install the 1.0.2 MSI once to add the desktop shortcut and folder configuration to an older installation; executable self-updates preserve existing shortcuts.

## Installer and update consent

The MSI provides a welcome/licence/folder/confirmation/progress/finish wizard. It remembers INSTALLFOLDER in the current user registry for MSI upgrades and installs installation.json so the launcher derives its package and self-update root from that directory. Scenes and recovery remain in their existing user storage. Startup checks only fetch the signed channel; clicking Install / update authorizes package downloads and activation. Self-update continuation is restricted to the hash of that same approved signed channel. No non-commercial-only restriction is added to the existing MIT/CC0 grants.
