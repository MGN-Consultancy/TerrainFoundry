const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createPremiumDevice({userData,safeStorage}){
 if(!path.isAbsolute(userData)||!safeStorage)throw Error('Native device storage required.');
 const file=path.join(userData,'premium','device-key.json');let cached;
 async function identity(){
  if(cached)return cached;
  if(!safeStorage.isEncryptionAvailable()||safeStorage.getSelectedStorageBackend?.()==='basic_text')throw Error('Windows protected storage is unavailable. Activation has not been changed.');
  let privateKey;
  try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.schemaVersion!==1||typeof saved.protectedKey!=='string')throw Error('Invalid protected device key');privateKey=crypto.createPrivateKey(safeStorage.decryptString(Buffer.from(saved.protectedKey,'base64')));}
  catch(e){if(e.code!=='ENOENT')throw Error('The protected device key could not be read. Contact pack support for a reset.');
   const pair=crypto.generateKeyPairSync('ed25519');privateKey=pair.privateKey;const bytes=safeStorage.encryptString(privateKey.export({type:'pkcs8',format:'pem'}));await fs.mkdir(path.dirname(file),{recursive:true});
   // Exclusive creation preserves a key made concurrently by another native window.
   try{await fs.writeFile(file,JSON.stringify({schemaVersion:1,protectedKey:bytes.toString('base64')}),{flag:'wx',mode:0o600});}catch(writeError){if(writeError.code==='EEXIST')return identity();throw writeError;}
  }
  if(privateKey.asymmetricKeyType!=='ed25519')throw Error('Invalid device key type.');const key=crypto.createPublicKey(privateKey),publicKey=key.export({type:'spki',format:'pem'}),fingerprint=crypto.createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
  cached={privateKey,publicKey,fingerprint};return cached;
 }
 async function publicIdentity(){const i=await identity();return {publicKey:i.publicKey,fingerprint:i.fingerprint};}
 async function signChallenge(message,purpose='TerrainFoundry.activate.v1',expectedLicence){const i=await identity();if(typeof message!=='string'||message.length>1500)throw Error('Invalid activation challenge.');const lines=message.split('\n');if(lines.length!==4||lines[0]!==purpose||expectedLicence!==undefined&&lines[1]!==expectedLicence||!/^[a-f0-9]{64}$/.test(lines[1])||lines[2]!==i.fingerprint||!/^[-_a-zA-Z0-9]{43}$/.test(lines[3]))throw Error('Activation challenge does not match this device.');return crypto.sign(null,Buffer.from(message),i.privateKey).toString('base64');}
 async function verifyEntitlement(grant,issuerPublicKey,expectedPack){const i=await identity();if(!grant||typeof grant.payload!=='string'||grant.payload.length>12000||typeof grant.signature!=='string')throw Error('Invalid pack entitlement.');const bytes=Buffer.from(grant.payload,'base64');if(!crypto.verify(null,bytes,issuerPublicKey,Buffer.from(grant.signature,'base64')))throw Error('Pack entitlement signature failed.');const p=JSON.parse(bytes);if(p.schemaVersion!==1||p.issuer!=='TerrainFoundry'||p.packId!==expectedPack||p.deviceFingerprint!==i.fingerprint||p.offlineUse!==true||!Number.isFinite(p.issuedAt)||!p.licenceId)throw Error('Pack entitlement is not valid for this computer.');return p;}
 return {publicIdentity,signChallenge:message=>signChallenge(message),signDownloadChallenge:(message,licence)=>signChallenge(message,'TerrainFoundry.download.v1',licence),verifyEntitlement};
}
module.exports={createPremiumDevice};
