const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function createCampaignMeshy({store,ai,fetchImpl=fetch,onProgress=()=>{}}){
 let busy=false;const recent=[];
 async function json(response){
  let size=0;const parts=[];if(!response.body)throw Error('Meshy returned an empty response.');const reader=response.body.getReader();
  for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2_000_000){await reader.cancel();throw Error('Meshy response exceeded the safety limit.');}parts.push(Buffer.from(r.value));}
  const data=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(!response.ok)throw Error(response.status===401?'Meshy rejected the saved API key. Re-enter it in AI settings.':response.status===402?'Meshy reports that this account has insufficient credits.':response.status===429?'Meshy rate limit reached. Wait before trying again.':'Meshy could not complete the model request (HTTP '+response.status+').');return data;
 }
 async function request(url,options){return json(await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(60000)}));}
 async function resizeBinarySTL(source){
  if(source.length<134)throw Error('Meshy did not return a complete STL.');const count=source.readUInt32LE(80);
  if(count<4||count>600_000||84+count*50!==source.length)throw Error('Meshy returned an unsupported STL encoding or size.');
  const {inspectSTL}=await import('./print-geometry.mjs'),info=inspectSTL(source,[10000,10000,10000]),factor=32/Math.max(...info.sizeMm),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<count;i++){const base=96+i*50;for(let j=0;j<3;j++){const k=base+j*12;for(let a=0;a<3;a++){const v=source.readFloatLE(k+a*4);min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}}}
  const mid=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]],out=Buffer.from(source);
  for(let i=0;i<count;i++){const base=96+i*50;for(let j=0;j<3;j++){const k=base+j*12;for(let a=0;a<3;a++)out.writeFloatLE((source.readFloatLE(k+a*4)-mid[a])*factor+(a===2?0:16),k+a*4);}}
  inspectSTL(out,[64,64,64]);return out;
 }
 async function downloadSTL(url){
  const download=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!download.ok||!download.body)throw Error('Meshy model download failed.');
  const reader=download.body.getReader(),parts=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>100_000_000){await reader.cancel();throw Error('Meshy model is larger than the 100 MB safety limit.');}parts.push(Buffer.from(part.value));}return Buffer.concat(parts);
 }
 async function installModel(campaign,character,stl){
  const campaignId=campaign.id,directory=await store.folder(campaignId),modelPath='models/'+character.id+'.stl',modelDirectory=path.join(directory,'models'),target=path.join(modelDirectory,character.id+'.stl');
  await fs.mkdir(modelDirectory,{recursive:true});const dirStat=await fs.lstat(modelDirectory);if(!dirStat.isDirectory()||dirStat.isSymbolicLink())throw Error('Campaign model folder must be a normal local folder.');
  const realRoot=await fs.realpath(directory),realModels=await fs.realpath(modelDirectory);if(!realModels.startsWith(realRoot+path.sep))throw Error('Model path must stay inside the campaign.');
  try{const old=await fs.lstat(target);if(old.isSymbolicLink()||!old.isFile())throw Error('Existing model path is not a regular file.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const temporary=path.join(modelDirectory,'.'+character.id+'.'+crypto.randomUUID()+'.tmp'),backup=path.join(modelDirectory,'.'+character.id+'.'+crypto.randomUUID()+'.bak');await fs.writeFile(temporary,stl,{flag:'wx'});
  let hadOld=false,installed=false;
  try{
   const latest=await store.load(campaignId);if(latest.revision!==campaign.revision)throw Error('This campaign changed while Meshy was generating. The new model was not installed; check Meshy task history before retrying.');
   const latestCharacter=latest.characters.find(x=>x.id===character.id);if(!latestCharacter||latestCharacter.portrait!==character.portrait)throw Error('This character changed while Meshy was generating. The model was not installed.');
   try{await fs.rename(target,backup);hadOld=true;}catch(e){if(e.code!=='ENOENT')throw e;}
   await fs.rename(temporary,target);installed=true;character.modelFile=modelPath;const saved=await store.save(campaign);
   if(hadOld){await fs.rm(backup,{force:true}).catch(()=>{});hadOld=false;}return {campaign:saved,modelFile:modelPath,heightMm:32,triangles:stl.readUInt32LE(80)};
  }catch(e){if(installed){await fs.rm(target,{force:true}).catch(()=>{});installed=false;}if(hadOld){await fs.rename(backup,target).catch(()=>{});hadOld=false;}throw e;}
  finally{await fs.rm(temporary,{force:true}).catch(()=>{});await fs.rm(backup,{force:true}).catch(()=>{});}
 }
 async function generate(campaignId,characterId){
  if(busy)throw Error('A Meshy model request is already running.');while(recent.length&&recent[0]<Date.now()-3600000)recent.shift();if(recent.length>=3)throw Error('Local safety limit: three Meshy generations per hour.');
  busy=true;recent.push(Date.now());try{
   const campaign=await store.load(campaignId),character=campaign.characters.find(x=>x.id===characterId);
   if(!character||!character.portrait)throw Error('Choose a character and approve its portrait concept first.');
   if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(character.portrait)||character.portrait.length>6_000_000)throw Error('Use a PNG or JPEG character concept under 4 MB.');
   const key=await ai.meshyKey(),headers={'Content-Type':'application/json',Authorization:'Bearer '+key};onProgress({phase:'Submitting',percent:0});
   const created=await request('https://api.meshy.ai/openapi/v1/image-to-3d',{method:'POST',headers,body:JSON.stringify({image_url:character.portrait,model_type:'standard',ai_model:'meshy-7.1',should_texture:false,should_remesh:false,pose_mode:'a-pose',target_formats:['stl'],moderation:true})});
   if(typeof created.result!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(created.result))throw Error('Meshy did not return a valid task.');
   const taskId=created.result;let result;for(let i=0;i<180;i++){if(i>0)await new Promise(resolve=>setTimeout(resolve,10000));result=await request('https://api.meshy.ai/openapi/v1/image-to-3d/'+encodeURIComponent(taskId),{method:'GET',headers:{Authorization:'Bearer '+key}});if(result.status==='SUCCEEDED')break;if(result.status==='FAILED'||result.status==='CANCELED')throw Error('Meshy could not generate this model. No retry was made.');if(!['PENDING','IN_PROGRESS'].includes(result.status))throw Error('Meshy returned an unknown task state.');onProgress({phase:'Generating 32 mm miniature',percent:Math.min(90,5+Math.floor((i/180)*85))});}
   if(result?.status!=='SUCCEEDED'||typeof result.model_urls?.stl!=='string')throw Error('Meshy task timed out before an STL was ready. Check Meshy task history before retrying.');
   const assetUrl=new URL(result.model_urls.stl);if(assetUrl.protocol!=='https:'||assetUrl.hostname!=='assets.meshy.ai')throw Error('Meshy returned an untrusted model download address.');
   onProgress({phase:'Preparing 32 mm STL',percent:93});const stl=await resizeBinarySTL(await downloadSTL(assetUrl));const saved=await installModel(campaign,character,stl);onProgress({phase:'Saved to this campaign',percent:100});return saved;
  }finally{busy=false;}
 }
 return {generate};
}
module.exports={createCampaignMeshy};
