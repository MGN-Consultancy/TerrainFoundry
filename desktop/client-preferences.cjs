const fs=require('node:fs/promises');
const path=require('node:path');
function normalize(value={}){return {startupMode:value.startupMode==='fullscreen'?'fullscreen':'windowed',interfaceScale:[0.9,1,1.1,1.25].includes(value.interfaceScale)?value.interfaceScale:1,reducedMotion:value.reducedMotion===true,tutorialSkip:typeof value.tutorialSkip==='boolean'?value.tutorialSkip:null};}
function createClientPreferences(directory){
 const file=path.join(directory,'client-preferences.json');let pending=Promise.resolve();
 async function read(){try{return normalize(JSON.parse(await fs.readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return normalize();throw error;}}
 function save(value){pending=pending.catch(()=>{}).then(async()=>{const next=normalize({...await read(),...value});await fs.mkdir(directory,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(next));await fs.rename(file+'.tmp',file);return next;});return pending;}
 return {read,save};
}
module.exports={normalize,createClientPreferences};
