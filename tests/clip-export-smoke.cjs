const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const dir=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'terrain-clips-'));
 const app=await electron.launch({executablePath:process.env.TERRAIN_EXECUTABLE,args:[...(process.env.TERRAIN_EXECUTABLE?[]:['.']),`--user-data-dir=${dir}/profile`]});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#tutorial-dialog',{state:'attached'});if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-close').click();await page.waitForSelector('#connection-status');
  await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},dir);
  await page.locator('#export').click();assert.match(await page.locator('#export-summary').textContent(),/13 clips to print.*Clip STL included/);
  await page.locator('#confirm-print').click();await page.waitForFunction(()=>!document.querySelector('#print-dialog').open);
  const pack=(await fs.readdir(dir)).find(n=>n.startsWith('TerrainFoundry-'));
  const report=JSON.parse(await fs.readFile(path.join(dir,pack,'connections.json')));assert.equal(report.totalClipQuantity,13);
  const clip=await fs.readFile(path.join(dir,pack,'openlock-clip.stl'));assert.equal(clip.length,37284);
  assert.match(await fs.readFile(path.join(dir,pack,'quantities.csv'),'utf8'),/openlock-clip.stl,13,/);
  await page.locator('#fit-test').click();await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.startsWith('Fit test exported:'));
  const fit=(await fs.readdir(dir)).find(n=>n.startsWith('TerrainFoundry-')&&n!==pack);
  assert.deepEqual(await fs.readFile(path.join(dir,fit,'openlock-clip.stl')),clip);
  assert.match(await fs.readFile(path.join(dir,fit,'quantities.csv'),'utf8'),/openlock-clip.stl,1,/);
  assert.match(await fs.readFile(path.join(dir,fit,'OPENLOCK-CLIP-NOTICE.txt'),'utf8'),/Printable Scenery/);
  assert.deepEqual(errors,[]);console.log('PASS: packaged offline scene export includes clip, count 13, attribution; fit-test export includes clip, count 1. '+dir);
 }finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
