import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.argv[2]||'.',bad=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){
 if(['.git','node_modules'].includes(e.name)||(['.tools','release','deliverables','work','test-results','dist'].includes(e.name)&&dir===root))continue;
 const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()){
  if(e.name==='check-public-source.mjs')continue;
  if(/\.(msi|exe|zip|nupkg|wixobj|wixpdb|pem)$/i.test(e.name)&&e.name!=='update-public.pem')bad.push(p);
  const text=/\.(js|mjs|cjs|cs|py|ps1|json|yml|yaml)$/i.test(e.name)?await fs.readFile(p,'utf8'):'';
  if(text.includes('BEGIN PRIVATE KEY')||text.includes('BEGIN RSA PRIVATE KEY'))bad.push(p);
 }
}}
await walk(root);
for(const name of ['LICENSE-SCOPE.md','third-party/openlock/NOTICE.md','third-party/openlock/CLIP-NOTICE.md','third-party/openlock/CLIP-LICENSE.txt'])if(!await fs.stat(path.join(root,name)).catch(()=>null))bad.push('Missing attribution/licence: '+name);
const clip=await fs.readFile(path.join(root,'third-party/openlock/OpenLOCK_Clip_v5.4.stl'));
if(createHash('sha256').update(clip).digest('hex')!=='50d2e770f52f6c6836d157b4351b39a6b6733ddb625b2cb08611866965fe7cd6')bad.push('OpenLOCK clip differs from attributed upstream file');
if(bad.length)throw Error('Public-source audit failed: '+bad.join(', '));
console.log('No installer binaries or private keys; attributed OpenLOCK source, original clip and non-commercial licence present.');
