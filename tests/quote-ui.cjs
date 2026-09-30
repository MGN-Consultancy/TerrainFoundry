const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const q={id:'a'.repeat(32),status:'quoted',preview:true,expiresAt:Date.now()+86400000,colour:{label:'Stone grey'},items:Array.from({length:23},(_,i)=>({name:'Detailed dungeon curved wall '+(i+1),quantity:2})),price:{pieceCount:46,filamentPence:606,machinePence:3880,handlingPence:1700,discountPence:100,discount:{code:'TEST10'},shippingPence:495,vatPence:0,totalPence:6581,estimate:{material:'Basic PLA',printer:'Bambu H2S',grams:387.91,hours:19.4}}};
 const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));let calls=0;
 await page.route('https://terrainfoundry.co.uk/**',async route=>{const name=new URL(route.request().url()).pathname.slice(1);if(name==='print-config.js')return route.fulfill({body:"window.TERRAIN_PRINT_API='https://quote.test';",contentType:'text/javascript'});return route.fulfill({body:await fs.readFile('site/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/html'});});
 await page.route('https://quote.test/**',route=>{if(route.request().method()==='POST'){assert.ok(route.request().url().includes('/test-order/'));calls++;return route.fulfill({json:{...q,status:'test-requested'}});}return route.fulfill({json:q});});
 try{
 for(const [width,height] of [[1920,1080],[1366,768],[390,844],[390,667],[667,390]]){
  await page.setViewportSize({width,height});await page.goto('https://terrainfoundry.co.uk/print-order.html#'+q.id+'.'+'b'.repeat(64));await page.reload();await page.waitForSelector('.quote-summary');
  const layout=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewport:innerHeight,actions:document.querySelector('.quote-actions').getBoundingClientRect().bottom, panelBottom:document.querySelector('#order-details').getBoundingClientRect().bottom, contentBottom:Math.max(...[...document.querySelectorAll('.quote-column:not([hidden]) > *')].map(e=>e.getBoundingClientRect().bottom))}));
  assert.ok(layout.height<=height+1,JSON.stringify({width,height,layout}));assert.ok(layout.width<=width);assert.ok(layout.actions<height);assert.ok(layout.contentBottom<=layout.panelBottom,JSON.stringify({width,height,layout}));
  assert.doesNotMatch(await page.locator('body').innerText(),/manufacturing markup|filament cost|machine time cost/i);
  if(width<700)await page.getByRole('tab',{name:'Pieces'}).click();
  const seen=new Set();do{for(const name of await page.locator('.quote-pieces li').allTextContents())seen.add(name);if(await page.getByRole('button',{name:'Next',exact:true}).isDisabled())break;await page.getByRole('button',{name:'Next',exact:true}).click();}while(true);assert.equal(seen.size,23);
  if(width<700)await page.getByRole('tab',{name:'Price',exact:true}).click();
  await page.screenshot({path:`test-results/compact-quote-${width}-${height}.png`});console.log(`PASS ${width}x${height}: fits viewport; all pieces accessible`);
 }
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save quotation',exact:true}).click();const download=await downloadPromise;const text=await fs.readFile(await download.path(),'utf8');assert.ok(text.includes('#'+q.id+'.'+'b'.repeat(64)));assert.doesNotMatch(text,/markup|filament cost|machine time cost/i);
 await page.getByRole('button',{name:'PayPal-style test'}).click();await page.getByRole('status').filter({hasText:'Test request saved'}).waitFor();assert.equal(calls,1);assert.deepEqual(errors,[]);console.log('PASS private saved link and test request; no PayPal call');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
