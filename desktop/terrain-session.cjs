const fs=require('node:fs/promises'),path=require('node:path');
function createTerrainSessions({directory,store}){
 const pending=new Map();
 async function local(target){for(let current=path.resolve(target);;current=path.dirname(current)){try{if((await fs.lstat(current)).isSymbolicLink())throw Error('Companion workspace must be local; symbolic links are not supported');}catch(e){if(e.code!=='ENOENT')throw e;}if(path.dirname(current)===current)break;}}
 async function open(project){
  require('./project-store.cjs').check(JSON.stringify(project));
  const id=project.companionId;if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error('Invalid terrain companion identity');
  if(pending.has(id))return pending.get(id);
  const task=(async()=>{const folder=path.join(directory,id),file=path.join(folder,'campaign.tfcampaign');
   await local(file);await local(path.join(folder,'campaign.json'));
   await fs.mkdir(directory,{recursive:true});if((await fs.lstat(directory)).isSymbolicLink())throw Error('Companion folder must be local');
   try{if((await fs.lstat(folder)).isSymbolicLink())throw Error('Companion workspace must be local');return await store.openWorkspace(file);}catch(e){if(e.code!=='ENOENT')throw e;}
   let c=(await import('./campaign-schema.mjs')).createCampaign(project.name,{genre:'Terrain design',rules:''});c.workspaceKind='design';c.summary='Design plan for '+project.name;c=await store.save(c);await store.moveWorkspace(c.id,folder);return store.load(c.id);
  })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }
 return {open};
}
module.exports={createTerrainSessions};
