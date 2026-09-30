// Run after generating scenery packs. Only original/attributed registered models are rendered.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {KIT} from '../src/model.js';
import {stlFile} from '../src/print-pack.js';
import {clipFiles} from '../src/print-clip.js';
const require=createRequire(import.meta.url),{createSceneryReader}=require('../desktop/scenery-store.cjs');
const root=path.resolve(import.meta.dirname,'..'),read=createSceneryReader(root);
const folder=path.join(root,'site/assets/terrain');await fs.mkdir(folder,{recursive:true});
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const shapeMiddleware=(req,res,next)=>{
 if(!req.url.startsWith('/__quote-shape/'))return next();
 try{const id=req.url.slice('/__quote-shape/'.length),shape=read({'fit-floor':'floor','fit-wall':'wall-low'}[id]||id,true);res.setHeader('Content-Type','application/octet-stream');res.setHeader('X-Vertices',shape.vertices);res.setHeader('X-Indices',shape.indices);res.end(shape.bytes);}catch{res.statusCode=404;res.end();}
};
const server=await createServer({root,configFile:false,plugins:[{name:'quote-shapes',configureServer(server){server.middlewares.use(shapeMiddleware);}}],server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({...(!process.env.CI?{channel:'msedge'}:{}),headless:true});
const entries=[...KIT,{id:'fit-floor',name:'Floor connector fit test',category:'Fit tests',hint:'Print one before your scene'},{id:'fit-wall',name:'Wall connector fit test',category:'Fit tests',hint:'Print one before your scene'},{id:'openlock-clip',name:'OpenLOCK clip 5.4',category:'Connectors',hint:'Printable Scenery · CC BY-NC 4.0'}];
const catalog={schema:1,release:version,assets:{}};let bytes=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));page.on('requestfailed',r=>console.error('Render resource failed: '+r.url()));await page.goto(server.resolvedUrls.local[0]+'scripts/quote-preview-renderer.html',{waitUntil:'commit'});await page.waitForFunction(()=>!!window.renderQuotePreview,{},{timeout:120000});
 for(const item of entries){
  const hashes=[];let input;
  if(item.id==='openlock-clip'){const clip=clipFiles().files[0].data;input={id:item.id,clip:Array.from(clip)};hashes.push(createHash('sha256').update(clip).digest('hex'));}
  else{
   input={id:item.id};
   for(const connectors of ['openlock'])hashes.push(createHash('sha256').update(stlFile(item.id,{grid:25.4,assets:{},connectors}).file.data).digest('hex'));
  }
  const imagePath=path.join(folder,item.id+'.webp');let image;
  if(!image){const data=await page.evaluate(input=>window.renderQuotePreview(input),input);if(!data.startsWith('data:image/webp;'))throw Error('Expected WebP preview');image=Buffer.from(data.split(',')[1],'base64');await fs.writeFile(imagePath,image);}bytes+=image.length;
  catalog.assets[item.id]={name:item.name,category:item.category,hint:item.hint,sha256:[...new Set(hashes)]};
  if(Object.keys(catalog.assets).length%100===0)console.log('Rendered '+Object.keys(catalog.assets).length+' registered pieces');
 }
 await fs.writeFile(path.join(root,'site/terrain-catalog.json'),JSON.stringify(catalog));
 console.log(`Published catalogue: ${entries.length} previews, ${(bytes/1048576).toFixed(2)} MB total; only visible images load on a quote.`);
}finally{await browser.close();await server.close();}
