import fs from 'node:fs/promises';
import {createHash,sign,verify} from 'node:crypto';
const root='release/publish',product=JSON.parse(await fs.readFile('release-config/product.json','utf8'));
const envelope=JSON.parse(await fs.readFile('release/previous/channel.json','utf8')),bytes=Buffer.from(envelope.payload,'base64');
if(!verify('RSA-SHA256',bytes,await fs.readFile('release-config/update-public.pem'),Buffer.from(envelope.signature,'base64')))throw Error('Previous update channel signature invalid');
const previous=JSON.parse(bytes);
if(previous.repository!==product.repository||!previous.client?.files||!previous.assets?.length)throw Error('Invalid previous release');
const name='TerrainFoundryLauncher.exe',binary=await fs.readFile(root+'/'+name);
const release={...previous,sequence:Math.max(Date.now(),previous.sequence+1),launcher:{name,url:`https://github.com/${product.repository}/releases/download/v${product.launcherVersion}/${name}`,size:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),version:product.launcherVersion+'.0'}};
// A launcher repair must preserve the exact signed client and all scenery references.
if(JSON.stringify(release.client)!==JSON.stringify(previous.client)||JSON.stringify(release.assets)!==JSON.stringify(previous.assets))throw Error('Launcher repair changed content');
const payload=Buffer.from(JSON.stringify(release)),signature=sign('RSA-SHA256',payload,process.env.TERRAIN_RELEASE_KEY);
await fs.writeFile(root+'/channel.json',JSON.stringify({payload:payload.toString('base64'),signature:signature.toString('base64')}));
console.log(`Launcher ${product.launcherVersion}; preserving editor ${previous.version} and ${previous.assets.length} scenery packs.`);
