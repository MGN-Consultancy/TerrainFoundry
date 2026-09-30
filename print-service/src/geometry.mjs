import yauzl from 'yauzl';
import {createHash} from 'node:crypto';

export class InputError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export const LIMITS={upload:40*1024*1024,expanded:160*1024*1024,files:180,triangles:600000,pieces:500};
const fail=message=>{throw new InputError(message);};

// Never extract untrusted archives to disk. Bound both declared and actual sizes.
export function readPack(buffer,{strictModels=false}={}) {
 if(buffer.length>LIMITS.upload) fail('The print pack must be smaller than 40 MB. Split larger scenes into separate packs.');
 return new Promise((resolve,reject)=>yauzl.fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
  if(error)return reject(new InputError('Choose a valid ZIP print pack.'));
  let expanded=0,count=0;const files=new Map();
  const stop=err=>{zip.close();reject(err instanceof InputError?err:new InputError('The ZIP file could not be read.'));};
  zip.on('error',stop);zip.on('end',()=>resolve(files));
  zip.on('entry',entry=>{
   if(++count>LIMITS.files)return stop(new InputError('Too many files in this pack.'));
   const path=entry.fileName,segments=path.split('/');
   if(path.includes('\\')||path.startsWith('/')||segments.includes('..')||path.includes(':')||entry.generalPurposeBitFlag&1||((entry.externalFileAttributes>>>16)&0xf000)===0xa000)return stop(new InputError('Unsafe or encrypted archive entry.'));
   expanded+=entry.uncompressedSize;if(expanded>LIMITS.expanded)return stop(new InputError('The expanded pack is too large.'));
   if(path.endsWith('/'))return zip.readEntry();
   const name=segments.at(-1);
   if(!/^[a-zA-Z0-9_. -]{1,120}$/.test(name))return stop(new InputError('Unsupported filename in the pack.'));
   if(!/\.stl$/i.test(name)&&name!=='quantities.csv'){if(strictModels)return stop(new InputError('Model ZIPs may contain STL files only. Remove scripts, textures, documents and nested archives.'));return zip.readEntry();}
   if(files.has(name.toLowerCase()))return stop(new InputError('Duplicate filenames in the pack.'));
   zip.openReadStream(entry,(err,stream)=>{
    if(err)return stop(err);const chunks=[];let size=0;
    stream.on('error',stop);stream.on('data',chunk=>{size+=chunk.length;if(size>entry.uncompressedSize||size>LIMITS.expanded){stream.destroy();stop(new InputError('Archive size mismatch.'));}else chunks.push(chunk);});
    stream.on('end',()=>{files.set(name.toLowerCase(),{name,bytes:Buffer.concat(chunks)});zip.readEntry();});
   });
  });zip.readEntry();
 }));
}

