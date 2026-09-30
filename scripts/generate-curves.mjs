import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DUNGEON_RANGE_KIT} from '../src/dungeon-range-kit.js';
const plan=[];
const families=[...new Set(DUNGEON_RANGE_KIT.map(k=>k.family)), 'Hollowdeep','Blackwater','Greywatch','Quarry','Village stone','Village timber'];
const recipes={'Hollowdeep':'Cavern','Blackwater':'Crypt','Greywatch':'Gothic','Quarry':'Fortress','Village stone':'Smallstone','Village timber':'Timber'};
const add=(family,radius,depth=radius,sweep=90,matches=[])=>{
 if(plan.some(p=>p.family===family&&p.radius===radius&&p.innerDepth===depth&&p.sweep===sweep))return;
 const wide=radius>=101.59,label=sweep===45?'Gentle 45° wall':wide?'Wide curved wall':'Curved wall';
 plan.push({id:`a-${String(plan.length+1).padStart(3,'0')}`,name:`${family} ${label.toLowerCase()} · ${(radius/50.8).toFixed(2).replace(/\.00$/,'')} tile radius`,category:'Walls',icon:'',family,recipe:recipes[family]||family,radius,innerDepth:depth,sweep,matches,shape:sweep===45?'gentle-curve':'curved-wall',hint:`${family} / ${sweep}° curve / inner radius ${radius.toFixed(1)} mm${wide?' / spans two or more 50.8 mm tiles':''}${matches.length?' / fits '+matches.join(', '):''}`});
};
for(const f of DUNGEON_RANGE_KIT.filter(k=>k.category==='Floors'&&['quarter','arc-strip'].includes(k.shape))){const matches=DUNGEON_RANGE_KIT.filter(k=>k.family===f.family&&k.category==='Floors'&&['quarter','arc-strip'].includes(k.shape)&&k.width===f.width&&k.depth===f.depth).map(k=>k.id);add(f.family,f.width,f.depth,90,matches);}
for(const f of families){add(f,50.8);add(f,101.6);add(f,101.6,101.6,45);}
await fs.mkdir('test-results/curves',{recursive:true});
await fs.writeFile('src/curve-kit.js','// Original curved companions. Radius measures the floor edge, not the outside wall.\nexport const CURVE_KIT = '+JSON.stringify(plan,null,2)+';\n');
if(process.argv.includes('--batch')){
 const {M,wasm}=await import('./sculpt-library.mjs');
 const {wallShape,cutRangeSockets}=await import('./dungeon-range-shapes.mjs');
 const {solidData}=await import('../src/openlock-build.js');
 const {cleanMeshData}=await import('./clean-mesh-data.mjs');
 const start=Number(process.argv[3]);
 for(const k of plan.slice(start,start+4)){
  const t=12.7,R=k.radius+t,D=k.innerDepth+t,mid=k.radius+t/2,midD=k.innerDepth+t/2,angle=k.sweep*Math.PI/180,len=mid*angle;
  const r={family:k.recipe,feature:'wall',width:len,depth:t,height:50.8,variant:start+17,referenceName:'original'};
  let s=wallShape(r).refineToLength(1.2).warp(p=>{const a=(p[0]/len+.5)*angle,z=p[2];p[0]=(mid-z)*Math.cos(a)-R/2;p[2]=(midD-z)*Math.sin(a)-D/2;});
  const segments=k.sweep===45?16:32;const polys=[];for(let i=0;i<segments;i++){const a=angle*i/segments,b=angle*(i+1)/segments;polys.push([[k.radius*Math.cos(a)-R/2,k.innerDepth*Math.sin(a)-D/2],[R*Math.cos(a)-R/2,D*Math.sin(a)-D/2],[R*Math.cos(b)-R/2,D*Math.sin(b)-D/2],[k.radius*Math.cos(b)-R/2,k.innerDepth*Math.sin(b)-D/2]]);}
  const ports=[],put=(x,z,nx,nz,y,roll)=>ports.push({x,z,nx,nz,y,roll,angle:Math.atan2(-nz,nx)*180/Math.PI});
  // Existing elliptical floors have no curved-edge socket. Keep their geometry
  // compatible and use end-to-end wall connectors rather than inventing a mate.
  if(Math.abs(k.radius-k.innerDepth)<.001){const a=angle/2;put(k.radius*Math.cos(a)-R/2,k.radius*Math.sin(a)-D/2,-Math.cos(a),-Math.sin(a),3.5,0);}
  for(const y of [12.7,38.1]){put(mid-R/2,-D/2,0,-1,y,90);put(mid*Math.cos(angle)-R/2,midD*Math.sin(angle)-D/2,-Math.sin(angle),Math.cos(angle),y,90);}
  const spec={revision:3,kind:'wall',width:R,depth:D,height:8,rotationStep:45,ports,footprints:polys};
  function checked(s){const parts=s.decompose().sort((a,b)=>b.volume()-a.volume());if(s.status()!=='NoError'||!parts.length||parts.slice(1).reduce((v,p)=>v+Math.abs(p.volume()),0)>Math.min(5,parts[0].volume()*.001))throw Error(k.id+' disconnected '+parts.map(p=>p.volume()).join(','));return parts[0];}
  function encode(s){const d=cleanMeshData(solidData(s));const edges=new Map();for(let i=0;i<d.indices.length;i+=3)for(let j=0;j<3;j++){const a=d.indices[i+j],b=d.indices[i+(j+1)%3],key=a<b?a+','+b:b+','+a,e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}if([...edges.values()].some(e=>e[0]!==2||e[1]!==0))throw Error(k.id+' topology');const p=Float32Array.from(d.positions),c=Float32Array.from(d.colors),i=Uint32Array.from(d.indices),data=Buffer.concat([Buffer.from(p.buffer),Buffer.from(c.buffer),Buffer.from(i.buffer)]);return {data,vertices:p.length/3,indices:i.length,length:data.length,volume:s.volume()};}
  s=checked(s);let raw;try{raw=encode(s);}catch(error){for(const tol of [.01,.003,.001]){const simple=s.simplify(tol);try{raw=encode(simple);s.delete();s=simple;break;}catch{simple.delete();}}if(!raw)throw error;}const c=checked(cutRangeSockets(s,spec)),connected=encode(c),bytes=Buffer.concat([raw.data,connected.data]);delete raw.data;delete connected.data;
  await fs.writeFile(`test-results/curves/${k.id}.bin`,bytes);await fs.writeFile(`test-results/curves/${k.id}.json`,JSON.stringify({raw,connected,openlock:spec,sha256:createHash('sha256').update(bytes).digest('hex')}));console.log(k.id,k.name);s.delete();c.delete();
 }
}else{
 for(let i=0;i<plan.length;i+=4){if(!process.argv.includes('--force')&&(await Promise.all(plan.slice(i,i+4).map(k=>fs.stat('test-results/curves/'+k.id+'.bin').then(()=>true).catch(()=>false)))).every(Boolean))continue;const result=spawnSync(process.execPath,[import.meta.filename,'--batch',String(i)],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
 const old=JSON.parse(await fs.readFile('src/generated/dungeon-range-index.json','utf8')),oldBytes=await fs.readFile('public/dungeon-range/meshes.bin'),chunks=[],index={};let offset=0;
 for(const k of [...DUNGEON_RANGE_KIT,...plan]){const added=k.id.startsWith('a-'),m=added?JSON.parse(await fs.readFile(`test-results/curves/${k.id}.json`,'utf8')):old[k.id],data=added?await fs.readFile(`test-results/curves/${k.id}.bin`):oldBytes.subarray(m.offset,m.offset+m.raw.length+m.connected.length);index[k.id]={...m,offset};chunks.push(data);offset+=data.length;}
 await fs.writeFile('public/dungeon-range/meshes.bin',Buffer.concat(chunks));await fs.writeFile('public/dungeon-range/index.json',JSON.stringify(index));await fs.writeFile('src/generated/dungeon-range-index.json',JSON.stringify(index));console.log('Added',plan.length,'curved walls');
}



