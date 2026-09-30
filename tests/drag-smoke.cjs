const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const dir=path.join(require('node:os').tmpdir(),'terrain-drag-'+Date.now());await fs.mkdir(dir,{recursive:true});
 const fixture={version:1,name:'Drag test',grid:25.4,board:24,connectors:'openlock',printer:{x:180,y:180,z:180},items:[{id:'test-floor',type:'floor',x:0,z:0,y:0,rotation:90,color:'#ffffff'}]};
 const file=path.join(dir,'scene.terrain');await fs.writeFile(file,JSON.stringify(fixture));
 const app=await electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),`--user-data-dir=${dir}/profile`]});
 try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('canvas');
 await page.evaluate(()=>window.confirm=()=>true);
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
 await page.locator('#open').click();await page.waitForFunction(()=>document.querySelector('#count').textContent==='1');
 async function center(){await page.locator('#top').click();await page.waitForTimeout(600);const b=await page.locator('canvas').boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};}
 async function values(){return page.evaluate(()=>['x','z','height','angle'].map(id=>Number(document.getElementById(id).value)));}
 let c=await center();await page.mouse.click(c.x,c.y);assert.deepEqual(await values(),[0,0,0,90]);
 await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+90,c.y+40,{steps:12});await page.mouse.up();
 const moved=await values();assert.notEqual(moved[0],0);assert.equal(moved[2],0);assert.equal(moved[3],90);assert.equal(moved[0]%.25,0);
 await page.locator('#undo').click();assert.deepEqual(await values(),[0,0,0,90]);await page.locator('#redo').click();assert.deepEqual(await values(),moved);
 c=await center();await page.keyboard.down('Alt');await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x,c.y-80,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');
 const raised=await values();assert.ok(raised[2]>0);assert.deepEqual(raised.slice(0,2),moved.slice(0,2));
 c=await center();await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+80,c.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await values(),raised);
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Ready'));const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.items[0].y,raised[2]);
 await page.locator('#undo').click();assert.deepEqual(await values(),moved);
 // Downward elevation clamps at the board, without changing horizontal position.
 c=await center();await page.keyboard.down('Alt');await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x,c.y+80,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');assert.deepEqual(await values(),moved);
 // Empty board space still orbits the camera without moving the selected piece.
 const box=await page.locator('canvas').boundingBox();const before=await page.locator('canvas').screenshot();
 await page.mouse.move(box.x+box.width*.15,box.y+box.height*.7);await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.8,{steps:12});await page.mouse.up();await page.waitForTimeout(500);
 assert.deepEqual(await values(),moved);assert.notDeepEqual(await page.locator('canvas').screenshot(),before);
 assert.deepEqual(errors,[]);console.log('PASS: piece drag, snap, rotation preservation, Alt elevation, clamp, Escape cancel, single-step undo/redo, saved position and empty-space camera orbit.');
 }finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
