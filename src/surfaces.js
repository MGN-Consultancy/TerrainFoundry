import * as THREE from 'three';
import {materialProfile} from './material-profiles.js';
const clamp=(v)=>Math.max(0,Math.min(1,v));
export function stoneField(u,v,scale=25.4){const h=scale/4,w=scale/2;const row=Math.floor(v/h),xx=u+(row%2)*w*.5;const col=Math.floor(xx/w);const fx=xx/w-Math.floor(xx/w),fy=v/h-row;const edge=Math.min(fx*w,(1-fx)*w,fy*h,(1-fy)*h);const grain=Math.sin(u*3.7+v*5.3)*Math.sin(u*9.1-v*4.7);return{relief:clamp((edge-.22)/.6)*(.65+.08*grain),tone:.65+.2*(.5+.5*Math.sin(col*71.3+row*39.7)),grout:clamp(edge/.65)};}
export function finishGeometry(geo,type,g){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;const colors=[];const wood=type==='crate';const tint=new THREE.Color();for(let i=0;i<p.count;i++){let u,v;if(Math.abs(n.getY(i))>.7){u=p.getX(i);v=p.getZ(i);}else if(Math.abs(n.getX(i))>.7){u=p.getZ(i);v=p.getY(i);}else{u=p.getX(i);v=p.getY(i);}uv?.setXY(i,u/g,v/g);const s=stoneField(u,v,g);const shade=wood?.8+.13*Math.sin(u*1.3+Math.sin(v*.25)):(type==='boulder'?.72+.15*Math.sin(u*.7+v*1.1):s.tone*(.65+.35*s.grout));tint.setRGB(shade*(wood?1:.99),shade*(wood?.73:1),shade*(wood?.43:.94));colors.push(tint.r,tint.g,tint.b);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geo;}

// Every built-in collection uses a material-appropriate albedo, bump and
// roughness finish. Geometry colours still distinguish stone, foliage and metal
// within a mixed-material sculpt. These maps are offline and deterministic.
const textureCache=new Map();
function textureSet(profile){
 if(textureCache.has(profile))return textureCache.get(profile);
 const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),albedo=ctx.createImageData(size,size),height=ctx.createImageData(size,size),rough=ctx.createImageData(size,size);
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (hash(a,b)*(1-s)+hash(a+1,b)*s)*(1-t)+(hash(a,b+1)*(1-s)+hash(a+1,b+1)*s)*t;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*25.4,v=y/size*25.4,n=noise(u*.6,v*.6),micro=hash(x,y),broad=noise(u*.16,v*.16);let relief=n*.55+micro*.18,tone=.87+broad*.10,roughness=.89;
  if(profile==='grass'){const blade=Math.pow(.5+.5*Math.sin(u*16+Math.sin(v*2.3)*3),16)*(.35+.65*noise(u*2,v*2));relief=.23+n*.28+blade*.5;tone=.77+broad*.18+blade*.14;}
  else if(profile==='rock'){const seam=Math.pow(.5+.5*Math.sin(v*2+u*.21+noise(u*.18,v*.2)*4),18);relief=.3+broad*.12+n*.30+micro*.18-seam*.045;tone=.86+broad*.10-seam*.025;}
  else if(profile==='wood'){const grain=Math.pow(.5+.5*Math.sin(u*10+noise(u*.18,v*.12)*5),9);relief=.28+n*.2+grain*.34;tone=.81+n*.1+grain*.12;roughness=.79;}
  else if(profile==='metal'){relief=.4+micro*.12+Math.pow(noise(u*3,v*3),7)*.2;tone=.83+n*.12;roughness=.59+micro*.13;}
  else if(profile==='sand'){relief=.45+.12*Math.sin(u*4+Math.sin(v*.3)*2)+micro*.17;tone=.87+n*.08;}
  else if(profile==='foliage'){relief=.35+Math.pow(noise(u*3,v*3),3)*.5;tone=.85+n*.12;}
  else if(profile==='river'){relief=.45+.11*Math.sin(u*5+v*3)+micro*.07;tone=.9+n*.07;}
  else{const pores=Math.pow(noise(u*3,v*3),9);relief=.35+n*.24-pores*.35;tone=.87+broad*.08-pores*.1;}
  const i=(y*size+x)*4;for(let c=0;c<3;c++){albedo.data[i+c]=Math.round(clamp(tone)*255);height.data[i+c]=Math.round(clamp(relief)*255);rough.data[i+c]=Math.round(clamp(roughness)*255);}albedo.data[i+3]=height.data[i+3]=rough.data[i+3]=255;
 }
 const make=(data,color=false)=>{const c=canvas.cloneNode();c.getContext('2d').putImageData(data,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;};
 const set={map:make(albedo,true),bumpMap:make(height),roughnessMap:make(rough)};textureCache.set(profile,set);return set;
}
export function terrainMaterial(type,color='#ffffff'){
 const profile=materialProfile(type);if(profile==='imported')return new THREE.MeshStandardMaterial({color,vertexColors:true,roughness:.94});
 return new THREE.MeshStandardMaterial({color,...textureSet(profile),bumpScale:profile==='grass'?.34:profile==='rock'?.30:profile==='wood'?.22:.14,vertexColors:true,roughness:1,metalness:profile==='metal'?.22:0});
}

