// Isolated UI coverage: fake locations only; no providers, credentials or client profile.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const html = `<!doctype html><html><body><script type="module">
import {setupLibraryStorage} from '/src/library-storage.js';
window.state={auditCalls:0,locationsCalls:0,folderCalls:[],chooseCalls:0,cancelCalls:0,restartCalls:0,cacheCalls:0,pending:false,dirty:false,toasts:[]};
const state=window.state;
window.storage=setupLibraryStorage({isDirty:()=>state.dirty,toast:text=>state.toasts.push(text),api:{
 storageLocations:async()=>{state.locationsCalls++;return {currentRoot:'X:/Example/TerrainFoundry',installRoot:'X:/Example/Program',pendingDestination:state.pending?'Y:/Example/NewLibrary':null,folders:[{id:'games',label:'Games',path:'X:/Example/TerrainFoundry/Games'},{id:'worlds',label:'Worlds',path:'X:/Example/TerrainFoundry/Worlds'},{id:'scenery',label:'Scenery',path:'X:/Example/TerrainFoundry/Scenery'},{id:'characters',label:'Player pieces',path:'X:/Example/TerrainFoundry/Characters'}]};},
 storageAudit:async()=>{state.auditCalls++;return {totalBytes:2048,partial:true,skippedSymlinks:1,categories:[{label:'Games',bytes:2048,files:2}]};},
 storageOpenFolder:async id=>state.folderCalls.push(id),
 storageChooseLocation:async()=>{state.chooseCalls++;state.pending=true;return {restartRequired:true};},
 storageCancelLocation:async()=>{state.cancelCalls++;state.pending=false;return {message:'Pending move cancelled. Original files are unchanged.'};},
 storageRestart:async()=>{state.restartCalls++;},
 storageClearCache:async()=>{state.cacheCalls++;return {removedBytes:2048,removedFiles:2,skipped:1,partial:true};},
 creativeExportBackup:async()=>null,creativeImportBackup:async()=>null
}});
window.ready=true;
</script></body></html>`;

const server=await createServer({configFile:false,publicDir:false,logLevel:'error',plugins:[{name:'library-storage-smoke',configureServer(server){server.middlewares.use('/__library-storage-smoke',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});}}],server:{host:'127.0.0.1',port:0}});
await server.listen();
let browser;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.TERRAIN_BROWSER_EXECUTABLE||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(server.resolvedUrls.local[0]+'__library-storage-smoke');
 await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>window.storage.open());
 const dialog=page.getByRole('dialog',{name:'Local storage and backup'});
 await dialog.waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>window.state.auditCalls),0,'Opening storage must not scan the library');
 assert.match(await dialog.textContent(),/opening this panel does not scan your files/);

 await dialog.getByRole('button',{name:'Measure disk usage',exact:true}).click();
 await page.waitForFunction(()=>window.state.auditCalls===1);
 await dialog.getByText('2.0 KB measured locally · partial scan.',{exact:true}).waitFor();
 assert.match(await dialog.textContent(),/Linked folders and unconfigured external workspaces are omitted/);
 assert.equal(await page.evaluate(()=>window.state.auditCalls),1,'Explicit measurement makes exactly one audit request');

 for(const label of ['Open data folder','Open editor installation','Open Games','Open Worlds','Open Scenery','Open Player pieces']) {
  await dialog.getByRole('button',{name:label,exact:true}).click();
 }
 assert.deepEqual(await page.evaluate(()=>window.state.folderCalls),['root','installation','games','worlds','scenery','characters']);

 await dialog.getByRole('button',{name:'Choose data folder…',exact:true}).click();
 await dialog.getByRole('button',{name:'Restart to finish move',exact:true}).waitFor();
 assert.match(await dialog.textContent(),/Move scheduled\. Save your projects, then restart/);
 assert.match(await dialog.textContent(),/Pending data folder: Y:\/Example\/NewLibrary/);
 assert.equal(await page.evaluate(()=>window.state.chooseCalls),1);
 await page.evaluate(()=>{window.state.dirty=true;});
 await dialog.getByRole('button',{name:'Restart to finish move',exact:true}).click();
 await dialog.getByText('Save your current world or scene before restarting.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.state.restartCalls),0,'Unsaved work blocks restart');
 await page.evaluate(()=>{window.state.dirty=false;});
 await dialog.getByRole('button',{name:'Restart to finish move',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.state.restartCalls),1);
 await dialog.getByRole('button',{name:'Cancel pending move',exact:true}).click();
 await dialog.getByRole('button',{name:'Restart to finish move',exact:true}).waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.state.cancelCalls),1);
 assert.match(await dialog.textContent(),/Pending move cancelled\. Original files are unchanged/);

 await dialog.getByRole('button',{name:'Clear disposable cache',exact:true}).click();
 await dialog.getByText('Cleared disposable cache (2.0 KB measured) · some locked or bounded items remain. Your saved designs, models, account connections and conversations are retained.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.state.cacheCalls),1);
 assert.equal(await page.evaluate(()=>window.state.auditCalls),1,'Folder and cache actions must not trigger hidden audits');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('dialog').waitFor({state:'detached'});
 await page.evaluate(()=>window.storage.open());
 await dialog.waitFor({state:'visible'});
 await page.evaluate(async()=>{window.storage.close();await window.storage.open();await new Promise(resolve=>setTimeout(resolve,50));});
 assert.equal(await dialog.isVisible(),true,'A queued close event must not remove the immediately reopened dialog');
 assert.equal(await page.evaluate(()=>window.state.auditCalls),1,'Reopening storage must not measure automatically');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,automaticAuditCalls:0,explicitAuditCalls:1,folderButtons:6,pendingAndCancel:true,dirtyRestartBlocked:true,cacheRetentionMessage:true,immediateReopen:true,providerCalls:0,realProfileUsed:false}));
} finally {
 if(browser)await browser.close();
 await server.close();
}
