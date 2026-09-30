import rangeIndex from '../src/generated/dungeon-range-index.json' with {type:'json'};
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {KIT} from '../src/model.js';
const meshes=JSON.parse(await fs.readFile('src/generated/openlock.json','utf8'));
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
export function verifyCompatibility(previous,next){for(const [id,asset]of Object.entries(previous.assets)){if(!next.assets[id])throw Error('Saved projects need asset '+id+'. Retain its ID or provide a migration.');if(JSON.stringify(asset.connection)!==JSON.stringify(next.assets[id].connection))throw Error('Connection layout changed for '+id+'. Use a new asset ID so existing scenes keep fitting.');}}
export const catalog={schema:1,release:pkg.version,policy:'Built-in asset IDs resolve to this installed catalogue; imported geometry stays in the project.',assets:Object.fromEntries(KIT.map(k=>[k.id,{name:k.name,category:k.category,connection:(meshes[k.id]||rangeIndex[k.id]).openlock,sha256:rangeIndex[k.id]?.sha256||createHash('sha256').update(JSON.stringify(meshes[k.id])).digest('hex')}]))};
if(process.argv[1]?.endsWith('asset-catalog.mjs')){const previous=JSON.parse(await fs.readFile('installer/asset-contract.json','utf8'));verifyCompatibility(previous,catalog);await fs.writeFile('desktop/asset-catalog.json',JSON.stringify(catalog,null,2));console.log(`Verified ${KIT.length} stable asset IDs and connector layouts.`);}
