const DEFAULTS=Object.freeze({openai:{model:'gpt-6-luna',imageModel:'gpt-image-2.5-sunburst',outputBudget:2000},claude:{model:'claude-sonnet-5-5',imageModel:'',outputBudget:2000}});
const validModel=v=>typeof v==='string'&&/^[-a-zA-Z0-9._]{1,100}$/.test(v)&&!/^sk-/i.test(v);
function provider(value){if(!Object.hasOwn(DEFAULTS,value))throw Error('Choose OpenAI or Claude');return value;}
function selection(value,p){
 const d=DEFAULTS[p],s=value||{};
 return {model:validModel(s.model)?s.model:d.model,imageModel:typeof s.imageModel==='string'&&(s.imageModel===''||validModel(s.imageModel))?s.imageModel:d.imageModel,outputBudget:Number.isInteger(s.outputBudget)&&s.outputBudget>=128&&s.outputBudget<=8000?s.outputBudget:d.outputBudget};
}
function normalizeSettings(value={}){
 const p=Object.hasOwn(DEFAULTS,value.provider)?value.provider:'openai',providers={};
 for(const id of Object.keys(DEFAULTS))providers[id]=selection(value.providers?.[id]||(id===p?value:undefined),id);
 const keys={};for(const id of [...Object.keys(DEFAULTS),'meshy'])if(typeof value.keys?.[id]==='string'&&value.keys[id].length<=4000)keys[id]=value.keys[id];
 for(const id of Object.keys(DEFAULTS))if(providers[id].model==='gpt-6.1-sol')providers[id].model=id==='openai'?'gpt-6-luna':providers[id].model;
 if(providers.openai.imageModel==='gpt-image-2.5-flare')providers.openai.imageModel='gpt-image-2.5-sunburst';
 return {schemaVersion:3,provider:p,providers,keys,voiceProvider:value.voiceProvider==='realtime'?'realtime':'live',agentMode:value.agentMode===true};
}
function modelName(p,model){return model===DEFAULTS[p].model?(p==='openai'?'GPT‑6 Luna':'Claude Sonnet 5.5'):model==='gpt-6-astra'?'GPT‑6 Astra (Pro)':'Custom model';}
module.exports={DEFAULTS,provider,validModel,normalizeSettings,modelName};
