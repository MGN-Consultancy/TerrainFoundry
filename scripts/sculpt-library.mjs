import Module from 'manifold-3d';
import * as THREE from 'three';
import fs from 'node:fs/promises';

const wasm=await Module();wasm.setup();const {Manifold:M,Mesh}=wasm;
let seed=9047;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,z)=>{let n=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
const noise=(x,y,z)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=t=>t*t*(3-2*t),a=smooth(x-ix),b=smooth(y-iy),c=smooth(z-iz);let sum=0;for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++)sum+=hash(ix+i,iy+j,iz+k)*(i?a:1-a)*(j?b:1-b)*(k?c:1-c);return sum*2-1;};
const paint=(s,c)=>s.setProperties(3,(p)=>c.forEach((v,i)=>p[i]=v));
const box=(w,h,d,x,y,z,c)=>paint(M.cube([w,h,d],true).translate([x,y,z]),c);

// Sculpt in object space before assembly. Shared boundary vertices use the same
// position function on all faces so the high-resolution surfaces remain closed.
function sculpt(w,h,d,kind,offset=0){
 const step=kind==='wood'?.5:.85;
 const geo=new THREE.BoxGeometry(w,h,d,Math.ceil(w/step),Math.ceil(h/step),Math.ceil(d/step));
 const p=geo.attributes.position;const half=[w/2,h/2,d/2];const bevel=kind==='wood'?.32:Math.min(.42,h*.12);
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
  pos=pos.map((a,j)=>a+norm[j]*depth);
  const key=pos.map(a=>Math.round(a*1e5)).join(',');let id=map.get(key);
  if(id===undefined){id=props.length/6;map.set(key,id);const c=kind==='wood'?[.31,.16,.065]:kind==='stone'?[.48,.45,.38]:[.78,.71,.56];props.push(...pos,...c.map(a=>a*shade*tone));}remap.push(id);
 }
 for(const i of geo.index.array)indices.push(remap[i]);geo.dispose();
 const result=new M(new Mesh({numProp:6,vertProperties:new Float32Array(props),triVerts:new Uint32Array(indices)}));
 if(result.status()!=='NoError')throw Error('Invalid sculpt '+kind+': '+result.status());return result;
}


export {wasm,M,sculpt,paint,box,noise,random};
