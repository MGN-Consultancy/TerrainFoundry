const fs=require('node:fs/promises'),crypto=require('node:crypto');
// Assemble the exact signed ciphertext archive using verified local plaintext.
// Fresh IVs/keys/version AAD mean old ciphertext must never simply be copied.
async function writeDelta({file,manifest:m,key,previous,readPrevious,fetchEntry,signal,onProgress=()=>{}}){
 const fd=await fs.open(file,'wx',0o600),old=new Map((previous?.files||[]).map(f=>[f.path,f]));let reusedBytes=0,downloadedBytes=0,completed=0;
 try{for(const entry of m.files){if(signal?.aborted)throw Error('Pack update cancelled.');let encrypted;const match=old.get(entry.path);
   if(match&&match.sha256===entry.sha256&&match.plainSize===entry.plainSize){
    const plain=await readPrevious(entry.path);
    if(plain.length!==entry.plainSize||crypto.createHash('sha256').update(plain).digest('hex')!==entry.sha256)throw Error('Installed scenery integrity failed.');
    const cipher=crypto.createCipheriv('aes-256-gcm',key,Buffer.from(entry.iv,'base64'));cipher.setAAD(Buffer.from(m.packId+'\n'+m.version+'\n'+entry.path));encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
    if(!cipher.getAuthTag().equals(Buffer.from(entry.tag,'base64')))throw Error('Updated pack encryption does not match signed inventory.');reusedBytes+=encrypted.length;
   }else{encrypted=Buffer.from(await fetchEntry(entry));downloadedBytes+=encrypted.length;}
   if(encrypted.length!==entry.length)throw Error('Updated scenery range has the wrong length.');let written=0;while(written<encrypted.length){const {bytesWritten}=await fd.write(encrypted,written,encrypted.length-written,entry.offset+written);if(!bytesWritten)throw Error('Pack update write failed.');written+=bytesWritten;}
   completed++;onProgress({completed,total:m.files.length,reusedBytes,downloadedBytes,preparedBytes:reusedBytes+downloadedBytes});await new Promise(resolve=>setImmediate(resolve));
  }await fd.sync();return {reusedBytes,downloadedBytes,completed};
 }finally{await fd.close();}
}
module.exports={writeDelta};
