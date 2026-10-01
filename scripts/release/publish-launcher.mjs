import fs from 'node:fs/promises';
import {createHash,sign,verify} from 'node:crypto';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

// Launcher-only releases retain the existing immutable client/scenery URLs.
const root='release/publish',repo='MGN-Consultancy/TerrainFoundry';
const previous=JSON.parse(await fs.readFile('release/previous-channel.json','utf8'));
const previousBytes=Buffer.from(previous.payload,'base64');
assert(verify('RSA-SHA256',previousBytes,await fs.readFile('release-config/update-public.pem'),Buffer.from(previous.signature,'base64')),'Previous channel signature invalid');
const old=JSON.parse(previousBytes);
assert.equal(old.repository,repo);
const product=JSON.parse(await fs.readFile('release-config/product.json','utf8'));
const expectedConnector=product.connector==='OpenLOCK'?'openlock-official-8.6':'foundry-link-v1';
assert.equal(old.connector,expectedConnector,'Connector transition requires a full editor/scenery release before a launcher-only update');
const version=product.launcherVersion;
assert.match(version,/^\d+\.\d+\.\d+$/);
assert.equal(JSON.parse(await fs.readFile('package.json','utf8')).version,version);
const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;};
assert(newer(version,old.version),'A release version must increase');
assert(newer(version,old.launcher.version),'The launcher version must increase');
for(const entry of [old.client,...old.assets]){
  const url=new URL(entry.url);
  assert.equal(url.origin,'https://github.com');
  assert(url.pathname.startsWith('/'+repo+'/releases/download/'));
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);
}
await fs.mkdir(root,{recursive:true});
const name='TerrainFoundryLauncher.exe',bytes=await fs.readFile('launcher/'+name);
await fs.copyFile('launcher/'+name,root+'/'+name);
await fs.access(`${root}/TerrainFoundryLauncher-${version}-win-x64.msi`);
const manifest={...old,version,sequence:Math.max(Date.now(),old.sequence+1),launcher:{name,url:`https://github.com/${repo}/releases/download/v${version}/${name}`,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),version:version+'.0'}};
const key=process.env.TERRAIN_RELEASE_KEY||await fs.readFile(path.join(os.homedir(),'.terrain-foundry','release-signing-private.pem'),'utf8');
const payload=Buffer.from(JSON.stringify(manifest));
const signature=sign('RSA-SHA256',payload,key);
await fs.writeFile(root+'/channel.json',JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')}));
console.log(`Signed launcher ${version}; reusing the existing client and ${old.assets.length} scenery packs.`);
