const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-guide-test-'));
 async function launch(){return electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),'--user-data-dir='+profile]});}
 async function stop(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
 let app=await launch();
 try{
 const p=await app.firstWindow(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>r.abort());
 await p.waitForSelector('#tutorial-dialog[open]');await app.evaluate(({dialog})=>{global.__saveCalls=0;dialog.showSaveDialog=async()=>{global.__saveCalls++;return{canceled:true};};});
 const initial=await p.locator('#count').textContent();
 for(const size of [{width:1440,height:900},{width:1100,height:720}]){
  await p.setViewportSize(size);
  for(let i=0;i<6;i++){
   await p.locator('.tutorial-steps button').nth(i).click();
   await p.waitForFunction(()=>{const i=document.querySelector('#tutorial-image');return i.complete&&i.naturalWidth>0;});
   const bounds=await p.locator('#tutorial-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height+1);
   assert.ok(await p.locator('#tutorial-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
   const next=await p.locator('#tutorial-next').boundingBox();assert.ok(next.y+next.height<=size.height);
  }
 }
 await p.locator('.tutorial-steps button').first().click();assert.ok(await p.locator('#tutorial-back').isDisabled());
 await p.keyboard.press('ArrowRight');assert.match(await p.locator('.tutorial-progress').textContent(),/Step 2/);await p.locator('#tutorial-back').click();
 await p.locator('#tutorial-enlarge').click();await p.waitForSelector('#tutorial-zoom[open]');await p.keyboard.press('Escape');assert.ok(await p.locator('#tutorial-dialog').isVisible());
 for(const key of ['Delete','r','d','Control+s'])await p.keyboard.press(key);
 assert.equal(await p.locator('#count').textContent(),initial);assert.equal(await app.evaluate(()=>global.__saveCalls),0);
 await p.screenshot({path:'test-results/tutorial-1100.png'});
 await p.locator('.tutorial-steps button').last().click();assert.equal(await p.locator('#tutorial-next').textContent(),'Start building');await p.locator('#tutorial-next').click();
 await p.locator('#tutorial-help').click();await p.keyboard.press('Escape');await p.keyboard.press('F1');await p.locator('#tutorial-close').click();
 const controls=await p.locator('header button').evaluateAll(bs=>bs.filter(b=>!b.hidden&&b.offsetWidth).map(b=>{const r=b.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));assert.ok(controls.every(r=>r.left>=0&&r.right<=1100&&r.top>=0&&r.bottom<=78));
 await p.screenshot({path:'test-results/editor-1100.png'});assert.deepEqual(errors,[]);
 await stop(app);app=await launch();const p2=await app.firstWindow();await p2.waitForSelector('#tutorial-help');assert.equal(await p2.locator('#tutorial-dialog').evaluate(d=>d.open),false);await p2.locator('#tutorial-help').click();await p2.waitForSelector('#tutorial-dialog[open]');
 console.log('PASS first-start guide: six bundled screenshots, offline navigation, two window sizes, enlarge, shortcut isolation, unchanged scene, persistence and reopening.');
 }finally{await stop(app);}
})().catch(e=>{console.error(e);process.exit(1)});
