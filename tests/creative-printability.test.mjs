import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCreativeLibrary}=require('../desktop/creative-library.cjs');
const {createCreativePrintability}=require('../desktop/creative-printability.cjs');
const {stlToPrintGLB}=require('../desktop/printability-geometry.cjs');
const {retainedGLBGeometry}=await import('../desktop/scenery-glb-source.mjs');
const {candidateGeometryReadiness}=await import('../desktop/creative-readiness.mjs');

function stl({open=false}={}){
 const points=[[0,0,0],[20,0,0],[0,16,0],[0,0,10]],faces=open?[[0,1,3],[0,3,2],[1,2,3]]:[[0,2,1],[0,1,3],[0,3,2],[1,2,3]],bytes=Buffer.alloc(84+faces.length*50);
 bytes.write('Synthetic controller fixture');bytes.writeUInt32LE(faces.length,80);
 faces.forEach((face,i)=>{let at=96+i*50;for(const index of face)for(const value of points[index]){bytes.writeFloatLE(value,at);at+=4;}});return bytes;
}
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const healthy={thin_area_ratio:0,has_thin_walls:false,status:'healthy'};
async function fixture(t,{kind='character',design={},metadata={},initialBytes,repairBytes,thinWalls=healthy,maxPolls=2,poll,post}={}){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-creative-print-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const library=createCreativeLibrary({directory}),source=initialBytes||stl();let asset=await library.create({kind,name:'Printability controller fixture',design:{heightMm:32,upAxis:'z',...design}});
 asset=await library.installModel(asset.id,{bytes:source,filename:'source.stl',sourceUpAxis:'z',outputUpAxis:'z',validation:{minimumWallThicknessVerified:false,physicalFitVerified:false},...metadata});
 const requests=[],tasks=new Map(),usage=[],repaired=repairBytes||stlToPrintGLB(source,{sourceUpAxis:'z'}).bytes;let settings={},poller=poll,walls=thinWalls;
 const fetchImpl=async(url,init={})=>{
  const parsed=new URL(url),method=init.method||'GET',body=init.body?JSON.parse(init.body):undefined;requests.push({url:String(url),method,body});
  if(parsed.origin==='https://assets.meshy.ai'&&parsed.pathname==='/fixture.glb')return new Response(repaired);
  assert.equal(parsed.origin,'https://api.meshy.ai','all external provider destinations are mocked');
  const match=parsed.pathname.match(/^\/openapi\/v1\/print\/(analyze|repair)(?:\/([^/]+))?$/);assert.ok(match,'unexpected mock provider route: '+parsed.pathname);
  const [,kind,id]=match;
  if(method==='POST'){assert.equal(id,undefined);const taskId=randomUUID();tasks.set(taskId,{kind,body,gets:0});const overridden=await post?.({kind,id:taskId,body});return overridden||json({result:taskId});}
  assert.equal(method,'GET');const item=tasks.get(id);if(!item)return new Response(JSON.stringify({message:'Unknown synthetic task'}),{status:404});item.gets++;
  const overridden=await poller?.({...item,id,requests});if(overridden)return json({id,...overridden});
  if(kind==='repair')return json({id,type:'print-repair',status:'SUCCEEDED',progress:100,model_urls:{glb:'https://assets.meshy.ai/fixture.glb'},consumed_credits:5});
  const printability={status:walls?.status||'unknown',intended_print:{printer_type:item.body.printer_type,height_mm:item.body.intended_print_height_mm??null,longest_side_mm:item.body.intended_print_longest_side_mm??64,wall_thickness_mm:1},...(walls===undefined?{}:{thin_walls:walls})};
  return json({id,type:'print-analyze',status:'SUCCEEDED',progress:100,printability,consumed_credits:0});
 };
 const service=createCreativePrintability({library,ai:{status:async()=>({meshyPrint:settings}),meshyKey:async()=> 'controller-fixture-key',recordUsage:async event=>{usage.push(structuredClone(event));}},fetchImpl,wait:async()=>{},maxPolls,pollIntervalMs:1});
 return {directory,library,service,source,asset,requests,tasks,usage,setSettings:value=>{settings=value;},setPoll:value=>{poller=value;},setThinWalls:value=>{walls=value;},posts:kind=>requests.filter(r=>r.method==='POST'&&r.url.endsWith('/'+kind))};
}

