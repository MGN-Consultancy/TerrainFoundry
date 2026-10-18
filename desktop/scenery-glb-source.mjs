import crypto from 'node:crypto';
const MAX_BYTES=100*1024*1024,MAX_TRIANGLES=Math.floor((MAX_BYTES-84)/50),IDENTITY=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const finite=(values,n)=>Array.isArray(values)&&values.length===n&&values.every(Number.isFinite);
function matrix(node){
  if(node.matrix!==undefined){if(!finite(node.matrix,16)||node.matrix[3]!==0||node.matrix[7]!==0||node.matrix[11]!==0||node.matrix[15]!==1)throw Error('Use finite affine GLB node transforms.');return node.matrix;}
  const t=node.translation||[0,0,0],q=node.rotation||[0,0,0,1],s=node.scale||[1,1,1];if(!finite(t,3)||!finite(q,4)||!finite(s,3)||Math.abs(Math.hypot(...q)-1)>.0001)throw Error('Invalid GLB transform.');
  const[x,y,z,w]=q,xx=2*x*x,yy=2*y*y,zz=2*z*z,xy=2*x*y,xz=2*x*z,yz=2*y*z,wx=2*w*x,wy=2*w*y,wz=2*w*z;
  return [(1-yy-zz)*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-xx-zz)*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-xx-yy)*s[2],0,...t,1];
}
const multiply=(a,b)=>Array.from({length:16},(_,i)=>{let n=0;for(let k=0;k<4;k++)n+=a[k*4+i%4]*b[Math.floor(i/4)*4+k];return n;});
const determinant=m=>m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
export function retainedGLBGeometry(input){
  if(!Buffer.isBuffer(input)||input.length<20||input.length>MAX_BYTES||input.toString('ascii',0,4)!=='glTF'||input.readUInt32LE(4)!==2||input.readUInt32LE(8)!==input.length)throw Error('Use a complete retained GLB under 100 MiB.');
  let json,bin;for(let at=12;at<input.length;){if(at+8>input.length)throw Error('Truncated GLB chunk.');const length=input.readUInt32LE(at),type=input.readUInt32LE(at+4);if(length%4||at+8+length>input.length)throw Error('Invalid GLB chunk bounds.');if(type===0x4e4f534a){if(json||length>4*1024*1024)throw Error('Invalid GLB JSON chunk.');json=JSON.parse(input.subarray(at+8,at+8+length).toString('utf8').trim());}else if(type===0x004e4942){if(bin)throw Error('Use one embedded GLB geometry buffer.');bin=input.subarray(at+8,at+8+length);}at+=8+length;}
  if(json?.asset?.version!=='2.0'||json.animations?.length)throw Error('Use static glTF 2.0 scenery without animations.');
  if(!json||!bin||!Array.isArray(json.buffers)||json.buffers.length!==1||json.buffers[0].uri||!Number.isInteger(json.buffers[0].byteLength)||json.buffers[0].byteLength>bin.length||json.images?.some(image=>image.uri))throw Error('Recovery uses embedded GLB resources only; external files are never fetched.');
  if(!Array.isArray(json.nodes)||json.nodes.length>64||!Array.isArray(json.meshes)||json.meshes.length>64)throw Error('GLB scene exceeds the bounded recovery layout.');
  function accessor(index,position){
    const a=json.accessors?.[index],v=json.bufferViews?.[a?.bufferView],components=position?3:1,bytes=position?4:({5121:1,5123:2,5125:4})[a?.componentType];
    if(!a||!v||v.buffer!==0||v.extensions?.EXT_meshopt_compression||a.sparse||a.normalized||a.type!==(position?'VEC3':'SCALAR')||(position&&a.componentType!==5126)||!bytes||!Number.isInteger(a.count)||a.count<1||a.count>MAX_TRIANGLES*3)throw Error('Unsupported GLB geometry accessor.');
    const offset=a.byteOffset||0,start=v.byteOffset||0,stride=v.byteStride||components*bytes,length=v.byteLength;
    if(![offset,start,stride,length].every(Number.isInteger)||Math.min(offset,start,length)<0||stride<components*bytes||stride>512||start+length>json.buffers[0].byteLength||offset+(a.count-1)*stride+components*bytes>length)throw Error('GLB accessor exceeds its embedded buffer bounds.');
    const read=(i,k=0)=>{const at=start+offset+i*stride+k*bytes;return position?bin.readFloatLE(at):bytes===4?bin.readUInt32LE(at):bytes===2?bin.readUInt16LE(at):bin.readUInt8(at);};return {count:a.count,read};
  }
  const scene=json.scenes?.[json.scene??0];if(!scene||!Array.isArray(scene.nodes))throw Error('Retained GLB has no default scene.');const primitives=[],visited=new Set(),transforms=[];let triangles=0;
  function visit(index,parent,ancestors){
    if(!Number.isInteger(index)||!json.nodes[index]||ancestors.has(index)||visited.has(index))throw Error('Invalid or repeated GLB scene node.');visited.add(index);const node=json.nodes[index];if(node.skin!==undefined||node.weights?.some(n=>n!==0))throw Error('Use static unskinned GLB scenery.');const world=multiply(parent,matrix(node)),det=determinant(world);if(!Number.isFinite(det)||Math.abs(det)<1e-15)throw Error('GLB transform has a collapsed dimension.');
    if(node.mesh!==undefined){const mesh=json.meshes[node.mesh];if(!mesh||!Array.isArray(mesh.primitives))throw Error('Invalid GLB mesh.');transforms.push({node:index,matrix:world});for(const primitive of mesh.primitives){if((primitive.mode??4)!==4||primitive.targets?.length||primitive.extensions?.KHR_draco_mesh_compression)throw Error('Use uncompressed static GLB triangles.');const positions=accessor(primitive.attributes?.POSITION,true),indices=primitive.indices===undefined?null:accessor(primitive.indices,false),count=indices?.count||positions.count;if(count%3)throw Error('GLB has incomplete triangle indices.');triangles+=count/3;if(triangles>MAX_TRIANGLES)throw Error('GLB exceeds the 100 MiB expanded source budget.');primitives.push({positions,indices,count,world,reverse:det<0});}}
    const next=new Set(ancestors);next.add(index);for(const child of node.children||[])visit(child,world,next);
  }
  for(const index of scene.nodes)visit(index,IDENTITY,new Set());if(!triangles)throw Error('GLB has no scenery triangles.');const vertexCount=primitives.reduce((n,p)=>n+p.positions.count,0);
  if(vertexCount>MAX_TRIANGLES*3)throw Error('GLB exceeds the bounded vertex budget.');
  const positions=new Float32Array(vertexCount*3),indices=new Uint32Array(triangles*3);let vertexOffset=0,indexOffset=0;
  for(const p of primitives){
    for(let i=0;i<p.positions.count;i++){
      const x=p.positions.read(i,0),y=p.positions.read(i,1),z=p.positions.read(i,2),m=p.world;
      const point=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
      if(point.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9))throw Error('GLB has invalid world coordinates.');
      positions.set(point,(vertexOffset+i)*3);
    }
    for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
      const corner=p.reverse&&j?3-j:j,index=p.indices?p.indices.read(i+corner):i+corner;
      if(index>=p.positions.count)throw Error('GLB triangle index exceeds its position accessor.');
      indices[indexOffset++]=vertexOffset+index;
    }
    vertexOffset+=p.positions.count;
  }
  return {positions,indices,metadata:{format:'retained-glb',sourceSHA256:crypto.createHash('sha256').update(input).digest('hex'),sourceUpAxis:'y',sourceUnits:'metres',nodeTransformsApplied:true,nodeTransforms:transforms,triangles,vertices:vertexCount,surfaceReconstruction:false,externalResourcesFetched:false}};
}
