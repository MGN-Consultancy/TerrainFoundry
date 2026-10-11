// Stub-only browser checks. No provider credentials, network requests or paid jobs.
import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const harness=(_request,response)=>{
 response.setHeader('Content-Type','text/html');response.end(`<!doctype html><html><head><link rel="stylesheet" href="/src/creative-studio.css"><style>body{background:#10202b;color:white;font-family:system-ui}button{padding:8px;background:#d8b477;color:#10202b;border:0;border-radius:6px}input,textarea,select{background:#10202b;color:white;border:1px solid #68818a;box-sizing:border-box}.chat{display:flex;flex-direction:column;gap:12px;height:100%;min-height:300px}.chat textarea{margin-top:auto}</style></head><body><div id="original"><div id="companion" class="chat"><h3>Your companion · same voice session</h3><p>Tell me about the character you have in mind.</p><button id="voice">Live voice active</button><textarea aria-label="Shared companion prompt"></textarea></div><span id="after">Following original sibling</span></div><script type="module">
 import {setupCreativeStudio} from '/src/creative-studio.js';
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 window.records=[];window.calls=[];window.settingsCalls=0;window.added=null;window.voice=document.getElementById('voice');window.voice.session={active:true};
 const clone=v=>structuredClone(v),api={
  creativeCreate:async({kind,name,packName})=>{const r={schema:1,id:crypto.randomUUID(),kind,name,packName,description:'',stage:'brief',design:{},sheet:{},concepts:[],selectedConceptId:null,createdAt:Date.now(),updatedAt:Date.now()};window.records.push(r);return clone(r)},
  creativeLoad:async id=>clone(window.records.find(r=>r.id===id)),
  creativeSave:async r=>{window.records[window.records.findIndex(v=>v.id===r.id)]=clone(r);return clone(r)},
  creativeList:async({kind})=>clone(window.records.filter(r=>r.kind===kind)),
  creativeGenerateConcept:async(id,prompt)=>{window.calls.push({type:'image',prompt});const r=window.records.find(r=>r.id===id);r.concepts.push({id:crypto.randomUUID(),image,name:'Concept '+(r.concepts.length+1),approved:false,retained:true,createdAt:Date.now()});return clone(r)},
  creativeGenerateModel:async(id,conceptId)=>{window.calls.push({type:'model',conceptId});const r=window.records.find(r=>r.id===id);r.model={format:'stl',status:'Needs print review'};return clone(r)},
  creativeImport:async()=>[],creativeExportBackup:async value=>window.calls.push(value),creativeImportBackup:async()=>{},creativeOpenFolder:async()=>{},creativePrintSheet:async(id,format)=>window.calls.push({type:'print',id,format})
 };
 window.studio=setupCreativeStudio({api,conversation:document.getElementById('companion'),onSettings:()=>window.settingsCalls++,onSaveToCampaign:r=>window.added=r,onPlace:r=>window.placed=r});
 window.ready=true;
 </script></body></html>`);
};
const server=await createServer({configFile:false,publicDir:false,plugins:[{name:'creative-smoke-harness',configureServer(server){server.middlewares.use('/__creative_smoke',harness)}}],server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.TERRAIN_BROWSER_EXECUTABLE?{executablePath:process.env.TERRAIN_BROWSER_EXECUTABLE}:{})}),page=await browser.newPage({viewport:{width:1365,height:900}});
try {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(server.resolvedUrls.local[0]+'__creative_smoke');await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>{window.cancelledOpen=window.studio.open('character')});await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.creative-start'));assert.equal(await page.evaluate(()=>window.records.length),0);
 await page.evaluate(()=>{window.openDesign=window.studio.open('character')});await page.waitForSelector('.creative-start[open]');assert.equal(await page.evaluate(()=>window.records.length),0);await page.getByLabel('Design name',{exact:true}).fill('Mira the ranger');await page.getByRole('button',{name:'Start design',exact:true}).click();await page.waitForSelector('.creative-studio[open]');assert.equal(await page.evaluate(()=>window.records[0].name),'Mira the ranger');
 assert.equal(await page.locator('#companion').count(),1);assert.equal(await page.locator('.creative-companion #companion').count(),1);
 await page.getByLabel('Character name',{exact:true}).fill('Mira the ranger');await page.getByLabel('Design brief',{exact:true}).fill('Woodland ranger with bow and travelling cloak');await page.getByRole('button',{name:'Next · Appearance',exact:true}).click();
 await page.getByRole('button',{name:'Generate concept image',exact:true}).click();await page.waitForSelector('.creative-concept');
 await page.getByRole('button',{name:'Select',exact:true}).click();await page.getByRole('button',{name:'Approve this concept',exact:true}).click();await page.getByRole('button',{name:'Next · 3D model',exact:true}).click();
 await page.getByRole('button',{name:'Generate 3D with Meshy',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.type==='model').length),1);await page.getByText('Needs print review',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Next · Character sheet',exact:true}).click();await page.getByLabel('Species / ancestry',{exact:true}).fill('Elf');await page.getByLabel('Class',{exact:true}).fill('Ranger');await page.getByRole('button',{name:'Save character',exact:true}).click();await page.getByRole('button',{name:'Add character to campaign',exact:true}).click();
 const added=await page.evaluate(()=>window.added);assert.equal(added.name,'Mira the ranger');assert.equal(added.sheet.species,'Elf');assert.equal(added.sheet.class,'Ranger');
 await page.getByRole('button',{name:'Compact character card',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.at(-1).format),'card');
 await page.getByRole('button',{name:'AI and voice settings',exact:true}).click();assert.equal(await page.evaluate(()=>window.settingsCalls),1);
 assert.equal(await page.evaluate(()=>window.voice===document.getElementById('voice')&&window.voice.session.active),true);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/creative-studio-character.png'});
 const size=await page.locator('.creative-studio').evaluate(node=>({scroll:node.scrollWidth,width:node.clientWidth}));assert.equal(size.scroll,size.width);
 await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.evaluate(()=>document.getElementById('companion').nextElementSibling.id),'after');
 await page.evaluate(()=>window.studio.browse('scenery'));await page.getByRole('button',{name:'New scenery piece',exact:true}).click();await page.getByLabel('Design name',{exact:true}).fill('Mossy wall');await page.getByLabel('Scenery pack name',{exact:true}).fill('My grotto');await page.getByRole('button',{name:'Start design',exact:true}).click();await page.getByRole('tab',{name:'4 · Pack',exact:true}).click();await page.getByLabel('Pack name',{exact:true}).fill('My grotto');await page.getByRole('button',{name:'Save piece to pack',exact:true}).click();assert.equal(await page.evaluate(()=>window.studio.context().step),'pack');
 await page.getByRole('button',{name:'Close',exact:true}).click();assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',sharedConversationPreserved:true,approvedConceptSubmitted:true,characterSheetSaved:true,screenshot:'test-results/creative-studio-character.png'}));
} finally {await browser.close();await server.close();}
