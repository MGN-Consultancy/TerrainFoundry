import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const bytes=await fs.readFile('third-party/openlock/OpenLOCK_Clip_v5.4.stl');
if(createHash('sha256').update(bytes).digest('hex')!=='50d2e770f52f6c6836d157b4351b39a6b6733ddb625b2cb08611866965fe7cd6')throw Error('OpenLOCK source clip digest mismatch');
const notice=await fs.readFile('third-party/openlock/CLIP-NOTICE.md','utf8');
const license=await fs.readFile('third-party/openlock/CLIP-LICENSE.txt','utf8');
await fs.writeFile('src/generated-clip.js',`// Printable Scenery OpenLOCK Clip 5.4; CC BY-NC 4.0. See bundled attribution.\nexport const CLIP_BASE64=${JSON.stringify(bytes.toString('base64'))};\nexport const CLIP_NOTICE=${JSON.stringify(notice)};\nexport const CLIP_LICENSE=${JSON.stringify(license)};\n`);
console.log('Bundled unchanged OpenLOCK Clip 5.4 source with attribution and full non-commercial licence.');
await fs.appendFile('src/generated-clip.js',`export const SOCKET_NOTICE=${JSON.stringify(await fs.readFile('third-party/openlock/NOTICE.md','utf8'))};\n`);
