import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {generateKeyPairSync,createPublicKey} from 'node:crypto';
const folder=path.join(os.homedir(),'.terrain-foundry'),file=path.join(folder,'release-signing-private.pem');
await fs.mkdir(folder,{recursive:true});
if(!await fs.stat(file).catch(()=>null)){const {privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});await fs.writeFile(file,privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});}
const pub=createPublicKey(await fs.readFile(file)),j=pub.export({format:'jwk'}),b=s=>Buffer.from(s,'base64url').toString('base64');
await fs.writeFile('release-config/update-public.pem',pub.export({type:'spki',format:'pem'}));
await fs.writeFile('launcher/update-public.xml',`<RSAKeyValue><Modulus>${b(j.n)}</Modulus><Exponent>${b(j.e)}</Exponent></RSAKeyValue>`);
console.log('Update verification public key prepared. Private key remains outside the repository.');
