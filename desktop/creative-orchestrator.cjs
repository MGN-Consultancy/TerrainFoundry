function createCreativeOrchestrator({library,generation,conversationContext=async()=>null}){
 async function inventory(){const records=await library.list();return {total:records.length,shown:Math.min(records.length,100),assets:records.slice(0,100).map(a=>({id:a.id,kind:a.kind,name:a.name,packName:a.packName,stage:a.stage,hasModel:!!a.model,validationStatus:a.model?.validation?.status||null}))};}
 async function context(view){
  const {designerView}=await import('./creative-actions.mjs'),v=designerView(view);if(!v)return null;
  const a=await library.load(v.assetId);if(a.kind!==v.kind)throw Error('Designer kind does not match the library asset');
  return {id:a.id,kind:a.kind,name:a.name,description:a.description,stage:a.stage,packName:a.packName,design:a.design,sheet:a.sheet,discussion:await conversationContext(a.id),concepts:a.concepts.map(({id,name,approved,retained})=>({id,name,approved,retained})),selectedConceptId:a.selectedConceptId,model:a.model?{status:a.model.validation?.status,validation:a.model.validation}:null};
 }
 async function dispatch(values){
  const {validateCreativeAction,canonicalSheetPatch}=await import('./creative-actions.mjs');const results=[];
  if(!Array.isArray(values)||values.length>10)throw Error('Use at most ten designer actions per turn');const actions=values.map(validateCreativeAction),unique=new Set(actions.map(a=>JSON.stringify(a)));if(unique.size!==actions.length)throw Error('Duplicate designer actions are not allowed');
  for(const action of actions){let asset;
   if(action.type==='openDesigner'){asset=action.id?await library.load(action.id):await library.create({kind:action.kind,name:action.name,packName:action.packName});if(asset.kind!==action.kind)throw Error('Choose an asset from the correct library');}
   else if(action.type==='updateDesign'){const old=await library.load(action.id),patch=action.patch,oldSheet=canonicalSheetPatch(old.sheet||{}),sheet={...oldSheet,...patch.sheet};for(const field of ['abilities','saves','skills'])if(oldSheet[field]||patch.sheet?.[field])sheet[field]={...oldSheet[field],...patch.sheet?.[field]};asset=await library.save({...old,...patch,design:{...old.design,...patch.design},sheet});}
   else if(action.type==='generateDesignConcept')asset=await generation.generateConcept(action.id,action.prompt);
   else if(action.type==='placeDesign'){await library.readModel(action.id);asset=await library.load(action.id);results.push({type:action.type,asset,place:true,open:false,applied:false,message:'Place saved model into terrain'});continue;}
   else {const old=await library.load(action.id);asset=await library.save({...old,stage:'model'});}
   results.push({type:action.type,asset,open:true,applied:true,message:action.type==='prepareDesignModel'?'Review and approve a concept in the 3D step before spending Meshy credits.':'Local designer workspace updated.'});
  }return results;
 }
 return {context,dispatch,inventory};
}
module.exports={createCreativeOrchestrator};
