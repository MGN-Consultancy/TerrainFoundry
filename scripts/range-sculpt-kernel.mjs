import * as THREE from 'three';
import {wasm,M,noise,paint,box,random} from './sculpt-library.mjs';
const {Mesh}=wasm;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function sculpt(w,h,d,kind,offset=0){
 const step=kind==='wood'?.5:.85;
 const geo=new THREE.BoxGeometry(w,h,d,Math.ceil(w/step),Math.ceil(h/step),Math.ceil(d/step));
 const p=geo.attributes.position;const half=[w/2,h/2,d/2];const bevel=Math.min(kind==='wood'?.32:.42,w*.12,h*.12,d*.12);
 const map=new Map(),props=[],indices=[],remap=[];const shade=.78+random()*.35;
 for(let i=0;i<p.count;i++){
  const v=[p.getX(i),p.getY(i),p.getZ(i)],q=v.map((a,j)=>clamp(a,-half[j]+bevel,half[j]-bevel));
  let norm=v.map((a,j)=>a-q[j]);const len=Math.hypot(...norm);norm=norm.map(a=>a/len);
  let pos=q.map((a,j)=>a+norm[j]*bevel),depth=0,tone=1;
  if(kind==='stone'){
   const [x,y,z]=pos;const n=noise(x*.65+offset,y*.85,z*.5);
   // Layered fracture faces, a shallow chipped seam, and small surface pits.
   const seam=Math.exp(-Math.pow((y-.22*x-Math.sin(x*.55+offset)*.38)/.23,2));
   const strata=clamp(noise(x*.3+offset,y*2,z*.2),0,1);
   depth=.12*n+.035*noise(x*3+offset,y*3,z*3)-.18*seam-.06*strata-.12*Math.abs(x*.3+y*.6+Math.sin(offset)*1.3);
   tone=.85+.12*n-.12*seam;
  }else if(kind==='wood'){
   const [x,y,z]=pos;
   const knotY=-h*.16,knotX=w*.08;
   const knot=Math.exp(-Math.pow((y-knotY)/(h*.19+1),2));
   const warp=1.5*knot*Math.tanh((x-knotX)*2);
   const phase=x*7.5+Math.sin(y*.31+offset)*.35+warp;
   const groove=Math.pow(.5+.5*Math.sin(phase),14);
   const split=Math.exp(-Math.pow((x-w*.22-Math.sin(y*.4)*.12)/.12,2))*clamp((y+h*.1)/(h*.6),0,1);
   const onFace=Math.pow(Math.abs(norm[2]),3);
   depth=(-.38*groove-.32*split+.045*noise(x*7,y*2,z))*onFace;
   tone=.86-.22*groove-.12*split;
  }else{
   depth=.1*noise(pos[0]*3,pos[1]*3,pos[2]);tone=.95+.045*noise(pos[0],pos[1],pos[2]);
  }
  depth=clamp(depth,-bevel*.65,bevel*.3);
  pos=pos.map((a,j)=>a+norm[j]*depth);
  const key=pos.map(a=>Math.round(a*1e5)).join(',');let id=map.get(key);
  if(id===undefined){id=props.length/6;map.set(key,id);const c=kind==='wood'?[.31,.16,.065]:kind==='stone'?[.48,.45,.38]:[.78,.71,.56];props.push(...pos,...c.map(a=>a*shade*tone));}remap.push(id);
 }
 for(const i of geo.index.array)indices.push(remap[i]);geo.dispose();
 const result=new M(new Mesh({numProp:6,vertProperties:new Float32Array(props),triVerts:new Uint32Array(indices)}));
 if(result.status()!=='NoError')throw Error('Invalid sculpt '+kind+': '+result.status());return result;
}
export {M,sculpt,paint,box,noise};
