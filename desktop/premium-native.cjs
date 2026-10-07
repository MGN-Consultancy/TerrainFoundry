const path=require('node:path');
const fs=require('node:fs/promises');
const licence=require('./premium-licence.cjs');
const {createPremiumDevice}=require('./premium-device.cjs');
const {createPremiumStore}=require('./premium-store.cjs');
const {createPremiumClient}=require('./premium-client.cjs');
const trust=require('./premium-trust.cjs');
async function setupPremiumNative({app,win,ipcMain,BrowserWindow,safeStorage,net,isReserved}){
 const device=createPremiumDevice({userData:app.getPath('userData'),safeStorage});
 const store=createPremiumStore({userData:app.getPath('userData'),safeStorage,device,issuerPublicKey:trust.issuerPublicKey,isReserved});await store.init();let entry;
 ipcMain.handle('premium-inventory',event=>{if(event.sender!==win.webContents)throw Error('Unapproved window.');return store.inventory();});
 ipcMain.handle('premium-open',async event=>{
  if(event.sender!==win.webContents)throw Error('Unapproved window.');if(entry){entry.focus();return false;}
  const bounds=win.getBounds();entry=new BrowserWindow({parent:win,modal:true,width:Math.min(630,bounds.width),height:Math.min(750,bounds.height),resizable:true,title:'Activate premium scenery',backgroundColor:'#12222e',webPreferences:{preload:path.join(__dirname,'premium-entry-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});const current=entry;
  const client=createPremiumClient({device,store,recordAcceptance:async receipt=>{const folder=path.join(app.getPath('userData'),'premium','licence-acceptance');await fs.mkdir(folder,{recursive:true});const file=path.join(folder,require('node:crypto').createHash('sha256').update(String(receipt.licenceId)).digest('hex')+'.json');await fs.writeFile(file+'.tmp',JSON.stringify({...receipt,licenceText:licence.text},null,2),{encoding:'utf8',mode:0o600});await fs.rename(file+'.tmp',file);},fetchImpl:(...args)=>net.fetch(...args),onProgress:status=>{if(!current.isDestroyed())current.webContents.send('premium-entry-progress',status);}});
  const channels=['premium-entry-start','premium-entry-verify','premium-entry-activate','premium-entry-licence'];
  const methods=[client.loginStart,client.loginVerify,client.activate,()=>({version:licence.version,text:licence.text})];
  for(let i=0;i<channels.length;i++)ipcMain.handle(channels[i],async(e,value)=>{if(e.sender!==current.webContents)throw Error('Unapproved activation window.');return methods[i](value);});
  current.webContents.setWindowOpenHandler(()=>({action:'deny'}));current.webContents.on('will-navigate',e=>e.preventDefault());
  const closed=new Promise(resolve=>current.once('closed',()=>{client.cancel();for(const channel of channels)ipcMain.removeHandler(channel);entry=undefined;resolve(true);}));
  await current.loadFile(path.join(__dirname,'premium-entry.html'));return closed;
 });
 return {store};
}
module.exports={setupPremiumNative};
