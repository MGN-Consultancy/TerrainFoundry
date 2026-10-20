const path=require('node:path');
const fs=require('node:fs/promises');
const licence=require('./premium-licence.cjs');
const {createPremiumDevice}=require('./premium-device.cjs');
const {createPremiumStore}=require('./premium-store.cjs');
const {createPremiumClient}=require('./premium-client.cjs');
const trust=require('./premium-trust.cjs');
async function setupPremiumNative({app,win,ipcMain,BrowserWindow,safeStorage,net,dialog,isReserved,directory}){
 const device=createPremiumDevice({userData:app.getPath('userData'),safeStorage});
 const store=createPremiumStore({userData:app.getPath('userData'),directory,safeStorage,device,issuerPublicKey:trust.issuerPublicKey,isReserved});await store.init();let entry;
 const updater=createPremiumClient({device,store,fetchImpl:(...args)=>net.fetch(...args),onProgress:status=>{if(!win.isDestroyed())win.webContents.send('premium-update-progress',status);}});let update=null;
 ipcMain.handle('premium-sync',event=>{if(event.sender!==win.webContents)throw Error('Unapproved window.');if(!update)update=updater.sync().finally(()=>{update=null;});return update;});
 win.once('closed',()=>updater.cancel());
 ipcMain.handle('premium-inventory',event=>{if(event.sender!==win.webContents)throw Error('Unapproved window.');return store.inventory();});
 ipcMain.handle('premium-open',async event=>{
  if(event.sender!==win.webContents)throw Error('Unapproved window.');if(entry){entry.focus();return false;}
  const bounds=win.getBounds();entry=new BrowserWindow({parent:win,modal:true,width:Math.min(630,bounds.width),height:Math.min(750,bounds.height),resizable:true,title:'Activate premium scenery',backgroundColor:'#12222e',webPreferences:{preload:path.join(__dirname,'premium-entry-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});const current=entry;
  const client=createPremiumClient({device,store,recordAcceptance:async receipt=>{const folder=path.join(app.getPath('userData'),'premium','licence-acceptance');await fs.mkdir(folder,{recursive:true});const file=path.join(folder,require('node:crypto').createHash('sha256').update(String(receipt.licenceId)).digest('hex')+'.json');await fs.writeFile(file+'.tmp',JSON.stringify({...receipt,licenceText:licence.text},null,2),{encoding:'utf8',mode:0o600});await fs.rename(file+'.tmp',file);},fetchImpl:(...args)=>net.fetch(...args),onProgress:status=>{if(!current.isDestroyed())current.webContents.send('premium-entry-progress',status);}});
  const channels=['premium-entry-activate','premium-entry-licence','premium-entry-device-status','premium-entry-repair-device'];
  const methods=[client.activate,()=>({version:licence.version,text:licence.text}),async()=>{try{await device.publicIdentity();return {unreadable:false};}catch(error){if(error.code==='PREMIUM_IDENTITY_UNREADABLE')return {unreadable:true};throw error;}},async()=>{
   if(update)throw Error('Wait for scenery sync to finish before repairing activation.');
   const confirmation=await dialog.showMessageBox(current,{type:'question',title:'Repair pack activation',buttons:['Cancel','Back up and repair'],defaultId:0,cancelId:0,message:'Back up the unreadable pack identity and create a new protected identity?',detail:'Existing model archives and signed grants are retained. Enter your pack code afterwards to download fresh activations. No email verification is required.'});
   if(confirmation.response!==1)return {cancelled:true};
   return device.recoverUnreadableIdentity();
  }];
  for(let i=0;i<channels.length;i++)ipcMain.handle(channels[i],async(e,value)=>{if(e.sender!==current.webContents)throw Error('Unapproved activation window.');return methods[i](value);});
  current.webContents.setWindowOpenHandler(()=>({action:'deny'}));current.webContents.on('will-navigate',e=>e.preventDefault());
  const closed=new Promise(resolve=>current.once('closed',()=>{client.cancel();for(const channel of channels)ipcMain.removeHandler(channel);entry=undefined;resolve(true);}));
  await current.loadFile(path.join(__dirname,'premium-entry.html'));return closed;
 });
 return {store};
}
module.exports={setupPremiumNative};
