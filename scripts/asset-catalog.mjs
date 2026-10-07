import builtinIndex from '../src/generated/builtin-index.json' with {type:'json'};
import rangeIndex from '../src/generated/dungeon-range-index.json' with {type:'json'};
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {KIT} from '../src/model.js';
// Client-only releases do not regenerate scenery. Use the checked-in asset index
// when the full geometry build has not produced its temporary OpenLOCK overlay.
const meshes=JSON.parse(await fs.readFile('src/generated/openlock.json','utf8').catch(error=>{if(error.code==='ENOENT')return '{}';throw error;}));
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
// Provenance describes licensing, not the position or dimensions of a connection.
const layout=({templateSource,...geometry})=>geometry;
export function verifyCompatibility(previous,next){for(const [id,asset]of Object.entries(previous.assets)){if(!next.assets[id])throw Error('Saved projects need asset '+id+'. Retain its ID or provide a migration.');if(JSON.stringify(layout(asset.connection))!==JSON.stringify(layout(next.assets[id].connection)))throw Error('Connection layout changed for '+id+'. Use a new asset ID so existing scenes keep fitting.');}}
export const catalog={schema:1,release:pkg.version,policy:'Built-in asset IDs resolve to this installed catalogue; imported geometry stays in the project.',assets:Object.fromEntries(KIT.map(k=>[k.id,{name:k.name,category:k.category,connection:(meshes[k.id]||rangeIndex[k.id]||builtinIndex[k.id]).openlock,sha256:builtinIndex[k.id].sha256}]))};
if(process.argv[1]?.endsWith('asset-catalog.mjs')){const previous=JSON.parse(await fs.readFile('installer/asset-contract.json','utf8'));verifyCompatibility(previous,catalog);await fs.writeFile('desktop/asset-catalog.json',JSON.stringify(catalog,null,2));console.log(`Verified ${KIT.length} stable asset IDs and connector layouts.`);}
