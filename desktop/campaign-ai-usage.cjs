const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {atomicWrite}=require('./project-store.cjs'),{validModel}=require('./campaign-ai-settings.cjs');
const MAX_BYTES=2000000,MAX_RECORDS=500,MAX_COUNT=100000000;
const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX_COUNT?v:null;
const optional=v=>v===undefined?0:count(v);
const validSource=v=>typeof v==='string'&&v.length<=300&&/^https:\/\/[^\s?#]+$/.test(v);
function validateRates(value){
 if(!value||value.schemaVersion!==1||value.currency!=='USD'||!/^[-a-zA-Z0-9._]{1,80}$/.test(value.version)||!/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedOn)||!Array.isArray(value.models)||value.models.length>100)throw Error('Invalid local AI price table');
 const models=[],seen=new Set();for(const r of value.models){
  if(!['openai','claude'].includes(r.provider)||!validModel(r.model)||!['text','image'].includes(r.kind)||!validSource(r.source))throw Error('Invalid local AI price table');
  const key=r.provider+'/'+r.model+'/'+r.kind;if(seen.has(key))throw Error('Duplicate AI price entry');seen.add(key);
  const out={provider:r.provider,model:r.model,kind:r.kind,source:r.source};
  for(const name of ['input','cacheRead','cacheWrite','cacheWrite5m','cacheWrite1h','output','textInput','imageInput','imageOutput','textOutput'])if(r[name]!==undefined){if(typeof r[name]!=='number'||!Number.isFinite(r[name])||r[name]<0||r[name]>1000)throw Error('Invalid local AI price');out[name]=r[name];}
  if(r.maxEstimatedInputTokens!==undefined){if(count(r.maxEstimatedInputTokens)===null)throw Error('Invalid price context limit');out.maxEstimatedInputTokens=r.maxEstimatedInputTokens;}
  models.push(out);
 }
 return {schemaVersion:1,version:value.version,verifiedOn:value.verifiedOn,currency:'USD',models};
}
function normalizeUsage(provider,kind,u){
 if(!u||typeof u!=='object'||Array.isArray(u))return null;
 const input=count(u.input_tokens),output=count(u.output_tokens);
 // Keep partial provider counts, but never infer a missing mandatory count.
 if(input===null&&output===null)return null;
 const read=optional(provider==='claude'?u.cache_read_input_tokens:u.input_tokens_details?.cached_tokens),write=optional(provider==='claude'?u.cache_creation_input_tokens:u.input_tokens_details?.cache_write_tokens);
 if(read===null||write===null)return null;
 const totalInput=input===null?null:provider==='claude'?input+read+write:input;
 if(totalInput!==null&&(totalInput>MAX_COUNT||provider==='openai'&&read+write>totalInput))return null;
 const n={inputTokens:totalInput,outputTokens:output,ordinaryInputTokens:input===null?null:provider==='claude'?input:input-read-write,cacheReadTokens:read,cacheCreationTokens:write};
 if(provider==='claude'&&u.cache_creation){n.cacheCreation5mTokens=count(u.cache_creation.ephemeral_5m_input_tokens);n.cacheCreation1hTokens=count(u.cache_creation.ephemeral_1h_input_tokens);if(n.cacheCreation5mTokens===null||n.cacheCreation1hTokens===null||n.cacheCreation5mTokens+n.cacheCreation1hTokens!==write)return null;}
 if(kind==='image'){
  n.textInputTokens=count(u.input_tokens_details?.text_tokens);n.imageInputTokens=count(u.input_tokens_details?.image_tokens);
  n.imageOutputTokens=u.output_tokens_details?count(u.output_tokens_details.image_tokens):output;n.textOutputTokens=u.output_tokens_details?count(u.output_tokens_details.text_tokens):0;
  if(n.textInputTokens!==null&&n.imageInputTokens!==null&&input!==null&&n.textInputTokens+n.imageInputTokens!==input)return null;
  if(n.imageOutputTokens!==null&&n.textOutputTokens!==null&&output!==null&&n.imageOutputTokens+n.textOutputTokens!==output)return null;
 }
 return n;
}
function estimateCost(provider,model,kind,usage,table,serviceTier){
 const rate=table.models.find(r=>r.provider===provider&&r.model===model&&r.kind===kind);
 const unavailable=reason=>({nanoUsd:null,reason,rateVersion:table.version,rateDate:table.verifiedOn,source:rate?.source||null,rates:rate||null});
 if(!usage||usage.inputTokens===null||usage.outputTokens===null)return unavailable('Provider usage is missing or incomplete');
 if(!rate)return unavailable('No maintained price for this model');
 if(serviceTier&&!['default','standard','auto'].includes(serviceTier))return unavailable('Provider used a different pricing tier');
 if(rate.maxEstimatedInputTokens!==undefined&&usage.inputTokens>rate.maxEstimatedInputTokens)return unavailable('Long-context pricing is not configured');
 const terms=[];
 if(kind==='image'){
  if(usage.cacheReadTokens||usage.cacheCreationTokens)return unavailable('Image cache pricing is not configured for this endpoint');
  for(const [tokens,price]of [[usage.textInputTokens,rate.textInput],[usage.imageInputTokens,rate.imageInput],[usage.imageOutputTokens,rate.imageOutput],[usage.textOutputTokens,rate.textOutput]]){if(tokens===null||tokens===undefined)return unavailable('Image token breakdown is missing');if(tokens&&price===undefined)return unavailable('Image modality pricing is missing');terms.push(tokens*(price||0));}
 }else{
  const writes=provider==='claude'&&usage.cacheCreationTokens?[[usage.cacheCreation5mTokens,rate.cacheWrite5m],[usage.cacheCreation1hTokens,rate.cacheWrite1h]]:[[usage.cacheCreationTokens,rate.cacheWrite]];
  for(const [tokens,price]of [[usage.ordinaryInputTokens,rate.input],[usage.cacheReadTokens,rate.cacheRead],...writes,[usage.outputTokens,rate.output]]){if(tokens===undefined||tokens===null)return unavailable('Cache lifetime breakdown is missing');if(tokens&&price===undefined)return unavailable('Token pricing is incomplete');terms.push(tokens*(price||0));}
 }
 const nanoUsd=Math.round(terms.reduce((a,b)=>a+b,0)*1000);if(!Number.isSafeInteger(nanoUsd))return unavailable('Cost exceeds the supported range');
 return {nanoUsd,reason:null,rateVersion:table.version,rateDate:table.verifiedOn,source:rate.source,rates:rate};
}
const empty=()=>({requests:0,inputTokens:0,outputTokens:0,cacheReadTokens:0,cacheCreationTokens:0,knownNanoUsd:0,unavailableCosts:0,missingUsage:0});
function add(total,r){total.requests++;if(!r.usage)total.missingUsage++;else {if(r.usage.inputTokens===null||r.usage.outputTokens===null)total.missingUsage++;for(const k of ['inputTokens','outputTokens','cacheReadTokens','cacheCreationTokens']){if(r.usage[k]!==null)total[k]+=r.usage[k];} }if(r.cost.nanoUsd===null)total.unavailableCosts++;else total.knownNanoUsd+=r.cost.nanoUsd;for(const n of Object.values(total))if(!Number.isSafeInteger(n))throw Error('AI usage totals exceed the supported range');return total;}
const publicTotal=t=>({...t,knownCostUsd:t.knownNanoUsd/1e9});
function cleanRecord(r){
 if(!r||!['openai','claude'].includes(r.provider)||!validModel(r.model)||!['text','image'].includes(r.kind)||!['completed','unusable-output','failed','cancelled'].includes(r.outcome)||typeof r.at!=='string'||r.at.length>40||!Number.isFinite(Date.parse(r.at))||typeof r.id!=='string'||!/^[-a-f0-9]{36}$/.test(r.id))throw Error('Invalid usage record');
 const usage=r.usage===null?null:{};if(usage){for(const key of ['inputTokens','outputTokens','ordinaryInputTokens','cacheReadTokens','cacheCreationTokens','cacheCreation5mTokens','cacheCreation1hTokens','textInputTokens','imageInputTokens','imageOutputTokens','textOutputTokens'])if(r.usage[key]!==undefined){if(r.usage[key]!==null&&count(r.usage[key])===null)throw Error('Invalid usage count');usage[key]=r.usage[key];}for(const key of ['inputTokens','outputTokens','ordinaryInputTokens','cacheReadTokens','cacheCreationTokens'])if(usage[key]===undefined)throw Error('Missing usage count');}
 const c=r.cost;if(!c||c.nanoUsd!==null&&(!Number.isSafeInteger(c.nanoUsd)||c.nanoUsd<0)||typeof c.rateVersion!=='string'||c.rateVersion.length>80||c.reason!==null&&(typeof c.reason!=='string'||c.reason.length>200)||c.source!==null&&!validSource(c.source))throw Error('Invalid usage cost');
 const rate=c.rates?validateRates({schemaVersion:1,currency:'USD',version:c.rateVersion,verifiedOn:c.rateDate,models:[c.rates]}).models[0]:null;
 return {id:r.id,at:r.at,provider:r.provider,model:r.model,kind:r.kind,outcome:r.outcome,usage,cost:{nanoUsd:c.nanoUsd,reason:c.reason,rateVersion:c.rateVersion,rateDate:c.rateDate,source:c.source,rates:rate}};
}
function createAIUsage({directory,now=()=>new Date(),maxRecords=MAX_RECORDS}){
 const file=path.join(directory,'ai-usage.json'),ratesFile=path.join(directory,'ai-rates.json'),session={text:empty(),image:empty()};let queue=Promise.resolve();
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 async function rates(){let value;try{if((await fs.stat(ratesFile)).size>100000)throw Error('AI price table is too large');value=JSON.parse(await fs.readFile(ratesFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Local AI price table could not be read. Estimates are unavailable until it is corrected.');value=require('./ai-rates.json');}return validateRates(value);}
 async function load(){try{if((await fs.stat(file)).size>MAX_BYTES)throw Error('AI usage history exceeds its limit');const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.schemaVersion!==1||!Array.isArray(data.records)||data.records.length>MAX_RECORDS)throw Error('Invalid AI usage history');for(const kind of ['text','image'])for(const key of Object.keys(empty()))if(!Number.isSafeInteger(data.totals?.[kind]?.[key])||data.totals[kind][key]<0)throw Error('Invalid AI usage totals');if(typeof data.since!=='string'||data.since.length>40||!Number.isFinite(Date.parse(data.since)))throw Error('Invalid ledger date');return {schemaVersion:1,since:data.since,totals:Object.fromEntries(['text','image'].map(kind=>[kind,Object.fromEntries(Object.keys(empty()).map(k=>[k,data.totals[kind][k]]))])),records:data.records.map(cleanRecord)};}catch(e){if(e.code==='ENOENT')return {schemaVersion:1,since:now().toISOString(),totals:{text:empty(),image:empty()},records:[]};throw Error('Local AI usage history could not be read. It has been preserved.');}}
 async function record({provider,model,kind,usage,outcome,serviceTier}){return serial(async()=>{
  const data=await load(),normalized=normalizeUsage(provider,kind,usage);let table,cost;try{table=await rates();cost=estimateCost(provider,model,kind,normalized,table,serviceTier);}catch{cost={nanoUsd:null,reason:'Local price table is unavailable',rateVersion:'unavailable',rateDate:null,source:null,rates:null};}
  const r={id:randomUUID(),at:now().toISOString(),provider,model:validModel(model)?model:'unknown',kind,outcome:['completed','unusable-output','failed','cancelled'].includes(outcome)?outcome:'failed',usage:normalized,cost};
  if(!['openai','claude'].includes(provider)||!['text','image'].includes(kind))throw Error('Invalid usage record');
  add(data.totals[kind],r);data.records.push(r);data.records=data.records.slice(-Math.min(MAX_RECORDS,maxRecords));const encoded=JSON.stringify(data);if(Buffer.byteLength(encoded)>MAX_BYTES)throw Error('AI usage history exceeds its limit');await fs.mkdir(directory,{recursive:true});await atomicWrite(file,encoded);add(session[kind],r);return r;
 });}
 async function summary(){return serial(async()=>{const data=await load();let table,pricingWarning=null;try{table=await rates();}catch(e){pricingWarning=e.message;}return {since:data.since,last:data.records.at(-1)||null,session:{text:publicTotal(session.text),image:publicTotal(session.image)},allTime:{text:publicTotal(data.totals.text),image:publicTotal(data.totals.image)},retainedRequests:data.records.length,priceTable:table?{version:table.version,verifiedOn:table.verifiedOn}:null,pricingWarning};});}
 return {record,summary};
}
module.exports={createAIUsage,normalizeUsage,estimateCost,validateRates};
