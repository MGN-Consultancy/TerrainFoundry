import {createHash} from 'node:crypto';

export function splitPackedContent(index,bin){
 const next={},files=new Map(),ranges=[];
 for(const [id,entry] of Object.entries(index)){
  if(!/^[a-z][a-z0-9-]{0,80}$/.test(id))throw Error('Invalid piece ID in packed content');
  if(entry.file){next[id]=entry;continue;}
  const offset=entry.offset,rawLength=entry.raw?.length,connectedLength=entry.connected?.length,total=rawLength+connectedLength;
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(total)||total<1||offset+total>bin.length)throw Error(`Invalid packed range for ${id}`);
  ranges.push([offset,offset+total,id]);
  const bytes=bin.subarray(offset,offset+total),digest=createHash('sha256').update(bytes).digest('hex');
  if(entry.sha256&&entry.sha256!==digest)throw Error(`Packed model hash mismatch for ${id}`);
  const file=`models/${id}.bin`;files.set(file,bytes);const {offset:_offset,...metadata}=entry;next[id]={...metadata,file,sha256:digest};
 }
 ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw Error(`Packed model ranges overlap: ${ranges[i-1][2]} and ${ranges[i][2]}`);
 return {index:next,files};
}
