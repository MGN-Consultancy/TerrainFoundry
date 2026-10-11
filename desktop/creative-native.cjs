const fs=require('node:fs/promises'),path=require('node:path');
function setupCreativeNative({app,win,ipcMain,dialog,BrowserWindow,ai,store,net,premiumInventory}){
 const directory=process.env.TERRAIN_CREATIVE_LIBRARY||path.join(app.getPath('documents'),'Terrain Foundry','Asset Library');
 const library=require('./creative-library.cjs').createCreativeLibrary({directory});
 const generation=require('./creative-generation.cjs').createCreativeGeneration({library,ai,fetchImpl:(...args)=>net.fetch(...args),onProgress:value=>{if(!win.isDestroyed())win.webContents.send('creative-progress',value);}});
 const orchestrator=require('./creative-orchestrator.cjs').createCreativeOrchestrator({library,generation});
 const sessions=new Map(),confirming=new Set(),ownedFile=path.join(directory,'owned-packs.json');
 async function ownedReferences(){try{const stat=await fs.lstat(ownedFile);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2000000)throw Error('Invalid restored pack references');return (await import('./creative-schema.mjs')).validateOwnedReferences(JSON.parse(await fs.readFile(ownedFile,'utf8')));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function persistReferences(values){const refs=(await import('./creative-schema.mjs')).validateOwnedReferences(values);await fs.mkdir(directory,{recursive:true});try{const stat=await fs.lstat(ownedFile);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid restored pack references');}catch(e){if(e.code!=='ENOENT')throw e;}await require('./project-store.cjs').atomicWrite(ownedFile,JSON.stringify(refs,null,2));return refs;}
 async function session(id){
  if(sessions.has(id))return sessions.get(id);
  const task=(async()=>{const a=await library.load(id),folder=path.join(await library.folder(id),'Conversation'),reference=a.references.find(r=>r.type==='design-conversation');
   try{const stat=await fs.lstat(folder);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Design conversation must be a regular folder inside its asset');}catch(e){if(e.code!=='ENOENT')throw e;}
   if(reference?.campaignId){try{const c=await store.load(reference.campaignId);if(c.workspaceKind!=='design')throw Error('The design conversation reference is not a designer workspace');const actual=await fs.realpath(await store.folder(c.id)),expected=await fs.realpath(folder);if(actual!==expected)throw Error('The design conversation is outside its asset folder');return c;}catch(e){if(e.code!=='ENOENT')throw e;}}
   // Recover a conversation whose folder was moved before the asset reference saved.
   try{const stat=await fs.lstat(path.join(folder,'campaign.tfcampaign'));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid design conversation workspace');const recovered=await store.openWorkspace(path.join(folder,'campaign.tfcampaign'));if(recovered.workspaceKind!=='design')throw Error('The local conversation is not a designer workspace');await library.save({...a,references:[...a.references.filter(r=>r.type!=='design-conversation'),{type:'design-conversation',campaignId:recovered.id}]});return recovered;}catch(e){if(e.code!=='ENOENT')throw e;}
   const {createCampaign}=await import('./campaign-schema.mjs');let c=createCampaign((a.name+' design').slice(0,120),{theme:a.description.slice(0,2000),rules:a.sheet?.rules||'D&D 5e'});c.workspaceKind='design';c=await store.save(c);await store.moveWorkspace(c.id,folder);const latest=await library.load(id);await library.save({...latest,references:[...latest.references.filter(r=>r.type!=='design-conversation'),{type:'design-conversation',campaignId:c.id}]});return c;
  })();sessions.set(id,task);try{return await task;}finally{sessions.delete(id);}
 }
 const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{if(e.sender!==win.webContents)throw Error('Unapproved asset library window');return fn(...args);});
 handle('creative-list',options=>library.list(options));handle('creative-packs',()=>library.listPacks());handle('creative-create',value=>library.create(value));handle('creative-load',id=>library.load(id));handle('creative-save',value=>library.save(value));handle('creative-read-model',async id=>{const r=await library.readModel(id);return {...r,bytes:new Uint8Array(r.bytes)};});
 handle('creative-session',session);handle('creative-provider-validate',(provider,options)=>generation.validateProvider(provider,options));handle('creative-owned-references',ownedReferences);
 handle('creative-generate-concept',(id,prompt)=>generation.generateConcept(id,prompt));
 handle('creative-generate-model',async(id,conceptId)=>{
  if(confirming.has(id))throw Error('This model generation is already awaiting confirmation.');confirming.add(id);try{
  const a=await library.load(id),concept=a.concepts.find(c=>c.id===conceptId);if(!concept?.approved)throw Error('Approve your chosen concept first.');
  if(a.modelJob)throw Error('This design already has a Meshy task. Resume the saved task instead of submitting again.');
  const provider=await generation.validateProvider('meshy');if(!provider.working)throw Error(provider.message);
  const answer=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Generate with my Meshy credits'],defaultId:0,cancelId:0,title:'Approve Meshy generation',message:'Generate a 3D model of '+a.name+'?',detail:'This sends the approved concept to Meshy and spends credits on your Meshy account. A generated mesh still needs print and fit checks. This does not publish or sell the model.'});
  return answer.response===1?await generation.generateModel(id,conceptId):null;
  }finally{confirming.delete(id);}
 });
 handle('creative-resume-model',id=>generation.resumeModel(id));
 handle('creative-import',async({kind,packName}={})=>{const r=await dialog.showOpenDialog(win,{title:'Import models or a scenery pack',filters:[{name:'3D models and packs',extensions:['stl','obj','glb','3mf','zip']}],properties:['openFile','multiSelections']});if(r.canceled)return null;return library.importFiles({kind,packName,files:r.filePaths.map(p=>({path:p}))});});
 handle('creative-open-folder',async id=>{const target=id?await library.folder(id):directory;await fs.mkdir(target,{recursive:true});return require('electron').shell.openPath(target);});
 handle('creative-export-backup',async({includeModels=true}={})=>{
  const r=await dialog.showSaveDialog(win,{title:'Back up your asset library',defaultPath:path.join(app.getPath('documents'),'Terrain-Foundry-Asset-Library.zip'),filters:[{name:'Asset library backup',extensions:['zip']}]});if(r.canceled)return null;
  const installed=await premiumInventory?.()||{},packs=installed.packs||[],references=await ownedReferences(),byId=new Map(references.map(r=>[r.packId,r]));byId.set('terrain-foundry-free',{packId:'terrain-foundry-free',name:'Terrain Foundry free scenery',source:'Terrain Foundry launcher content sync',licence:'Restored automatically by the launcher from the current free scenery catalogue.'});for(const p of packs){const id=p.packId||p.id;byId.set(id,{packId:id,name:p.name||id,version:p.version||'',source:'Terrain Foundry premium catalogue',licence:'Restore this pack using your existing purchase and activation on the destination computer.'});}
  await fs.writeFile(r.filePath,await library.exportBackup({includeModels,ownedReferences:[...byId.values()]}));return r.filePath;
 });
 handle('creative-import-backup',async()=>{const r=await dialog.showOpenDialog(win,{title:'Restore an asset library',filters:[{name:'Asset library backup',extensions:['zip']}],properties:['openFile']});if(r.canceled)return null;const stat=await fs.lstat(r.filePaths[0]);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024*1024)throw Error('Choose a regular backup file under 512 MB');const result=await library.importBackup(await fs.readFile(r.filePaths[0])),existing=await ownedReferences(),byId=new Map(existing.map(r=>[r.packId,r]));for(const ref of result.ownedReferences)byId.set(ref.packId,ref);await persistReferences([...byId.values()]);return result;});
 handle('creative-print-sheet',async(id,format)=>{
  if(!['sheet','card'].includes(format))throw Error('Choose a character sheet or card');const a=await library.load(id);if(a.kind!=='character')throw Error('Choose a character');const {characterSheetHtml}=await import('./character-sheet.mjs');
  const r=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('documents'),a.name.replace(/[^a-zA-Z0-9 -]/g,'_')+'-'+format+'.pdf'),filters:[{name:'Character PDF',extensions:['pdf']}]});if(r.canceled)return null;
  const printing=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});try{await printing.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(characterSheetHtml(a,format)));await fs.writeFile(r.filePath,await printing.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true}));return r.filePath;}finally{printing.destroy();}
 });
 handle('creative-add-to-campaign',async(campaignId,assetId)=>{
  const a=await library.load(assetId);if(a.kind!=='character')throw Error('Choose a character asset');const c=await store.load(campaignId),{normaliseCharacterSheet}=await import('./character-sheet.mjs'),{canonicalSheetPatch}=await import('./creative-actions.mjs'),sheet=normaliseCharacterSheet(canonicalSheetPatch(a.sheet||{})),old=c.characters.find(x=>x.libraryAssetId===assetId),record={id:old?.id||require('node:crypto').randomUUID(),libraryAssetId:assetId,name:a.name,details:[a.description,sheet.biography].filter(Boolean).join('\n\n').slice(0,20000),abilities:JSON.stringify(sheet.abilities),equipment:sheet.equipment,spells:sheet.spells,hp:sheet.currentHitPoints,ac:sheet.armourClass,portrait:a.concepts.find(x=>x.id===a.selectedConceptId&&x.approved&&x.retained)?.image||null,modelFile:'',visible:old?.visible||false};
  if(record.portrait?.length>5500000){const image=require('electron').nativeImage.createFromDataURL(record.portrait);if(image.isEmpty())throw Error('Approved portrait could not be read');record.portrait='data:image/jpeg;base64,'+image.resize({width:Math.min(1024,image.getSize().width)}).toJPEG(85).toString('base64');}const i=c.characters.findIndex(x=>x.id===record.id);if(i<0)c.characters.push(record);else c.characters[i]=record;return store.save(c);
 });
 return {library,generation,orchestrator,session,ownedReferences};
}
module.exports={setupCreativeNative};
