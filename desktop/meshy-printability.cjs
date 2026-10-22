const crypto=require('node:crypto');
const ROOT='https://api.meshy.ai/openapi/v1/print';
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const STATES=new Set(['PENDING','IN_PROGRESS','SUCCEEDED','FAILED','CANCELED']);
const MAX_MODEL_BYTES=100000000,MAX_TASK_BYTES=192*1024,MAX_JOB_BYTES=256*1024;
const defaultWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function validateInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Choose a saved Meshy task or model to check.');
 const keys=Object.keys(value);if(keys.length!==1||!['input_task_id','model_url'].includes(keys[0]))throw Error('Send exactly one Meshy input task or model URL.');
 if(keys[0]==='input_task_id'){if(typeof value.input_task_id!=='string'||!UUID.test(value.input_task_id))throw Error('Invalid Meshy input task ID.');return {...value};}
 const url=value.model_url;if(typeof url!=='string')throw Error('Invalid printability model URL.');
 const prefix='data:model/gltf-binary;base64,';
 if(url.startsWith(prefix)){
  const data=url.slice(prefix.length);if(!data||data.length>Math.ceil(MAX_MODEL_BYTES/3)*4||data.length%4!==0||!/^[A-Za-z\d+/]+={0,2}$/.test(data))throw Error('Invalid or oversized GLB upload.');
  const bytes=Buffer.from(data,'base64');if(bytes.length>MAX_MODEL_BYTES||bytes.length<12||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Printability upload must be a valid bounded GLB 2 file.');
 }else{
  let parsed;try{parsed=new URL(url);}catch{throw Error('Invalid printability model URL.');}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash||url.length>16384)throw Error('Use a bounded HTTPS model URL without credentials or fragment.');
 }
 return {...value};
}
function validateParameters(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid Meshy print settings.');
 const allowed=new Set(['printer_type','intended_print_height_mm','intended_print_longest_side_mm']);for(const name of Object.keys(value))if(!allowed.has(name))throw Error('Unsupported Meshy print setting: '+name);
 const result={};if(Object.hasOwn(value,'printer_type')){if(!['fdm','sla','full_color'].includes(value.printer_type))throw Error('Choose FDM, SLA or full-color printing.');result.printer_type=value.printer_type;}
 const height=Object.hasOwn(value,'intended_print_height_mm'),longest=Object.hasOwn(value,'intended_print_longest_side_mm');if(height&&longest)throw Error('Choose print height or longest side, not both.');
 for(const name of ['intended_print_height_mm','intended_print_longest_side_mm'])if(Object.hasOwn(value,name)){const number=value[name];if(typeof number!=='number'||!Number.isFinite(number)||number<1||number>1000)throw Error('Print size must be between 1 and 1000 mm.');result[name]=number;}
 return result;
}
function sourceIdentity(kind,input,parameters){return crypto.createHash('sha256').update(JSON.stringify({kind,input,parameters})).digest('hex');}
function boundedClone(value,max,label){const text=JSON.stringify(value);if(Buffer.byteLength(text)>max)throw Error(label+' exceeds its safe saved-result limit.');return JSON.parse(text);}
function createMeshyPrintability({request,wait=defaultWait,pollIntervalMs=1500,maxPolls=80}={}){
 if(typeof request!=='function'||typeof wait!=='function'||!Number.isInteger(maxPolls)||maxPolls<1||maxPolls>1000||!Number.isFinite(pollIntervalMs)||pollIntervalMs<0||pollIntervalMs>60000)throw Error('Invalid Meshy printability worker configuration.');
 async function run({kind,input,parameters={},key,job:previous,onJob,confirmCredits=false}={}){
  if(!['analyze','repair'].includes(kind))throw Error('Choose Meshy analysis or repair.');
  input=validateInput(input);parameters=validateParameters(parameters);
  if(Object.hasOwn(parameters,'intended_print_height_mm')&&input.model_url&&!input.model_url.startsWith('data:model/gltf-binary;base64,')&&!/\.glb(?:\?|$)/i.test(input.model_url))throw Error('Height-based print sizing requires GLB geometry; use longest side for other formats.');
  if(typeof key!=='string'||!key.trim()||key.length>4096)throw Error('A Meshy API key is required.');
  if(typeof onJob!=='function')throw Error('Printability job persistence is required before contacting Meshy.');
  const sourceHash=sourceIdentity(kind,input,parameters),endpoint=ROOT+'/'+kind;
  let job;
  const publish=async()=>{const copy=boundedClone(job,MAX_JOB_BYTES,'Printability job');try{await onJob(copy);}catch(error){const message=job.taskId?'Could not save Meshy task '+job.taskId+'. Keep this task ID and resume it; do not submit another repair.':job.status==='submitting'?'Could not save the printability submission marker; no provider request was sent.':'Could not save the uncertain Meshy submission outcome. Keep the submission marker and recover its task ID from Meshy history; do not submit again.';const failure=Error(message);failure.job=copy;failure.cause=error;throw failure;}};
  const call=async(url,init={})=>request(url,{...init,headers:{...(init.headers||{}),Authorization:'Bearer '+key}});
  if(previous){
   job=boundedClone(previous,MAX_JOB_BYTES,'Saved printability job');
   if(job.kind!==kind||job.sourceHash!==sourceHash)throw Error('This saved printability task belongs to different geometry or print settings. Start a separate check for the edited model.');
   if(job.taskId&&!UUID.test(job.taskId))throw Error('Invalid saved Meshy printability task ID.');
   if(!job.taskId)throw Error('The previous Meshy submission may have been accepted. Recover its task ID from Meshy task history before trying again; no new request was sent.');
   if(['FAILED','CANCELED'].includes(job.status))throw Error('The saved Meshy printability task ended unsuccessfully. Review its result before starting another task.');
   if(job.status==='SUCCEEDED'&&job.task)return {job,task:boundedClone(job.task,MAX_TASK_BYTES,'Meshy result')};
  }else{
   if(kind==='repair'&&confirmCredits!==true)throw Error('Meshy repair uses credits. Confirm the paid repair before submitting it.');
   job={schemaVersion:1,kind,sourceHash,sourceType:input.input_task_id?'task':input.model_url.startsWith('data:')?'glb-upload':'https-model',parameters,submissionId:crypto.randomUUID(),status:'submitting',progress:0,submittedAt:Date.now(),...(input.input_task_id?{inputTaskId:input.input_task_id}:{}),...(kind==='repair'?{approvedRepair:true}:{})};
   await publish();
   let response;
   try{response=await call(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,...parameters})});if(typeof response?.result!=='string'||!UUID.test(response.result))throw Error('Meshy did not return a valid printability task ID.');}
   catch(error){job.status='unknown';job.error='Submission outcome is unknown. Recover the task ID from Meshy history before retrying.';await publish();const failure=Error(job.error);failure.job=boundedClone(job,MAX_JOB_BYTES,'Printability job');failure.cause=error;throw failure;}
   job.taskId=response.result;job.status='PENDING';await publish();
  }
  for(let poll=0;poll<maxPolls;poll++){
   if(poll)await wait(pollIntervalMs);
   let task;try{task=await call(endpoint+'/'+job.taskId);}catch(error){const failure=Error('Could not refresh the saved Meshy printability task. Resume it later; no new submission is needed.');failure.job=job;failure.cause=error;throw failure;}
   if(!task||Array.isArray(task)||!STATES.has(task.status)||task.id!==undefined&&task.id!==job.taskId)throw Error('Meshy returned an invalid printability task state. Resume the saved task later.');
   const progress=typeof task.progress==='number'&&Number.isFinite(task.progress)?Math.min(100,Math.max(0,task.progress)):0,changed=job.status!==task.status||job.progress!==progress;
   job.status=task.status;job.progress=progress;
   if(['SUCCEEDED','FAILED','CANCELED'].includes(task.status)){
    job.task=boundedClone(task,MAX_TASK_BYTES,'Meshy result');job.finishedAt=Date.now();await publish();
    if(task.status!=='SUCCEEDED'){const failure=Error('Meshy printability '+kind+' '+task.status.toLowerCase()+'. Review the saved provider result before submitting again.');failure.job=job;throw failure;}
    return {job,task:job.task};
   }
   if(changed)await publish();
  }
  job.pausedAt=Date.now();await publish();const failure=Error('Meshy is still processing this printability task. Resume the saved task to continue; this will not submit another paid job.');failure.job=job;throw failure;
 }
 return {run};
}
module.exports={createMeshyPrintability,validateInput,validateParameters};
