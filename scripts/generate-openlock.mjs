import {repairMeshData} from './clean-mesh-data.mjs';
import fs from 'node:fs/promises';
import Module from 'manifold-3d';
import {KIT} from '../src/model.js';
import {geometry} from './source-geometry.mjs';
import {connectAsset,socketBase,solidData} from '../src/openlock-build.js';
const wasm=await Module();wasm.setup();const assets={};
// Deepstone is restored from its checksum-pinned release archives after the
// procedural generators run. Do not attempt to recreate those authored meshes.
for(const k of KIT.filter(k=>!/^[ra]-/.test(k.id)&&!k.id.startsWith('dg-'))){const geo=geometry(k.id,25.4);assets[k.id]=connectAsset(wasm,geo,k.category,k.id);assets[k.id]=repairMeshData(assets[k.id],wasm);geo.dispose();console.log(k.id,assets[k.id].openlock.kind,assets[k.id].indices.length/3);}
const spec={width:50.8,depth:25.4,height:8,frame:false,ports:[{x:25.4,z:0,nx:1,nz:0,angle:0},{x:-25.4,z:0,nx:-1,nz:0,angle:180}]};
const base=socketBase(wasm,spec);assets['fit-coupon']=repairMeshData({...solidData(base),openlock:spec},wasm);base.delete();
await fs.writeFile('src/generated/openlock.json',JSON.stringify(assets));

