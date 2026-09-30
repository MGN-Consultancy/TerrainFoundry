const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'terrain-underkeep-'));
 const app=await electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),`--user-data-dir=${dir}/profile`]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.waitForSelector('canvas',{timeout:120000});
  await page.locator('#collection').selectOption('r-');assert.match(await page.locator('#library-count').textContent(),/24 of 431/);assert.equal(await page.locator('#kit .asset').count(),24);
  await page.locator('#more-assets').click();assert.match(await page.locator('#library-count').textContent(),/48 of 431/);
  await page.locator('#family').selectOption('Mine');assert.equal(await page.locator('#kit .asset').count(),20);await page.locator('#family').selectOption('All families');
  await page.locator('#search').fill('E-TRP-TrackMine-X');assert.equal(await page.locator('#kit .asset').count(),1);assert.equal(await page.locator('#kit .asset').getAttribute('data-asset'),'r-106');
  const project={version:1,name:'Underkeep inspection',grid:25.4,connectors:'openlock',connectorRevision:2,board:32,printer:{x:256,y:256,z:256},items:['r-002','r-033','r-052','r-100','r-108','r-137','r-158','r-222','r-324','r-356','r-336','r-431'].map((type,i)=>({id:'review-'+i,type,x:(i%4-1.5)*6,z:(Math.floor(i/4)-1)*6,y:0,rotation:0,color:'#ffffff'}))};
  await fs.writeFile(dir+'/review.terrain',JSON.stringify(project));
  await app.evaluate(({dialog},dir)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dir+'/saved.terrain'});dialog.showOpenDialog=async(_,o)=>({canceled:false,filePaths:[o.properties.includes('openDirectory')?dir:dir+'/review.terrain']});},dir);
  await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='12');await page.locator('#fit').click();await page.waitForTimeout(800);await page.screenshot({path:path.resolve('test-results/underkeep-scene.png')});
  await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'));assert.deepEqual(JSON.parse(await fs.readFile(dir+'/saved.terrain','utf8')).items,project.items);
  await page.locator('#export').click();await page.locator('#confirm-print').click();await page.waitForFunction(()=>!document.querySelector('#print-dialog').open,{timeout:60000});
  const pack=(await fs.readdir(dir)).find(n=>n.startsWith('TerrainFoundry-'));assert.ok(pack);const files=await fs.readdir(path.join(dir,pack));for(const item of project.items)assert.ok(files.includes(item.type+'.stl'));assert.ok(files.includes('foundry-link-pin.stl'));assert.ok(files.includes('DUNGEON-PIECES.json'));
  await page.locator('#search').fill('');await page.locator('#collection').selectOption('r-');
  await page.addStyleTag({content:'header,.right,.stage,.footer,.toast,.library-note,.examples,#import-stl,#dungeon-demo{display:none!important}.workspace{display:block!important;height:auto!important}aside{width:100%!important;overflow:visible!important}.kit{grid-template-columns:repeat(6,1fr)!important}.thumbnail{height:125px!important}.asset{min-height:175px!important}body{overflow:auto!important}'});
  for(const family of ['Fortress','Crypt','Mine','Grating','Ossuary','Timber','Cavern']){await page.locator('#family').selectOption(family);await page.screenshot({path:path.resolve(`test-results/underkeep-${family.toLowerCase()}.png`),fullPage:true});}
  assert.deepEqual(errors,[]);console.log('PASS: 431-piece browsing, pagination, family and reference search, 12-piece save, STL/connector export, seven family preview sheets.');
 }finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
