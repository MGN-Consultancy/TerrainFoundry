const crypto = require('node:crypto');

const MESHY = 'https://api.meshy.ai/openapi/v1';
const OPENAI = 'https://api.openai.com/v1';
const IMAGE_LIMIT = 20 * 1024 * 1024;
const MODEL_LIMIT = 100 * 1024 * 1024;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PURPOSES = new Set(['dnd','railway','racing','other']);
function purposeFor(workspace){const purpose=workspace.design?.purpose||'dnd';if(!PURPOSES.has(purpose))throw Error('Choose D&D, railway, racing or another design purpose.');return purpose;}
function conceptReferences(workspace,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['referenceConceptIds','useSelectedConcept'].includes(k)))throw Error('Invalid concept reference options.');
  if(options.useSelectedConcept!==undefined&&typeof options.useSelectedConcept!=='boolean')throw Error('Choose whether to use the selected concept.');
  const uploads=(workspace.referenceImages||[]).filter(r=>r.active===true);
  const selected=workspace.mainConceptId||workspace.selectedConceptId;
  const ids=options.referenceConceptIds??(options.useSelectedConcept!==false&&selected?[selected]:[]);
  if(!Array.isArray(ids)||ids.length>4||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Choose up to four different retained concept references.');
  const concepts=ids.map(id=>{const c=workspace.concepts?.find(c=>c.id===id);if(!c||c.retained!==true)throw Error('Choose a retained concept before asking for an amendment.');return {...c,referenceType:'concept'};});
  const references=[...concepts,...uploads.map(r=>({...r,referenceType:'upload'}))];
  if(references.length>4)throw Error('Use at most four reference images in total. Disable an uploaded reference before adding another concept view.');
  if(new Set(references.map(r=>r.id)).size!==references.length)throw Error('Concept and upload reference identities must be distinct.');
  references.forEach(r=>imageData(r.image));return references;
}

function imageData(value) {
  if (typeof value !== 'string' || value.length > IMAGE_LIMIT * 1.4 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Choose a PNG, JPEG or WebP concept under 20 MB.');
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
  if (!bytes.length || bytes.length > IMAGE_LIMIT) throw Error('Concept image exceeds the 20 MB limit.');
  const valid = value.startsWith('data:image/png;') ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : value.startsWith('data:image/jpeg;') ? bytes[0] === 255 && bytes[1] === 216 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw Error('Concept image does not match its declared format.');
  return value;
}

// STL has no declared up axis. Use the design's selected source axis (Y default)
// and convert the resulting candidate to Z-up for slicing and orientation review.
// Height is the chosen vertical extent, never the longest bounding-box dimension.
function scaleSTL(input, heightMm, upAxis = 'y') {
  if (!Number.isFinite(heightMm) || heightMm < 1 || heightMm > 1000) throw Error('Choose a model height from 1 to 1000 mm before generation.');
  if (!['y','z'].includes(upAxis)) throw Error('Choose Y or Z as the source model up axis.');
  const vertices = [];
  if (input.length >= 84 && 84 + input.readUInt32LE(80) * 50 === input.length) {
    const count = input.readUInt32LE(80);
    if (!count || count > 600000) throw Error('Model must contain between 1 and 600,000 triangles.');
    for (let i=0;i<count;i++) for (let j=0;j<9;j++) vertices.push(input.readFloatLE(96+i*50+j*4));
  } else {
    const source = input.toString('utf8');
    if (!/^\s*solid\b/i.test(source) || !source.includes('endsolid')) throw Error('Meshy output is not a supported STL.');
    for (const m of source.matchAll(/\bvertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
      vertices.push(Number(m[1]),Number(m[2]),Number(m[3]));
      if (vertices.length > 600000*9) throw Error('Model exceeds 600,000 triangles.');
    }
  }
  if (!vertices.length || vertices.length%9) throw Error('Model contains no complete triangles.');
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=3) {
    const p=upAxis==='y'?[vertices[i],-vertices[i+2],vertices[i+1]]:vertices.slice(i,i+3);
    for(let j=0;j<3;j++) { if(!Number.isFinite(p[j]) || Math.abs(p[j])>1e9) throw Error('Model contains invalid coordinates.'); vertices[i+j]=p[j];min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]); }
  }
  const extent=max[2]-min[2];
  if(extent<=1e-8) throw Error('Model has no measurable height.');
  const factor=heightMm/extent,center=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]];
  const out=Buffer.alloc(84+vertices.length/9*50);out.write('Terrain Foundry: scaled geometry; print review required');out.writeUInt32LE(vertices.length/9,80);
  for(let i=0;i<vertices.length;i+=9) {
    const tri=vertices.slice(i,i+9).map((v,j)=>(v-center[j%3])*factor),a=tri.slice(0,3),b=tri.slice(3,6),c=tri.slice(6,9),u=b.map((v,j)=>v-a[j]),v=c.map((n,j)=>n-a[j]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);
    const offset=84+i/9*50;
    for(let j=0;j<3;j++)out.writeFloatLE(len?n[j]/len:0,offset+j*4);
    for(let j=0;j<9;j++)out.writeFloatLE(tri[j],offset+12+j*4);
  }
  return {bytes:out,scale:factor,heightMm,sourceUpAxis:upAxis,outputUpAxis:'z',sizeMm:max.map((n,j)=>(n-min[j])*factor)};
}

