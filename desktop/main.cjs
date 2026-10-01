const {app,BrowserWindow,dialog,ipcMain,Menu,shell,screen}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
const {createProjectStore}=require('./project-store.cjs');
const {createSceneryReader}=require('./scenery-store.cjs');
// Keep the existing profile identity across portable and installed releases.
if(!app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.join(app.getPath('appData'),'dnd-terrain-builder'));
app.setAppUserModelId('TerrainFoundry.Desktop');
app.whenReady().then(async()=>{
 const store=createProjectStore({userData:app.getPath('userData'),documents:app.getPath('documents'),installRoot:app.getAppPath().endsWith('.asar')?path.dirname(process.execPath):app.getAppPath()});
 await store.init();
 const estimator=require('./print-estimate.cjs').createPrintEstimator({userData:app.getPath('userData'),fetchImpl:(...args)=>require('electron').net.fetch(...args)});
 ipcMain.handle('print-estimate-config',()=>estimator.config());
 ipcMain.handle('print-estimate',(_,files,selection)=>estimator.estimate(files,selection));
 const readBuiltin=createSceneryReader(path.join(__dirname,'..'));
 ipcMain.on('builtin-shape',(event,id,connected)=>{try{event.returnValue=readBuiltin(id,connected);}catch(error){event.returnValue={error:error.message};}});
 let finishing=false;app.on('before-quit',e=>{if(!finishing){e.preventDefault();store.flush().finally(()=>{finishing=true;app.quit();});}});
 ipcMain.handle('load-recovery',()=>store.loadRecovery());
 ipcMain.handle('save-recovery',(_,data)=>store.saveRecovery(data));
 ipcMain.handle('storage-info',()=>({projects:store.projects,backups:store.backups,recovery:store.recovery,version:app.getVersion()}));
 Menu.setApplicationMenu(null);
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 const width=Math.min(1500,area.width),height=Math.min(960,area.height);
 const win=new BrowserWindow({x:area.x+Math.floor((area.width-width)/2),y:area.y+Math.floor((area.height-height)/2),width,height,minWidth:Math.min(1100,area.width),minHeight:Math.min(720,area.height),title:'Terrain Foundry',backgroundColor:'#111820',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(({url})=>{if(['https://www.printablescenery.com/','https://www.printablescenery.com/2026/10/01/mgn-consultancy/'].includes(url))void shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',e=>e.preventDefault());
 ipcMain.handle('print-website-pack',async(_,data)=>{if(!(data instanceof Uint8Array)||data.length>40*1024*1024||data[0]!==80||data[1]!==75)throw Error('Print pack must be a ZIP under 40 MB.');const result=await dialog.showSaveDialog(win,{title:'Save the print pack to upload on the website',defaultPath:path.join(app.getPath('documents'),'TerrainFoundry-print-quote.zip'),filters:[{name:'ZIP print pack',extensions:['zip']}]});if(result.canceled)return null;await fs.writeFile(result.filePath,data);await shell.openExternal('https://terrainfoundry.co.uk/#print-service');return result.filePath;});
 win.webContents.on('will-prevent-unload',e=>{const response=dialog.showMessageBoxSync(win,{type:'question',buttons:['Keep editing','Close window'],defaultId:0,cancelId:0,title:'Unsaved project',message:'Close with unsaved changes?',detail:'Save a project file to keep all changes. Recovery is kept separately, but named project files are the best way to keep multiple scenes.'});if(response===1)e.preventDefault();else finishing=false;});
 win.loadFile(path.join(__dirname,'../dist/index.html'),{query:process.argv.includes('--castle-demo')?{demo:'castle'}:process.argv.includes('--outdoor-demo')?{demo:'outdoor'}:process.argv.includes('--openlock-demo')?{demo:'openlock'}:process.argv.includes('--benchmarks')?{demo:'benchmarks'}:process.argv.includes('--dungeon-demo')?{demo:'dungeon'}:process.argv.includes('--village-demo')?{demo:'village'}:{}});
 ipcMain.handle('save',async(_,data)=>{if(typeof data!=='string'||data.length>100000000)throw Error('Invalid project');const r=await dialog.showSaveDialog(win,{defaultPath:path.join(store.projects,'My dungeon.terrain'),filters:[{name:'Terrain project',extensions:['terrain']}]});if(r.canceled)return null;await store.save(r.filePath,data);await store.saveRecovery(data);return r.filePath;});
 ipcMain.handle('open',async()=>{const r=await dialog.showOpenDialog(win,{defaultPath:store.projects,filters:[{name:'Terrain project',extensions:['terrain']}],properties:['openFile']});if(r.canceled)return null;const p=r.filePaths[0];if((await fs.stat(p)).size>100000000)throw Error('Project too large');return await fs.readFile(p,'utf8');});
 ipcMain.handle('export',async(_,files)=>{if(!Array.isArray(files)||files.length>1000)throw Error('Invalid export');for(const f of files)if(!/^[a-zA-Z0-9_.-]+$/.test(f.name)||(typeof f.data!=='string'&&!(f.data instanceof Uint8Array))||f.data.length>100000000)throw Error('Invalid file');const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory'],title:'Choose where to create the print pack'});if(r.canceled)return null;const dir=await fs.mkdtemp(path.join(r.filePaths[0],'TerrainFoundry-'));for(const f of files)await fs.writeFile(path.join(dir,f.name),f.data);return dir;});
});app.on('window-all-closed',()=>app.quit());






