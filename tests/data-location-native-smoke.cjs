// Native storage acceptance uses synthetic files, isolated Documents/profile and no providers.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');

(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tf-data-location-native-'));
 assert.equal(path.dirname(root),path.resolve(os.tmpdir()));
 assert.ok(path.basename(root).startsWith('tf-data-location-native-'));
 const profile=path.join(root,'profile'),documents=path.join(root,'documents'),destination=path.join(root,'Chosen editor data');
 const artifacts=path.resolve('test-results/game-designer/data-location-native');
 await fs.mkdir(artifacts,{recursive:true});
 const executable=process.env.TERRAIN_EXECUTABLE||require('electron');
 const env={...process.env,TERRAIN_DOCUMENTS_DIR:documents};
 for(const key of ['ELECTRON_RUN_AS_NODE','TERRAIN_CAMPAIGN_DIR','TERRAIN_SCENE_LIBRARY','TERRAIN_CREATIVE_LIBRARY','TERRAIN_COMPANION_DIR','TERRAIN_LAUNCHER_ROOT'])delete env[key];
 let app,totalProviderCalls=0,totalBrowserCalls=0;
 const write=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);};
 const normal=file=>path.resolve(file).toLowerCase();
 async function launch(){
  app=await _electron.launch({executablePath:executable,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),'--user-data-dir='+profile],env});
  const paths=await app.evaluate(({app})=>({userData:app.getPath('userData'),sessionData:app.getPath('sessionData')}));
  for(const value of Object.values(paths))assert.equal(normal(value),normal(profile),'Refuse fixture writes outside the isolated runtime profile');
  await app.evaluate(({net,shell})=>{globalThis.storageProviderCalls=0;globalThis.storageBrowserCalls=0;net.fetch=async()=>{globalThis.storageProviderCalls++;throw Error('Storage acceptance blocks provider requests');};shell.openExternal=async()=>{globalThis.storageBrowserCalls++;throw Error('Storage acceptance blocks external browser requests');};});
  const page=await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.waitForURL(/\/dist\/index\.html(?:\?.*)?$/,{timeout:120000});
  await page.waitForFunction(()=>typeof window.desktop?.storageLocations==='function');
  return page;
 }
 async function close(){
  if(!app)return;
  const calls=await app.evaluate(()=>({provider:globalThis.storageProviderCalls,browser:globalThis.storageBrowserCalls}));
  totalProviderCalls+=calls.provider;totalBrowserCalls+=calls.browser;
  await app.close();app=null;
 }
 try{
  // Tiny tetrahedra satisfy the existing built-in renderer without loading paid collections.
  const fixture=path.join(root,'fixture');await fs.mkdir(fixture);
  const vertices=[0,0,0,25,0,0,0,8,0,0,0,25],indices=[0,2,1,0,1,3,0,3,2,1,2,3];
  const data=Buffer.concat([Buffer.from(new Float32Array(vertices).buffer),Buffer.from(new Float32Array(vertices.length).fill(.7).buffer),Buffer.from(new Uint32Array(indices).buffer)]),part={vertices:4,indices:12,length:data.length};
  await fs.writeFile(path.join(fixture,'meshes.bin'),Buffer.concat([data,data]));
  const ids=Object.keys(JSON.parse(await fs.readFile('src/generated/builtin-index.json','utf8')));
  await fs.writeFile(path.join(fixture,'index.json'),JSON.stringify(Object.fromEntries(ids.map(id=>[id,{offset:0,raw:part,connected:part}]))));
  env.TERRAIN_ASSET_PACKS=JSON.stringify({test:fixture});
  let page=await launch();
  const initial=await page.evaluate(()=>window.desktop.storageLocations());
  assert.equal(normal(initial.userData),normal(profile));
  assert.equal(normal(initial.currentRoot),normal(path.join(documents,'Terrain Foundry')));
  assert.equal(initial.persistedRoot,null);
  const {createCampaign}=await import('../desktop/campaign-schema.mjs');
  const game=await page.evaluate(value=>window.desktop.campaignSave(value),createCampaign('Storage migration fixture game'));
  const asset=await page.evaluate(()=>window.desktop.creativeCreate({kind:'scenery',name:'Storage migration fixture wall',design:{purpose:'other'}}));
  const character=await page.evaluate(()=>window.desktop.creativeCreate({kind:'character',name:'Storage migration player piece',design:{purpose:'other'}}));
  const sceneryFolders=await fs.readdir(path.join(initial.creativeDirectory,'Scenery'));
  assert.equal(sceneryFolders.length,1);
  const relativeModel=path.join('Scenery',sceneryFolders[0],'raw-original.stl');
  const {defaults}=await import('../src/model.js');
  const world=defaults();world.kind='world';world.name='Storage migration fixture world';
  const worldFile=path.join(initial.projectsDirectory,'Worlds','fixture.world.terrain');
  const modelFile=path.join(initial.creativeDirectory,relativeModel);
  await write(worldFile,JSON.stringify(world));
  await write(modelFile,Buffer.from('SYNTHETIC ORIGINAL MODEL BYTES\x00\xff','latin1'));
  // Arbitrary protected fixture avoids interfering with normal account/device initialization.
  const privateFile=path.join(profile,'private','storage-acceptance.protected');
  await write(privateFile,Buffer.from('SYNTHETIC PRIVATE ACCOUNT BYTES\x00\xff','latin1'));
  const gameFile=path.join(initial.campaignDirectory,game.id,'campaign.json');
  const privateBefore=await fs.readFile(privateFile),modelBefore=await fs.readFile(modelFile),worldBefore=await fs.readFile(worldFile),gameBefore=await fs.readFile(gameFile);
  await app.evaluate(({dialog},destination)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[destination]});dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});},destination);
  const scheduled=await page.evaluate(()=>window.desktop.storageChooseLocation());
  assert.equal(scheduled.restartRequired,true);
  assert.equal(normal((await page.evaluate(()=>window.desktop.storageLocations())).pendingDestination),normal(destination));
  await assert.rejects(fs.stat(destination),{code:'ENOENT'});
  await close();
  page=await launch();
  const migrated=await page.evaluate(()=>window.desktop.storageLocations());
  assert.equal(normal(migrated.currentRoot),normal(destination));
  assert.equal(normal(migrated.campaignDirectory),normal(path.join(destination,'Games')));
  assert.equal(migrated.pendingDestination,null);
  assert.equal(migrated.migrationError,null);
  assert.equal((await page.evaluate(id=>window.desktop.campaignLoad(id),game.id)).name,game.name);
  assert.equal((await page.evaluate(id=>window.desktop.creativeLoad(id),asset.id)).name,asset.name);
  assert.equal((await page.evaluate(id=>window.desktop.creativeLoad(id),character.id)).name,character.name);
  assert.deepEqual(await fs.readFile(path.join(migrated.projectsDirectory,'Worlds','fixture.world.terrain')),worldBefore);
  assert.deepEqual(await fs.readFile(path.join(migrated.creativeDirectory,relativeModel)),modelBefore);
  assert.deepEqual(await fs.readFile(privateFile),privateBefore);
  assert.deepEqual(await fs.readFile(modelFile),modelBefore);
  assert.deepEqual(await fs.readFile(worldFile),worldBefore);
  assert.deepEqual(await fs.readFile(gameFile),gameBefore);
  assert.deepEqual(await fs.readFile(path.join(migrated.campaignDirectory,game.id,'campaign.json')),gameBefore);
  await assert.rejects(fs.stat(path.join(destination,'private')),{code:'ENOENT'});
  const configBefore=await fs.readFile(path.join(profile,'data-location.json'));
  await close();
  let missingRootFailsClosed=false;
  if(!process.env.TERRAIN_EXECUTABLE){
   // Capture the startup error before native UI creation, avoiding an unattended error dialog.
   const disconnected=path.join(root,'Disconnected editor data');await fs.rename(destination,disconnected);
   const missingReceipt=path.join(root,'missing-root.json'),wrapper=path.join(root,'missing-root-bootstrap.cjs');
   const source=path.resolve('desktop/main.cjs');
   await fs.writeFile(wrapper,`const fs=require('node:fs'),{app,dialog,net,shell}=require('electron');app.setPath('userData',${JSON.stringify(profile)});let windows=0,providers=0,error=null;app.on('browser-window-created',()=>windows++);net.fetch=async()=>{providers++;throw Error('Providers blocked');};shell.openExternal=async()=>{throw Error('Browser blocked');};dialog.showErrorBox=(title,message)=>{error={title,message};};app.on('will-quit',()=>fs.writeFileSync(${JSON.stringify(missingReceipt)},JSON.stringify({windows,providers,error})));require(${JSON.stringify(source)});`);
   const child=spawn(executable,[wrapper,'--user-data-dir='+profile],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
   let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Missing-root startup did not terminate: '+output.slice(-2000)));},30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Missing-root startup exited '+code+': '+output.slice(-2000)));});});
   const failure=JSON.parse(await fs.readFile(missingReceipt,'utf8'));
   assert.equal(failure.windows,0);assert.equal(failure.providers,0);
   assert.equal(failure.error.title,'Editor data folder unavailable');
   assert.match(failure.error.message,/unavailable|reconnect/i);
   await assert.rejects(fs.stat(destination),{code:'ENOENT'});
   assert.deepEqual(await fs.readFile(path.join(profile,'data-location.json')),configBefore);
   assert.deepEqual(await fs.readFile(privateFile),privateBefore);
   await fs.rename(disconnected,destination);
   missingRootFailsClosed=true;
  }
  assert.equal(totalProviderCalls,0);assert.equal(totalBrowserCalls,0);
  const receipt={passed:true,isolated:true,nativeIpc:true,relaunchAppliesMove:true,gameReopened:true,worldCopied:true,sceneryReopened:true,characterReopened:true,originalModelPreserved:true,originalSourcePreserved:true,privateBytesUnchanged:true,missingRootFailsClosed,providerCalls:totalProviderCalls,browserCalls:totalBrowserCalls};
  await fs.writeFile(path.join(artifacts,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{
  if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
  await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
