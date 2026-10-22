const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createPremiumDevice({userData,safeStorage,fsImpl=fs}){
 if(!path.isAbsolute(userData)||!safeStorage)throw Error('Native device storage required.');
 const file=path.join(userData,'premium','device-key.json');let cached,recovering;
 const unreadable=()=>Object.assign(Error('The protected device key could not be read. Recover the device connection, then use your pack code to download your scenery again.'),{code:'PREMIUM_IDENTITY_UNREADABLE'});
 const protectedStorage=()=>{if(!safeStorage.isEncryptionAvailable()||safeStorage.getSelectedStorageBackend?.()==='basic_text')throw Error('Windows protected storage is unavailable. Activation has not been changed.');};
 function decode(bytes){
  const saved=JSON.parse(bytes.toString('utf8'));if(saved.schemaVersion!==1||typeof saved.protectedKey!=='string')throw Error('Invalid protected device key');
  const pem=safeStorage.decryptString(Buffer.from(saved.protectedKey,'base64'));let key;
  try{key=crypto.createPrivateKey(pem);}catch(error){
   // Electron auth failures can leave a stale BoringSSL error for Node's next key import.
   // Retry only parsing the same successfully decrypted, unencrypted PKCS8 envelope once.
   if(error.code!=='ERR_OSSL_BAD_DECRYPT'||typeof pem!=='string'||!/^[-]{5}BEGIN PRIVATE KEY[-]{5}\r?\n[A-Za-z0-9+/=\r\n]+[-]{5}END PRIVATE KEY[-]{5}\s*$/.test(pem))throw error;
   key=crypto.createPrivateKey(pem);
  }
  if(key.asymmetricKeyType!=='ed25519')throw Error('Invalid device key type.');return key;
 }
 function publicFor(privateKey){const key=crypto.createPublicKey(privateKey),publicKey=key.export({type:'spki',format:'pem'}),fingerprint=crypto.createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');return {publicKey,fingerprint};}
 async function identity(){
  if(cached)return cached;
  protectedStorage();
  let privateKey;
  try{privateKey=decode(await fsImpl.readFile(file));}
  catch(e){if(e.code!=='ENOENT')throw unreadable();
   const pair=crypto.generateKeyPairSync('ed25519');privateKey=pair.privateKey;const bytes=safeStorage.encryptString(privateKey.export({type:'pkcs8',format:'pem'}));await fsImpl.mkdir(path.dirname(file),{recursive:true});
   // Exclusive creation preserves a key made concurrently by another native window.
   try{await fsImpl.writeFile(file,JSON.stringify({schemaVersion:1,protectedKey:bytes.toString('base64')}),{flag:'wx',mode:0o600});}catch(writeError){if(writeError.code==='EEXIST')return identity();throw writeError;}
  }
  cached={privateKey,...publicFor(privateKey)};return cached;
 }
 async function localFile(){for(let current=file;;current=path.dirname(current)){const stat=await fsImpl.lstat(current);if(stat.isSymbolicLink())throw Error('Linked device-key locations cannot be repaired');if(current===file&&(!stat.isFile()||stat.size>65536))throw Error('Invalid saved device-key file');if(path.dirname(current)===current)break;}return fsImpl.readFile(file);}
 async function repair(){
  protectedStorage();await localFile();const lock=file+'.recovery.lock';let lockOwned=false,replaced=false,backupPath,original,result;const temporary=file+'.recovery-'+crypto.randomUUID()+'.tmp',rollback=file+'.rollback-'+crypto.randomUUID()+'.tmp';
  try{
   try{await fsImpl.writeFile(lock,'Terrain Foundry explicit device recovery',{flag:'wx',mode:0o600});lockOwned=true;}catch(error){if(error.code==='EEXIST')throw Error('Another device recovery is already in progress');throw error;}
   original=await localFile();let readable=false;try{decode(original);readable=true;}catch{}if(readable)throw Error('The saved device key is readable and will not be reset');
   backupPath=path.join(path.dirname(file),'device-key.unreadable-'+crypto.randomUUID()+'.json');await fsImpl.writeFile(backupPath,original,{flag:'wx',mode:0o600});if(!(await fsImpl.readFile(backupPath)).equals(original))throw Error('Encrypted device backup verification failed');
   const privateKey=crypto.generateKeyPairSync('ed25519').privateKey,publicIdentity=publicFor(privateKey),bytes=Buffer.from(JSON.stringify({schemaVersion:1,protectedKey:safeStorage.encryptString(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64')}));
   if(publicFor(decode(bytes)).fingerprint!==publicIdentity.fingerprint)throw Error('New protected device key could not be verified');await fsImpl.writeFile(temporary,bytes,{flag:'wx',mode:0o600});if(!(await fsImpl.readFile(temporary)).equals(bytes)||publicFor(decode(await fsImpl.readFile(temporary))).fingerprint!==publicIdentity.fingerprint)throw Error('New protected device file could not be verified');
   if(!(await localFile()).equals(original))throw Error('Device key changed during recovery; no replacement was made');await fsImpl.rename(temporary,file);replaced=true;
   const installed=await localFile();if(!installed.equals(bytes)||publicFor(decode(installed)).fingerprint!==publicIdentity.fingerprint)throw Error('Installed protected device key could not be verified');cached={privateKey,...publicIdentity};result={...publicIdentity,backupPath};return result;
  }catch(error){
   if(replaced){try{await fsImpl.writeFile(rollback,original,{flag:'wx',mode:0o600});await fsImpl.rename(rollback,file);if(!(await localFile()).equals(original))throw Error('Restored device-key bytes differ');cached=undefined;}catch(rollbackError){throw Object.assign(Error('Device recovery failed and automatic restoration could not finish. The original encrypted key is preserved at '+backupPath),{code:'PREMIUM_IDENTITY_RECOVERY_ROLLBACK_FAILED',backupPath,cause:rollbackError});}}
   if(backupPath)error.backupPath=backupPath;throw error;
  }finally{for(const target of [temporary,rollback,...(lockOwned?[lock]:[])])await fsImpl.unlink(target).catch(error=>{if(error.code!=='ENOENT'&&result)result.cleanupWarning='Recovery succeeded, but a temporary recovery file could not be removed.';});}
 }
 function recoverUnreadableIdentity(){if(!recovering)recovering=repair().finally(()=>{recovering=undefined;});return recovering;}
 async function publicIdentity(){const i=await identity();return {publicKey:i.publicKey,fingerprint:i.fingerprint};}
 async function signChallenge(message,purpose='TerrainFoundry.activate.v1',expectedLicence){const i=await identity();if(typeof message!=='string'||message.length>1500)throw Error('Invalid activation challenge.');const lines=message.split('\n');if(lines.length!==4||lines[0]!==purpose||expectedLicence!==undefined&&lines[1]!==expectedLicence||!/^[a-f0-9]{64}$/.test(lines[1])||lines[2]!==i.fingerprint||!/^[-_a-zA-Z0-9]{43}$/.test(lines[3]))throw Error('Activation challenge does not match this device.');return crypto.sign(null,Buffer.from(message),i.privateKey).toString('base64');}
 async function verifyEntitlement(grant,issuerPublicKey,expectedPack){const i=await identity();if(!grant||typeof grant.payload!=='string'||grant.payload.length>12000||typeof grant.signature!=='string')throw Error('Invalid pack entitlement.');const bytes=Buffer.from(grant.payload,'base64');if(!crypto.verify(null,bytes,issuerPublicKey,Buffer.from(grant.signature,'base64')))throw Error('Pack entitlement signature failed.');const p=JSON.parse(bytes);if(p.schemaVersion!==1||p.issuer!=='TerrainFoundry'||p.packId!==expectedPack||p.deviceFingerprint!==i.fingerprint||p.offlineUse!==true||!Number.isFinite(p.issuedAt)||!p.licenceId)throw Error('Pack entitlement is not valid for this computer.');return p;}
 async function signUpdateChallenge(message,licenceId,productId,bundleId){const i=await identity();if(typeof message!=='string'||message.length>1500)throw Error('Invalid scenery update challenge.');const lines=message.split('\n');if(lines.length!==6||lines[0]!=='TerrainFoundry.update.v1'||lines[1]!==licenceId||!/^[a-f0-9]{64}$/.test(licenceId)||lines[2]!==i.fingerprint||lines[3]!==productId||lines[4]!== (bundleId||'*')||!/^[-_a-zA-Z0-9]{43}$/.test(lines[5]))throw Error('Scenery update challenge does not match this computer or purchase.');return crypto.sign(null,Buffer.from(message),i.privateKey).toString('base64');}
 return {publicIdentity,recoverUnreadableIdentity,signUpdateChallenge,signChallenge:message=>signChallenge(message),signDownloadChallenge:(message,licence)=>signChallenge(message,'TerrainFoundry.download.v1',licence),verifyEntitlement};
}
module.exports={createPremiumDevice};
