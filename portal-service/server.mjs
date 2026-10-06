import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createPortal} from './core.mjs';
import {FileStore,BlobStore} from './store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plainHeaders={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const cookie=(value,secure)=>'tf_portal='+value+'; Path=/api/portal; HttpOnly; SameSite=Strict; Max-Age='+(value?604800:0)+(secure?'; Secure':'');
export function portalServer({portal,origin,secureCookies=true}){
 return http.createServer(async(req,res)=>{
  const url=new URL(req.url,origin),send=(status,data,extra={})=>{res.writeHead(status,{...plainHeaders,...extra});res.end(JSON.stringify(data));};
  try{
   if(!url.pathname.startsWith('/api/portal/')){
    const files={'/':'campaign-portal.html','/campaign-portal.html':'campaign-portal.html','/campaign-portal.js':'campaign-portal.js','/campaign-portal.css':'campaign-portal.css','/style.css':'style.css','/refresh.css':'refresh.css','/navigation.js':'navigation.js','/assets/terrain-foundry-mark.svg':'assets/terrain-foundry-mark.svg'};
    const file=files[url.pathname];if(!file){send(404,{error:'Not found'});return;}const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(await fs.readFile(path.join(root,'site',file)));return;
   }
   if(req.method==='GET'&&url.pathname==='/api/portal/config'){send(200,{enabled:true,passwordless:true,privateSnapshots:true});return;}
   if(req.method==='POST'&&req.headers.origin!==origin){send(403,{error:'Unapproved request origin'});return;}
   const sessionToken=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('tf_portal='))?.slice(10),csrf=req.headers['x-portal-csrf'];
   let body={};if(req.method==='POST'){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>16000000)throw Object.assign(Error('Request exceeds 16 MB'),{status:413});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}}
   const route=url.pathname.slice('/api/portal/'.length).split('/');let result;
   if(req.method==='POST'&&route[0]==='login-link')result=await portal.loginLink(body.email,req.socket.remoteAddress||'unknown');
   else if(req.method==='POST'&&route[0]==='login'){const login=await portal.login(body.token);send(200,{user:login.user,csrf:login.csrf},{'Set-Cookie':cookie(login.sessionToken,secureCookies)});return;}
   else if(req.method==='GET'&&route[0]==='me')result=await portal.me(sessionToken);
   else if(req.method==='POST'&&route[0]==='logout'){result=await portal.logout(sessionToken,csrf);send(200,result,{'Set-Cookie':cookie('',secureCookies)});return;}
   else if(route[0]==='campaigns'&&route.length===1){if(req.method==='GET')result=await portal.list(sessionToken);else if(req.method==='POST')result=await portal.publish(sessionToken,csrf,body.handout,body.expectedRevision);}
   else if(route[0]==='campaigns'&&route[1]){if(req.method==='GET'&&route.length===2)result=await portal.get(sessionToken,route[1]);else if(req.method==='POST'&&route[2]==='invitations')result=await portal.invite(sessionToken,csrf,route[1],body.email);else if(req.method==='POST'&&route[2]==='revoke')result=await portal.revoke(sessionToken,csrf,route[1],body.memberId);else if(req.method==='POST'&&route[2]==='notes')result=await portal.saveNote(sessionToken,csrf,route[1],body);}
   else if(req.method==='POST'&&route[0]==='accept')result=await portal.accept(sessionToken,csrf,body.token);
   if(result===undefined){send(404,{error:'Not found'});return;}send(200,result);
  }catch(e){send(e.status||500,{error:e.status?e.message:'Portal could not complete this request. Try again or contact support.'});}
 });
}
async function start(){
 const dev=process.env.PORTAL_LOCAL_DEV==='1',port=Number(process.env.PORT||5190),origin=process.env.PORTAL_ORIGIN||(dev?'http://127.0.0.1:'+port:'');if(!origin)throw Error('Set PORTAL_ORIGIN to the hosted HTTPS origin');
 if(!dev&&(!origin.startsWith('https://')||!process.env.PORTAL_STORAGE_CONNECTION_STRING||!process.env.PORTAL_EMAIL_CONNECTION_STRING||!process.env.PORTAL_EMAIL_SENDER))throw Error('Production portal needs HTTPS origin, private storage and verified email sender configuration');
 if(dev&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Development mail mode is allowed only on loopback');
 let store,sendMail;
 if(dev){store=new FileStore(path.join(root,'work','portal-dev','state.json'));sendMail=async m=>{await fs.mkdir(path.join(root,'work','portal-dev'),{recursive:true});await fs.appendFile(path.join(root,'work','portal-dev','mail.jsonl'),JSON.stringify(m)+'\n',{mode:0o600});};}
 else{const require=createRequire(path.join(root,'print-service','package.json'));const {BlobServiceClient}=require('@azure/storage-blob'),{EmailClient}=require('@azure/communication-email');store=new BlobStore(BlobServiceClient.fromConnectionString(process.env.PORTAL_STORAGE_CONNECTION_STRING));await store.init();const email=new EmailClient(process.env.PORTAL_EMAIL_CONNECTION_STRING);sendMail=async m=>{const poller=await email.beginSend({senderAddress:process.env.PORTAL_EMAIL_SENDER,content:{subject:m.subject,plainText:m.text},recipients:{to:[{address:m.to}]}});const result=await poller.pollUntilDone();if(result.status!=='Succeeded')throw Error('Email service did not accept the message');};}
 const server=portalServer({portal:createPortal({store,sendMail,origin}),origin,secureCookies:!dev});server.listen(port,dev?'127.0.0.1':'0.0.0.0',()=>console.log('Campaign portal listening on '+origin+(dev?' (local development; email is saved privately in work/portal-dev/mail.jsonl)':'')));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))start().catch(e=>{console.error(e.message);process.exitCode=1;});