function createCreativeGeneration({library,ai,fetchImpl=fetch,onProgress=()=>{},pollIntervalMs=10000,maxPolls=180,wait=sleep,now=Date.now}) {
  const busy=new Set(),verified=new Map();
  const emit=(id,phase,progress)=>{try{onProgress({id,phase,progress,percent:progress});}catch{}};
  async function bounded(response,limit) {
    if(Number(response.headers?.get('content-length'))>limit)throw Error('Provider output exceeds the download limit.');
    const reader=response.body?.getReader();if(!reader)throw Error('Provider returned no response body.');
    let size=0;const parts=[];
    for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>limit){await reader.cancel();throw Error('Provider output exceeds the download limit.');}parts.push(Buffer.from(item.value));}
    return Buffer.concat(parts);
  }
  async function request(url,options={},limit=2*1024*1024) {
    let response;try{response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(options.method==='POST'?120000:30000)});}catch{throw Error('Provider connection failed. Check your connection; paid requests are never retried automatically.');}
    if(!response.ok){const reason={400:'The provider rejected these generation settings.',401:'The API key was rejected. Update it in Settings.',402:'Your Meshy account has insufficient credits.',403:'This API key cannot access this operation. Check its permissions.',404:'The selected model or task is unavailable.',429:'The provider has reached its usage or billing limit.'}[response.status]||'The provider could not complete this request.';const error=Error(reason+' (HTTP '+response.status+').');error.httpStatus=response.status;throw error;}
    return bounded(response,limit);
  }
  async function json(url,options,limit){try{return JSON.parse((await request(url,options,limit)).toString('utf8'));}catch(e){if(e instanceof SyntaxError)throw Error('Provider returned invalid JSON.');throw e;}}
  async function keyFor(provider){return provider==='openai'?ai.voiceKey():ai.meshyKey();}
  async function validateProvider(provider,{force=false}={}) {
    if(!['openai','meshy'].includes(provider))throw Error('Unknown AI provider.');
    let key;try{key=await keyFor(provider);}catch{return {provider,configured:false,working:false,message:'Add your '+(provider==='openai'?'OpenAI':'Meshy')+' API key in Settings to enable this feature.'};}
    const fingerprint=crypto.createHash('sha256').update(key).digest('hex'),cached=verified.get(provider);
    if(!force&&cached?.fingerprint===fingerprint&&now()-cached.checkedAt<60000)return {...cached.result};
    let result;
    try{const value=await json(provider==='openai'?OPENAI+'/models':MESHY+'/balance',{headers:{Authorization:'Bearer '+key}});if(provider==='openai'&&!Array.isArray(value.data))throw Error('OpenAI returned no model list.');if(provider==='meshy'&&(!Number.isFinite(value.balance)||value.balance<0))throw Error('Meshy returned no valid balance.');result={provider,configured:true,working:true,checkedAt:now(),message:'API credentials accepted. Individual model permissions and billing are checked when generating.',...(provider==='meshy'?{balance:value.balance}:{})};}
    catch(e){result={provider,configured:true,working:false,checkedAt:now(),message:e.message};}
    verified.set(provider,{fingerprint,checkedAt:now(),result});return {...result};
  }
  async function gate(provider){const status=await validateProvider(provider);if(!status.working)throw Error(status.message);if(provider==='meshy'&&status.balance===0)throw Error('Your Meshy API key works, but its account has no credits. Add credits in Meshy before generating a model.');return keyFor(provider);}
  async function mutate(id,fn){const value=await library.load(id);fn(value);return library.save(value);}
  async function exclusive(id,fn){if(busy.has(id))throw Error('A generation is already running for this design.');busy.add(id);try{return await fn();}finally{busy.delete(id);}}
  async function generateConcept(id,prompt,options={}) {return exclusive(id,async()=>{
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>6000)throw Error('Describe the concept in 1–6000 characters.');
    const workspace=await library.load(id);
    if((workspace.concepts?.length||0)>=30)throw Error('Remove an unwanted concept before generating another; keep at most 30 per asset.');
    const references=conceptReferences(workspace,options),purpose=purposeFor(workspace);
    const key=await gate('openai'),status=await ai.status();
    const imageModel=status.providers?.openai?.imageModel||status.imageModel||'gpt-image-1';
    if(!/^(gpt-image-[a-zA-Z0-9.-]+|chatgpt-image-latest)$/.test(imageModel))throw Error('Choose a valid OpenAI image model in Settings.');
    const safePrompt=prompt.split(key).join('[removed]');
    const instructions=workspace.kind==='character'?'Original printable figure concept for '+({dnd:'a D&D tabletop character',railway:'a model railway figure',racing:'a model racing figure',other:'the user chosen model-making purpose'}[purpose])+'. Single full figure, head to feet visible, plain background, no text or logos. Preserve the described costume and anatomy.':'Original printable '+({dnd:'tabletop fantasy',railway:'model railway',racing:'model racing',other:'user chosen model-making'}[purpose])+' scenery concept. Show the complete piece, detailed sculpted surfaces and a plain background. Do not depict invented OpenLOCK sockets; the connector template is engineered separately.';
    const editGuide=references.length?'\nUse the attached reference images as actual visual source material. Preserve the primary reference identity, silhouette, materials, proportions and shared details unless the requested amendment changes them. Generate one revised concept, not a collage. Additional views depict the same object; do not combine different alternative designs.':'';
    const body={model:imageModel,prompt:(instructions+'\nAsset name: '+workspace.name+'\nExisting design description: '+workspace.description+'\nDesign brief: '+JSON.stringify(workspace.design||{}).slice(0,4000)+editGuide+'\nRequested change: '+safePrompt).split(key).join('[removed]'),n:1,size:'1024x1024',output_format:'png'};
    if(references.length)body.images=references.map(r=>({image_url:r.image}));
    emit(id,'Generating concept',0);
    const result=await json(OPENAI+(references.length?'/images/edits':'/images/generations'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)},IMAGE_LIMIT*1.4);
    const b64=result.data?.[0]?.b64_json;if(typeof b64!=='string')throw Error('OpenAI did not return an image. No automatic retry was made.');
    const concept={id:crypto.randomUUID(),name:'Concept '+((workspace.concepts?.length||0)+1),image:imageData('data:image/png;base64,'+b64),prompt:safePrompt,approved:false,retained:true,createdAt:now(),provider:'openai',model:imageModel,usage:result.usage||null,referenceIds:references.map(r=>r.id),...(references.find(r=>r.referenceType==='concept')?{parentConceptId:references.find(r=>r.referenceType==='concept').id}:{})};
    const saved=await mutate(id,w=>{w.concepts||=[];w.concepts.push(concept);});emit(id,'Concept ready for review',100);return saved;
  });}
  async function download(url) {
    let address;try{address=new URL(url);}catch{throw Error('Meshy returned an invalid download address.');}
    if(address.protocol!=='https:'||address.hostname!=='assets.meshy.ai'||address.username||address.password||address.port)throw Error('Meshy returned an untrusted download address.');
    return request(address.href,{},MODEL_LIMIT);
  }
  async function poll(id,key) {
    let workspace=await library.load(id),job=workspace.modelJob;
    if(!job?.taskId)throw Error('No saved Meshy task is available. Recover the task ID from Meshy task history before retrying an uncertain submission.');
    if(!/^[A-Za-z0-9-]{8,100}$/.test(job.taskId))throw Error('Invalid saved Meshy task ID.');
    if(job.status==='installed')return workspace;
    if(['FAILED','CANCELED'].includes(job.status))throw Error('This Meshy task ended unsuccessfully. Review it before starting another paid job.');
    for(let i=0;i<maxPolls;i++) {
      if(i)await wait(pollIntervalMs);
      const endpoint=job.endpoint||'image-to-3d';if(!['image-to-3d','multi-image-to-3d'].includes(endpoint))throw Error('Invalid saved Meshy endpoint.');
      const task=await json(MESHY+'/'+endpoint+'/'+encodeURIComponent(job.taskId),{headers:{Authorization:'Bearer '+key}});
      if(!['PENDING','IN_PROGRESS','SUCCEEDED','FAILED','CANCELED'].includes(task.status))throw Error('Meshy returned an unknown task state. Resume the saved task later.');
      const progress=Number.isFinite(task.progress)?Math.max(0,Math.min(100,task.progress)):0;
      await mutate(id,w=>{if(w.modelJob?.taskId!==job.taskId)throw Error('The current design task changed.');Object.assign(w.modelJob,{status:task.status,progress});});emit(id,'Meshy '+task.status.toLowerCase().replace('_',' '),progress);
      if(['FAILED','CANCELED'].includes(task.status))throw Error('Meshy could not generate this model. No automatic retry was made.');
      if(task.status!=='SUCCEEDED')continue;
      if(typeof task.model_urls?.stl!=='string')throw Error('Completed Meshy task has no STL. Its task ID remains saved for recovery.');
      const rawStl=await download(task.model_urls.stl);
      let stl=null,validation,scale;
      try{scale=scaleSTL(rawStl,job.heightMm,job.upAxis);stl=scale.bytes;const {inspectSTL}=await import('./print-geometry.mjs');validation={geometry:inspectSTL(stl,[1000,1000,1000]),status:'needs-print-review',physicalFitVerified:false,minimumWallThicknessVerified:false};}
      catch(e){validation={status:'needs-repair',message:e.message,physicalFitVerified:false,minimumWallThicknessVerified:false};}
      let glb;try{if(task.model_urls.glb)glb=await download(task.model_urls.glb);}catch{validation.previewDownloadFailed=true;}
      const metadata=JSON.parse(JSON.stringify({provider:'meshy',taskId:job.taskId,conceptId:job.conceptId,conceptIds:job.conceptIds||[job.conceptId],endpoint:job.endpoint||'image-to-3d',purpose:job.purpose||purposeFor(workspace),heightMm:job.heightMm,sourceUpAxis:job.upAxis,outputUpAxis:'z',orientationVerified:false,scaleFactor:scale?.scale,sizeMm:scale?.sizeMm,validation,printReady:false,openlock:job.openlock?{requested:true,status:'adapter-required',floorDatumMm:8,profile:'official-template',message:'Generated geometry has no certified sockets. Assemble and validate deterministic OpenLOCK templates separately.'}:{requested:false},usage:task.credits??task.usage??null,createdAt:new Date(now()).toISOString()}));
      // Even invalid/too-complex paid outputs are installed as raw candidates for repair.
      await library.installModel(id,{...metadata,rawStl,stl,glb,metadata});
      const saved=await mutate(id,w=>{if(w.modelJob?.taskId===job.taskId)Object.assign(w.modelJob,{status:'installed',progress:100,metadata});});
      emit(id,validation.status==='needs-repair'?'Model saved for repair':'Model saved for print review',100);return saved;
    }
    throw Error('Meshy is still processing. Resume this saved task later; no additional generation charge is needed.');
  }
  async function generateModel(id,conceptSelection) {return exclusive(id,async()=>{
    const workspace=await library.load(id),conceptIds=Array.isArray(conceptSelection)?conceptSelection:[conceptSelection];
    if(!conceptIds.length||conceptIds.length>4||conceptIds.some(id=>typeof id!=='string')||new Set(conceptIds).size!==conceptIds.length)throw Error('Choose one to four distinct approved concepts of the same model.');
    const concepts=conceptIds.map(conceptId=>{const concept=workspace.concepts?.find(c=>c.id===conceptId);if(!concept||concept.approved!==true||concept.retained!==true)throw Error('Lock in and retain every selected concept before submitting it to Meshy.');imageData(concept.image);return concept;});
    const conceptId=conceptIds[0],endpoint=conceptIds.length>1?'multi-image-to-3d':'image-to-3d',purpose=purposeFor(workspace);
    const heightMm=workspace.design?.heightMm??workspace.heightMm;
    if(!Number.isFinite(heightMm)||heightMm<1||heightMm>1000)throw Error('Choose a model height from 1 to 1000 mm before generation.');
    if(workspace.modelJob)throw Error('This design already has a Meshy submission. Resume or review its saved task before creating another paid model.');
    const upAxis=workspace.design?.upAxis||'y';if(!['y','z'].includes(upAxis))throw Error('Choose Y or Z as the source model up axis.');
    const key=await gate('meshy');
    const marker={conceptId,conceptIds,endpoint,purpose,status:'submitting',submissionId:crypto.randomUUID(),startedAt:new Date(now()).toISOString(),heightMm,upAxis,openlock:workspace.kind!=='character'&&!!workspace.design?.openlock};
    await mutate(id,w=>{if(w.modelJob)throw Error('A model submission was already saved.');w.modelJob=marker;});
    emit(id,'Submitting approved concept to Meshy',0);
    let created;
    const body={ai_model:'meshy-7.1',should_texture:true,enable_pbr:true,should_remesh:false,image_enhancement:false,target_formats:['stl','glb'],moderation:true,...(conceptIds.length>1?{image_urls:concepts.map(c=>c.image)}:{image_url:concepts[0].image,model_type:'standard'})};
    try{created=await json(MESHY+'/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)});}
    catch(e){await mutate(id,w=>{w.modelJob.status=e.httpStatus&&e.httpStatus<500?'rejected':'submission-uncertain';w.modelJob.message='No automatic resubmission. '+e.message;});throw e;}
    if(typeof created.result!=='string'||!/^[A-Za-z0-9-]{8,100}$/.test(created.result)){await mutate(id,w=>{w.modelJob.status='submission-uncertain';});throw Error('Meshy returned no valid task ID. Check its task history before submitting again.');}
    await mutate(id,w=>{Object.assign(w.modelJob,{taskId:created.result,status:'PENDING',progress:0});});
    return poll(id,key);
  });}
  async function resumeModel(id){return exclusive(id,async()=>poll(id,await gate('meshy')));}
  return {generateConcept,generateModel,resumeModel,validateProvider,providerStatus:validateProvider};
}
module.exports={createCreativeGeneration,scaleSTL};
