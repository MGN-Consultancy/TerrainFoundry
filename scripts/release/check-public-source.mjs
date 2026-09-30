import fs from 'node:fs/promises';import path from 'node:path';
const root=process.argv[2]||'.',bad=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules','.tools','release','deliverables','work','test-results','dist'].includes(e.name)&&dir===root)continue;const p=path.join(dir,e.name);if(e.isDirectory()){if(p.replaceAll('\\','/').endsWith('third-party/openlock')){bad.push(p);continue;}await walk(p);}else if(e.isFile()){if(e.name==='check-public-source.mjs')continue;if(/\.(msi|exe|zip|nupkg|wixobj|wixpdb|pem)$/i.test(e.name)&&e.name!=='update-public.pem')bad.push(p);const text=/\.(js|mjs|cjs|cs|py|ps1|json|yml|yaml)$/i.test(e.name)?await fs.readFile(p,'utf8'):'';if(text.includes('BEGIN PRIVATE KEY')||text.includes('BEGIN RSA PRIVATE KEY'))bad.push(p);if(text.includes('OpenLOCK_Clip_v5.4.stl')||text.includes('adapted from caitlynb'))bad.push(p);}}}
await walk(root);if(bad.length)throw Error('Public-source audit failed: '+bad.join(', '));console.log('Public source contains no installer binaries, private keys or excluded connector source.');


