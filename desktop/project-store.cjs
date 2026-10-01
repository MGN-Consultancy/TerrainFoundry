const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const MAX_BYTES=100000000;
function check(data){if(typeof data!=='string'||Buffer.byteLength(data)>MAX_BYTES)throw Error('Project exceeds the 100 MB limit');const p=JSON.parse(data);if((![1,2].includes(p.version)||(p.version===2&&p.kind!=='world'))||!Array.isArray(p.items)||typeof p.name!=='string')throw Error('Invalid project');return data;}
async function atomicWrite(file,data){const temp=file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,data,{flag:'wx'});await fs.rename(temp,file);}finally{await fs.unlink(temp).catch(()=>{});}}
function createProjectStore({userData,documents,installRoot}){
 const projects=path.join(documents,'Terrain Foundry','Projects'),recovery=path.join(userData,'projects','recovery.terrain'),backups=path.join(userData,'projects','backups');
 let queue=Promise.resolve();
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const inside=(p,root)=>{const rel=path.relative(root,p);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
 async function init(){await fs.mkdir(projects,{recursive:true});await fs.mkdir(backups,{recursive:true});}
 async function backup(file){try{const old=await fs.readFile(file);const key=createHash('sha256').update(path.resolve(file).toLowerCase()).digest('hex').slice(0,12);const name=path.basename(file,'.terrain').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);await fs.writeFile(path.join(backups,`${name}-${key}-${Date.now()}-${randomUUID()}.terrain`),old,{flag:'wx'});}catch(e){if(e.code!=='ENOENT')throw e;}}
 async function save(file,data){check(data);await init();const parent=await fs.realpath(path.dirname(file));if(inside(path.resolve(file),path.resolve(installRoot))||inside(parent,await fs.realpath(installRoot)))throw Error('Save projects outside the application folder. Your Documents project folder is safe during upgrades.');await backup(file);await atomicWrite(file,data);return file;}
 function saveRecovery(data){check(data);return serial(async()=>{await init();try{const previous=await fs.readFile(recovery,'utf8');check(previous);await atomicWrite(recovery+'.previous',previous);}catch(e){if(e.code!=='ENOENT'){if(e instanceof SyntaxError||e.message==='Invalid project')await backup(recovery);else throw e;}}await atomicWrite(recovery,data);return true;});}
 async function loadRecovery(){let failed=false;for(const file of [recovery,recovery+'.previous']){try{const data=await fs.readFile(file,'utf8');check(data);return {data,previous:file!==recovery};}catch(e){if(e.code==='ENOENT')continue;failed=true;if(file.endsWith('.previous'))return {data:null,error:'Recovery could not be read. Your saved project files and backups are unchanged.'};}}return failed?{data:null,error:'Recovery could not be read. Your saved project files and backups are unchanged.'}:{data:null};}
 return {init,projects,recovery,backups,save,saveRecovery,loadRecovery,flush:()=>queue};
}
module.exports={createProjectStore,check,atomicWrite};