test('free working-STL analysis uploads the actual sized GLB and caches an unchanged candidate',async t=>{
 const f=await fixture(t),result=await f.service.analyze(f.asset.id),body=f.posts('analyze')[0].body;
 assert.equal(body.printer_type,'fdm');assert.equal(body.intended_print_longest_side_mm,20);assert.equal(body.intended_print_height_mm,undefined);
 const geometry=retainedGLBGeometry(Buffer.from(body.model_url.split(',')[1],'base64')),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<geometry.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],geometry.positions[i]);max[axis]=Math.max(max[axis],geometry.positions[i]);}
 assert.deepEqual(max.map((v,i)=>Math.round((v-min[i])*1000)),[20,10,16]);
 assert.equal(result.design.meshyPrintReport.thinWalls.status,'healthy');assert.equal(result.design.meshyPrintReport.candidateId,f.asset.model.id);
 assert.equal(result.model.validation.minimumWallThicknessVerified,false);assert.equal(result.model.validation.physicalFitVerified,false);
 const before=f.requests.length;await f.service.analyze(f.asset.id);assert.equal(f.requests.length,before);assert.equal(f.posts('repair').length,0);
 assert.deepEqual((await f.library.readModelArtifacts(f.asset.id)).bytes,f.source);
});

test('unfitted oversized scenery checks the planned body height provisionally and honors manual size overrides',async t=>{
 const large=stl();for(let face=0;face<large.readUInt32LE(80);face++)for(let coordinate=0;coordinate<9;coordinate++){const at=96+face*50+coordinate*4;large.writeFloatLE(large.readFloatLE(at)*95,at);}
 const f=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:1,gridDepth:1,openlock:true,upAxis:'y'},initialBytes:large,metadata:{sourceUpAxis:'y',outputUpAxis:'z',validation:{status:'needs-repair',adapterStatus:'failed',minimumWallThicknessVerified:false,physicalFitVerified:false}}});
 let result=await f.service.analyze(f.asset.id),body=f.posts('analyze')[0].body;assert.ok(Math.abs(body.intended_print_height_mm-16.2)<1e-10);assert.equal(body.intended_print_longest_side_mm,undefined);assert.equal(f.posts('repair').length,0);assert.equal(f.usage.length,0);
 const uploaded=retainedGLBGeometry(Buffer.from(body.model_url.split(',')[1],'base64')),max=[-Infinity,-Infinity,-Infinity],min=[Infinity,Infinity,Infinity];for(let i=0;i<uploaded.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],uploaded.positions[i]);max[axis]=Math.max(max[axis],uploaded.positions[i]);}assert.deepEqual(max.map((value,axis)=>Math.round((value-min[axis])*1000)),[1900,1520,950],'unfitted source uses its Y-up frame rather than the declared final Z-up frame');
 assert.equal(result.design.meshyPrintReport.scope,'unfitted-source');assert.match(result.design.meshyPrintReport.message,/provisional/i);assert.match(result.design.meshyPrintReport.message,/final assembled geometry/i);assert.equal(result.model.validation.status,'needs-repair');assert.equal(result.model.validation.minimumWallThicknessVerified,false);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id)).bytes,large);
 f.setSettings({sizeMode:'longest',sizeMm:80,printerType:'sla'});result=await f.service.analyze(f.asset.id);body=f.posts('analyze')[1].body;assert.equal(body.intended_print_longest_side_mm,80);assert.equal(body.intended_print_height_mm,undefined);assert.equal(body.printer_type,'sla');assert.equal(result.design.meshyPrintReport.scope,'unfitted-source');assert.equal(f.posts('repair').length,0);
 f.setSettings({sizeMode:'height',sizeMm:60});await f.service.analyze(f.asset.id);body=f.posts('analyze')[2].body;assert.equal(body.intended_print_height_mm,60);assert.equal(body.intended_print_longest_side_mm,undefined);assert.equal(f.posts('repair').length,0);
});

