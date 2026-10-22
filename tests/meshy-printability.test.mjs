import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createMeshyPrintability,validateInput,validateParameters}=require('../desktop/meshy-printability.cjs');
const source='018a210d-8ba4-705c-b111-1f1776f7f578',taskId='0193bfc5-ee4f-73f8-8525-44b398884ce9',key='private-meshy-test-key';
const options={kind:'analyze',input:{input_task_id:source},parameters:{printer_type:'fdm',intended_print_longest_side_mm:50.8},key};
function fixture(responses,{maxPolls=4}={}){const calls=[],jobs=[],waits=[];const worker=createMeshyPrintability({request:async(url,init)=>{calls.push({url,init});const result=responses.shift();if(result instanceof Error)throw result;return result;},wait:async ms=>waits.push(ms),pollIntervalMs:3,maxPolls});return {worker,calls,jobs,waits,run:args=>worker.run({...options,onJob:async job=>jobs.push(job),...args})};}

test('analysis uses explicit printer/scale, persists before POST and polls without treating missing wall data as a pass',async()=>{
 const f=fixture([{result:taskId},{id:taskId,status:'IN_PROGRESS',progress:12},{id:taskId,status:'SUCCEEDED',progress:100,printability:{status:'warning'}}]);let savedBeforePost=false;
 const result=await f.run({onJob:async job=>{if(job.status==='submitting')savedBeforePost=f.calls.length===0;f.jobs.push(job);}});
 assert.equal(savedBeforePost,true);assert.equal(f.calls[0].url,'https://api.meshy.ai/openapi/v1/print/analyze');assert.equal(f.calls[0].init.method,'POST');assert.deepEqual(JSON.parse(f.calls[0].init.body),{input_task_id:source,printer_type:'fdm',intended_print_longest_side_mm:50.8});assert.equal(f.calls[0].init.headers.Authorization,'Bearer '+key);assert.equal(f.calls[1].url,'https://api.meshy.ai/openapi/v1/print/analyze/'+taskId);assert.equal(result.task.printability.thin_walls,undefined);assert.deepEqual(f.jobs.map(j=>j.status),['submitting','PENDING','IN_PROGRESS','SUCCEEDED']);assert.equal(JSON.stringify(f.jobs).includes(key),false);assert.deepEqual(f.waits,[3]);
});
test('repair cannot POST without explicit credit confirmation; analysis task printer/size is inherited with no conflicting fields',async()=>{
 const f=fixture([{result:taskId},{status:'SUCCEEDED',printability:{thin_walls:{thin_face_ratio:.09}}}]);await assert.rejects(f.run({kind:'repair',parameters:{}}),/Confirm the paid repair/);assert.equal(f.calls.length,0);assert.equal(f.jobs.length,0);
 const result=await f.run({kind:'repair',parameters:{},confirmCredits:true});assert.equal(f.calls[0].url,'https://api.meshy.ai/openapi/v1/print/repair');assert.deepEqual(JSON.parse(f.calls[0].init.body),{input_task_id:source});assert.equal(result.job.approvedRepair,true);assert.deepEqual(result.task.printability.thin_walls,{thin_face_ratio:.09});
});
test('paused paid repair resumes GET only without confirmation or another charge',async()=>{
 const f=fixture([{result:taskId},{status:'IN_PROGRESS',progress:20}],{maxPolls:1});let saved;await assert.rejects(f.run({kind:'repair',confirmCredits:true,onJob:async job=>{saved=job;}}),/still processing/);assert.equal(saved.taskId,taskId);
 const resumed=fixture([{id:taskId,status:'SUCCEEDED',progress:100,model_urls:{stl:'https://assets.meshy.ai/result.stl'}}]);const result=await resumed.run({kind:'repair',job:saved});assert.equal(resumed.calls.length,1);assert.equal(resumed.calls[0].init.method,undefined);assert.equal(resumed.calls[0].url.endsWith('/repair/'+taskId),true);assert.equal(result.job.status,'SUCCEEDED');
});
test('unknown POST outcome is retained and cannot be resubmitted',async()=>{
 const f=fixture([new Error('network disconnected')]);let saved;await assert.rejects(f.run({onJob:async job=>{saved=job;}}),/outcome is unknown/);assert.equal(saved.status,'unknown');assert.ok(saved.submissionId);assert.equal(saved.taskId,undefined);
 await assert.rejects(f.run({job:saved}),/Recover its task ID/);assert.equal(f.calls.length,1);assert.equal(JSON.stringify(saved).includes(key),false);
});
test('failed pre-submit persistence prevents provider calls; failed task-ID save exposes recovery ID',async()=>{
 const f=fixture([]);await assert.rejects(f.run({onJob:async()=>{throw Error('disk full');}}),/no provider request was sent/);assert.equal(f.calls.length,0);
 const g=fixture([{result:taskId}]);await assert.rejects(g.run({onJob:async job=>{if(job.taskId)throw Error('disk full');}}),error=>error.message.includes(taskId)&&error.job.taskId===taskId);assert.equal(g.calls.length,1);
});
test('failed persistence after an uncertain POST does not claim no request was sent',async()=>{
 const f=fixture([new Error('network disconnected')]);await assert.rejects(f.run({onJob:async job=>{if(job.status==='unknown')throw Error('disk full');}}),error=>error.job.status==='unknown'&&error.message.includes('do not submit again')&&!error.message.includes('no provider request was sent'));assert.equal(f.calls.length,1);
});
test('resume rejects changed source, scale, task kind and malformed ID before calls',async()=>{
 const f=fixture([{result:taskId},{status:'IN_PROGRESS',progress:1}],{maxPolls:1});let job;await assert.rejects(f.run({onJob:async value=>{job=value;}}),/still processing/);
 for(const change of [{parameters:{printer_type:'sla',intended_print_longest_side_mm:50.8}},{input:{input_task_id:'018a210d-8ba4-705c-b111-1f1776f7f579'}},{kind:'repair'}]){const g=fixture([]);await assert.rejects(g.run({...change,job}),/different geometry or print settings/);assert.equal(g.calls.length,0);}
 const g=fixture([]);await assert.rejects(g.run({job:{...job,taskId:'../../other'}}),/Invalid saved/);assert.equal(g.calls.length,0);
});
test('terminal failures are saved and do not trigger retry submissions',async()=>{
 for(const status of ['FAILED','CANCELED']){const f=fixture([{result:taskId},{id:taskId,status,task_error:{message:'Model cannot be repaired'}}]);let saved;await assert.rejects(f.run({onJob:async job=>{saved=job;}}),/Review the saved provider result/);assert.equal(saved.status,status);assert.ok(saved.task.task_error);const calls=f.calls.length;await assert.rejects(f.run({job:saved}),/ended unsuccessfully/);assert.equal(f.calls.length,calls);}
});
test('completed task returns its saved result without calls; wall details are retained exactly',async()=>{
 const thin_walls={status:'warning',thin_face_ratio:.06,min_thickness_mm:.7},f=fixture([{result:taskId},{id:taskId,status:'SUCCEEDED',printability:{thin_walls,intended_print:{printer_type:'fdm',wall_thickness_mm:1}}}]);const result=await f.run();const g=fixture([]),restored=await g.run({job:result.job});assert.deepEqual(restored.task.printability.thin_walls,thin_walls);assert.equal(g.calls.length,0);
});
test('invalid response states/IDs, excessive results and network refresh errors preserve saved submission',async()=>{
 for(const response of [{status:'SURPRISE'},{id:source,status:'SUCCEEDED'},{status:'SUCCEEDED',padding:'x'.repeat(193*1024)},new Error('temporary read outage')]){const f=fixture([{result:taskId},response]);await assert.rejects(f.run());assert.equal(f.jobs.at(-1).taskId,taskId);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);}
});
test('unchanged progress does not rewrite the job on every poll',async()=>{
 const f=fixture([{result:taskId},{status:'PENDING',progress:0},{status:'PENDING',progress:0},{status:'SUCCEEDED',progress:100}]);await f.run();assert.equal(f.jobs.length,3);assert.deepEqual(f.jobs.map(j=>j.status),['submitting','PENDING','SUCCEEDED']);
});
test('request validation rejects ambiguous inputs, printers, nonfinite size, both sizes, insecure URLs and non-GLB height requests',async()=>{
 for(const input of [{},{input_task_id:'bad'},{input_task_id:source,model_url:'https://assets.meshy.ai/model.glb'},{model_url:'http://assets.meshy.ai/model.glb'},{model_url:'https://user:password@assets.meshy.ai/model.glb'},{model_url:'data:model/stl;base64,abcd'}])assert.throws(()=>validateInput(input));
 for(const parameters of [{printer_type:'resin'},{intended_print_height_mm:1001},{intended_print_height_mm:0},{intended_print_height_mm:NaN},{intended_print_height_mm:'100'},{intended_print_height_mm:100,intended_print_longest_side_mm:100},{wall_thickness_mm:1}])assert.throws(()=>validateParameters(parameters));
 for(const printer_type of ['fdm','sla','full_color'])assert.deepEqual(validateParameters({printer_type,intended_print_longest_side_mm:1}),{printer_type,intended_print_longest_side_mm:1});
 const f=fixture([]);await assert.rejects(f.run({input:{model_url:'https://assets.meshy.ai/model.stl'},parameters:{intended_print_height_mm:100}}),/requires GLB/);assert.equal(f.calls.length,0);
});
test('local GLB uploads are bounded/validated and are not persisted in jobs',async()=>{
 const glb=Buffer.alloc(12);glb.write('glTF');glb.writeUInt32LE(2,4);glb.writeUInt32LE(12,8);const input={model_url:'data:model/gltf-binary;base64,'+glb.toString('base64')};assert.deepEqual(validateInput(input),input);assert.throws(()=>validateInput({model_url:'data:model/gltf-binary;base64,YWJjZA=='}),/valid bounded GLB/);
 const f=fixture([{result:taskId},{status:'SUCCEEDED'}]);await f.run({input});assert.equal(JSON.stringify(f.jobs).includes('data:model'),false);assert.equal(f.jobs[0].sourceType,'glb-upload');
});
