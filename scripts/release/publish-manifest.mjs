import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import{createHash,sign,verify}from'node:crypto';import{clientSourceHash}from'./client-source-hash.mjs';
const pkg=JSON.parse(await fs.readFile('package.json','utf8')),repo='MGN-Consultancy/TerrainFoundry',tag='v'+pkg.version,root='release/publish',url=n=>`https://github.com/${repo}/releases/download/${tag}/${n}`;
async function entry(name,extra={}){const data=await fs.readFile(path.join(root,name));return {name,url:url(name),size:data.length,sha256:createHash('sha256').update(data).digest('hex'),...extra};}
const fileLists=JSON.parse(await fs.readFile(root+'/package-files.json','utf8'));
const assets=[];for(const name of (await fs.readdir(root)).filter(n=>n.startsWith('scenery-')&&n.endsWith('.zip')).sort()){const id=name.slice(8,-4);assets.push(await entry(name,{id,files:fileLists[name]}));}
const clientName=`TerrainFoundry-client-${pkg.version}-win-x64.zip`,sourceHash=await clientSourceHash(),product=JSON.parse(await fs.readFile('release-config/product.json','utf8'));
let client=await entry(clientName,{files:fileLists[clientName],sourceHash});
if(process.env.TERRAIN_SCENERY_ONLY==='true'){
 const previous=JSON.parse(await fs.readFile('release/previous-channel.json','utf8')),payload=Buffer.from(previous.payload,'base64');if(!verify('RSA-SHA256',payload,await fs.readFile('release-config/update-public.pem'),Buffer.from(previous.signature,'base64')))throw Error('Previous channel signature invalid');const release=JSON.parse(payload);if(release.repository!==repo||release.client.sourceHash!==sourceHash)throw Error('Client code/catalogue changed: publish a normal release instead of scenery-only');client=release.client;
}
const release={schema:1,repository:repo,version:pkg.version,sequence:Date.now(),connector:'openlock-cc-by-nc-4.0',client,assets,launcher:await entry('TerrainFoundryLauncher.exe',{version:(product.launcherVersion||'1.0.0')+'.0'})};
const key=process.env.TERRAIN_RELEASE_KEY||await fs.readFile(path.join(os.homedir(),'.terrain-foundry','release-signing-private.pem'),'utf8'),payload=Buffer.from(JSON.stringify(release)),signature=sign('RSA-SHA256',payload,key);
await fs.writeFile(root+'/channel.json',JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')}));
console.log('Signed release manifest for',tag,assets.length,'scenery packs');

if(process.env.TERRAIN_SCENERY_ONLY==='true')await fs.unlink(path.join(root,clientName));