test('printer or size changes invalidate cached analysis without changing model bytes',async t=>{
 const f=await fixture(t);await f.service.analyze(f.asset.id);f.setSettings({printerType:'sla',sizeMode:'height',sizeMm:50});const result=await f.service.analyze(f.asset.id);
 assert.equal(f.posts('analyze').length,2);const body=f.posts('analyze')[1].body;assert.equal(body.printer_type,'sla');assert.equal(body.intended_print_height_mm,50);assert.equal(body.intended_print_longest_side_mm,undefined);
 assert.equal(result.model.id,f.asset.model.id);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id)).bytes,f.source);
});

test('paused analysis resumes by task GET without repeating its POST',async t=>{
 const f=await fixture(t,{maxPolls:1,poll:()=>({status:'IN_PROGRESS',progress:40})});await assert.rejects(f.service.analyze(f.asset.id),/still|processing|resume/i);
 const pending=await f.library.load(f.asset.id);assert.equal(pending.design.meshyPrintWorkflow.status,'paused');const taskId=pending.design.meshyPrintWorkflow.jobs.finalAnalysis.taskId;
 f.setPoll(undefined);const result=await f.service.resume(f.asset.id);assert.equal(f.posts('analyze').length,1);assert.equal(result.design.meshyPrintWorkflow.status,'completed');assert.equal(result.design.meshyPrintWorkflow.jobs.finalAnalysis.taskId,taskId);
});

test('uncertain analysis can attach its recovered task ID and finish using GET only',async t=>{
 const f=await fixture(t,{post:({kind})=>{if(kind==='analyze')throw new TypeError('Synthetic response lost after analysis was accepted');}});await assert.rejects(f.service.analyze(f.asset.id),/unknown|recover|history/i);
 const uncertain=await f.library.load(f.asset.id),taskId=[...f.tasks.keys()][0];assert.equal(uncertain.design.meshyPrintReport.needsTaskId,true);assert.equal(uncertain.design.meshyPrintWorkflow.jobs.finalAnalysis.taskId,undefined);assert.equal(uncertain.design.meshyPrintWorkflow.jobs.finalAnalysis.status,'unknown');
 const before=f.requests.length;await assert.rejects(f.service.resume(f.asset.id,{taskId:'sk-fake-api-key-not-a-task'}),/UUID|API key/i);assert.equal(f.requests.length,before);await assert.rejects(f.service.resume(f.asset.id),/unknown|history|recover/i);assert.equal(f.requests.length,before);
 const result=await f.service.resume(f.asset.id,{taskId});assert.equal(result.design.meshyPrintWorkflow.status,'completed');assert.equal(result.design.meshyPrintWorkflow.jobs.finalAnalysis.taskId,taskId);assert.equal(f.posts('analyze').length,1);assert.equal(f.requests.filter(r=>r.method==='GET'&&r.url.endsWith('/'+taskId)).length,1);assert.equal(f.posts('repair').length,0);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id)).bytes,f.source);
});

test('lost paid-repair response recovers without another paid POST and wrong IDs remain correctable',async t=>{
 const f=await fixture(t,{post:({kind})=>{if(kind==='repair')throw new TypeError('Synthetic paid response lost after provider accepted repair');}});await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}),/unknown|recover|history/i);
 let record=await f.library.load(f.asset.id);assert.equal(record.design.meshyPrintWorkflow.phase,'repair');assert.equal(record.design.meshyPrintReport.needsTaskId,true);assert.equal(record.design.meshyPrintWorkflow.jobs.repair.status,'unknown');const taskId=[...f.tasks].find(([,task])=>task.kind==='repair')[0],before=f.requests.length;
 for(const invalid of ['sk-another-key','not-a-task','12345'])await assert.rejects(f.service.resume(f.asset.id,{taskId:invalid}),/UUID|API key/i);assert.equal(f.requests.length,before);assert.equal(f.posts('repair').length,1);
 const wrong=randomUUID();await assert.rejects(f.service.resume(f.asset.id,{taskId:wrong}),/resume|saved|refresh|404/i);record=await f.library.load(f.asset.id);assert.equal(record.design.meshyPrintReport.needsTaskId,true);assert.equal(record.design.meshyPrintWorkflow.jobs.repair.status,'unknown');assert.equal(record.design.meshyPrintWorkflow.jobs.repair.taskId,undefined);assert.equal(f.posts('repair').length,1);
 const result=await f.service.resume(f.asset.id,{taskId});assert.equal(result.design.meshyPrintWorkflow.status,'completed');assert.equal(result.model.printabilityRepairTaskId,taskId);assert.equal(f.posts('repair').length,1);assert.equal(f.posts('analyze').length,2,'source analysis is reused and only the new final geometry needs another free analysis');assert.equal(f.requests.filter(r=>r.method==='GET'&&r.url.endsWith('/'+taskId)).length,1);assert.equal(f.usage.length,1);assert.equal(f.usage[0].dedupeKey,'meshy-print-repair:'+taskId);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id,f.asset.model.id)).bytes,f.source);
});

