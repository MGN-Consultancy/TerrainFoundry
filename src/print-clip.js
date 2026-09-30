import {CLIP_BASE64,CLIP_NOTICE,CLIP_LICENSE,SOCKET_NOTICE} from './generated-clip.js';
export function clipFiles(){
 const data=Uint8Array.from(atob(CLIP_BASE64),c=>c.charCodeAt(0));
 const view=new DataView(data.buffer),count=view.getUint32(80,true);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let t=0;t<count;t++)for(let v=0;v<3;v++)for(let a=0;a<3;a++){
  const n=view.getFloat32(84+t*50+12+v*12+a*4,true);min[a]=Math.min(min[a],n);max[a]=Math.max(max[a],n);
 }
 const offset=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]];
 for(let t=0;t<count;t++)for(let v=0;v<3;v++)for(let a=0;a<3;a++){
  const i=84+t*50+12+v*12+a*4;view.setFloat32(i,view.getFloat32(i,true)-offset[a],true);
 }
 return {size:max.map((n,a)=>n-min[a]),files:[{name:'openlock-clip.stl',data},{name:'OPENLOCK-CLIP-NOTICE.txt',data:CLIP_NOTICE},{name:'OPENLOCK-SOCKET-NOTICE.txt',data:SOCKET_NOTICE},{name:'OPENLOCK-CLIP-LICENSE.txt',data:CLIP_LICENSE}]};
}
