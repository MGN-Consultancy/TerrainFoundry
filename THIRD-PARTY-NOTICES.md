# Licences and origin

Terrain Foundry application code is MIT licensed except the separately attributed OpenLOCK profile. Original connector-free procedural sculpture remains CC0-1.0; OpenLOCK-socketed derivatives and the supplied clip are CC BY-NC 4.0. See LICENSE-SCOPE.md, ASSET-LICENSE.txt and third-party/openlock/. Copyright is not the same as a restrictive licence: dependencies retain their copyright notices and permissive licences.

- Three.js: MIT (https://github.com/mrdoob/three.js).
- Electron: MIT, with Chromium and other third-party notices included in the distributed client (https://github.com/electron/electron).
- Manifold: Apache-2.0 (https://github.com/elalish/manifold). Used for geometry generation and imported-mesh processing.
- Vite: MIT (https://github.com/vitejs/vite). Build tool.
- WiX 3: Microsoft Reciprocal License (https://github.com/wixtoolset/wix3). Installer build tool; not bundled as a library in the editor.
- Microsoft Artifact Signing client and Windows SDK tools: Microsoft tool licences. Used only for signing official builds; not redistributed in the source repository or launcher.

This release restores OpenLOCK for non-commercial use. The socket profile in src/openlock-profile.js is adapted from caitlynb/OpenSCAD-OpenLock, commit 2dc0e67caffe73901902541d93baaa5d804d961c. Printable Scenery created the bundled OpenLOCK Clip 5.4. Both contributions are attributed in third-party/openlock/ and licensed CC BY-NC 4.0. The source SCAD and original clip are preserved with their notices and full licence. Export translates the clip to the print origin; the socket port adapts the source to Manifold/Y-up and omits breakaway supports. Physical fit has not been verified. No separate commercial printing permission is supplied.

No commercial Terrain Tinker meshes or textures are included. Scenery is generated from the original procedural modelling source in this repository. Generic architectural dimensions and shapes are used; this audit is not a legal opinion or a guarantee that no third-party intellectual-property claims could ever exist.

Terrain Foundry is independent of Wizards of the Coast, Printable Scenery, Terrain Tinker and Bambu Lab. Their names and trademarks are not licensed by CC0. Bambu Studio is a separate application; STL files are exported for the user to open and slice in it.