test('terminal failed analysis can start a new explicitly requested check',async t=>{
 const f=await fixture(t,{poll:()=>({status:'FAILED',progress:0,task_error:{message:'Synthetic failed mesh analysis'}})});await assert.rejects(f.service.analyze(f.asset.id));
 const failed=await f.library.load(f.asset.id);assert.equal(failed.design.meshyPrintWorkflow.status,'failed');f.setPoll(undefined);const result=await f.service.analyze(f.asset.id);assert.equal(result.design.meshyPrintWorkflow.status,'completed');assert.equal(f.posts('analyze').length,2);
});

test('paid repair requires explicit credit approval before any provider POST',async t=>{
 const f=await fixture(t);await assert.rejects(f.service.repair(f.asset.id),/credit|approve/i);assert.equal(f.requests.length,0);
 const after=await f.library.load(f.asset.id);assert.equal(after.model.id,f.asset.model.id);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id)).bytes,f.source);
});

test('full candidate history and invalid scenery dimensions fail before provider submissions',async t=>{
 const full=await fixture(t);for(let i=0;i<19;i++)await full.library.installModel(full.asset.id,{bytes:full.source,filename:'source.stl',sourceUpAxis:'z',outputUpAxis:'z'});
 assert.equal((await full.library.load(full.asset.id)).model.history.length,19);await assert.rejects(full.service.repair(full.asset.id,undefined,{confirmCredits:true}),/20|history|clone/i);assert.equal(full.requests.length,0);assert.equal(full.usage.length,0);
 const invalid=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:17,gridDepth:1,openlock:false}});await assert.rejects(invalid.service.repair(invalid.asset.id,undefined,{confirmCredits:true}),/module|tile|dimension/i);assert.equal(invalid.requests.length,0);assert.equal(invalid.usage.length,0);
});

test('GLB-only repair retains the original candidate and analyzes newly scaled geometry',async t=>{
 const f=await fixture(t),result=await f.service.repair(f.asset.id,undefined,{confirmCredits:true});
 assert.equal(f.posts('analyze').length,2);assert.equal(f.posts('repair').length,1);
 const source=f.posts('analyze')[0].body,repair=f.posts('repair')[0].body,final=f.posts('analyze')[1].body;
 const analysisId=[...f.tasks].find(([,task])=>task.kind==='analyze')[0];assert.equal(repair.input_task_id,analysisId);assert.equal(source.intended_print_height_mm,32);assert.equal(final.intended_print_longest_side_mm,64);
 assert.notEqual(result.model.id,f.asset.model.id);assert.equal(result.model.history.length,1);assert.equal(result.model.history[0].id,f.asset.model.id);assert.equal(result.model.accepted,false);assert.equal(result.model.printReady,false);assert.equal(result.model.texturesRemoved,true);
 assert.equal(result.design.meshyPrintReport.candidateId,result.model.id);assert.equal(result.design.meshyPrintReport.thinWalls.status,'healthy');
 assert.equal(result.model.usage,5);assert.equal(result.design.meshyPrintReport.repairCredits,5);assert.equal(f.usage.length,1);assert.deepEqual(f.usage[0],{provider:'meshy',model:'print-repair',kind:'meshy',usage:null,credits:5,outcome:'completed',dedupeKey:'meshy-print-repair:'+result.model.printabilityRepairTaskId});
 assert.deepEqual((await f.library.readModelArtifacts(f.asset.id,f.asset.model.id)).bytes,f.source);
 const current=await f.library.readModelArtifacts(f.asset.id);assert.ok(current.rawStl);assert.ok(current.glb);assert.equal(current.metadata.validation.minimumWallThicknessVerified,false);
});

