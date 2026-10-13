import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.argv[2]||'.',bad=[];
// Git provides the source boundary; never recursively traverse the working collection.
const sources=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,maxBuffer:16*1024*1024}).toString('utf8').split('\0').filter(Boolean))];
for(const name of sources){
 const p=path.join(root,name),stat=await fs.lstat(p);
 if(stat.isSymbolicLink()){bad.push('Linked source file: '+name);continue;}
 if(!stat.isFile())continue;
 if(/^(?:work|premium-assets|deliverables|release|test-results|dist|node_modules|\.tools)\//.test(name))bad.push('Working data tracked as source: '+name);
 if(path.basename(name)==='check-public-source.mjs')continue;
 if(/\.(msi|exe|zip|nupkg|wixobj|wixpdb|pem)$/i.test(name)&&path.basename(name)!=='update-public.pem')bad.push(p);
 const text=/\.(js|mjs|cjs|cs|py|ps1|json|yml|yaml)$/i.test(name)?await fs.readFile(p,'utf8'):'';
  if(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(text))bad.push(p);
}
for(const name of ['LICENSE-SCOPE.md','third-party/openlock/NOTICE.md','third-party/openlock/CLIP-NOTICE.md','third-party/openlock/CLIP-LICENSE.txt','third-party/openlock/MGN-COMMERCIAL-LICENSE.txt','third-party/openlock/official/provenance.json'])if(!await fs.stat(path.join(root,name)).catch(()=>null))bad.push('Missing attribution/licence: '+name);
const clip=await fs.readFile(path.join(root,'third-party/openlock/OpenLOCK_Clip_v5.4.stl'));
if(createHash('sha256').update(clip).digest('hex')!=='50d2e770f52f6c6836d157b4351b39a6b6733ddb625b2cb08611866965fe7cd6')bad.push('OpenLOCK clip differs from attributed upstream file');
if(await fs.stat(path.join(root,'third-party/openlock/OpenLock.scad')).catch(()=>null))bad.push('Obsolete community socket source');
if(bad.length)throw Error('Public-source audit failed: '+bad.join(', '));
console.log('No installer binaries or private keys; attributed OpenLOCK source, original clip, public terms and MGN commercial grant present.');
