import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash,sign,verify} from 'node:crypto';
import {clientSourceHash} from './client-source-hash.mjs';
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const repo='MGN-Consultancy/TerrainFoundry',tag=process.env.TERRAIN_RELEASE_TAG||'v'+pkg.version,root='release/publish';
const component=(process.env.TERRAIN_COMPONENT||'full').toLowerCase();
if(!['full','launcher','client','content'].includes(component))throw Error('Unknown release component');
const url=name=>`https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;
const filesMeta=JSON.parse(await fs.readFile(root+'/package-files.json','utf8'));
async function entry(name,extra={}){const data=await fs.readFile(path.join(root,name));return {name,url:url(name),size:data.length,sha256:createHash('sha256').update(data).digest('hex'),...extra};}
async function readEnvelope(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return null;}}
const publicKey=await fs.readFile('release-config/update-public.pem');
function verifyEnvelope(envelope){const payload=Buffer.from(envelope.payload,'base64');if(!verify('RSA-SHA256',payload,publicKey,Buffer.from(envelope.signature,'base64')))throw Error('Previous update channel signature invalid');const value=JSON.parse(payload);if(value.repository!==repo)throw Error('Previous channel repository mismatch');return value;}
const legacyEnvelope=await readEnvelope('release/previous-legacy-channel.json')||await readEnvelope('release/previous-channel.json');
const componentEnvelope=await readEnvelope('release/previous-component-channel.json');
const legacy=legacyEnvelope?verifyEnvelope(legacyEnvelope):null;
const prior=componentEnvelope?verifyEnvelope(componentEnvelope):(legacy?legacy:null);
if(!legacy&&component!=='full')throw Error('A previous legacy channel is required for an independent component update');
if(prior?.schema===1&&component!=='full')throw Error('Publish one full migration release before independent component releases');
const product=JSON.parse(await fs.readFile('release-config/product.json','utf8'));
let launcher=prior?.launcher,client=prior?.client,assets=prior?.assets||[];
const legacyLauncher=(component==='full'||component==='launcher')?await entry('TerrainFoundryLauncher.exe',{version:(product.launcherVersion||'1.0.0')+'.0'}):(legacy?.launcher||launcher);
if(component==='full'||component==='launcher')launcher=legacyLauncher;
if(component==='full'||component==='client'){
 const published={};
 for(const [relative,meta] of Object.entries(filesMeta.client?.files||{})){
  const oldFile=prior?.schema===2?prior.client.files?.[relative]:null;
  if(oldFile?.sha256===meta.sha256){published[relative]=oldFile;await fs.unlink(path.join(root,meta.artifact));}
  else published[relative]=await entry(meta.artifact,{path:relative});
 }
 const sourceHash=await clientSourceHash();
 const aggregate=createHash('sha256').update(JSON.stringify(Object.entries(published).map(([p,f])=>[p,f.sha256]).sort())).digest('hex');
 client={name:'Terrain Foundry editor',version:pkg.version,sourceHash,sha256:aggregate,size:Object.values(published).reduce((n,f)=>n+f.size,0),files:published};
}
if(component==='content'&&prior?.schema===2){
 const currentSourceHash=await clientSourceHash();
 if(currentSourceHash!==prior.client.sourceHash)throw Error('Content catalogue or OpenLOCK metadata changed. Publish a client update so installed editors can read the new content safely.');
}
if(component==='full'||component==='content'){
 const byId=new Map(assets.map(a=>[a.id,a]));
 for(const [id,pack] of Object.entries(filesMeta.content||{})){
  const old=byId.get(id),published={};
  for(const [relative,meta] of Object.entries(pack.files)){
   const oldFile=old?.files?.[relative];
   if(oldFile?.sha256===meta.sha256){published[relative]=oldFile;await fs.unlink(path.join(root,meta.artifact));}
   else published[relative]=await entry(meta.artifact,{path:relative});
  }
  const packVersion=createHash('sha256').update(JSON.stringify(Object.entries(published).map(([p,f])=>[p,f.sha256]).sort())).digest('hex');
  byId.set(id,{id,name:id,version:packVersion,files:published,index:pack.index});
 }
 assets=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
if(!launcher||!client||!assets.length)throw Error('Component channel is missing a required component.');
if(!client.files||!client.files['TerrainFoundry.exe']||Object.keys(client.files).length>2000)throw Error('Editor channel does not contain a bounded executable file inventory.');
for(const pack of assets){if(!pack.files||!pack.index||Object.keys(pack.files).length>2000)throw Error(`Content pack ${pack.id} does not contain its complete file inventory and index.`);for(const [relative,file] of Object.entries(pack.files)){if(relative.includes('..')||relative.includes('\\')||relative.startsWith('/')||!file.url.startsWith(`https://github.com/${repo}/releases/download/`)||!/^[a-f0-9]{64}$/.test(file.sha256)||file.size<1)throw Error(`Unsafe content file record in ${pack.id}.`);}}
const componentVersions={launcher:launcher.version,client:client.version,content:createHash('sha256').update(JSON.stringify(assets.map(a=>[a.id,a.version]))).digest('hex')};
const release={schema:2,repository:repo,version:pkg.version,sequence:Date.now(),connector:'openlock-official-8.6',componentVersions,client,assets,launcher};
const key=process.env.TERRAIN_RELEASE_KEY||await fs.readFile(path.join(os.homedir(),'.terrain-foundry','release-signing-private.pem'),'utf8');
function signed(value){const payload=Buffer.from(JSON.stringify(value));return JSON.stringify({payload:payload.toString('base64'),signature:sign('RSA-SHA256',payload,key).toString('base64')});}
await fs.writeFile(root+'/component-channel.json',signed(release));
// Older launchers keep reading this schema-1 channel; they can update the launcher but will not break when the new component channel is introduced.
if(!legacy)throw Error('The compatibility channel is missing; a migration release must retain schema 1.');
const legacyRelease={...legacy,version:pkg.version,sequence:Date.now(),launcher:legacyLauncher};
await fs.writeFile(root+'/channel.json',signed(legacyRelease));
console.log(`Signed independent channels (${component}): launcher ${launcher.version}, editor ${client.version}, ${assets.length} content packs`);