test('protected OpenLOCK model without a retained body refuses repair before submission',async t=>{
 const f=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:1,gridDepth:1,openlock:true},metadata:{openlock:{requested:true},validation:{adapterStatus:'completed',minimumWallThicknessVerified:false}}});
 await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}),/retained.*body|original sculpt/i);assert.equal(f.requests.length,0);assert.equal((await f.library.load(f.asset.id)).model.id,f.asset.model.id);
});

test('OpenLOCK repair analyzes the retained body then rebuilds and checks the exact module',async t=>{
 const {adaptScenerySTL}=await import('../desktop/scenery-adapter.mjs'),raw=stl(),glb=stlToPrintGLB(raw,{sourceUpAxis:'z'}).bytes,spec={gridWidth:1,gridDepth:1,gridMm:25.4,heightMm:24,openlock:true,sourceUpAxis:'z',floorDatumMm:8},initial=await adaptScenerySTL(raw,spec,{sourceGLB:glb});
 const f=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:1,gridDepth:1,openlock:true},initialBytes:initial.bytes,metadata:{rawStl:raw,glb,openlock:initial.metadata.openlock,validation:initial.validation},repairBytes:glb});
 const result=await f.service.repair(f.asset.id,undefined,{confirmCredits:true}),source=f.posts('analyze')[0].body,final=f.posts('analyze')[1].body;
 assert.ok(Math.abs(source.intended_print_height_mm-16.2)<1e-10);assert.ok(Math.abs(final.intended_print_longest_side_mm-25.4)<.00001);assert.equal(final.intended_print_height_mm,undefined);
 assert.equal(source.model_url.split(',')[1],glb.toString('base64'),'provider receives retained sculpt rather than assembled socket base');assert.equal(result.model.validation.adapterStatus,'completed');assert.equal(result.model.openlock.requested,true);result.model.sizeMm.forEach((value,index)=>assert.ok(Math.abs(value-[25.4,25.4,24][index])<.005));
 assert.equal(result.model.validation.moduleSpec.sourceUpAxis,result.design.upAxis);assert.equal(candidateGeometryReadiness(result,result.model).ready,true,'repaired candidate matches the original Z-up design instead of falsely requiring another adaptation');
 assert.equal(result.model.validation.physicalFitVerified,false);assert.equal(result.model.validation.minimumWallThicknessVerified,false);assert.deepEqual((await f.library.readModelArtifacts(f.asset.id,f.asset.model.id)).bytes,initial.bytes);
});

test('unmeasured wall thickness remains unknown and never marks geometry printable',async t=>{
 const f=await fixture(t,{thinWalls:{thin_area_ratio:null,has_thin_walls:null,status:'unknown'}});let result=await f.service.analyze(f.asset.id);assert.equal(result.design.meshyPrintReport.thinWalls.status,'unknown');assert.notEqual(result.model.validation.minimumWallThicknessVerified,true);
 f.setThinWalls(undefined);f.setSettings({printerType:'sla'});result=await f.service.analyze(f.asset.id);assert.equal(result.design.meshyPrintReport.thinWalls,null);assert.notEqual(result.model.printReady,true);
});

test('failed local adaptation retains the repaired source as a draft and the original in history',async t=>{
 const broken=stlToPrintGLB(stl({open:true}),{sourceUpAxis:'z'}).bytes,f=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:1,gridDepth:1,openlock:false},repairBytes:broken});
 const result=await f.service.repair(f.asset.id,undefined,{confirmCredits:true});assert.notEqual(result.model.id,f.asset.model.id);assert.equal(result.model.validation.status,'needs-repair');assert.equal(result.design.meshyPrintReport.status,'needs-local-repair');assert.equal(result.design.meshyPrintReport.thinWalls,null);assert.equal(f.posts('analyze').length,1);
 assert.deepEqual((await f.library.readModelArtifacts(f.asset.id,f.asset.model.id)).bytes,f.source);const retained=await f.library.readModelArtifacts(f.asset.id);assert.deepEqual(retained.glb,broken);assert.ok(retained.rawStl);assert.notEqual(result.model.printReady,true);
});