export function quantities(files) {
 const csv=files.get('quantities.csv');if(!csv)fail('Include quantities.csv from Prepare print pack so copy counts and connectors are correct.');
 if(csv.bytes.length>100000)fail('Quantity list is too large.');
 const rows=csv.bytes.toString('utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(rows.shift()!=='Piece,File,Quantity,Width_mm,Depth_mm,Height_mm')fail('Use the original Terrain Foundry quantities.csv.');
 const result=[];const seen=new Set();let total=0;
 for(const row of rows){const cols=row.split(',');if(cols.length!==6)fail('Invalid quantity row.');const [piece,file,n]=cols;const quantity=Number(n),key=file.toLowerCase();
  if(!/^[a-zA-Z0-9][a-zA-Z0-9 _().'-]{0,119}$/.test(piece)||!/^\d+$/.test(n)||quantity<1||!Number.isSafeInteger(quantity)||!key.endsWith('.stl')||!files.has(key)||seen.has(key))fail('The quantity list has a missing model, duplicate, or invalid count.');
  seen.add(key);total+=quantity;if(total>LIMITS.pieces)fail('Please split orders above 500 pieces into smaller packs.');
  result.push({name:piece.slice(0,120),file:files.get(key).name,quantity,bytes:files.get(key).bytes});
 }
 if(!result.length)fail('The print pack has no pieces.');
 for(const key of files.keys())if(key.endsWith('.stl')&&!seen.has(key))fail('Every STL must be listed in quantities.csv.');
 return result;
}

export function inspectSTL(bytes,buildVolume=[256,256,256]) {
 let vertices=[];
 if(bytes.length>=84&&84+bytes.readUInt32LE(80)*50===bytes.length){const count=bytes.readUInt32LE(80);if(count>LIMITS.triangles)fail('This model is too detailed for automatic quoting.');
  for(let i=0;i<count;i++)for(let j=0;j<9;j++)vertices.push(bytes.readFloatLE(84+i*50+12+j*4));
 }else{
  const source=bytes.toString('utf8');if(!/^\s*solid\b/i.test(source)||!source.includes('endsolid'))fail('An STL file is invalid.');
  for(const match of source.matchAll(/\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g)){vertices.push(Number(match[1]),Number(match[2]),Number(match[3]));if(vertices.length>LIMITS.triangles*9)fail('This model is too detailed for automatic quoting.');}
 }
 if(!vertices.length||vertices.length%9)fail('An STL has no complete triangles.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],edges=new Map();let volume=0,area=0;
 const parents=new Int32Array(vertices.length/9),signed=new Float64Array(parents.length);for(let i=0;i<parents.length;i++)parents[i]=i;
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const pointKey=p=>p.map(n=>Object.is(n,-0)?0:n).join(',');
 for(let i=0;i<vertices.length;i+=9){const a=vertices.slice(i,i+3),b=vertices.slice(i+3,i+6),c=vertices.slice(i+6,i+9);
  for(const p of [a,b,c])for(let j=0;j<3;j++){if(!Number.isFinite(p[j])||Math.abs(p[j])>10000)fail('An STL has invalid coordinates.');min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);}
  const u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]);const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const triangleArea=Math.hypot(...cross)/2;if(triangleArea<1e-10)fail('A model has degenerate triangles and needs repair before automatic quoting.');area+=triangleArea;
  signed[i/9]=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;volume+=signed[i/9];
  const keys=[a,b,c].map(pointKey);for(let j=0;j<3;j++){const x=keys[j],y=keys[(j+1)%3];if(x===y)fail('A model contains collapsed edges.');const k=x<y?x+'|'+y:y+'|'+x;const e=edges.get(k)||[0,0,i/9];if(e[0])parents[root(i/9)]=root(e[2]);e[0]++;e[1]+=x<y?1:-1;edges.set(k,e);}
 }
 for(const [count,direction] of edges.values())if(count!==2||direction!==0)fail('A model has open or non-manifold edges. Repair it before requesting an automatic quote.');
 const components=new Map();for(let i=0;i<parents.length;i++){const id=root(i);components.set(id,(components.get(id)||0)+signed[i]);}
 const volumes=[...components.values()];if(volumes.some(v=>v>1e-6)&&volumes.some(v=>v< -1e-6))fail('A model contains inverted or nested shells and needs manual review before quoting.');
 const size=max.map((n,i)=>n-min[i]);
 if(size.some((n,i)=>n>buildVolume[i]||n<=0))fail('A model exceeds our configured printer size. Split or resize it before uploading.');
 volume=Math.abs(volume);if(volume<0.01||volume>size.reduce((a,b)=>a*b,1)*1.001)fail('A model has an invalid enclosed volume.');
 return {volumeCm3:volume/1000,surfaceCm2:area/100,sizeMm:size.map(n=>+n.toFixed(3)),triangles:vertices.length/9};
}

export function inspectPack(files,buildVolume) {
 let triangles=0;return quantities(files).map(({bytes,...item})=>{const mesh=inspectSTL(bytes,buildVolume);triangles+=mesh.triangles;if(triangles>LIMITS.triangles)fail('Split this detailed scene into smaller print packs.');return {...item,...mesh,sha256:createHash('sha256').update(bytes).digest('hex')};});
}

