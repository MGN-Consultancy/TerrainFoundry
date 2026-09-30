// Historical CC0 design only; never changes the active OpenLOCK connector.
import fs from 'node:fs/promises';
import {wasm,M} from './sculpt-library.mjs';
import {solidData} from '../src/openlock-build.js';
await fs.mkdir('assets-source/connectors',{recursive:true});
// Original design: split cylindrical friction pin with a solid centre bridge.
// No third-party connector mesh, template, profile or source is used.
let s=M.cylinder(13.6,2.12,2.12,48,true).rotate([0,90,0]);
const slots=M.union([-1,1].map(sign=>M.cube([5.4,.65,7],true).translate([sign*4.8,0,0])));
s=s.subtract(slots);if(s.status()!=='NoError'||s.decompose().length!==1)throw Error('Invalid Foundry Link pin');
const d=solidData(s),count=d.indices.length/3,bytes=Buffer.alloc(84+count*50);bytes.write('Terrain Foundry original Foundry Link connector / CC0-1.0');bytes.writeUInt32LE(count,80);
for(let i=0;i<count;i++)for(let j=0;j<3;j++){const p=d.positions.slice(d.indices[i*3+j]*3,d.indices[i*3+j]*3+3);for(let a=0;a<3;a++)bytes.writeFloatLE(p[a]+(a===2?2.12:0),84+i*50+12+j*12+a*4);}
const notice='Foundry Link original split friction pin. CC0-1.0. No OpenLOCK compatibility claim. Print a socket/pin fit test before production.';
await fs.writeFile('assets-source/connectors/legacy-foundry-link.js',`export const CLIP_BASE64=${JSON.stringify(bytes.toString('base64'))};\nexport const CLIP_NOTICE=${JSON.stringify(notice)};\nexport const CLIP_LICENSE='CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/';\n`);
await fs.mkdir('assets-source/connectors',{recursive:true});await fs.writeFile('assets-source/connectors/foundry-link.stl',bytes);
console.log('Generated original Foundry Link pin',bytes.length);