test('repair paused at final analysis resumes its existing repair and analysis tasks',async t=>{
 const f=await fixture(t,{maxPolls:1,poll:({kind,requests})=>kind==='analyze'&&requests.filter(r=>r.method==='POST'&&r.url.endsWith('/analyze')).length===2?{status:'IN_PROGRESS',progress:55}:undefined});
 await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}),/still|processing|resume/i);const pending=await f.library.load(f.asset.id);assert.notEqual(pending.model.id,f.asset.model.id);const installedId=pending.model.id;
 f.setPoll(undefined);const result=await f.service.resume(f.asset.id);assert.equal(result.model.id,installedId);assert.equal(result.model.history.length,1);assert.equal(f.posts('repair').length,1);assert.equal(f.posts('analyze').length,2);assert.equal(result.design.meshyPrintReport.candidateId,installedId);
 assert.equal(new Set(f.usage.map(event=>event.dedupeKey)).size,1,'repeated usage callbacks carry the same task dedupe key');
});

test('repair resume retains its original geometry settings when the design changes while paused',async t=>{
 const f=await fixture(t,{maxPolls:1,poll:({kind})=>kind==='analyze'?{status:'IN_PROGRESS',progress:20}:undefined});await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}),/still|processing|resume/i);
 const pending=await f.library.load(f.asset.id);assert.equal(pending.design.meshyPrintWorkflow.modelDesign.heightMm,32);await f.library.save({...pending,design:{...pending.design,heightMm:50,upAxis:'y'}});
 f.setPoll(undefined);const result=await f.service.resume(f.asset.id);assert.equal(f.posts('analyze').length,2);assert.equal(f.posts('repair').length,1);assert.equal(f.posts('analyze')[0].body.intended_print_height_mm,32);assert.equal(f.posts('repair')[0].body.intended_print_height_mm,32);
 assert.equal(result.model.heightMm,32);assert.equal(result.model.sourceUpAxis,'z');assert.equal(result.design.heightMm,50,'the user edit remains saved while the already-approved model uses its original size');assert.equal(result.design.upAxis,'y');assert.equal(result.model.history[0].id,f.asset.model.id);assert.equal(result.model.sizeMm[2],32);
});

test('repair resume does not inherit a newly added OpenLOCK option that was absent at submission',async t=>{
 const f=await fixture(t,{kind:'scenery',design:{heightMm:24,gridWidth:1,gridDepth:1},maxPolls:1,poll:({kind})=>kind==='analyze'?{status:'IN_PROGRESS',progress:25}:undefined});await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}),/still|processing|resume/i);
 const pending=await f.library.load(f.asset.id);assert.equal(pending.design.openlock,undefined);await f.library.save({...pending,design:{...pending.design,openlock:true,floorDatumMm:8}});
 f.setPoll(undefined);const result=await f.service.resume(f.asset.id);assert.equal(f.posts('analyze').length,2);assert.equal(f.posts('repair').length,1);assert.equal(f.posts('analyze')[0].body.intended_print_height_mm,24);assert.equal(f.posts('repair')[0].body.intended_print_height_mm,24);assert.equal(result.model.openlock.requested,false);assert.equal(result.design.openlock,true,'new user edits remain available for a subsequent adaptation');
});

test('terminal failed paid task records provider credits through the saved worker task object',async t=>{
 const f=await fixture(t,{poll:({kind})=>kind==='repair'?{status:'FAILED',progress:100,consumed_credits:3,task_error:{message:'Synthetic repair failure'}}:undefined});await assert.rejects(f.service.repair(f.asset.id,undefined,{confirmCredits:true}));
 const result=await f.library.load(f.asset.id);assert.equal(result.design.meshyPrintWorkflow.status,'failed');assert.equal(result.design.meshyPrintWorkflow.jobs.repair.task.credits,3);assert.equal(f.usage.length,1);assert.equal(f.usage[0].credits,3);assert.equal(f.usage[0].outcome,'failed');assert.equal(f.usage[0].dedupeKey,'meshy-print-repair:'+result.design.meshyPrintWorkflow.jobs.repair.taskId);assert.equal(result.model.id,f.asset.model.id);
});
