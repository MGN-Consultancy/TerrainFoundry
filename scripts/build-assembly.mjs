import fs from 'node:fs/promises';
import {builtinData} from '../src/builtin-data.js';
import {build} from 'vite';
const models={};
for(const id of ['v-stone-floor','b-weathered-wall','wall-low']){
 const d=builtinData(id,true); const bytes=Buffer.concat([Buffer.from(d.positions.buffer,d.positions.byteOffset,d.positions.byteLength),Buffer.from(d.colors.buffer,d.colors.byteOffset,d.colors.byteLength),Buffer.from(d.indices.buffer,d.indices.byteOffset,d.indices.byteLength)]);
 await fs.writeFile(`site/assets/assembly-${id}.bin`,bytes);models[id]={vertices:d.positions.length/3,indices:d.indices.length};
}
await fs.writeFile('site/assets/assembly-models.json',JSON.stringify(models));
await build({configFile:false,publicDir:false,build:{outDir:'site/assets',emptyOutDir:false,lib:{entry:'scripts/assembly-scene.js',formats:['es'],fileName:()=> 'assembly.js'},minify:true}});
await fs.copyFile('node_modules/three/LICENSE','site/assets/assembly-three-LICENSE.txt');
