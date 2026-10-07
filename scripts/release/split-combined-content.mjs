import fs from 'node:fs/promises';
import path from 'node:path';
import {splitPackedContent} from './split-packed-content.mjs';
for(const packDir of await fs.readdir('release/asset-packs',{withFileTypes:true})){
 if(!packDir.isDirectory())continue;
 const directory=path.join('release/asset-packs',packDir.name),indexPath=path.join(directory,'index.json'),meshPath=path.join(directory,'meshes.bin');
 try{const index=JSON.parse(await fs.readFile(indexPath,'utf8'));if(!Object.values(index).some(entry=>!entry.file))continue;
  const {index:next,files}=splitPackedContent(index,await fs.readFile(meshPath));
  for(const [relative,bytes] of files){const target=path.join(directory,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
  await fs.writeFile(indexPath,JSON.stringify(next));await fs.rm(meshPath);
  for(const aggregate of ['src/generated/builtin-index.json','desktop/builtin-index.json']){const file=JSON.parse(await fs.readFile(aggregate,'utf8'));for(const [id,entry] of Object.entries(next))if(entry.file)file[id]={...file[id],...entry,pack:packDir.name};await fs.writeFile(aggregate,JSON.stringify(file));}
  console.log(`Split ${files.size} model files in ${packDir.name}`);
 }catch(error){if(error.code==='ENOENT')continue;throw error;}
}
