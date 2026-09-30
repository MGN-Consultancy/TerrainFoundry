import {cleanMeshData} from './clean-mesh-data.mjs';
import fs from 'node:fs/promises';
import Module from 'manifold-3d';
import {KIT} from '../src/model.js';
import {geometry} from './source-geometry.mjs';
import {connectAsset,socketBase,solidData} from '../src/openlock-build.js';
const wasm=await Module();wasm.setup();const assets={};
for(const k of KIT.filter(k=>!/^[ra]-/.test(k.id))){const geo=geometry(k.id,25.4);assets[k.id]=connectAsset(wasm,geo,k.category,k.id);if(/^[oqtcn]-/.test(k.id))assets[k.id]=cleanMeshData(assets[k.id]);geo.dispose();console.log(k.id,assets[k.id].openlock.kind,assets[k.id].indices.length/3);}
const spec={width:50.8,depth:25.4,height:8,frame:false,ports:[{x:25.4,z:0,nx:1,nz:0,angle:0},{x:-25.4,z:0,nx:-1,nz:0,angle:180}]};
const base=socketBase(wasm,spec);assets['fit-coupon']={...solidData(base),openlock:spec};base.delete();
await fs.writeFile('src/generated/openlock.json',JSON.stringify(assets));

