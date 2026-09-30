// Loopback-only demo. No Azure upload, email, PayPal payment or printer command.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MemoryStore,FakePayPal,env,rates} from './test/helpers.mjs';
import {makeService} from './src/service.mjs';
const port=Number(process.env.PORT||4175),origin='http://127.0.0.1:'+port;
const store=new MemoryStore(),service=makeService({store,paypal:new FakePayPal(),env:{...env,PRINT_SITE_ORIGIN:origin},rates,verifyHuman:async()=>{}});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(url.pathname==='/print-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.TERRAIN_PRINT_API='+JSON.stringify(origin)+';');}
  if(url.pathname.startsWith('/api/print/')){
   const [,action,id]=url.pathname.split('/api/print/').join('/').split('/');let result;
   if(action==='config')result={...service.config(),demo:true};
   else if(action==='quotes'&&req.method==='POST'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>41*1024*1024)throw Error('File too large');chunks.push(chunk);}
    const request=new Request(origin+req.url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)});const form=await request.formData();
    result=await service.create(Buffer.from(await form.get('pack').arrayBuffer()),JSON.parse(form.get('details')),'demo');result.demo=true;
   }else if(action==='quote')result={...await service.get(id,req.headers.authorization?.replace(/^Bearer /,'')),demo:true};
   else throw Error('Payments are disabled in the local demo.');
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(result));
  }
  const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(error){res.statusCode=error.status||400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message}));}
}).listen(port,'127.0.0.1',()=>console.log('Local demonstration: '+origin+'/#print-service — no real orders or emails'));
