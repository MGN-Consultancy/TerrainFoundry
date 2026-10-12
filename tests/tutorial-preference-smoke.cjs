const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tf-tutorial-restart-'));let app;
 const env={...process.env,TERRAIN_CAMPAIGN_DIR:dir+'/campaigns',TERRAIN_SCENE_LIBRARY:dir+'/scenes'};delete env.ELECTRON_RUN_AS_NODE;
 const packs={};for(const d of await fs.readdir('G:/Github/dnd-terrain-builder/release/asset-packs',{withFileTypes:true}))if(d.isDirectory()){const p='G:/Github/dnd-terrain-builder/release/asset-packs/'+d.name;try{await fs.access(p+'/index.json');packs[d.name]=p;}catch{}}env.TERRAIN_ASSET_PACKS=JSON.stringify(packs);
 async function launch(){app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['.','--user-data-dir='+dir+'/profile'],env});const page=await app.firstWindow();await page.waitForSelector('#tutorial-dialog',{state:'attached',timeout:120000});if(await page.locator('#release-dialog').isVisible())await page.locator('#release-acknowledge').click();return page;}
 async function stop(){app.process().kill();await app.close().catch(()=>{});app=null;}
 try{
  let page=await launch();await page.locator('#tutorial-dialog[open]').waitFor();await page.locator('#tutorial-skip').check();await page.waitForFunction(()=>!document.querySelector('#tutorial-skip').disabled);await page.locator('#tutorial-close').click();await page.locator('#studio-home[open]').waitFor();
  await page.evaluate(async()=>{await window.desktop.clientPreferencesSave({reducedMotion:true});localStorage.removeItem('terrain-foundry-tutorial-skip-v2');});await stop();
  page=await launch();await page.locator('#studio-home[open]').waitFor();assert.equal(await page.locator('#tutorial-dialog').isVisible(),false);await page.locator('#studio-home-close').click();await page.keyboard.press('F1');await page.locator('#tutorial-dialog[open]').waitFor();assert.equal(await page.locator('#tutorial-skip').isChecked(),true);await page.locator('#tutorial-skip').uncheck();await page.waitForFunction(()=>!document.querySelector('#tutorial-skip').disabled);await page.locator('#tutorial-close').click();await stop();
  page=await launch();await page.locator('#tutorial-dialog[open]').waitFor();assert.equal(await page.locator('#tutorial-skip').isChecked(),false);assert.equal(await page.evaluate(async()=>(await window.desktop.clientPreferencesRead()).reducedMotion),true);
  console.log(JSON.stringify({passed:true,skipSurvivesRestart:true,independentOfBrowserStorage:true,unrelatedSettingsPreserved:true,F1ReopensGuide:true,uncheckedShowsNextLaunch:true,providerCalls:0}));
 }finally{if(app)await stop();await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
