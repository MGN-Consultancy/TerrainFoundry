// Derive the socket from Printable Scenery's A floor template, not community code.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import Module from 'manifold-3d';import {STLLoader} from 'three/addons/loaders/STLLoader.js';
const path='third-party/openlock/official/A-TRP-v7.0.stl',bytes=await fs.readFile(path);
const provenance=JSON.parse(await fs.readFile('third-party/openlock/official/provenance.json','utf8'));
if(createHash('sha256').update(bytes).digest('hex')!==provenance.files.find(f=>f.file==='A-TRP-v7.0.stl').sha256)throw Error('Official template digest mismatch');
const wasm=await Module();wasm.setup();const M=wasm.Manifold;
const geo=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
// Remove export noise below one micron; dimensions remain in millimetres.
const vertices=Float32Array.from(geo.attributes.position.array,n=>Math.round(n*1000)/1000);
const mesh=new wasm.Mesh({numProp:3,vertProperties:vertices,triVerts:Uint32Array.from({length:vertices.length/3},(_,i)=>i),tolerance:.0001});mesh.merge();const template=new M(mesh);if(template.status()!=='NoError')throw Error(template.status());
// Isolate the central socket of the official triplex A template. The template's
// existing hollow underside supplies the latch clearance. Keep its 7 mm datum.
const region=M.cube([14,11.2,7.5]).translate([18.4,2,-1]);
let cavity=region.subtract(template);
// Omit only the two sacrificial print-support posts in the central entrance.
const posts=[22.86,27.94].map(x=>M.cube([1.8,2.6,4.02]).translate([x-.9,10.5,1.49]));
const opened=cavity.add(M.union(posts));cavity.delete();cavity=opened;
const normalized=cavity.warp(p=>{const [x,y,z]=p;p[0]=y-12.7;p[1]=z;p[2]=x-25.4;}).simplify(.0001);
if(normalized.status()!=='NoError')throw Error(normalized.status());
const m=normalized.getMesh();const data={positions:Array.from(m.vertProperties),indices:Array.from(m.triVerts)};
await fs.writeFile('src/official-socket-data.js','// Generated from official A-TRP-v7.0.stl. See scripts/generate-official-socket.mjs and bundled licence.\nexport const OFFICIAL_SOCKET='+JSON.stringify(data)+';\n');
await fs.writeFile('src/openlock-profile.js',`// Printable Scenery official template derivative. No community OpenSCAD code.
// Commercial grant: third-party/openlock/MGN-COMMERCIAL-LICENSE.txt (MGN only).
// Public non-commercial terms and provenance: third-party/openlock/NOTICE.md.
import {OFFICIAL_SOCKET} from './official-socket-data.js';
export function socketCut(wasm){return new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(OFFICIAL_SOCKET.positions),triVerts:Uint32Array.from(OFFICIAL_SOCKET.indices)}));}
`);
console.log('Official socket generated:',m.triVerts.length/3,'triangles, volume',normalized.volume());
normalized.delete();cavity.delete();region.delete();template.delete();posts.forEach(p=>p.delete());geo.dispose();
