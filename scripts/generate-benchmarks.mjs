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
 const step=kind==='wood'?.28:.48;
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

function weatheredWall(){
 const parts=[box(50.8,50.8,3.6,0,25.4,0,[.24,.235,.21])];
 let y=0,row=0;
 while(y<50.7){const height=Math.min(50.8-y,5+random()*3.2);let x=-25.4;
  while(x<25.3){let width=Math.min(25.4-x,6+random()*9);if(25.4-x-width<2)width=25.4-x;
   const gap=.35+random()*.18;const depth=6.6+random()*2;
   parts.push(sculpt(width-gap,height-.28,depth,'stone',row*3+x).translate([x+width/2,y+height/2,0]));x+=width;
  }y+=height;row++;
 }
 let solid=M.union(parts);
 // Deliberate missing corner chips, cut through individual exposed stone edges.
 const chips=[];for(let i=0;i<22;i++){const x=-23+random()*46,y=2+random()*46,z=(i%2?1:-1)*(3.7+random()*.5);chips.push(M.sphere(.45+random()*.65,8).scale([1.6,.6,1]).translate([x,y,z]));}
 solid=solid.subtract(M.union(chips));const chunks=solid.decompose().sort((a,b)=>b.volume()-a.volume());const debris=chunks.slice(1).reduce((n,c)=>n+c.volume(),0);if(debris>1)throw Error('Chip debris exceeded one cubic millimetre');console.log('Removed loose chip debris:',debris);return chunks[0];
}
function timberWindow(){
 const wood=[.28,.14,.055],iron=[.075,.085,.09];
 let panel=sculpt(48.8,48.8,3.8,'plaster').translate([0,25.4,0]);
 panel=panel.subtract(M.cube([22,26,20],true).translate([0,30,0]));
 const parts=[panel];
 const beam=(w,h,d,x,y,z=0,angle=0)=>sculpt(w,h,d,'wood',x+y).rotate([0,0,angle]).translate([x,y,z]);
 // Structural frame, carved grain, two splayed braces and pegged joints.
 parts.push(beam(5,50.8,7,-22.9,25.4),beam(5,50.8,7,22.9,25.4));
 parts.push(beam(4.5,50.8,7,0,2.3,0,90),beam(4.5,50.8,7,0,48.5,0,90));
 parts.push(beam(3.4,20,6,-16,13,0,-34),beam(3.4,20,6,16,13,0,34));
 // Recessed opening with a projecting sill, lintel and fine mullions.
 parts.push(beam(3,29,7,-12,30),beam(3,29,7,12,30));
 parts.push(beam(3.4,29,8,0,44,0,90),beam(4,31,11,0,16,1,90));
 parts.push(beam(1.8,26,4,0,30),beam(1.8,22,4,0,30,0,90));
 // Open shutters retain separate planks, scored grain and iron straps.
 for(const side of [-1,1]){
  for(let i=0;i<3;i++)parts.push(beam(2.15,23,2.2,side*(15+i*2.1),30,3.35));
  for(const yy of [22,38]){parts.push(box(7,1.35,1,side*17,yy,4.75,iron));for(const dx of [-2.5,2.5])parts.push(paint(M.sphere(.55,10).scale([1,1,.5]).translate([side*17+dx,yy,5.25]),iron));}
 }
 for(const x of [-22.9,22.9])for(const y of [3,47])parts.push(paint(M.cylinder(.7,.7,.7,12,true).rotate([90,0,0]).translate([x,y,3.55]),wood));
 return M.union(parts);
}

const assets={};
for(const [id,name,build]of [['b-weathered-wall','Weathered rubble wall',weatheredWall],['b-timber-window','Carved timber window',timberWindow]]){
 console.log('Sculpting',name);seed=9047;let s=build();s=s.translate([0,-s.boundingBox().min[1],0]);
 const components=s.decompose().length;if(s.status()!=='NoError'||components!==1)throw Error(id+' invalid or disconnected: '+components);
 const mesh=s.getMesh(),positions=[],colors=[];for(let i=0;i<mesh.vertProperties.length;i+=mesh.numProp){positions.push(...mesh.vertProperties.slice(i,i+3));colors.push(...mesh.vertProperties.slice(i+3,i+6));}
 const welded=[],wcolors=[],lookup=new Map(),remap=[];
 for(let i=0;i<positions.length;i+=3){const p=positions.slice(i,i+3).map(n=>Math.round(n*10000)/10000),key=p.join(',');let vi=lookup.get(key);if(vi===undefined){vi=welded.length/3;lookup.set(key,vi);welded.push(...p);wcolors.push(...colors.slice(i,i+3));}remap.push(vi);}
 const indices=[];for(let i=0;i<mesh.triVerts.length;i+=3){const tri=Array.from(mesh.triVerts.slice(i,i+3),j=>remap[j]);if(new Set(tri).size===3)indices.push(...tri);}
 const faces=new Map();for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),key=[...tri].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,tri);}
 const cleanIndices=[...faces.values()].flat();
 assets[id]={name,category:'Walls',positions:welded,colors:wcolors,indices:cleanIndices,volume:s.volume()};console.log(id,cleanIndices.length/3,'triangles',s.volume(),'mm3');
}
await fs.mkdir('src/generated',{recursive:true});await fs.writeFile('src/generated/benchmarks.json',JSON.stringify(assets));
await fs.writeFile('src/benchmark-kit.js','export const BENCHMARK_KIT = '+JSON.stringify(Object.entries(assets).map(([id,a])=>({id,name:a.name,category:'Walls',icon:'',hint:'Detail study · review candidate'})),null,2)+';\n');





