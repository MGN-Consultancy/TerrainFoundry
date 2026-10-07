const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-studio-home-'));
 const app=await _electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),`--user-data-dir=${dir}/profile`],env:{...process.env,TERRAIN_CAMPAIGN_DIR:dir+'/campaigns',TERRAIN_SCENE_LIBRARY:dir+'/scenes'}});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('#campaign-home',{timeout:120000});
  if(await page.locator('#release-dialog').isVisible())await page.locator('#release-acknowledge').click();
  if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-close').click();
  await page.waitForSelector('#studio-home[open]');
  assert.equal(await page.locator('#studio-home .studio-icon-button[aria-label="Settings"]').count(),1);
  assert.equal(await page.locator('#studio-home').getByText('Continue editor',{exact:true}).count(),0);
  assert.equal(await page.locator('#studio-home').getByText(/AI setup|Setup · AI/i).count(),0);
  assert.match(await page.locator('#studio-home').innerText(),/D&D Campaigns[\s\S]*Worlds[\s\S]*Encounters & Scenes/);
  const images=await page.locator('#studio-home img').evaluateAll(items=>items.map(i=>({alt:i.alt,loaded:i.complete&&i.naturalWidth>0})));
  assert.equal(images.length,4);assert(images.every(i=>i.loaded),JSON.stringify(images));
  await page.locator('[data-route=campaign]').click();assert.match(await page.locator('#studio-create-panel, #studio-route').innerText(),/D&D campaign|Campaign brief|Start a D&D campaign/);
  await page.locator('#studio-create-close').click();await page.locator('[data-route=world]').click();assert.match(await page.locator('#studio-route').innerText(),/complete table layout/);
  await page.locator('#studio-create-close').click();await page.locator('[data-route=scene]').click();assert.match(await page.locator('#studio-route').innerText(),/smaller self-contained scene/);
  await page.locator('#studio-create-close').click();
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'test-results/studio-home.png',fullPage:true});
  const dimensions=await page.locator('#studio-home').evaluate(e=>({scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
  assert.equal(dimensions.scrollWidth,dimensions.clientWidth);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({images,dimensions,screenshot:'test-results/studio-home.png'}));
 }finally{await app.close();await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});

