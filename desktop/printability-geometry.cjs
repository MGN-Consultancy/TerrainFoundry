const crypto=require('node:crypto');
const MAX_INPUT_BYTES=100*1024*1024,MAX_TRIANGLES=2000000,MAX_GLB_BYTES=100000000;
const NUMBER='([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
const FACET=new RegExp('\\s*facet\\s+normal\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+outer\\s+loop\\s+vertex\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+vertex\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+vertex\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+'+NUMBER+'\\s+endloop\\s+endfacet\\s*','iy');
const OPEN=/\s*solid(?:[ \t]+[^\r\n]*)?(?:\r?\n|$)/iy,CLOSE=/\s*endsolid(?:[ \t]+[^\r\n]*)?(?:\r?\n|$)/iy;

function asciiFacets(text,visit){
 let at=0,count=0,solids=0;
 while(at<text.length){
  if(!text.slice(at).trim())break;
  OPEN.lastIndex=at;const opening=OPEN.exec(text);if(!opening)throw Error('Invalid ASCII STL solid header.');at=OPEN.lastIndex;solids++;
  for(;;){
   CLOSE.lastIndex=at;if(CLOSE.exec(text)){at=CLOSE.lastIndex;break;}
   FACET.lastIndex=at;const facet=FACET.exec(text);if(!facet)throw Error('Invalid ASCII STL: each facet must have a finite normal and exactly three vertices.');at=FACET.lastIndex;
   count++;if(count>MAX_TRIANGLES)throw Error('STL exceeds the two-million-triangle upload limit.');
   for(let i=1;i<=12;i++)if(!Number.isFinite(Number(facet[i])))throw Error('STL contains non-finite coordinates or normals.');
   if(visit)visit(facet,count-1);
  }
 }
 if(!solids||!count)throw Error('STL has no triangles.');return count;
}

