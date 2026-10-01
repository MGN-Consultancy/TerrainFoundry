const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const dir=path.resolve('test-results','outdoor-'+Date.now());await fs.mkdir(dir,{recursive:true});
 const app=await electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),'--outdoor-demo','--user-data-dir='+dir+'/profile']});
 try{const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.waitForSelector('#tutorial-dialog',{state:'attached'});if(await page.locator('#release-dialog').isVisible())await page.locator('#release-acknowledge').click();await page.waitForSelector('#tutorial-dialog',{state:'attached'});if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-close').click();await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='30',null,{timeout:60000});
 assert.match(await page.locator('#connection-status').textContent(),/^49 matched connections/);assert.equal(await page.locator('#kit .asset').count(),21);
 await page.locator('#fit').click();await page.waitForTimeout(400);await page.screenshot({path:path.resolve('test-results/outdoor-scene.png')});
 await app.evaluate(({dialog},dir)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dir+'/scene.terrain'});dialog.showOpenDialog=async(_,o)=>({canceled:false,filePaths:[o.properties.includes('openDirectory')?dir:dir+'/detail.terrain']});},dir);
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'));
 const saved=JSON.parse(await fs.readFile(dir+'/scene.terrain'));assert.equal(saved.items.length,30);
 await page.locator('#export').click();await page.locator('#confirm-print').click();await page.waitForFunction(()=>!document.querySelector('#print-dialog').open);
 const pack=(await fs.readdir(dir)).find(x=>x.startsWith('TerrainFoundry-'));for(const id of ['o-bridge-wood','o-bridge-stone','o-oasis-inlet']){const b=await fs.readFile(path.join(dir,pack,id+'.stl'));assert.equal(b.length,84+b.readUInt32LE(80)*50);}
 for(const id of ['o-oasis','o-bridge-wood','o-bridge-stone']){const p={...saved,name:id,items:[{id:'detail',type:id,x:0,z:0,y:0,rotation:0,color:'#ffffff'}]};await fs.writeFile(dir+'/detail.terrain',JSON.stringify(p));await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='1');await page.locator('#fit').click();await page.waitForTimeout(250);await page.screenshot({path:path.resolve('test-results/'+id+'.png')});}
 assert.deepEqual(errors,[]);console.log('PASS outdoor desktop: 30-tile scene, 21 library assets, save, STL exports and detailed model previews.');
 }finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
