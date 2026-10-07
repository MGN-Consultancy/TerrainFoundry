# Independent and incremental updates

Terrain Foundry uses three independently versioned components: launcher, editor client, and scenery content. The launcher checks the signed component channel when it opens and presents the total update size before the customer chooses whether to continue.

The launcher is a small, signed executable update. The editor is represented by a signed list of its installed files. A client release compares file hashes with the preceding channel, publishes only changed files, and keeps the previous editor until the staged replacement is verified. Client-only releases skip scenery generation, mesh checks and content signing.

Each scenery pack has an index plus a separate binary for every model. The signed content channel lists each file hash and download location. Content releases compare those hashes and publish only changed model files. The launcher copies files whose hashes already match and downloads only the rest; it verifies each downloaded file before switching the pack into use. A changed model updates its own file and the small signed channel metadata. Unchanged packs are left in place.

On the first transition from the old combined-pack format, the launcher reads the prior pack index and extracts each model's exact byte range locally. It checks the extracted hash before reusing the model, so existing scenery does not need to be downloaded again. If extraction fails verification, it safely downloads the required model file.

`channel.json` remains signed in the previous schema for older launchers. Updated launchers use `component-channel.json`; this lets the existing launcher update itself before the new content format is activated. Both channels are signed, and the launcher rejects a wrong repository, unsafe paths, invalid hashes, or content that does not match its signed index.

Use the dedicated Launcher Update, Client Update, and Content Update workflows for routine releases. Use the full release workflow for first-time migration or when a content change also changes the asset catalogue or connector metadata. A new scenery ID or a change to its OpenLOCK connection requires a client release too, because saved scene compatibility must be checked.

The first release that introduces the file-level format is a migration release. Future editor releases transfer only changed editor files; future scenery releases transfer only changed scenery files.
