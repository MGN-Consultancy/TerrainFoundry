import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,verify} from 'node:crypto';
import {splitLegacyArchive} from './legacy-content.mjs';

const repository='MGN-Consultancy/TerrainFoundry';
const root='release/asset-packs';
const envelope=JSON.parse(await fs.readFile('release/legacy/channel.json','utf8'));
const payload=Buffer.from(envelope.payload,'base64');
const publicKey=await fs.readFile('release-config/update-public.pem');
if(!verify('RSA-SHA256',payload,publicKey,Buffer.from(envelope.signature,'base64')))throw Error('The existing scenery channel signature is invalid.');
const channel=JSON.parse(payload);
if(channel.schema!==1||channel.repository!==repository||!Array.isArray(channel.assets)||!channel.assets.length)throw Error('The existing release is not a supported scenery migration source.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await fs.rm(root,{recursive:true,force:true});
let pieceCount=0,totalBytes=0;
for(const asset of channel.assets){
 const url=new URL(asset.url);
 if(url.protocol!=='https:'||url.hostname!=='github.com'||!url.pathname.startsWith('/'+repository+'/releases/download/')||decodeURIComponent(url.pathname.split('/').pop())!==asset.name)throw Error('Unapproved scenery archive address.');
 const zip=await fs.readFile(path.join('release/legacy',asset.name));
 if(zip.length!==asset.size||sha(zip)!==asset.sha256)throw Error('The downloaded archive does not match the signed channel: '+asset.id);
 const split=splitLegacyArchive(asset,zip);const directory=path.join(root,asset.id);
 for(const [name,bytes] of split.files){const destination=path.join(directory,...name.split('/'));await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);}
 await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'index.json'),JSON.stringify(split.index));
 pieceCount+=split.pieceCount;totalBytes+=split.totalBytes;
 console.log(`Migrated ${asset.id}: ${split.pieceCount} pieces, source bytes verified`);
 if(global.gc)global.gc();
}
if(pieceCount<1)throw Error('No individual scenery pieces were found during migration.');
console.log(`Verified and split ${channel.assets.length} published packs (${pieceCount} pieces, ${totalBytes} source bytes). No geometry was regenerated.`);
