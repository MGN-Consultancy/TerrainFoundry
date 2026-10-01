// Printable Scenery official template derivative. No community OpenSCAD code.
// Commercial grant: third-party/openlock/MGN-COMMERCIAL-LICENSE.txt (MGN only).
// Public non-commercial terms and provenance: third-party/openlock/NOTICE.md.
import {OFFICIAL_SOCKET} from './official-socket-data.js';
export function socketCut(wasm){return new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(OFFICIAL_SOCKET.positions),triVerts:Uint32Array.from(OFFICIAL_SOCKET.indices)}));}
