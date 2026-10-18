// UI ownership regression only: no provider calls, keys or saved client profile.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({configFile:false,publicDir:false,logLevel:'error',plugins:[{name:'usage-meter',configureServer(server){server.middlewares.use('/__usage-meter',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><link rel="stylesheet" href="/src/creative-studio.css"></head><body><header id="original-heading"><small id="campaign-token-meter" role="status" style="max-width:25rem;white-space:normal;text-align:right">Recorded ChatGPT: 50 tokens · API: 0 tokens · Images: 0</small><button id="original-next">Settings</button></header><aside id="companion">Shared companion</aside><script type="module">
import {setupCreativeStudio} from '/src/creative-studio.js';
const records={scenery:{schema:1,id:'wall',kind:'scenery',name:'Harbor wall',packName:'Harbor',description:'A custom scenery wall',stage:'brief',design:{purpose:'other'},sheet:{},concepts:[],referenceImages:[]},character:{schema:1,id:'figure',kind:'character',name:'Harbor player piece',description:'Custom player piece',stage:'brief',design:{purpose:'other'},sheet:{},concepts:[],referenceImages:[]}};
window.studio=setupCreativeStudio({api:{creativeLoad:async id=>structuredClone(Object.values(records).find(r=>r.id===id)),creativeSave:async r=>r,creativeList:async()=>Object.values(records)},conversation:document.getElementById('companion'),usageMeter:()=>document.getElementById('campaign-token-meter')});window.ready=true;
</script></body></html>`);});}}],server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.TERRAIN_BROWSER_EXECUTABLE?{executablePath:process.env.TERRAIN_BROWSER_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.resolvedUrls.local[0]+'__usage-meter');await page.waitForFunction(()=>window.ready);
 for(const [kind,id] of [['scenery','wall'],['character','figure']]){
  await page.evaluate(([kind,id])=>window.studio.open(kind,id),[kind,id]);if(kind==='character')await page.evaluate(()=>document.querySelector('.creative-studio').dispatchEvent(new Event('close')));assert.equal(await page.locator('.creative-companion #companion').count(),1,'A queued old close event must not detach the active companion');assert.equal(await page.locator('.creative-heading #campaign-token-meter').count(),1,kind+' header must own the live usage meter');assert.equal(await page.locator('#campaign-token-meter').count(),1);
  await page.evaluate(()=>document.getElementById('campaign-token-meter').textContent='Recorded ChatGPT: 50 tokens · API: 1152 tokens · Images: 1');assert.match(await page.locator('.creative-heading #campaign-token-meter').textContent(),/API: 1152 tokens/);
  for(const width of [1365,800,600]){await page.setViewportSize({width,height:900});const size=await page.locator('.creative-studio').evaluate(node=>({scroll:node.scrollWidth,width:node.clientWidth,meter:node.querySelector('#campaign-token-meter').getBoundingClientRect().right,right:node.getBoundingClientRect().right}));assert.ok(size.scroll<=size.width,'Usage header must not cause horizontal overflow at '+width);assert.ok(size.meter<=size.right,'Usage meter must remain inside the designer at '+width);}
  await page.locator('#creative-close').click();assert.equal(await page.locator('#original-heading > #campaign-token-meter').count(),1);assert.equal(await page.evaluate(()=>document.getElementById('campaign-token-meter').nextElementSibling.id),'original-next');assert.equal(await page.locator('#campaign-token-meter').count(),1);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,sceneryMeterVisible:true,characterMeterVisible:true,sameLiveMeter:true,restoredOnClose:true,providerCalls:0}));
}finally{await browser.close();await server.close();}
