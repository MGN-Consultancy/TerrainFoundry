import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function source(){const points=[[0,0,0],[12,0,0],[0,4,0],[0,0,7]],faces=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]],b=Buffer.alloc(284);b.writeUInt32LE(4,80);faces.forEach((face,i)=>face.forEach((index,j)=>points[index].forEach((n,k)=>b.writeFloatLE(n,96+i*50+j*12+k*4))));return b;}
const reply=value=>new Response(JSON.stringify(value));
async function fixture(raw=source()){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-adapt-pipeline-'));
 const library=require('../desktop/creative-library.cjs').createCreativeLibrary({directory});
 let asset=await library.create({kind:'scenery',name:'Asymmetric module',design:{purpose:'other',gridWidth:2,gridDepth:3,heightMm:24,openlock:true,upAxis:'y'}});
 asset.concepts=[{id:crypto.randomUUID(),image:'data:image/png;base64,iVBORw0KGgo=',name:'Original test art',retained:true,approved:true,createdAt:Date.now()}];asset=await library.save(asset);
 asset=await library.installModel(asset.id,{stl:source(),rawStl:source(),accepted:true,validation:{status:'needs-print-review'}});
 const original=structuredClone(asset.model),requests=[];
 const ai={status:async()=>({consent:{accepted:true},configured:{meshy:true},chatgpt:{enabled:true,signedIn:true},route:'chatgpt'}),meshyKey:async()=>'private-test-key'};
 const generation=require('../desktop/creative-generation.cjs').createCreativeGeneration({library,ai,wait:async()=>{},maxPolls:1,fetchImpl:async(url,options={})=>{
  requests.push({url:String(url),method:options.method||'GET'});
  if(String(url).endsWith('/balance'))return reply({balance:100});
  if(options.method==='POST')return reply({result:'task-12345678'});
  if(String(url).includes('/image-to-3d/')){
   const changed=await library.load(asset.id);changed.design.gridWidth=1;changed.design.gridDepth=1;await library.save(changed);
   return reply({status:'SUCCEEDED',progress:100,model_urls:{stl:'https://assets.meshy.ai/module.stl'}});
  }
  return new Response(raw);
 }});
 return {directory,library,asset,original,requests,generation};
}

test('Meshy adaptation uses snapshotted footprint and preserves provider bytes and old candidates',async()=>{
 const f=await fixture();try{
  const updated=await f.generation.generateModel(f.asset.id,f.asset.concepts[0].id);
  const generated=updated.model.history.at(-1);
  assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  assert.deepEqual(generated.validation.geometry.sizeMm,[50.8,76.2,24]);
  assert.equal(generated.validation.moduleSpec.gridWidth,2);assert.equal(generated.validation.moduleSpec.gridDepth,3);
  assert.equal(updated.design.gridWidth,1);assert.equal(updated.design.scenery.widthMm,50.8);
  assert.equal(generated.accepted,false);assert.equal(updated.model.id,f.original.id);assert.equal(updated.model.accepted,true);
  const files=await f.library.readModelArtifacts(updated.id,generated.id);assert.deepEqual(files.rawStl,source());
  assert.deepEqual((await f.library.readModelArtifacts(updated.id,f.original.id)).bytes,source());
  const calls=f.requests.length,adapted=await f.generation.adaptModel(updated.id,generated.id),resized=adapted.model.history.at(-1);
  assert.equal(f.requests.length,calls,'Local resize must not contact a provider');
  assert.deepEqual(resized.validation.geometry.sizeMm,[25.4,25.4,24]);
  assert.equal(adapted.model.history.length,2);assert.equal(resized.accepted,false);assert.equal(adapted.model.id,f.original.id);
  assert.deepEqual((await f.library.readModelArtifacts(updated.id,resized.id)).rawStl,source());
  assert.equal(resized.validation.physicalFitVerified,false);
 }finally{await fs.rm(f.directory,{recursive:true,force:true});}
});

test('invalid returned scenery is retained as a failed adapter candidate without resubmission',async()=>{
 const raw=source().subarray(0,234);raw.writeUInt32LE(3,80);const f=await fixture(raw);try{
  const updated=await f.generation.generateModel(f.asset.id,f.asset.concepts[0].id);
  const generated=updated.model.history.at(-1);
  assert.equal(generated.validation.status,'needs-repair');assert.equal(generated.openlock.status,'adapter-failed');
  assert.equal(generated.adapter.status,'failed');assert.equal(updated.model.id,f.original.id);
  assert.deepEqual((await f.library.readModelArtifacts(updated.id,generated.id)).rawStl,raw);
  assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
 }finally{await fs.rm(f.directory,{recursive:true,force:true});}
});

test('invalid module spec is refused before submitting a paid Meshy task',async()=>{
 const f=await fixture();try{const changed=await f.library.load(f.asset.id);changed.design.gridWidth=1.5;await f.library.save(changed);await assert.rejects(f.generation.generateModel(changed.id,changed.concepts[0].id),/whole tiles/);assert.deepEqual(f.requests,[]);}finally{await fs.rm(f.directory,{recursive:true,force:true});}
});
test('imported models adapt locally without an invented remote task and retain import provenance on resize',async()=>{
 const f=await fixture();try{
  const calls=f.requests.length,first=await f.generation.adaptModel(f.asset.id,f.original.id),candidate=first.model.history.at(-1);
  assert.equal(candidate.sourceProvider,'import');assert.equal(Object.hasOwn(candidate,'sourceTaskId'),false);
  assert.deepEqual(candidate.validation.geometry.sizeMm,[50.8,76.2,24]);
  const second=await f.generation.adaptModel(f.asset.id,candidate.id),resized=second.model.history.at(-1);
  assert.equal(resized.sourceProvider,'import');assert.equal(Object.hasOwn(resized,'sourceTaskId'),false);assert.equal(f.requests.length,calls);
  assert.deepEqual((await f.library.readModelArtifacts(second.id,resized.id)).rawStl,source());
 }finally{await fs.rm(f.directory,{recursive:true,force:true});}
});
