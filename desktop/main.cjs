const {app,BrowserWindow,dialog,ipcMain,Menu,shell,screen,safeStorage,net}=require('electron');
const fs=require('node:fs/promises');const path=require('node:path');
const {createProjectStore}=require('./project-store.cjs');
const {createSceneryReader}=require('./scenery-store.cjs');
const {createSceneLibrary}=require('./scene-library.cjs');
// Keep the existing profile identity across portable and installed releases.
if(!app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.join(app.getPath('appData'),'dnd-terrain-builder'));
app.setAppUserModelId('TerrainFoundry.Desktop');
app.whenReady().then(async()=>{
 const store=createProjectStore({userData:app.getPath('userData'),documents:app.getPath('documents'),installRoot:app.getAppPath().endsWith('.asar')?path.dirname(process.execPath):app.getAppPath()});
 await store.init();
 const sceneLibrary=createSceneLibrary({directory:process.env.TERRAIN_SCENE_LIBRARY||path.join(app.getPath('documents'),'Terrain Foundry','Encounter Library')});
 ipcMain.handle('scene-library-list',(_,options)=>sceneLibrary.list(options));
 ipcMain.handle('scene-library-load',(_,id)=>sceneLibrary.load(id));
 ipcMain.handle('scene-library-save',(_,data,source)=>sceneLibrary.save(data,source));
 const estimator=require('./print-estimate.cjs').createPrintEstimator({userData:app.getPath('userData'),fetchImpl:(...args)=>require('electron').net.fetch(...args)});
 ipcMain.handle('print-estimate-config',()=>estimator.config());
 ipcMain.handle('print-estimate',(_,files,selection)=>estimator.estimate(files,selection));
 const readBuiltin=createSceneryReader(path.join(__dirname,'..'));
 let premiumServices;
 const readPrint=require('./print-scenery.cjs').createPrintSceneryReader(path.join(__dirname,'..'));
 ipcMain.on('print-scenery',(event,id,connected=true)=>{try{event.returnValue={files:premiumServices?.store.has(id)?premiumServices.store.readPrint(id,connected):readPrint(id)};}catch(error){event.returnValue={error:error.message};}});
 ipcMain.on('builtin-shape',(event,id,connected)=>{try{event.returnValue=premiumServices?.store.has(id)?premiumServices.store.readShape(id,connected):readBuiltin(id,connected);}catch(error){event.returnValue={error:error.message};}});
 let campaignServices;let finishing=false;app.on('before-quit',e=>{if(!finishing){e.preventDefault();campaignServices?.ai.cancel();campaignServices?.voice.stop();campaignServices?.voice.stopDictation();Promise.all([store.flush(),sceneLibrary.flush(),campaignServices?.store.flush(),campaignServices?.ai.flush()]).finally(()=>{finishing=true;app.quit();});}});
 ipcMain.handle('load-recovery',()=>store.loadRecovery());
 ipcMain.handle('save-recovery',(_,data)=>store.saveRecovery(data));
 ipcMain.handle('storage-info',()=>({projects:store.projects,backups:store.backups,recovery:store.recovery,version:app.getVersion()}));
 ipcMain.handle('project-list',async(_,kind)=>{const projects=await store.listProjects(kind);if(kind!=='scene')return projects;const byId=new Map(projects.map(x=>[x.id,x])),all=await sceneLibrary.listAllMetadata();for(const entry of all){const saved=byId.get(entry.id);byId.set(entry.id,{...saved,...entry,file:saved?.file||null,library:true,kind:'scene'});}return [...byId.values()].sort((a,b)=>b.modified-a.modified||a.name.localeCompare(b.name));});
 ipcMain.handle('project-load',(_,file,kind)=>store.loadProject(file,kind));
 ipcMain.handle('project-open-folder',async(_,kind)=>{if(!['world','scene'].includes(kind))throw Error('Choose a world or encounter folder');const folder=path.join(store.projects,kind==='world'?'Worlds':'Encounters');await fs.mkdir(folder,{recursive:true});const result=await shell.openPath(folder);if(result)throw Error(result);return true;});
 ipcMain.handle('campaign-open-folder',async()=>{const folder=process.env.TERRAIN_CAMPAIGN_DIR||path.join(app.getPath('documents'),'Terrain Foundry','Campaigns');await fs.mkdir(folder,{recursive:true});const result=await shell.openPath(folder);if(result)throw Error(result);return true;});
 Menu.setApplicationMenu(null);
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
 const width=Math.min(1500,area.width),height=Math.min(960,area.height);
 const win=new BrowserWindow({x:area.x+Math.floor((area.width-width)/2),y:area.y+Math.floor((area.height-height)/2),width,height,minWidth:Math.min(1100,area.width),minHeight:Math.min(720,area.height),title:'Terrain Foundry',backgroundColor:'#111820',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.session.setPermissionCheckHandler((contents,permission)=>contents===win.webContents&&permission==='media');
 win.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win.webContents&&permission==='media'&&!(details.mediaTypes||[]).includes('video')));
 premiumServices=await require('./premium-native.cjs').setupPremiumNative({app,win,ipcMain,BrowserWindow,safeStorage,net,isReserved:id=>readBuiltin.has(id)});
 campaignServices=require('./campaign-native.cjs').setupCampaignNative({app,win,ipcMain,dialog,BrowserWindow,safeStorage,net,sceneLibrary,premiumInventory:()=>premiumServices.store.inventory()});
 ipcMain.handle('campaign-open-portal',async event=>{if(event.sender!==win.webContents)throw Error('Unapproved window');const target=process.env.TERRAIN_PORTAL_LOCAL_URL||'https://terrainfoundry.co.uk/campaign-portal.html';if(target!=='https://terrainfoundry.co.uk/campaign-portal.html'&&!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+\/site\/campaign-portal\.html$/.test(target))throw Error('Invalid local portal test URL');await shell.openExternal(target);return true;});
 win.webContents.setWindowOpenHandler(({url})=>{if(['https://www.printablescenery.com/','https://www.printablescenery.com/2026/10/01/mgn-consultancy/'].includes(url))void shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',e=>e.preventDefault());
 ipcMain.handle('print-website-pack',async(_,data)=>{if(!(data instanceof Uint8Array)||data.length>40*1024*1024||data[0]!==80||data[1]!==75)throw Error('Print pack must be a ZIP under 40 MB.');const result=await dialog.showSaveDialog(win,{title:'Save the print pack to upload on the website',defaultPath:path.join(app.getPath('documents'),'TerrainFoundry-print-quote.zip'),filters:[{name:'ZIP print pack',extensions:['zip']}]});if(result.canceled)return null;await fs.writeFile(result.filePath,data);await shell.openExternal('https://terrainfoundry.co.uk/#print-service');return result.filePath;});
 win.webContents.on('will-prevent-unload',e=>{const response=dialog.showMessageBoxSync(win,{type:'question',buttons:['Keep editing','Close window'],defaultId:0,cancelId:0,title:'Unsaved project',message:'Close with unsaved changes?',detail:'Save a project file to keep all changes. Recovery is kept separately, but named project files are the best way to keep multiple scenes.'});if(response===1)e.preventDefault();else finishing=false;});
 win.loadFile(path.join(__dirname,'../dist/index.html'),{query:process.argv.includes('--castle-demo')?{demo:'castle'}:process.argv.includes('--outdoor-demo')?{demo:'outdoor'}:process.argv.includes('--openlock-demo')?{demo:'openlock'}:process.argv.includes('--benchmarks')?{demo:'benchmarks'}:process.argv.includes('--dungeon-demo')?{demo:'dungeon'}:process.argv.includes('--village-demo')?{demo:'village'}:{}});
 ipcMain.handle('save',async(_,data,options)=>{if(typeof data!=='string'||data.length>100000000)throw Error('Invalid project');const project=JSON.parse(data),world=project.kind==='world',folder=path.join(store.projects,world?'Worlds':'Encounters'),name=String(project.name||'Untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100).replace(/[. ]+$/,'')||'Untitled';await fs.mkdir(folder,{recursive:true});const r=await dialog.showSaveDialog(win,{title:world?'Save world':'Save encounter / scene',defaultPath:path.join(folder,'Terrain Foundry - '+name+(world?'.world.terrain':'.scene.terrain')),filters:[{name:world?'World project':'Encounter or scene',extensions:['terrain']}]});if(r.canceled)return null;await store.save(r.filePath,data);return r.filePath;});
 ipcMain.handle('open',async(_,options)=>{const r=await dialog.showOpenDialog(win,{defaultPath:store.projects,filters:[{name:'Terrain project',extensions:['terrain']}],properties:['openFile']});if(r.canceled)return null;const p=r.filePaths[0];if((await fs.stat(p)).size>100000000)throw Error('Project too large');const data=await fs.readFile(p,'utf8');return options?.withPath===true?{data,path:p}:data;});
 ipcMain.handle('export',async(_,files)=>{require('./print-export-validation.cjs').validateExportFiles(files);const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory'],title:'Choose where to create the print pack'});if(r.canceled)return null;const dir=await fs.mkdtemp(path.join(r.filePaths[0],'TerrainFoundry-'));for(const f of files)await fs.writeFile(path.join(dir,f.name),f.data);return dir;});
});app.on('window-all-closed',()=>app.quit());






