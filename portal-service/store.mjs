import fs from 'node:fs/promises';
import path from 'node:path';
import {initialState} from './core.mjs';
const MAX=250000000;
const decode=b=>{if(b.length>MAX)throw Error('Portal storage capacity reached');const s=JSON.parse(b);if(s.schema!==1)throw Error('Unsupported portal state');return s;};
export class FileStore{
 constructor(file){this.file=file;this.queue=Promise.resolve();}
 async load(){try{return decode(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return initialState();throw e;}}
 async read(fn){await this.queue;return fn(await this.load());}
 transact(fn){const task=this.queue.then(async()=>{const s=await this.load(),result=await fn(s);const text=JSON.stringify(s);if(text.length>MAX)throw Error('Portal storage capacity reached');await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+process.pid+'.tmp';await fs.writeFile(temp,text,{mode:0o600});await fs.rename(temp,this.file);return result;});this.queue=task.catch(()=>{});return task;}
}
export class BlobStore{
 constructor(service){this.container=service.getContainerClient('campaign-portal');this.blob=this.container.getBlockBlobClient('state.json');}
 async init(){await this.container.createIfNotExists();try{await this.blob.uploadData(Buffer.from(JSON.stringify(initialState())),{conditions:{ifNoneMatch:'*'}});}catch(e){if(![409,412].includes(e.statusCode))throw e;}}
 async read(fn){return fn(decode((await this.blob.downloadToBuffer()).toString()));}
 async transact(fn){const lease=this.blob.getBlobLeaseClient();try{await lease.acquireLease(60);}catch(e){if(e.statusCode===409)throw Object.assign(Error('Portal is busy; retry your action'),{status:409});throw e;}let lost=false;const renew=setInterval(()=>lease.renewLease().catch(()=>{lost=true;}),20000);renew.unref();try{const s=decode((await this.blob.downloadToBuffer()).toString()),result=await fn(s),b=Buffer.from(JSON.stringify(s));if(b.length>MAX)throw Error('Portal storage capacity reached');if(lost)throw Error('Portal storage lease lost');await this.blob.uploadData(b,{conditions:{leaseId:lease.leaseId},blobHTTPHeaders:{blobContentType:'application/json'}});return result;}finally{clearInterval(renew);await lease.releaseLease().catch(()=>{});}}
}
