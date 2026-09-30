import {cleanMeshData} from './clean-mesh-data.mjs';
import fs from 'node:fs/promises';
import Module from 'manifold-3d';
import {solidData} from '../src/openlock-build.js';
import {connectAsset} from '../src/openlock-build.js';
import * as THREE from 'three';
const wasm=await Module();wasm.setup();const M=wasm.Manifold,G=25.4;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7+17.13)*43758.5453;return n-Math.floor(n);};
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
const mix=(a,b,t)=>a.map((n,i)=>n*(1-t)+b[i]*t);
const paint=(s,c)=>s.setProperties(3,p=>{for(let i=0;i<3;i++)p[i]=c[i];});
const box=(w,h,d,x,y,z,c)=>paint(M.cube([w,h,d],true).translate([x,y,z]),c);
const green=[.19,.30,.075],soil=[.27,.18,.09],sand=[.69,.49,.24],water=[.08,.37,.43],stone=[.44,.42,.36],wood=[.32,.17,.065];

// Shared vertices and a closed underside: every surface detail below is real mesh relief.
function surface(w,d,nx,nz,top,color,bottom=null){
 const values=[],indices=[],topCount=(nx+1)*(nz+1);
 const add=(x,y,z,c)=>{values.push(x,y,z,...c);return values.length/6-1;};
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const xx=(x/nx-.5)*w,zz=(z/nz-.5)*d;add(xx,top(xx,zz),zz,color(xx,zz));}
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+1,c=a+nx+1,e=c+1;indices.push(a,c,b,b,c,e);}
 const rim=[];for(let x=0;x<=nx;x++)rim.push(x);for(let z=1;z<=nz;z++)rim.push(z*(nx+1)+nx);for(let x=nx-1;x>=0;x--)rim.push(nz*(nx+1)+x);for(let z=nz-1;z>0;z--)rim.push(z*(nx+1));
 const lows=new Map();
 if(bottom){for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const xx=(x/nx-.5)*w,zz=(z/nz-.5)*d;add(xx,bottom(xx,zz),zz,color(xx,zz));}
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=topCount+z*(nx+1)+x,b=a+1,c=a+nx+1,e=c+1;indices.push(a,b,c,b,e,c);}for(const i of rim)lows.set(i,i+topCount);
 }else{const centre=add(0,0,0,soil);for(const i of rim)lows.set(i,add(values[i*6],0,values[i*6+2],soil));for(let i=0;i<rim.length;i++)indices.push(centre,lows.get(rim[i]),lows.get(rim[(i+1)%rim.length]));}
 for(let k=0;k<rim.length;k++){const a=rim[k],b=rim[(k+1)%rim.length],c=lows.get(a),d=lows.get(b);indices.push(a,b,c,b,d,c);}
 const s=new M(new wasm.Mesh({numProp:6,vertProperties:new Float32Array(values),triVerts:new Uint32Array(indices)}));if(s.status()!=='NoError')throw Error('Surface: '+s.status());return s;
}
function riverDistance(kind,x,z){
 if(kind==='bend')return Math.abs(Math.hypot(x+G,z+G)-G);
 if(kind==='junction')return Math.min(Math.abs(x),Math.hypot(Math.max(x,0),z));
 if(kind==='end')return Math.hypot(x,Math.max(z,0));
 return Math.abs(x);
}
function cracks(x,z){const s=7,a=Math.floor(x/s),b=Math.floor(z/s),dist=[];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const xx=a+i,zz=b+j;dist.push(Math.hypot(x/s-xx-.15-.7*hash(xx,zz),z/s-zz-.15-.7*hash(xx+9,zz+3)));}dist.sort((a,b)=>a-b);return 1-smooth(.015,.085,dist[1]-dist[0]);}
function ground(kind,river=null){
 const desert=kind.startsWith('desert')||kind.startsWith('oasis');
 const biome=(x,z)=>kind==='transition'?smooth(-12,12,x):kind==='river-transition'?smooth(-12,12,z):desert?1:0;
 const wet=(x,z)=>kind.startsWith('oasis')?Math.max(1-smooth(12,16,Math.hypot(x,z)),kind==='oasis-inlet'?1-smooth(8,11,Math.hypot(x,Math.min(z,0))):0):river?1-smooth(8,11,riverDistance(river,x,z)):0;
 const trail=(x,z)=>kind==='path'?1-smooth(5.5,9,Math.abs(x)):kind==='path-turn'?1-smooth(5.5,9,Math.abs(Math.hypot(x+G,z+G)-G)):0;
 function top(x,z){const edge=smooth(0,4,Math.min(G-Math.abs(x),G-Math.abs(z))),n=noise(x*.19,z*.19),grass=.35*n+.65*Math.pow(noise(x*.48,z*.48),3)+.52*Math.pow(.5+.5*Math.sin(x*4.3+Math.sin(z*1.7)*2),8)+.34*Math.pow(.5+.5*Math.sin(z*4.8+x*.7),10);
  const ripple=.22*Math.sin(x*2.1+1.4*Math.sin(z*.16))+.16*n;
  let relief=mix([grass],[ripple],biome(x,z))[0]*(1-trail(x,z))+.05*trail(x,z);
  if(kind==='desert-dunes')relief+=4.6*Math.pow(.5+.5*Math.sin(x*.13+z*.045),3);
  if(kind==='desert-cracked')relief=.18*n-.35*cracks(x,z);
  const w=wet(x,z);return (8+edge*relief)*(1-w)+(7.4+edge*.09*Math.sin(z*2+x*.4))*w;
 }
 function color(x,z){const n=noise(x*.25,z*.25),g=mix([.10,.23,.045],[.36,.43,.10],n*.6+noise(x*.07,z*.07)*.4);let c=mix(g,sand,biome(x,z));c=mix(c,soil,trail(x,z)*.92);if(kind==='desert-cracked')c=mix(c,soil,cracks(x,z)*.65);return mix(c,mix(water,[.12,.48,.51],noise(x*.16,z*.16)),wet(x,z));}
 return {solid:surface(2*G,2*G,128,128,top,color),top,wet,biome};
}
function plantedGround(kind){
 const field=ground('grass'),parts=[field.solid];
 const flowerColors={daisies:[.86,.84,.68],buttercups:[.91,.63,.035],wildflowers:[.51,.19,.55]};
 const shrub=(x,z,r,seed)=>{const h=5+r*.65;parts.push(M.sphere(1,24).refineToLength(.17).warp(p=>{const n=1+.08*Math.sin(p[0]*23+p[1]*11)+.06*Math.sin(p[2]*21-p[1]*16);p[0]*=r*n;p[2]*=r*.8*n;p[1]*=h*.65*n;}).translate([x,field.top(x,z)+h*.35-.4,z]).setProperties(3,(c,p)=>{const n=noise(p[0]*.8+seed,p[2]*.8);[.14,.29,.05].forEach((v,i)=>c[i]=v*(.8+n*.45));}));};
 if(['shrubs','mixed','heather'].includes(kind))for(let i=0;i<(kind==='shrubs'?5:3);i++){const a=i*2.4;shrub(Math.cos(a)*15,Math.sin(a)*15,kind==='heather'?3.8:5+i%3,i);}
 if(kind==='tufts')for(let i=0;i<28;i++){const x=-21+42*hash(i,91),z=-21+42*hash(i,44);for(let j=0;j<3;j++)parts.push(paint(M.cylinder(2.4+j*.6,.85,.3,8,false).rotate([-90,0,0]).translate([x+j*.75,field.top(x,z)-.4,z]),[.27,.37,.055]));}
 if(kind==='moss')for(let i=0;i<16;i++){const x=-20+40*hash(i,3),z=-20+40*hash(i,7);parts.push(paint(M.sphere(2.4+i%3,16).scale([1,.30,.8]).translate([x,field.top(x,z)-.2,z]),[.26,.35,.075]));}
 if(flowerColors[kind]||['mixed','heather'].includes(kind))for(let i=0;i<22;i++){
  const x=-21+42*hash(i,63),z=-21+42*hash(i,28),y=field.top(x,z),color=flowerColors[kind]||flowerColors[['daisies','buttercups','wildflowers'][i%3]];
  parts.push(paint(M.cylinder(1.8,.65,.55,10,false).rotate([-90,0,0]).translate([x,y-.25,z]),green));
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5;parts.push(paint(M.sphere(1,12).scale([1.05,.55,.65]).rotate([0,-a*180/Math.PI,0]).translate([x+Math.cos(a)*.8,y+1.5,z+Math.sin(a)*.8]),color));}
  parts.push(paint(M.sphere(.65,12).scale([1,.7,1]).translate([x,y+1.8,z]),[.85,.52,.04]));
 }
 return M.union(parts);
}
function addRocks(parts,field,count,desert=false){for(let i=0;i<count;i++){const x=-21+42*hash(i,3),z=-21+42*hash(i,8);if(field.wet(x,z)>.05)continue;const r=1.5+hash(i,12)*2.3;parts.push(paint(M.sphere(r,12).scale([1,.55,.75]).translate([x,field.top(x,z)-.1,z]),desert?[.55,.38,.20]:stone));}}
function palm(x,z,height=22){const parts=[];parts.push(paint(M.cylinder(height,1.8,1.1,16,false).rotate([-90,0,0]).translate([x,7,z]),wood));
 for(let i=1;i<height/3;i++)parts.push(paint(M.cylinder(.8,1.85-i*.08,1.7-i*.08,16,true).rotate([-90,0,0]).translate([x,7+i*3,z]),[.38,.23,.095]));
 parts.push(paint(M.sphere(1.7,12).translate([x,7+height,z]),green));
 for(let k=0;k<8;k++){const curve=x=>{const t=(x+4.25)/8.5;return Math.sin(t*Math.PI)*2.8-t*2;};
  const leaf=surface(8.5,3,40,12,(x,z)=>curve(x)+.6-.15*Math.pow(.5+.5*Math.sin(x*7+Math.abs(z)*4),8),(x,z)=>mix(green,[.31,.40,.12],.4+.3*Math.sin(x*7+Math.abs(z)*4)),x=>curve(x)-.6).warp(p=>{const t=(p[0]+4.25)/8.5;p[2]*=.3+.7*Math.sin(t*Math.PI);p[0]+=4.25;});parts.push(leaf.rotate([0,k*45,0]).translate([x,7+height,z]));}

 return M.union(parts);
}
function oasis(inlet=false){const field=ground(inlet?'oasis-inlet':'oasis'),parts=[field.solid];addRocks(parts,field,10,true);parts.push(palm(-14,14,22),palm(15,-14,17));
 for(let i=0;i<10;i++){const a=i*2.4,x=Math.cos(a)*16,z=Math.sin(a)*16;for(let k=0;k<3;k++)parts.push(paint(M.cylinder(3+k*1.4,.65,.4,8,false).rotate([-90,0,0]).translate([x+k*.85,7,z]),[.31,.35,.10]));}return M.union(parts);
}
function timberPost(x,y,z){const w=2.4,h=10.8,d=2.4;
 return paint(M.cube([w,h,d],true).refineToLength(.55).warp(p=>{const end=smooth(0,.8,h/2-Math.abs(p[1]));
  if(Math.abs(Math.abs(p[0])-w/2)<.001)p[0]-=Math.sign(p[0])*.16*Math.pow(.5+.5*Math.sin(p[2]*9+Math.sin(p[1]*.5)),6)*end*smooth(0,.4,d/2-Math.abs(p[2]));
  if(Math.abs(Math.abs(p[2])-d/2)<.001)p[2]-=Math.sign(p[2])*.16*Math.pow(.5+.5*Math.sin(p[0]*9+Math.sin(p[1]*.5)),6)*end*smooth(0,.4,w/2-Math.abs(p[0]));
 }).translate([x,y,z]),wood);
}
const arch=x=>8+4*Math.cos(x/G*Math.PI/2);
function woodenBridge(){const field=ground('grass','straight'),parts=[field.solid];addRocks(parts,field,6);
 for(const z of [-9,9])parts.push(surface(2*G,2.5,72,2,(x)=>arch(x)-.9,()=>wood,(x)=>arch(x)-2.5).translate([0,0,z]));
 const pitch=2*G/14;
 for(let i=0;i<14;i++){const cx=-G+(i+.5)*pitch;parts.push(surface(pitch-.2,25.4,8,40,(x,z)=>arch(x+cx)+.1*Math.sin(z*3.4+Math.sin((x+cx)*2)),(x,z)=>mix(wood,[.45,.28,.11],noise(x+cx,z*.4)),(x)=>arch(x+cx)-1.5).translate([cx,0,0]));
  for(const z of [-9,9])parts.push(paint(M.cylinder(.4,.45,.45,10,true).rotate([-90,0,0]).translate([cx,arch(cx)+.12,z]),[.14,.15,.14]));}
 for(const z of [-14.2,14.2]){for(const x of [-21,-10.5,0,10.5,21]){parts.push(timberPost(x,arch(x)+4.4,z));parts.push(box(3,1.5,5.2,x,arch(x)-.3,z<0?-12.6:12.6,wood));}
  parts.push(surface(47,2.1,120,8,(x,z)=>arch(x)+10-.13*Math.pow(.5+.5*Math.sin(z*10+Math.sin(x*.7)),6),()=>wood,x=>arch(x)+8.1).translate([0,0,z]));}
 return M.union(parts);
}
function stoneBridge(){const field=ground('desert','straight'),parts=[field.solid];addRocks(parts,field,6);
 const top=(x,z)=>arch(x)+.15-.32*(Math.pow(Math.cos(x*Math.PI/4.2),24)+Math.pow(Math.cos(z*Math.PI/5),24));
 parts.push(surface(2*G,27.4,120,60,top,(x,z)=>mix(stone,[.57,.53,.43],hash(Math.floor(x/4.2),Math.floor(z/5))),x=>arch(x)-2.2));
 for(const z of [-15.1,15.1]){parts.push(surface(2*G,2.8,96,3,x=>arch(x)+5.2,()=>[.28,.28,.25],x=>Math.max(7,arch(x)-3)).translate([0,0,z]));
  for(let row=0;row<2;row++)for(let i=0;i<10;i++){const w=2*G/10,cx=-G+(i+.5)*w;parts.push(surface(w-.25,3.8,8,4,x=>arch(x+cx)+row*2.6+2.8,()=>mix(stone,[.56,.51,.40],hash(i,row)),x=>arch(x+cx)+row*2.6+.35).translate([cx,0,z]));}}
 return M.union(parts);
}
const specs=[
 ...[['daisies','Daisy meadow'],['buttercups','Buttercup meadow'],['wildflowers','Purple wildflower meadow'],['shrubs','Low shrub grassland'],['mixed','Flowers and shrubs'],['heather','Heather and wildflowers'],['tufts','Long grass tufts'],['moss','Mossy grassland']].map(([kind,name])=>['o-'+kind,name,'Terrain',()=>plantedGround(kind)]),
 ['o-grass','Meadow grass','Terrain','grass'],['o-grass-rough','Rocky grassland','Terrain','rough'],['o-path','Worn grass path','Terrain','path'],['o-path-turn','Turning grass path','Terrain','path-turn'],
 ['o-sand','Wind-rippled sand','Terrain','desert'],['o-dunes','Rolling desert dunes','Terrain','desert-dunes'],['o-cracked','Cracked desert earth','Terrain','desert-cracked'],['o-transition','Grass to desert','Terrain','transition'],
 ['o-oasis','Palm oasis pool','Water',()=>oasis()],['o-oasis-inlet','Oasis river inlet','Water',()=>oasis(true)],
 ['o-river','Grass river straight','Water','grass','straight'],['o-river-bend','Grass river bend','Water','grass','bend'],['o-river-junction','Grass river junction','Water','grass','junction'],['o-river-end','Grass river source','Water','grass','end'],
 ['o-river-desert','Desert river straight','Water','desert','straight'],['o-river-desert-bend','Desert river bend','Water','desert','bend'],['o-river-desert-junction','Desert river junction','Water','desert','junction'],['o-river-desert-end','Desert river source','Water','desert','end'],['o-river-transition','Grass to desert river','Water','river-transition','straight'],
 ['o-bridge-wood','Timber river bridge','Bridges',woodenBridge],['o-bridge-stone','Masonry river bridge','Bridges',stoneBridge]
];
const assets={};
for(const [id,name,category,kind,river]of specs){let solid;if(typeof kind==='function')solid=kind();else{const f=ground(kind,river),parts=[f.solid];if(kind==='rough'||river)addRocks(parts,f,kind==='rough'?16:5,kind==='desert');solid=M.union(parts);}
 const parts=solid.decompose().sort((a,b)=>b.volume()-a.volume());if(parts.length>1&&parts.slice(1).every(p=>p.volume()<0&&p.volume()>-.2)&&parts.slice(1).reduce((n,p)=>n-p.volume(),0)<.25){solid.delete();solid=parts.shift();}if(solid.status()!=='NoError'||parts.some(p=>p.volume()>0)&&parts.length!==1)throw Error(id+' disconnected: '+parts.map(p=>p.volume()));parts.forEach(p=>p.delete());
 assets[id]={name,category,...cleanMeshData(solidData(solid)),volume:solid.volume()};console.log(id,assets[id].indices.length/3);solid.delete();}
await fs.writeFile('src/generated/outdoor.json',JSON.stringify(assets));
await fs.writeFile('src/outdoor-kit.js','export const OUTDOOR_KIT = '+JSON.stringify(specs.map(([id,name,category])=>({id,name,category,icon:'',hint:'Outdoor collection / sculpted / 2 x 2 squares'})),null,2)+';\n');
const connected=JSON.parse(await fs.readFile('src/generated/openlock.json','utf8'));
for(const [id,data]of Object.entries(assets)){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geo.setIndex(data.indices);connected[id]=cleanMeshData(connectAsset(wasm,geo,data.category,id));geo.dispose();}
await fs.writeFile('src/generated/openlock.json',JSON.stringify(connected));
