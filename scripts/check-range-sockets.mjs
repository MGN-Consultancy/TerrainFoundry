import fs from 'node:fs/promises';
import {wasm,M} from './sculpt-library.mjs';
import {socketCut} from '../src/openlock-build.js';
const limit=Number(process.argv[2]||431),errors=[];
for(let i=1;i<=limit;i++){
 const id='r-'+String(i).padStart(3,'0'),meta=JSON.parse(await fs.readFile(`test-results/dungeon-range/${id}.json`)),b=await fs.readFile(`test-results/dungeon-range/meshes/${id}.bin`),buf=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),m=meta.connected,n=m.vertices*3,offset=meta.raw.length;
 const pos=new Float32Array(buf,offset,n),colors=new Float32Array(buf,offset+n*4,n),index=new Uint32Array(buf,offset+n*8,m.indices),props=new Float32Array(m.vertices*6);
 for(let v=0;v<m.vertices;v++){props.set(pos.subarray(v*3,v*3+3),v*6);props.set(colors.subarray(v*3,v*3+3),v*6+3);}
 const mesh=new wasm.Mesh({numProp:6,vertProperties:props,triVerts:index});mesh.merge();const s=new M(mesh);if(s.status()!=='NoError'){errors.push([id,s.status()]);continue;}
 const parts=s.decompose();if(parts.length!==1)errors.push([id,'components',parts.length]);parts.forEach(p=>p.delete());
 const cutter=socketCut(wasm).translate([0,-3.5,0]);for(const p of meta.openlock.ports){const cut=cutter.rotate([p.roll||0,0,0]).rotate([0,p.angle,0]).translate([p.x,p.y??3.5,p.z]),hit=s.intersect(cut);if(Math.abs(hit.volume())>=.01)errors.push([id,'cavity',hit.volume(),p]);hit.delete();cut.delete();}cutter.delete();s.delete();
}
await fs.writeFile('test-results/dungeon-range-socket-audit.json',JSON.stringify({checked:limit,errors},null,2));console.log(JSON.stringify({checked:limit,errors}));if(errors.length)process.exitCode=1;
