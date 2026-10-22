const crypto=require('node:crypto');
const {createMeshyPrintability}=require('./meshy-printability.cjs');
const {normalizeMeshyPrint,printParameters}=require('./meshy-print-settings.cjs');
const {reportedCredits}=require('./provider-errors.cjs');
const LIMIT=100*1024*1024;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function retainedTask(task){
 if(!task)return task;const p=task.printability,t=p?.thin_walls,intended=p?.intended_print;
 return {status:task.status,...(typeof task.id==='string'?{id:task.id}:{}),progress:task.progress||0,credits:reportedCredits(task),...(task.model_urls?.glb?{model_urls:{glb:String(task.model_urls.glb).slice(0,10000)}}:{}),...(task.task_error?{task_error:{message:String(task.task_error.message||'Provider task failed').slice(0,700)}}:{}),...(p?{printability:{thin_walls:t?{status:['healthy','error','unknown'].includes(t.status)?t.status:'unknown',thin_area_ratio:Number.isFinite(t.thin_area_ratio)&&t.thin_area_ratio>=0&&t.thin_area_ratio<=1?t.thin_area_ratio:null,has_thin_walls:typeof t.has_thin_walls==='boolean'?t.has_thin_walls:null}:null,intended_print:intended?Object.fromEntries(Object.entries(intended).filter(([key])=>['printer_type','height_mm','longest_side_mm','wall_thickness_mm','dimensions_mm'].includes(key))):null}}:{})};
}
function createCreativePrintability({library,ai,fetchImpl=fetch,onProgress=()=>{},wait,pollIntervalMs,maxPolls,now=Date.now}){
 const active=new Map();
 async function mutate(id,change){const record=await library.load(id);record.design||={};change(record.design,record);return library.save(record);}
 async function options(record){return normalizeMeshyPrint(record.design?.meshyPrintOptions||(await ai.status?.())?.meshyPrint,{strict:true});}
 async function response(url,init={},signal){
  const r=await fetchImpl(url,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
  if(!r.ok){const error=Error('Meshy printability request failed (HTTP '+r.status+'). Resume a saved task rather than submit another repair.');error.httpStatus=r.status;throw error;}return r;
 }
 async function json(url,init,signal){const r=await response(url,init,signal),text=await r.text();if(Buffer.byteLength(text)>256*1024)throw Error('Meshy task response exceeded its safe limit.');return JSON.parse(text);}
 async function download(url,signal){
  const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Meshy repair must return a secure model download.');
  const r=await response(url,{},signal),size=Number(r.headers.get('content-length'));if(size>LIMIT)throw Error('Repaired source exceeds 100 MiB.');const chunks=[];let count=0;
  for await(const chunk of r.body){count+=chunk.length;if(count>LIMIT)throw Error('Repaired source exceeds 100 MiB.');chunks.push(chunk);}if(!count)throw Error('Meshy returned an empty repaired source.');return Buffer.concat(chunks);
 }
 async function inputGeometry(artifact,record,{source=false}={}){
  const {stlToPrintGLB}=require('./printability-geometry.cjs');
  if(source&&artifact.glb){
   const bytes=Buffer.from(artifact.glb);if(bytes.length>LIMIT)throw Error('Retained source GLB exceeds 100 MiB.');
   return {input:{model_url:'data:model/gltf-binary;base64,'+bytes.toString('base64')},sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }
  const stl=source?(artifact.rawStl||(artifact.ext==='stl'?artifact.bytes:null)):(artifact.ext==='stl'?artifact.bytes:null);
  if(stl){const raw=source||artifact.metadata?.validation?.status==='needs-repair',sourceUpAxis=raw?(artifact.metadata?.sourceUpAxis||record.design?.upAxis||'z'):(artifact.metadata?.outputUpAxis||artifact.metadata?.sourceUpAxis||record.design?.upAxis||'z'),value=stlToPrintGLB(Buffer.from(stl),{sourceUpAxis});return {...value,input:{model_url:value.modelUrl}};}
  if(artifact.ext==='glb'){
   const bytes=Buffer.from(artifact.bytes);if(bytes.length>LIMIT)throw Error('Working GLB exceeds 100 MiB.');const {retainedGLBGeometry}=await import('./scenery-glb-source.mjs'),mesh=retainedGLBGeometry(bytes),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<mesh.positions.length;i++){const axis=i%3,value=mesh.positions[i]*1000;min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}const sizeMm=max.map((v,i)=>v-min[i]);return {input:{model_url:'data:model/gltf-binary;base64,'+bytes.toString('base64')},sizeMm,heightMm:sizeMm[1],longestMm:Math.max(...sizeMm),sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }
  throw Error('Check printability using a retained STL or uncompressed GLB. Import or convert this geometry to one of those formats first.');
 }
 const report=(value,candidateId,extra={})=>{const task=retainedTask(value);return {candidateId,status:task.status,thinWalls:task.printability?.thin_walls??null,intendedPrint:task.printability?.intended_print??null,taskId:task.id||null,checkedAt:new Date(now()).toISOString(),...extra};};
 async function recordRepairUsage(task,job){if(!task||!job.taskId||!['SUCCEEDED','FAILED','CANCELED'].includes(task.status))return;await ai.recordUsage?.({provider:'meshy',model:'print-repair',kind:'meshy',usage:null,credits:reportedCredits(task),outcome:task.status==='SUCCEEDED'?'completed':task.status==='CANCELED'?'cancelled':'failed',dedupeKey:'meshy-print-repair:'+job.taskId});}
 async function runTask(id,flow,role,kind,input,parameters,key,signal,confirmCredits){
  const worker=createMeshyPrintability({request:(url,init)=>json(url,init,signal),wait,pollIntervalMs,maxPolls});
  const result=await worker.run({kind,input,parameters,key,job:flow.jobs[role],confirmCredits,onJob:async job=>{
   flow.jobs[role]={...job,...(job.task?{task:retainedTask(job.task)}:{})};flow.phase=role;await mutate(id,design=>{design.meshyPrintWorkflow=flow;});if(kind==='repair'&&['FAILED','CANCELED'].includes(job.status))await recordRepairUsage(job.task,job);onProgress({id,stage:'Meshy '+role,progress:job.progress||0});
  }});if(kind==='repair')await recordRepairUsage(result.task,result.job);return result.task;
 }
 async function checkCurrent(id,flow,key,signal,candidateId){
  const asset=await library.load(id),artifact=await library.readModelArtifacts(id,candidateId),geometry=await inputGeometry(artifact,asset),unfitted=artifact.metadata?.validation?.status==='needs-repair',configuredHeight=flow.modelDesign?.heightMm??asset.design.heightMm,bodyHeight=configuredHeight-((flow.modelDesign?.openlock??asset.design.openlock)?7.8:0),parameters=unfitted&&flow.options.sizeMode==='model'?printParameters(flow.options,geometry,{bodyHeightMm:bodyHeight}):printParameters(flow.options,geometry);
  const task=await runTask(id,flow,'finalAnalysis','analyze',geometry.input,parameters,key,signal);
  flow.status='completed';flow.phase='completed';
  const creditNote=flow.kind==='repair'?(flow.repairCredits===null?' Meshy repair credits were not reported.':' Meshy repair usage: '+flow.repairCredits+' credits.') : '';
  return mutate(id,design=>{design.meshyPrintWorkflow=flow;design.meshyPrintReport=report(task,candidateId,{scope:unfitted?'unfitted-source':'working-geometry',...(flow.kind==='repair'?{repairCredits:flow.repairCredits}:{}),message:(unfitted?'Provisional source-body check at the selected print size. Local fitting must succeed and the final assembled geometry must be checked again. ':'Checked the working geometry at the selected print size. ')+'A healthy Meshy result may still contain up to 5% thin surface; slicing and physical fit remain separate checks.'+creditNote});});
 }
 async function repair(id,flow,key,signal,confirmCredits){
  const currentAsset=await library.load(id),asset={...currentAsset,design:{...currentAsset.design,...flow.modelDesign}},artifact=await library.readModelArtifacts(id,flow.sourceCandidateId),working=await inputGeometry(artifact,asset);
  if(!flow.jobs.repair?.taskId&&(asset.model?.history?.length||0)>=19)throw Error('This design already retains 20 model versions. Clone the design before spending Meshy credits on another repair.');
  const scenerySpec=asset.kind==='scenery'?(await import('./scenery-adapter.mjs')).scenerySpecForDesign(asset.design):null;
  // Repair the retained sculpt, then regenerate connectors locally. Never send a
  // protected fitted OpenLOCK base to a geometry-changing provider operation.
  if(artifact.metadata?.validation?.adapterStatus==='completed'&&artifact.metadata?.openlock?.requested&&!artifact.rawStl&&!artifact.glb)throw Error('Retained scenery body is missing. Import the original sculpt before repairing protected OpenLOCK geometry.');
  const source=await inputGeometry(artifact,asset,{source:true}),bodyHeightMm=asset.kind==='scenery'&&asset.design.openlock?asset.design.heightMm-8+.2:asset.design.heightMm;
  const parameters=printParameters(flow.options,working,{bodyHeightMm});
  const analyzed=await runTask(id,flow,'sourceAnalysis','analyze',source.input,parameters,key,signal);
  const repaired=await runTask(id,flow,'repair','repair',{input_task_id:flow.jobs.sourceAnalysis.taskId},parameters,key,signal,confirmCredits||flow.approvedRepair);
  flow.repairCredits=reportedCredits(repaired);const taskId=flow.jobs.repair.taskId;
  let current=await library.load(id),installed=[current.model,...(current.model?.history||[])].find(m=>m?.printabilityRepairTaskId===taskId);
  if(!installed){
   if(!repaired.model_urls?.glb)throw Error('Meshy repair did not return its GLB source. Resume this saved task; do not pay for another repair.');
   const glb=await download(repaired.model_urls.glb,signal),{glbToSTL}=require('./printability-geometry.cjs'),converted=await glbToSTL(glb),sourceUpAxis=asset.design.upAxis||'y';let rawStl=Buffer.from(converted.bytes);if(sourceUpAxis==='z')rawStl=require('./creative-generation.cjs').scaleSTL(rawStl,converted.heightMm,'y').bytes;let stl=null,adapted=null,scale=null,validation,adapterError;
   try{
    if(asset.kind==='scenery'){const {adaptScenerySTL}=await import('./scenery-adapter.mjs');adapted=await adaptScenerySTL(rawStl,scenerySpec,{sourceGLB:glb});stl=adapted.bytes;validation=adapted.validation;}
    else{scale=require('./creative-generation.cjs').scaleSTL(rawStl,asset.design.heightMm,sourceUpAxis);stl=scale.bytes;const {inspectSTL}=await import('./print-geometry.mjs');validation={geometry:inspectSTL(stl,[1000,1000,1000]),status:'needs-print-review',physicalFitVerified:false,minimumWallThicknessVerified:false};}
   }catch(error){adapterError=error.message;validation={status:'needs-repair',message:error.message,physicalFitVerified:false,minimumWallThicknessVerified:false};}
   const metadata=JSON.parse(JSON.stringify({provider:'meshy-print-repair',sourceProvider:artifact.metadata?.sourceProvider||artifact.metadata?.provider||'import',sourceCandidateId:artifact.metadata.id,printabilityRepairTaskId:taskId,sourceTaskId:artifact.metadata.sourceTaskId||artifact.metadata.taskId,heightMm:asset.design.heightMm,sourceUpAxis,outputUpAxis:'z',sizeMm:adapted?.sizeMm||scale?.sizeMm,adapter:adapted?.metadata,openlock:adapted?.metadata.openlock||{requested:asset.design.openlock===true,status:adapterError?'adapter-failed':'none'},validation,printReady:false,texturesRemoved:true,sourceAnalysisTaskId:flow.jobs.sourceAnalysis.taskId,usage:flow.repairCredits,createdAt:new Date(now()).toISOString()}));
   await library.installModel(id,{...metadata,rawStl,stl,glb,metadata});current=await library.load(id);installed=current.model;
  }
  flow.repairCandidateId=installed.id;await mutate(id,design=>{design.meshyPrintWorkflow=flow;});
  if(installed.validation?.status==='needs-repair'){
   flow.status='completed';flow.phase='needs-local-repair';return mutate(id,design=>{design.meshyPrintWorkflow=flow;design.meshyPrintReport={candidateId:installed.id,status:'needs-local-repair',thinWalls:null,message:'Meshy source repaired and retained, but local module validation failed: '+installed.validation.message+'. The original candidate remains available. No print-ready claim is made.'};});
  }
  return checkCurrent(id,flow,key,signal,installed.id);
 }
 async function execute(id,kind,candidateId,config={}){
  if(active.has(id))throw Error('A printability task is already running for this asset.');const abort=new AbortController();let done;
  const operation=(async()=>{
   let record=await library.load(id);const chosen=candidateId||record.model?.id;if(!chosen)throw Error('Choose a saved model before checking printability.');const artifact=await library.readModelArtifacts(id,chosen);let flow=record.design?.meshyPrintWorkflow;
   const pending=flow&&!['completed','failed'].includes(flow.status);
   if(config.resume){if(!flow)throw Error('No saved printability task is available.');kind=flow.kind;candidateId=flow.sourceCandidateId;
    if(config.taskId!==undefined){if(typeof config.taskId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(config.taskId))throw Error('Paste the saved Meshy task UUID, not an API key.');const job=flow.jobs[flow.phase];if(!job||job.taskId||!['unknown','submitting'].includes(job.status))throw Error('This saved task does not need an ID recovered.');flow.jobs[flow.phase]={...job,taskId:config.taskId.toLowerCase(),status:'PENDING',manuallyRecovered:true};await mutate(id,design=>{design.meshyPrintWorkflow=flow;});}
   }
   else if(pending){if(flow.sourceCandidateId!==chosen||flow.kind!==kind)throw Error('Resume the saved printability task before starting another check or repair.');}
   else{
    if(kind==='repair'&&config.confirmCredits!==true)throw Error('Approve Meshy credits explicitly before starting a paid repair.');
    const selected=await options(record),signature=digest({kind,candidateId:chosen,source:artifact.metadata.sha256||artifact.metadata.artifact?.sha256||crypto.createHash('sha256').update(Buffer.from(artifact.bytes)).digest('hex'),options:selected});
    if(kind==='analyze'&&flow?.signature===signature&&flow.status==='completed')return record;
    const modelDesign={heightMm:record.design.heightMm??null,upAxis:record.design.upAxis||'y',openlock:record.design.openlock??false,gridWidth:record.design.gridWidth??1,gridDepth:record.design.gridDepth??1,floorDatumMm:record.design.floorDatumMm??record.design.scenery?.floorDatumMm??8,scenery:{gridMm:record.design.scenery?.gridMm??25.4,floorDatumMm:record.design.scenery?.floorDatumMm??8,connectorSystem:record.design.scenery?.connectorSystem||(record.design.openlock?'openlock':'none')}};
    flow={id:crypto.randomUUID(),kind,sourceCandidateId:chosen,options:selected,modelDesign,signature,status:'running',phase:'starting',approvedRepair:kind==='repair'&&config.confirmCredits===true,jobs:{},createdAt:new Date(now()).toISOString()};await mutate(id,design=>{design.meshyPrintWorkflow=flow;});
   }
   if(kind==='repair'&&!flow.approvedRepair)throw Error('The saved repair has no Meshy credit approval.');
   try{const key=await ai.meshyKey();return kind==='repair'?await repair(id,flow,key,abort.signal,config.confirmCredits):await checkCurrent(id,flow,key,abort.signal,flow.sourceCandidateId);}
   catch(error){let cause=error,missingTask=false;for(let depth=0;cause&&depth<5;depth++,cause=cause.cause)if(cause.httpStatus===404)missingTask=true;const currentJob=flow.jobs[flow.phase];if(missingTask&&currentJob?.manuallyRecovered){delete currentJob.taskId;currentJob.status='unknown';}flow.message=String(error.message).slice(0,1000);flow.status=!Object.keys(flow.jobs).length||['FAILED','CANCELED'].includes(currentJob?.status)?'failed':'paused';await mutate(id,design=>{design.meshyPrintWorkflow=flow;design.meshyPrintReport={candidateId:flow.repairCandidateId||flow.sourceCandidateId,status:flow.status==='failed'?'failed':'pending',thinWalls:null,operation:currentJob?.kind||flow.kind,needsTaskId:!!currentJob&&!currentJob.taskId&&['unknown','submitting'].includes(currentJob.status),progress:currentJob?.progress||0,message:flow.message};});throw error;}
  })();done=operation.finally(()=>active.delete(id));active.set(id,{abort,done});return done;
 }
 async function maybeAnalyze(id){try{const record=await library.load(id);if(!(await options(record)).analyzeAfterGeneration)return record;return await execute(id,'analyze');}catch(error){return mutate(id,design=>{design.meshyPrintReport={...(design.meshyPrintReport||{}),status:'pending',message:'Model retained. Free printability check needs attention: '+String(error.message).slice(0,700)};});}}
 return {analyze:(id,candidateId)=>execute(id,'analyze',candidateId),repair:(id,candidateId,config)=>execute(id,'repair',candidateId,config),resume:(id,config={})=>execute(id,'analyze',null,{resume:true,taskId:config?.taskId}),maybeAnalyze,cancel:()=>{for(const task of active.values())task.abort.abort();},flush:()=>Promise.allSettled([...active.values()].map(task=>task.done))};
}
module.exports={createCreativePrintability};
