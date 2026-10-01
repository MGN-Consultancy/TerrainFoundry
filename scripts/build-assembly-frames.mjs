import {build} from 'vite';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium} from 'playwright';
const source=await fs.readFile('scripts/assembly-render-source.js','utf8');
await fs.writeFile('work/assembly-capture.js',source.replace("story.classList.add('scene-ready');","window.captureAssembly=p=>{render(p);return renderer.domElement.toDataURL('image/webp',.86);};story.classList.add('scene-ready');"));
await build({configFile:false,publicDir:false,build:{outDir:'work',emptyOutDir:false,lib:{entry:'work/assembly-capture.js',formats:['es'],fileName:()=> 'capture-bundle.js'},minify:true}});
const html='<style>.assembly-stage{width:720px;height:580px}.assembly-story{height:1000px}.assembly-pin{height:800px}</style><div class="assembly-story"><div class="assembly-pin"><div class="landing-copy"></div><div class="assembly-stage"></div><p id="assembly-caption"></p><button id="skip-assembly"></button></div></div><script type="module" src="/capture.js"></script>';
const server=http.createServer(async(q,r)=>{try{const name=q.url.split('/').pop();const f=q.url==='/'?null:name==='capture.js'?'work/capture-bundle.js':'site/assets/'+name;r.setHeader('Content-Type',f?(name.endsWith('.js')?'text/javascript':'application/octet-stream'):'text/html');r.end(f?await fs.readFile(f):html);}catch{r.writeHead(404).end();}}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.captureAssembly);await fs.mkdir('site/assets/assembly-frames',{recursive:true});for(let i=0;i<49;i++){const data=await page.evaluate(p=>window.captureAssembly(p),i/48);await fs.writeFile(`site/assets/assembly-frames/${String(i).padStart(2,'0')}.webp`,Buffer.from(data.split(',')[1],'base64'));}console.log('49 real scenery frames exported');}finally{await browser.close();server.close();}
