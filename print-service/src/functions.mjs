import {app} from '@azure/functions';
import {Store} from './storage.mjs';
import {PayPal} from './paypal.mjs';
import {makeService} from './service.mjs';
import {InputError,LIMITS} from './geometry.mjs';
import {processNotifications,cleanup} from './notifications.mjs';

const env=process.env;let runtime;
function dependencies(){
 if(runtime)return runtime;
 const store=new Store(env.PRINT_STORAGE_CONNECTION_STRING||env.AzureWebJobsStorage);
 const paypal=new PayPal(env);let rates;try{rates=JSON.parse(env.PRINT_RATES_JSON||'null');}catch{rates=null;}
 const verifyHuman=async token=>{
  if(!env.TURNSTILE_SECRET_KEY||!token)throw new InputError('Please complete the anti-spam check.');
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!result.success||result.hostname!==new URL(env.PRINT_SITE_ORIGIN).hostname||result.action!=='print-quote')throw new InputError('The anti-spam check expired. Please try again.');
 };
 runtime={store,service:makeService({store,paypal,env,rates,verifyHuman})};return runtime;
}
const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
export async function handler(request,context){
 const path=request.params.action||'config',id=request.params.id;
 try{
  if(path==='config'&&!env.PRINT_STORAGE_CONNECTION_STRING&&!env.AzureWebJobsStorage)return {jsonBody:{enabled:false,contact:'nigel.webster@mgnconsultancy.co.uk'},headers};
  const {store,service}=dependencies();let result;
  if(request.method==='GET'&&path==='config')return {jsonBody:service.config(),headers};
  // Non-browser webhook uses PayPal's signature verification. All browser writes require the site origin.
  const origins=(env.PRINT_ALLOWED_ORIGINS||env.PRINT_SITE_ORIGIN||'').split(',');
  if(request.method==='POST'&&path!=='webhook'&&!origins.includes(request.headers.get('origin')))throw new InputError('Unapproved request origin.',403);
  await store.init();
  const secret=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(request.method==='POST'&&path==='quotes'){
   const length=Number(request.headers.get('content-length'));if(!length||length>LIMITS.upload+100000)throw new InputError('Upload is missing or larger than 40 MB.',413);
   const form=await request.formData(),file=form.get('pack');if(!file||typeof file.arrayBuffer!=='function'||file.size>LIMITS.upload)throw new InputError('Choose a ZIP print pack under 40 MB.');
   const details=form.get('details');if(typeof details!=='string'||details.length>5000)throw new InputError('Invalid form details.');
   let parsed;try{parsed=JSON.parse(details);}catch{throw new InputError('Invalid form details.');}
   result=await service.create(Buffer.from(await file.arrayBuffer()),parsed,form.get('cf-turnstile-response'));
  }else if(request.method==='GET'&&path==='quote')result=await service.get(id,secret);
  else if(request.method==='POST'&&path==='checkout')result=await service.checkout(id,secret);
  else if(request.method==='POST'&&path==='confirm')result=await service.confirm(id,secret);
  else if(request.method==='POST'&&path==='webhook'){
   if(Number(request.headers.get('content-length'))>100000)throw new InputError('Notification too large.',413);
   result=await service.webhook(request.headers,await request.json());
  }else throw new InputError('Not found.',404);
  return {jsonBody:result,headers};
 }catch(error){if(!(error instanceof InputError)&&!error.status)context.error('Print service request failed.');return {status:error.status||503,jsonBody:{error:error.status?error.message:'The print service is temporarily unavailable. Please try again shortly.'},headers};}
}
app.http('print-service',{route:'print/{action?}/{id?}',methods:['GET','POST'],authLevel:'anonymous',handler});
app.timer('print-email-outbox',{schedule:'0 */1 * * * *',handler:async()=>{if(env.PRINT_SERVICE_ENABLED!=='true')return;const deps=dependencies();await deps.store.init();await processNotifications(deps);}});
app.timer('print-cleanup',{schedule:'0 15 3 * * *',handler:async()=>{const {store}=dependencies();await cleanup(store);}});
