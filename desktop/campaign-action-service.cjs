const {randomUUID}=require('node:crypto');
function createCampaignActions({store,inventory,savedScenes,sceneLibrary,chooseProject,files,style,artwork,now=Date.now}){
 const plans=new Map();
 async function review(id,action){
  for(const [key,p]of plans)if(p.expires<now())plans.delete(key);if(plans.size>=100)throw Error('Too many pending reviews. Reopen the campaign.');
  const c=await store.load(id),{validateAction}=await import('./campaign-actions.mjs');
  const checked=validateAction(action,c,{inventory:await inventory(),savedScenes:await savedScenes()}),token=randomUUID();
  if(['buildWorld','addWorldPieces'].includes(checked.type)){const {worldProject}=await import('./campaign-world-agent.mjs');worldProject(checked,await inventory(),checked.type==='addWorldPieces'?await store.project(id,checked.id):null);}if(checked.type==='editLinkedProject')await require('./campaign-terrain-actions.cjs').terrainEdit(await store.project(id,checked.id),checked.changes,await inventory());
  plans.set(token,{id,revision:c.revision,action:checked,expires:now()+15*60000});
  let preview=null;if(checked.type==='linkSavedScene'){const entries=await savedScenes();preview=entries.find(x=>x.id===checked.id)||null;}if(checked.type==='openLinkedProject')preview=c.links.find(x=>x.id===checked.id)||null;return {token,revision:c.revision,action:checked,preview};
 }
 async function apply(id,token){
  const plan=plans.get(token);if(!plan||plan.id!==id||plan.expires<now())throw Error('This review has expired. Review the proposal again.');
  const c=await store.load(id);if(c.revision!==plan.revision)throw Error('Campaign changed since this preview. Review the proposal again.');
  plans.delete(token);const action=plan.action;
  if(action.type==='updateSharedStyle'){const sharedStyleUndo=await style.write(action.content);return {campaign:await store.save(c),sharedStyleUndo,sharedStyleContent:action.content};}if(action.type==='writeWorkspaceFile'){const documentUndo=await files.write(id,action.path,action.content);return {campaign:await store.save(c),documentUndo};}if(action.type==='createArtwork'){const image=await artwork(c,action.prompt);if(action.target==='map')c.maps.push({id:randomUUID(),title:action.title,image,visible:false});else c.cover=image;return {campaign:await store.save(c)};}if(['buildWorld','addWorldPieces'].includes(action.type)){const {worldProject}=await import('./campaign-world-agent.mjs'),project=worldProject(action,await inventory(),action.type==='addWorldPieces'?await store.project(id,action.id):null);const campaign=action.type==='buildWorld'?await store.addProject(id,JSON.stringify(project),plan.revision):await store.setProjectRevision(id,action.id,project,plan.revision);return {campaign,project};}if(['updateBrief','upsertRecord'].includes(action.type)){const {applyCampaignAction}=await import('./campaign-actions.mjs');return {campaign:await store.save(applyCampaignAction(c,action))};}
  if(action.type==='editLinkedProject'){const p=await require('./campaign-terrain-actions.cjs').terrainEdit(await store.project(id,action.id),action.changes,await inventory());return {campaign:await store.setProjectRevision(id,action.id,p,plan.revision)};}
  if(action.type==='linkSavedScene'){const scene=await sceneLibrary.load(action.id);return {campaign:await store.addProject(id,scene.data,plan.revision)};}
  if(action.type==='chooseProjectFile'){const text=await chooseProject();if(text===null)return {cancelled:true};return {campaign:await store.addProject(id,text,plan.revision)};}
  if(action.type==='openLinkedProject')return {project:await store.project(id,action.id)};
  if(action.type==='proposeEncounter'){const {validateLayout}=await import('./campaign-actions.mjs');return {layout:validateLayout(action.layout,await inventory())};}
  throw Error('Unsupported assistant action');
 }
 async function lookup(action,id){if(action.type==='listWorkspaceFiles')return {type:action.type,entries:await files.list(id)};if(action.type==='readWorkspaceFile')return files.read(id,action.path);if(!['findAssets','findSavedScenes'].includes(action.type)||typeof action.query!=='string'||action.query.length>120)throw Error('Invalid catalogue lookup');const values=action.type==='findAssets'?await inventory():await savedScenes(),matched=values.filter(x=>(x.name+' '+(x.category||'')).toLowerCase().includes(action.query.toLowerCase()));return {type:action.type,query:action.query,total:matched.length,entries:matched.slice(0,30)};}return {review,apply,lookup};
}
module.exports={createCampaignActions};
