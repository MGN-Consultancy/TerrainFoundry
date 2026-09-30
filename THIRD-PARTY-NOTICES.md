# Licences and origin

Terrain Foundry source code is MIT licensed. Original procedural scenery and the original Foundry Link connector designs are dedicated under CC0-1.0; see ASSET-LICENSE.txt. Copyright is not the same as a restrictive licence: dependencies retain their copyright notices and permissive licences.

- Three.js: MIT (https://github.com/mrdoob/three.js).
- Electron: MIT, with Chromium and other third-party notices included in the distributed client (https://github.com/electron/electron).
- Manifold: Apache-2.0 (https://github.com/elalish/manifold). Used for geometry generation and imported-mesh processing.
- Vite: MIT (https://github.com/vitejs/vite). Build tool.
- WiX 3: Microsoft Reciprocal License (https://github.com/wixtoolset/wix3). Installer build tool; not bundled as a library in the editor.
- Microsoft Artifact Signing client and Windows SDK tools: Microsoft tool licences. Used only for signing official builds; not redistributed in the source repository or launcher.

The public release excludes legacy OpenLOCK SCAD source, the Printable Scenery clip STL, their non-commercial licences, and all generated legacy connector meshes. Foundry Link is a new cylindrical split-pin system, independently implemented in the included source. Its circular sockets and pins do not claim compatibility with OpenLOCK. Existing scene positions and IDs are retained; printed legacy connector parts are not upgraded.

No commercial Terrain Tinker meshes or textures are included. Scenery is generated from the original procedural modelling source in this repository. Generic architectural dimensions and shapes are used; this audit is not a legal opinion or a guarantee that no third-party intellectual-property claims could ever exist.

Terrain Foundry is independent of Wizards of the Coast, Printable Scenery, Terrain Tinker and Bambu Lab. Their names and trademarks are not licensed by CC0. Bambu Studio is a separate application; STL files are exported for the user to open and slice in it.
