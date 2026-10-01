const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const dir=path.resolve('test-results','openlock-'+Date.now());await fs.mkdir(dir,{recursive:true});
const app=await electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),'--user-data-dir='+path.join(dir,'profile')]});
try{const page=await app.firstWindow(),errors=[];page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#connection-status');await page.waitForFunction(()=>{const i=document.querySelector('img[alt="OpenLOCK Compatible"]');return i?.complete&&i.naturalWidth>0;});
 await page.waitForFunction(()=>document.querySelector('#count').textContent==='12');
 assert.equal(await page.locator('#connectors').inputValue(),'openlock');assert.ok(await page.locator('#grid').isDisabled());
 assert.match(await page.locator('#connection-status').textContent(),/0 overlapping bases/);
 await page.waitForSelector('#tutorial-dialog',{state:'attached'});if(await page.locator('#release-dialog').isVisible())await page.locator('#release-acknowledge').click();await page.waitForSelector('#tutorial-dialog[open]');await page.locator('#tutorial-close').click();await page.locator('#fit').click();await page.waitForTimeout(400);await page.screenshot({path:path.resolve('test-results/openlock-courtyard.png')});
 await page.locator('#sockets').click();await page.waitForTimeout(400);await page.screenshot({path:path.resolve('test-results/openlock-sockets.png')});await page.locator('#perspective').click();
 await app.evaluate(({dialog},dir)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dir+'/openlock.terrain'});dialog.showOpenDialog=async(_,o)=>({canceled:false,filePaths:[o.properties.includes('openDirectory')?dir:dir+'/openlock.terrain']});},dir);
 await page.locator('#export').click();await page.locator('#confirm-print').click();await page.waitForFunction(()=>!document.querySelector('#print-dialog').open);
 const pack=(await fs.readdir(dir)).find(x=>x.startsWith('TerrainFoundry-'));const report=JSON.parse(await fs.readFile(path.join(dir,pack,'connections.json')));assert.equal(report.overlaps.length,0);assert.ok(report.clipCount>=12);assert.equal(report.physicalFitVerified,false);assert.equal(report.templateSource,'printable-scenery-8.6');for(const name of ['MGN-OPENLOCK-COMMERCIAL-LICENSE.txt','OpenLOCK-Compatible.png'])assert.ok((await fs.readdir(path.join(dir,pack))).includes(name));
 const data=await fs.readFile(path.join(dir,pack,'fit-floor.stl'));assert.equal(data.length,84+data.readUInt32LE(80)*50);
 // A small plain fixture exercises the browser's local WASM conversion and embedded save.
 await page.locator('#stl-file').setInputFiles(path.resolve('test-results/import-column.stl'));
 await page.waitForFunction(()=>document.querySelector('#count').textContent==='13',null,{timeout:30000});
 assert.equal(await page.locator('#kit .asset').count(),1);assert.match(await page.locator('#kit .asset small').textContent(),/Scenic/);await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'));
 const project=JSON.parse(await fs.readFile(dir+'/openlock.terrain'));assert.equal(project.connectors,'openlock');assert.equal(Object.values(project.assets)[0].connected,undefined);
 await page.locator('#new').click();await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='13');
 await page.locator('#connectors').selectOption('none');assert.ok(await page.locator('#grid').isEnabled());
 await page.locator('#connectors').selectOption('openlock');await page.waitForFunction(()=>document.querySelector('#grid').disabled);await page.locator('#save').click();
 assert.deepEqual(errors,[]);console.log('PASS packaged UI: socket previews, 12-piece connected scene, STL/fit-pair export, unmodified STL import, saved scene, reopen and mode conversion.');
}finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.destroy();});await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});

