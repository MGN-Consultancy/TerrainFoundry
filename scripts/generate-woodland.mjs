import fs from 'node:fs/promises';
import * as THREE from 'three';
import {wasm,M,noise} from './sculpt-library.mjs';
import {solidData,connectAsset} from '../src/openlock-build.js';
import {cleanMeshData} from './clean-mesh-data.mjs';

const brown=[.30,.16,.07],green=[.19,.34,.065];
function limb(a,b,r1,r2,color=brown,seed=0){
 const d=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize());
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...a),q,new THREE.Vector3(1,1,1));
 return M.cylinder(d.length(),r1,r2,24,false).refineToLength(.75).warp(p=>{
  const angle=Math.atan2(p[1],p[0]),ridge=1+.065*Math.sin(angle*11+p[2]*.12)+.025*noise(p[0],p[1],p[2]);p[0]*=ridge;p[1]*=ridge;
  const v=new THREE.Vector3(...p).applyMatrix4(matrix);p[0]=v.x;p[1]=v.y;p[2]=v.z;
 }).setProperties(3,(c,p)=>{const n=.86+.24*noise(p[0]*1.2+seed,p[1]*.5,p[2]*1.2);color.forEach((v,i)=>c[i]=v*n);if(color[0]>.6&&Math.sin(p[1]*2+noise(p[0],0,p[2])*4)>.78)c.fill(.13);});
}
function crown(x,y,z,r,color,seed){
 return M.sphere(1,32).refineToLength(.12).warp(p=>{const n=1+.09*noise(p[0]*7+seed,p[1]*7,p[2]*7)+.045*noise(p[0]*22,p[1]*22+seed,p[2]*22);p[0]*=r*n;p[1]*=r*.82*n;p[2]*=r*n;}).translate([x,y,z]).setProperties(3,(c,p)=>{const shade=.8+.32*noise(p[0]*.7+seed,p[1]*.7,p[2]*.7);color.forEach((v,i)=>c[i]=v*shade);});
}
function tree(kind){
 const parts=[],birch=kind==='birch',dead=kind==='dead',stump=kind==='stump',pine=kind==='pine',height=stump?12:birch?61:pine?67:dead?48:51;
 const bark=birch?[.76,.72,.61]:brown;
 parts.push(limb([0,0,0],[1,height,0],stump?6:4.2,stump?4.8:1.5,bark));
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=stump?11:9;parts.push(limb([0,3,0],[Math.cos(a)*r,.9,Math.sin(a)*r],2.8,1.05,bark,i));}
 if(pine){
  for(let tier=0;tier<5;tier++){const y=19+tier*9,r=17-tier*2.6;
   const cone=M.cylinder(20,r,1.2,48,false).refineToLength(.8).warp(p=>{const a=Math.atan2(p[1],p[0]),s=1+.055*Math.sin(a*17+p[2]*.45)+.025*noise(p[0],p[1],p[2]);p[0]*=s;p[1]*=s;}).rotate([-90,0,0]).translate([.4,y,0]).setProperties(3,(c,p)=>{const s=.82+.25*noise(p[0],p[1]*.7,p[2]);[.095,.25,.13].forEach((v,i)=>c[i]=v*s);});parts.push(cone);
  }
 }else if(!stump){
  const foliage=kind==='autumn'?[.65,.27,.045]:birch?[.35,.46,.10]:green;
  for(let i=0;i<7;i++){const a=i*2.399,r=birch?9:14,y=height*(.49+i*.052),end=[Math.cos(a)*r,y+9,Math.sin(a)*r];
   parts.push(limb([.5,y-7,0],end,2.6,dead?1.15:1.6,bark,i));
   if(dead)parts.push(limb([end[0]*.7,y+4,end[2]*.7],[end[0]*1.08,y+17,end[2]*1.08],1.6,.9,bark));
   else parts.push(crown(...end,birch?8.7:12,foliage,i));
  }
  if(!dead)parts.push(crown(1,height,0,birch?9:12,foliage,11));
 }
 let solid=M.union(parts);const clip=M.cube([200,200,200],true).translate([0,100,0]);solid=solid.intersect(clip);clip.delete();
 if(stump){const rings=M.cylinder(.65,4.1,4.1,48,false).rotate([-90,0,0]).translate([1,11.5,0]).setProperties(3,(c,p)=>{const r=Math.hypot(p[0]-1,p[2]),s=.78+.2*Math.sin(r*7);[.61,.40,.20].forEach((v,i)=>c[i]=v*s);});solid=M.union([solid,rings]);}
 const shells=solid.decompose(); if(shells.length>1&&shells.filter(s=>s.volume()>0).length===1&&shells.every(s=>s.volume()>0||Math.abs(s.volume())<1))solid=shells.find(s=>s.volume()>0);
 if(solid.status()!=='NoError'||solid.decompose().length!==1)throw Error(kind+' invalid solid '+solid.status()+' '+solid.decompose().map(s=>s.volume()).join(','));return solid;
}
const specs=[['oak','Broad oak'],['birch','Silver birch'],['pine','Woodland pine'],['autumn','Autumn oak'],['dead','Weathered dead tree'],['stump','Old tree stump']];
const raw={},connected=JSON.parse(await fs.readFile('src/generated/openlock.json','utf8'));
for(const [kind,name]of specs){const id='w-'+kind,solid=tree(kind),data=cleanMeshData(solidData(solid));raw[id]={name,category:'Props',...data,volume:solid.volume()};const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geo.setIndex(data.indices);connected[id]=cleanMeshData(connectAsset(wasm,geo,'Props',id));geo.dispose();solid.delete();console.log(id,data.indices.length/3);}
await fs.writeFile('src/generated/woodland.json',JSON.stringify(raw));
await fs.writeFile('src/generated/openlock.json',JSON.stringify(connected));
await fs.writeFile('src/woodland-kit.js','export const WOODLAND_KIT = '+JSON.stringify(specs.map(([kind,name])=>({id:'w-'+kind,name,category:'Props',icon:'',hint:'Woodland / sculpted bark and foliage / place directly on grass'})),null,2)+';\n');



