import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DUNGEON_RANGE_KIT as kit} from '../src/dungeon-range-kit.js';
const dir='test-results/dungeon-range/meshes';
await fs.mkdir('public/dungeon-range',{recursive:true});
await fs.mkdir(dir,{recursive:true});await fs.mkdir('test-results/dungeon-range',{recursive:true});
if(process.argv.includes('--batch')){
 const start=Number(process.argv[3]),count=Number(process.argv[4]||10);
 const {makeRangeSolid,rangeSpec,cutRangeSockets}=await import('./dungeon-range-shapes.mjs');
 const {solidData}=await import('../src/openlock-build.js');
 const {cleanMeshData}=await import('./clean-mesh-data.mjs');
 function topology(data){const edges=new Map();for(let i=0;i<data.indices.length;i+=3){const t=data.indices.slice(i,i+3);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=a<b?a+','+b:b+','+a;const edge=edges.get(key)||[0,0];edge[0]++;edge[1]+=a<b?1:-1;edges.set(key,edge);}}return [...edges.values()].every(([count,balance])=>count===2&&balance===0);}
 function checked(s,id,simplify=true){let parts=s.decompose().sort((a,b)=>b.volume()-a.volume());if(s.status()!=='NoError'||!parts.length||parts[0].volume()<=0||parts.slice(1).reduce((a,p)=>a+Math.abs(p.volume()),0)>Math.min(5,parts[0].volume()*.001))throw Error(id+' invalid components '+parts.map(p=>p.volume()));const main=parts.shift();parts.forEach(p=>p.delete());s.delete();if(simplify)for(const tol of [.01,.003,.001,.02,.03]){const simple=main.simplify(tol);if(topology(cleanMeshData(solidData(simple)))){main.delete();return simple;}simple.delete();}if(!topology(cleanMeshData(solidData(main))))throw Error(id+' quantized topology');return main;}
 function encode(s){const data=cleanMeshData(solidData(s)),pos=Float32Array.from(data.positions),col=Float32Array.from(data.colors),ind=Uint32Array.from(data.indices);return {data:Buffer.concat([Buffer.from(pos.buffer),Buffer.from(col.buffer),Buffer.from(ind.buffer)]),vertices:pos.length/3,indices:ind.length,volume:s.volume()};}

 for(const r of kit.slice(start,start+count)){
  let s=checked(makeRangeSolid(r),r.id+' raw');const raw=encode(s),spec=rangeSpec(r);let c=checked(cutRangeSockets(s,spec),r.id+' socketed',false);const joined=encode(c),bytes=Buffer.concat([raw.data,joined.data]);
  await fs.writeFile(`${dir}/${r.id}.bin`,bytes);await fs.writeFile(`test-results/dungeon-range/${r.id}.json`,JSON.stringify({raw:{vertices:raw.vertices,indices:raw.indices,length:raw.data.length,volume:raw.volume},connected:{vertices:joined.vertices,indices:joined.indices,length:joined.data.length,volume:joined.volume},openlock:spec,sha256:createHash('sha256').update(bytes).digest('hex')}));c.delete();console.log(r.id,r.family,r.feature,raw.indices/3,joined.indices/3);
 }
}else{
 if(process.argv.includes('--cavern'))for(const r of kit.filter(k=>k.family==='Cavern')){const p=spawnSync(process.execPath,[import.meta.filename,'--batch',String(r.referenceIndex-1),'1'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
 if(process.argv.includes('--curves'))for(const r of kit.filter(k=>k.referenceCategory.startsWith('curved'))){const p=spawnSync(process.execPath,[import.meta.filename,'--batch',String(r.referenceIndex-1),'1'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
 if(process.argv.includes('--narrow-walls'))for(const r of kit.filter(k=>k.category==='Walls'&&k.width===25.4)){const p=spawnSync(process.execPath,[import.meta.filename,'--batch',String(r.referenceIndex-1),'1'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
 for(let start=0;start<kit.length;start+=5){const done=await Promise.all(kit.slice(start,start+5).map(async r=>{try{return !!(await fs.stat(`${dir}/${r.id}.bin`));}catch{return false;}}));const from=process.argv.includes('--from')?Number(process.argv[process.argv.indexOf('--from')+1]):Infinity;if(!process.argv.includes('--force')&&start<from&&done.every(Boolean))continue;const p=spawnSync(process.execPath,[import.meta.filename,'--batch',String(start),'5'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);}
 const index={},chunks=[];let offset=0;for(const r of kit){const m=JSON.parse(await fs.readFile(`test-results/dungeon-range/${r.id}.json`,'utf8')),bytes=await fs.readFile(`${dir}/${r.id}.bin`);index[r.id]={...m,offset};offset+=bytes.length;chunks.push(bytes);}
 const {CURVE_KIT}=await import('../src/curve-kit.js');for(const k of CURVE_KIT){if(!await fs.stat('test-results/curves/'+k.id+'.json').catch(()=>null))continue;const m=JSON.parse(await fs.readFile('test-results/curves/'+k.id+'.json','utf8')),bytes=await fs.readFile('test-results/curves/'+k.id+'.bin');index[k.id]={...m,offset};offset+=bytes.length;chunks.push(bytes);}
 await fs.writeFile('public/dungeon-range/meshes.bin',Buffer.concat(chunks));await fs.writeFile('src/generated/dungeon-range-index.json',JSON.stringify(index));await fs.writeFile('public/dungeon-range/index.json',JSON.stringify(index));console.log('Bundled',kit.length,'pieces,',Math.round(offset/1048576),'MiB');
}


