import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {splitPackedContent} from './split-packed-content.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const safe=s=>{const normalized=s.replace(/\\/g,'/');if(!normalized||normalized.startsWith('/')||normalized.includes(':')||normalized.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe scenery archive path.');return normalized;};
export function splitLegacyArchive(asset,zip){
 if(!/^[a-z][a-z0-9-]{0,40}$/.test(asset.id)||typeof asset.name!=='string'||!/^scenery-[a-z0-9-]+\.zip$/.test(asset.name)||!asset.files||typeof asset.files!=='object')throw Error('Invalid pack entry in signed scenery channel.');
 const extracted=unzipSync(zip);const entries=Object.keys(extracted).filter(name=>!name.endsWith('/')).map(safe);
 const actual=new Set(entries),expected=Object.keys(asset.files).map(safe);
 if(actual.size!==expected.length||expected.some(name=>!actual.has(name)))throw Error('Archive inventory differs from signed metadata: '+asset.id);
 let totalBytes=0;for(const name of expected){const bytes=Buffer.from(extracted[name]);if(sha(bytes)!==asset.files[name])throw Error('Archive file checksum failed: '+asset.id+'/'+name);totalBytes+=bytes.length;if(totalBytes>8589934592)throw Error('Migrated scenery exceeds the 8 GiB safety limit.');}
 const indexBytes=Buffer.from(extracted['index.json']||[]);if(!indexBytes.length)throw Error('Pack has no index: '+asset.id);
 const original=JSON.parse(indexBytes.toString('utf8'));const mesh=extracted['meshes.bin']?Buffer.from(extracted['meshes.bin']):Buffer.alloc(0);
 const split=splitPackedContent(original,mesh);const files=new Map();
 for(const name of expected){if(name==='index.json'||name==='meshes.bin')continue;files.set(name,Buffer.from(extracted[name]));}
 for(const [name,bytes] of split.files)files.set(name,Buffer.from(bytes));
 return {index:split.index,files,pieceCount:Object.keys(split.index).length,totalBytes};
}
