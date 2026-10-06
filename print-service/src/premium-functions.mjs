import {app} from '@azure/functions';
import {BlobServiceClient,generateBlobSASQueryParameters,BlobSASPermissions,SASProtocol} from '@azure/storage-blob';
import {EmailClient} from '@azure/communication-email';
import {Store} from './storage.mjs';
import {PayPal} from './paypal.mjs';
import {premiumDelivery} from './premium-delivery.mjs';
const env=process.env,headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};let runtime;
function dependencies(){
 if(runtime)return runtime;
 const store=new Store(env.PREMIUM_STORAGE_CONNECTION_STRING,'premium-state'),client=new EmailClient(env.ACS_EMAIL_CONNECTION_STRING),paypal=new PayPal({...env,PAYPAL_WEBHOOK_ID:env.PREMIUM_PAYPAL_WEBHOOK_ID});
 const credential={async getToken(scope){if(!env.IDENTITY_ENDPOINT||!env.IDENTITY_HEADER)throw Error('Managed identity unavailable');const url=new URL(env.IDENTITY_ENDPOINT);url.searchParams.set('api-version','2019-08-01');url.searchParams.set('resource',String(scope).replace(/\/.default$/,''));const response=await fetch(url,{headers:{'X-IDENTITY-HEADER':env.IDENTITY_HEADER},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Managed identity failed');const t=await response.json();return {token:t.access_token,expiresOnTimestamp:Number(t.expires_on)*1000};}};
 const service=new BlobServiceClient('https://'+env.PREMIUM_STORAGE_ACCOUNT+'.blob.core.windows.net',credential);
 async function downloadLink(blobName){if(typeof blobName!=='string'||!/^packs\/tf-[a-z0-9-]+\/\d+\.\d+\.\d+\/[a-f0-9]{64}\.tfc$/.test(blobName))throw Error('Invalid pack path');const startsOn=new Date(Date.now()-300000),expiresOn=new Date(Date.now()+600000),delegation=await service.getUserDelegationKey(startsOn,expiresOn);const sas=generateBlobSASQueryParameters({containerName:'premium-packs',blobName,permissions:BlobSASPermissions.parse('r'),startsOn,expiresOn,protocol:SASProtocol.Https},delegation,env.PREMIUM_STORAGE_ACCOUNT);return service.getContainerClient('premium-packs').getBlobClient(blobName).url+'?'+sas;}
 async function sendMail(mail,state,persist){const poller=await client.beginSend({senderAddress:env.PRINT_EMAIL_SENDER,replyTo:[{address:'nigel.webster@mgnconsultancy.co.uk'}],recipients:{to:[{address:mail.to}]},content:{subject:mail.subject,plainText:mail.text}},{...(state?.operation?{resumeFrom:state.operation}:{}),updateIntervalInMs:1000});if(state){state.operation=poller.toString();await persist();}const result=await poller.pollUntilDone({abortSignal:AbortSignal.timeout(30000)});if(result.status!=='Succeeded'){if(state)delete state.operation;throw Error('Email not accepted');}return result;}
 runtime={store,service:premiumDelivery({store,paypal,sendMail,downloadLink,env})};return runtime;
}
export async function premiumHandler(request,context,overrides){try{
 const action=request.params.action||'config';if(action==='config'&&request.method==='GET'&&!env.PREMIUM_STORAGE_CONNECTION_STRING)return {headers,jsonBody:{enabled:false,products:[]}};
 const {store,service}=overrides||dependencies();await store.init();
 if(request.method==='GET'&&action==='config')return {headers,jsonBody:service.config()};
 if(request.method!=='POST')throw Object.assign(Error('Not found'),{status:404});
 const origin=request.headers.get('origin');if(origin&&origin!==env.PREMIUM_SITE_ORIGIN)throw Object.assign(Error('Unapproved origin'),{status:403});
 const length=Number(request.headers.get('content-length'));if(!length||length>30000)throw Object.assign(Error('Invalid request size'),{status:413});
 const args=await request.json(),t=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';let result;
 const peer=(request.headers.get('x-forwarded-for')||'unknown').split(',').at(-1).trim();if(['login-start','login-verify'].includes(action)){const {createHash}=await import('node:crypto');await store.budget('auth-peer-'+createHash('sha256').update(peer).digest('hex')+'-'+Math.floor(Date.now()/3600000),60);}
 if(action==='login-start')result=await service.loginStart(args,peer);
 else if(action==='login-verify')result=await service.loginVerify(args);
 else if(action==='checkout')result=await service.checkout(t,args);
 else if(action==='confirm')result=await service.confirm(t,args);
 else if(action==='webhook')result=await service.webhook(request.headers,args);
 else if(action==='challenge')result=await service.challenge(t,args);
 else if(action==='activate')result=await service.activate(t,args);
 else if(action==='download-challenge')result=await service.downloadChallenge(t,args);
 else if(action==='download')result=await service.download(t,args);
 else if(action==='resend')result=await service.resend(t,args);
 else if(action==='support-reset')result=await service.supportReset(t,args);
 else throw Object.assign(Error('Not found'),{status:404});
 return {headers,jsonBody:result};
 }catch(e){if(!e.status)context.error('Premium service request failed');return {headers,status:e.status||503,jsonBody:{error:e.status?e.message:'Premium delivery is temporarily unavailable'}};}}
app.http('premium-service',{route:'premium/{action?}',methods:['GET','POST'],authLevel:'anonymous',handler:premiumHandler});
app.timer('premium-email-outbox',{schedule:'0 */1 * * * *',handler:async()=>{if(!env.PREMIUM_STORAGE_CONNECTION_STRING)return;const {store,service}=overrides||dependencies();await store.init();await service.outbox();}});

export async function cleanupPremiumAuth(store,now=Date.now()){for(const prefix of ['login/','sessions/','downloads/','premium/challenges/','limits/'])for await(const path of store.list(prefix)){const v=await store.get(path);if(v&&(((v.expires||v.expiresAt)&&(v.expires||v.expiresAt)<now-86400000)||(prefix==='limits/'&&v.createdAt<now-2*86400000)))await store.remove(path);}}
app.timer('premium-auth-cleanup',{schedule:'0 30 3 * * *',handler:async()=>{if(!env.PREMIUM_STORAGE_CONNECTION_STRING)return;const {store}=dependencies();await store.init();await cleanupPremiumAuth(store);}});