function stlToPrintGLB(value,{sourceUpAxis='z'}={}){
 if(!['z','y'].includes(sourceUpAxis))throw Error('Choose Z-up or Y-up for the STL source.');
 let source;if(Buffer.isBuffer(value))source=value;else if(value instanceof Uint8Array)source=Buffer.from(value.buffer,value.byteOffset,value.byteLength);else if(value instanceof ArrayBuffer)source=Buffer.from(value);else throw Error('STL geometry must be bytes.');
 if(!source.length||source.length>MAX_INPUT_BYTES)throw Error('STL input must be nonempty and no larger than 100 MiB.');
 let binary=false,count=0,text;
 if(source.length>=84){const declared=source.readUInt32LE(80);if(source.length===84+declared*50){if(declared>MAX_TRIANGLES)throw Error('STL exceeds the two-million-triangle upload limit.');if(!declared)throw Error('STL has no triangles.');binary=true;count=declared;}}
 if(!binary){
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(source);}catch{throw Error('STL is truncated, malformed, or not supported ASCII/binary geometry.');}
  count=asciiFacets(text);
 }
 const binLength=count*36;if(binLength+4096>MAX_GLB_BYTES)throw Error('Converted GLB exceeds the 100 MB Meshy upload limit.');
 const positions=Buffer.allocUnsafe(binLength),minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],gltfMinimum=[Infinity,Infinity,Infinity],gltfMaximum=[-Infinity,-Infinity,-Infinity];
 let positionOffset=0;
 function vertex(x,y,z){
  const native=[x,y,z];for(let axis=0;axis<3;axis++){if(!Number.isFinite(native[axis]))throw Error('STL contains non-finite coordinates.');minimum[axis]=Math.min(minimum[axis],native[axis]);maximum[axis]=Math.max(maximum[axis],native[axis]);}
  const transformed=sourceUpAxis==='z'?[x,z,-y]:native;
  for(let axis=0;axis<3;axis++){const meters=Math.fround(transformed[axis]/1000);if(!Number.isFinite(meters))throw Error('STL coordinates cannot be represented safely in GLB.');positions.writeFloatLE(meters,positionOffset);positionOffset+=4;gltfMinimum[axis]=Math.min(gltfMinimum[axis],meters);gltfMaximum[axis]=Math.max(gltfMaximum[axis],meters);}
 }
 if(binary){
  for(let triangle=0;triangle<count;triangle++){const start=84+triangle*50;for(let normal=0;normal<3;normal++)if(!Number.isFinite(source.readFloatLE(start+normal*4)))throw Error('STL contains non-finite normals.');for(let index=0;index<3;index++){const at=start+12+index*12;vertex(source.readFloatLE(at),source.readFloatLE(at+4),source.readFloatLE(at+8));}}
 }else asciiFacets(text,facet=>{for(let index=0;index<3;index++){const first=4+index*3;vertex(Number(facet[first]),Number(facet[first+1]),Number(facet[first+2]));}});
 const sizeMm=maximum.map((max,index)=>max-minimum[index]),longestMm=Math.max(...sizeMm),heightMm=sizeMm[sourceUpAxis==='z'?2:1];if(!Number.isFinite(longestMm)||longestMm<=0||gltfMinimum.every((min,index)=>min===gltfMaximum[index]))throw Error('STL has no measurable geometry.');
 const document={asset:{version:'2.0',generator:'Terrain Foundry printability upload'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],buffers:[{byteLength:binLength}],bufferViews:[{buffer:0,byteOffset:0,byteLength:binLength,target:34962}],accessors:[{bufferView:0,byteOffset:0,componentType:5126,count:count*3,type:'VEC3',min:gltfMinimum,max:gltfMaximum}]};
 const json=Buffer.from(JSON.stringify(document)),jsonLength=(json.length+3)&~3,total=12+8+jsonLength+8+binLength;if(total>MAX_GLB_BYTES)throw Error('Converted GLB exceeds the 100 MB Meshy upload limit.');
 const bytes=Buffer.allocUnsafe(total);bytes.write('glTF',0,4,'ascii');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(total,8);bytes.writeUInt32LE(jsonLength,12);bytes.write('JSON',16,4,'ascii');bytes.fill(0x20,20,20+jsonLength);json.copy(bytes,20);const binHeader=20+jsonLength;bytes.writeUInt32LE(binLength,binHeader);bytes.write('BIN\0',binHeader+4,4,'ascii');positions.copy(bytes,binHeader+8);
 return {bytes,modelUrl:'data:model/gltf-binary;base64,'+bytes.toString('base64'),sizeMm,heightMm,longestMm,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex')};
}
async function glbToSTL(value){
 let source;if(Buffer.isBuffer(value))source=value;else if(value instanceof Uint8Array)source=Buffer.from(value.buffer,value.byteOffset,value.byteLength);else if(value instanceof ArrayBuffer)source=Buffer.from(value);else throw Error('GLB geometry must be bytes.');
 if(!source.length||source.length>MAX_INPUT_BYTES)throw Error('GLB input must be nonempty and no larger than 100 MiB.');
 const {retainedGLBGeometry}=await import('./scenery-glb-source.mjs'),geometry=retainedGLBGeometry(source),{positions,indices}=geometry,count=indices.length/3;
 if(!Number.isInteger(count)||count<1||count>MAX_TRIANGLES||84+count*50>MAX_INPUT_BYTES)throw Error('Repaired GLB exceeds the bounded STL triangle limit.');
 const bytes=Buffer.alloc(84+count*50),minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],corners=new Float64Array(9);bytes.write('Terrain Foundry Meshy printability repair (millimeters; Y-up)');bytes.writeUInt32LE(count,80);
 for(let triangle=0;triangle<count;triangle++){
  const at=84+triangle*50;
  for(let corner=0;corner<3;corner++){const index=indices[triangle*3+corner];for(let axis=0;axis<3;axis++){const mm=Math.fround(positions[index*3+axis]*1000);if(!Number.isFinite(mm))throw Error('Repaired GLB coordinates cannot be represented safely in STL millimeters.');corners[corner*3+axis]=mm;bytes.writeFloatLE(mm,at+12+corner*12+axis*4);minimum[axis]=Math.min(minimum[axis],mm);maximum[axis]=Math.max(maximum[axis],mm);}}
  const ax=corners[3]-corners[0],ay=corners[4]-corners[1],az=corners[5]-corners[2],bx=corners[6]-corners[0],by=corners[7]-corners[1],bz=corners[8]-corners[2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,length=Math.hypot(nx,ny,nz);bytes.writeFloatLE(length?nx/length:0,at);bytes.writeFloatLE(length?ny/length:0,at+4);bytes.writeFloatLE(length?nz/length:0,at+8);
 }
 const sizeMm=maximum.map((max,index)=>max-minimum[index]),longestMm=Math.max(...sizeMm);if(!Number.isFinite(longestMm)||longestMm<=0)throw Error('Repaired GLB has no measurable geometry.');
 return {bytes,sourceUpAxis:'y',sizeMm,heightMm:sizeMm[1],longestMm,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex')};
}
module.exports={stlToPrintGLB,glbToSTL};
