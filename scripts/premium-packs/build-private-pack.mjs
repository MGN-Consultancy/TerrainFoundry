import fs from 'node:fs/promises';import path from 'node:path';
import {encryptPack,sha} from '../../print-service/src/premium-pack.mjs';
const safePath=(root,p)=>{if(typeof p!=='string'||!p||p.includes('\\')||p.includes(':')||path.isAbsolute(p)||p.split('/').some(x=>!x||x==='..'||x==='.'))throw Error('Unsafe source path');const full=path.resolve(root,p);if(!full.startsWith(path.resolve(root)+path.sep))throw Error('Source escaped pack');return full;};
const [root,specFile,output]=process.argv.slice(2);if(!root||!specFile||!output)throw Error('Usage: build-private-pack <approved-pack-root> <delivery-spec.json> <private-output-folder>');
const pack=JSON.parse(await fs.readFile(path.join(root,'pack.json'),'utf8')),spec=JSON.parse(await fs.readFile(specFile,'utf8'));
if(pack.distribution?.readyForSale!==true||pack.review?.allPiecesApproved!==true||pack.pieces.some(p=>p.validation?.rightsApproved!==true))throw Error('Pack has not passed its human approval and sale-readiness gates');
if(spec.packId!==pack.id||spec.version!==pack.version||!Array.isArray(spec.files)||!spec.files.some(f=>f.path==='catalogue.json'))throw Error('Delivery inventory must match the approved pack and include catalogue.json');
if(!process.env.PREMIUM_SIGNING_KEY_FILE)throw Error('Provide a private signing-key file outside source control');
const files=[];for(const f of spec.files){const bytes=await fs.readFile(safePath(root,f.source));if(f.sha256!==sha(bytes))throw Error('Approved source inventory changed: '+f.path);files.push({path:f.path,bytes});}
const encrypted=encryptPack({packId:spec.packId,version:spec.version,files,signingKey:await fs.readFile(process.env.PREMIUM_SIGNING_KEY_FILE)});
await fs.mkdir(output,{recursive:true});const blob='packs/'+spec.packId+'/'+spec.version+'/'+sha(encrypted.blob)+'.tfc';await fs.writeFile(path.join(output,sha(encrypted.blob)+'.tfc'),encrypted.blob,{flag:'wx'});await fs.writeFile(path.join(output,'private-delivery-record.json'),JSON.stringify({approved:true,blob,manifest:encrypted.manifest,key:encrypted.key.toString('base64')},null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({packId:spec.packId,version:spec.version,encryptedBytes:encrypted.blob.length,files:files.length,sha256:sha(encrypted.blob)}));
