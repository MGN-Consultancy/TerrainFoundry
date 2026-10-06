import {BlobServiceClient,StorageSharedKeyCredential,generateBlobSASQueryParameters,BlobSASPermissions} from '@azure/storage-blob';

export class Store {
 constructor(connection,containerName='print-orders'){this.service=BlobServiceClient.fromConnectionString(connection);this.container=this.service.getContainerClient(containerName);const values=Object.fromEntries(connection.split(';').filter(Boolean).map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));this.credential=new StorageSharedKeyCredential(values.AccountName,values.AccountKey);}
 async init(){await this.container.createIfNotExists();}
 blob(path){return this.container.getBlockBlobClient(path);}
 async put(path,data,options={}){return this.blob(path).uploadData(Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data)),{blobHTTPHeaders:{blobContentType:Buffer.isBuffer(data)?'application/zip':'application/json'},...options});}
 async get(path){try{return JSON.parse((await this.blob(path).downloadToBuffer()).toString());}catch(e){if(e.statusCode===404)return null;throw e;}}
 async remove(path){await this.blob(path).deleteIfExists();}
 async *list(prefix){try{for await(const b of this.container.listBlobsFlat({prefix}))yield b.name;}catch(e){if(e.statusCode!==404)throw e;}}
 async lock(path,fn){const blob=this.blob(path);const lease=blob.getBlobLeaseClient();try{await lease.acquireLease(60);}catch(e){if(e.statusCode===409)throw Object.assign(Error('This order is being processed. Please try again shortly.'),{status:409});throw e;}
  let leaseFailed=false;const timer=setInterval(()=>lease.renewLease().catch(()=>{leaseFailed=true;}),20000);timer.unref();
  try{return await fn(await this.get(path),async value=>{if(leaseFailed)throw Error('Order lock lost. Please retry.');await this.put(path,value,{conditions:{leaseId:lease.leaseId}});});}finally{clearInterval(timer);await lease.releaseLease().catch(()=>{});}
 }
 async budget(key,max){const path='limits/'+key+'.json';try{await this.put(path,{count:0,createdAt:Date.now()},{conditions:{ifNoneMatch:'*'}});}catch(e){if(e.statusCode!==409&&e.statusCode!==412)throw e;}
  await this.lock(path,async(value,save)=>{if(value.count>=max)throw Object.assign(Error('Too many quote requests. Please try again later.'),{status:429});value.count++;await save(value);});
 }
 downloadLink(path){const expiresOn=new Date(Date.now()+24*3600000);const sas=generateBlobSASQueryParameters({containerName:'print-orders',blobName:path,permissions:BlobSASPermissions.parse('r'),startsOn:new Date(Date.now()-300000),expiresOn,protocol:'https',contentDisposition:'attachment; filename="TerrainFoundry-print-order.zip"'},this.credential).toString();return this.blob(path).url+'?'+sas;}
}
