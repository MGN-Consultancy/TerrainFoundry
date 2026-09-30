import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {zipSync} from 'fflate';
import {InputError,readPack,inspectPack,LIMITS} from './geometry.mjs';
import {validateRates,validateDiscounts,customerDetails,price} from './pricing.mjs';
import {settled} from './paypal.mjs';
import {estimateItems} from './estimate.mjs';

export const quotePath=id=>'quotes/'+id+'.json';
export function makeService({store,paypal,env=process.env,rates,discounts=[],now=()=>Date.now(),verifyHuman}) {
 const ttl=7*86400000;
 // This edition includes CC BY-NC OpenLOCK assets. Enabling payments requires
 // separately documented commercial permissions covering every relevant right.
 const configured=()=>env.PRINT_PREVIEW_ENABLED!=='true'&&env.PRINT_COMMERCIAL_RIGHTS_APPROVED==='true'&&env.PRINT_SERVICE_ENABLED==='true'&&env.PRINT_RATES_APPROVED==='true'&&env.PRINT_TOKEN_SECRET?.length>=32&&env.PRINT_TERMS_APPROVED==='true'&&['PAYPAL_MERCHANT_ID','PAYPAL_WEBHOOK_ID','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PRINT_SITE_ORIGIN','ACS_EMAIL_CONNECTION_STRING','PRINT_EMAIL_SENDER','PRINT_OPERATOR_EMAIL','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY'].every(k=>!!env[k]);
 const previewConfigured=()=>env.PRINT_PREVIEW_ENABLED==='true'&&env.PRINT_PREVIEW_ACCESS_CODE?.length>=16&&env.PRINT_TOKEN_SECRET?.length>=32&&['PRINT_SITE_ORIGIN','ACS_EMAIL_CONNECTION_STRING','PRINT_EMAIL_SENDER','PRINT_OPERATOR_EMAIL'].every(k=>!!env[k]);
 const token=id=>createHmac('sha256',env.PRINT_TOKEN_SECRET).update('quote:'+id).digest('hex');
 function authorize(id,secret){if(!/^[a-f0-9]{32}$/.test(id)||!secret||!/^[a-f0-9]{64}$/.test(secret)||!timingSafeEqual(Buffer.from(token(id)),Buffer.from(secret)))throw new InputError('This quote link is invalid.',404);}
 function ready(allowPreview=false){if(!configured()&&!(allowPreview&&previewConfigured()))throw new InputError('Print orders are not open. Payments and production are disabled. This service is available for invited test quotes only.',503);validateRates(rates);validateDiscounts(discounts);}
 const quoteUrl=id=>env.PRINT_SITE_ORIGIN+'/print-order.html#'+id+'.'+token(id);
 const publicQuote=q=>({id:q.id,createdAt:q.createdAt,expiresAt:q.expiresAt,status:q.status,colour:q.colour,items:q.items,price:q.price,emailStatus:q.email.quote?.sentAt?'sent':'pending',preview:!!q.preview,sandbox:env.PAYPAL_ENV!=='live'});
 async function get(id,secret){authorize(id,secret);const q=await store.get(quotePath(id));if(!q)throw new InputError('This quote is no longer available.',404);return publicQuote(q);}
 async function create(buffer,details,humanToken){ready(true);const preview=!!previewConfigured();
  if(preview){const supplied=String(details.testAccessCode||'');const expected=env.PRINT_PREVIEW_ACCESS_CODE;const a=Buffer.from(supplied),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw new InputError('Enter the private test access code.',403);}
  else await verifyHuman(humanToken);
  const customer=customerDetails(details,rates);
  const hour=Math.floor(now()/3600000),emailKey=createHmac('sha256',env.PRINT_TOKEN_SECRET).update(customer.email.toLowerCase()).digest('hex');
  await store.budget('global-'+hour,30);await store.budget(emailKey+'-'+hour,3);
  const buildVolume=rates.printers?.find(p=>p.id===customer.printer)?.buildVolumeMm||rates.buildVolumeMm;
  const files=await readPack(buffer),items=inspectPack(files,buildVolume),cost=price(items,customer,rates,{code:details.discountCode??'',discounts,now:now()});
  const id=randomBytes(16).toString('hex'),createdAt=now();const q={id,createdAt,expiresAt:createdAt+ttl,status:'quoted',preview,sandbox:env.PAYPAL_ENV!=='live',customer,colour:rates.colours.find(c=>c.id===customer.colour),items,price:cost,email:{quote:{pending:true}},rateSnapshot:rates};
  // Rebuild the archive from the validated manufacturing files only. Editable scenes stay private.
  const clean={};for(const {name,bytes} of files.values())clean[name]=bytes;
  await store.put('packs/'+id+'.zip',Buffer.from(zipSync(clean,{level:1})));
  try{await store.put(quotePath(id),q,{conditions:{ifNoneMatch:'*'}});}catch(error){await store.remove('packs/'+id+'.zip');throw error;}
  return {...publicQuote(q),url:quoteUrl(id)};
 }
 async function checkout(id,secret){ready();authorize(id,secret);return store.lock(quotePath(id),async(q,save)=>{
  if(q?.preview)throw new InputError('Test requests can never be paid or sent to production.',409);
  if(!q)throw new InputError('Quote not found.',404);if(q.status==='paid')return {paid:true};if(q.status!=='quoted'||q.expiresAt<now())throw new InputError('This quote has expired or is unavailable. Please request another.',409);
  if(!q.paypalOrderId){const order=await paypal.create(q,quoteUrl(id));const approval=order.links?.find(l=>['approve','payer-action'].includes(l.rel))?.href;
   const url=new URL(approval);const expected=env.PAYPAL_ENV==='live'?'www.paypal.com':'www.sandbox.paypal.com';if(url.protocol!=='https:'||url.hostname!==expected)throw Error('Payment provider returned an invalid checkout link.');
   q.paypalOrderId=order.id;q.approvalUrl=approval;await save(q);
  }return {url:q.approvalUrl};
 });}
 async function confirm(id,secret){ready();authorize(id,secret);return reconcile(id,true);}
 async function reconcile(id,capture=false){return store.lock(quotePath(id),async(q,save)=>{
  if(q?.preview)throw new InputError('Test requests can never be paid or sent to production.',409);
  if(!q?.paypalOrderId)throw new InputError('No payment is associated with this quote.',409);if(q.status==='paid')return publicQuote(q);if(q.status!=='quoted')throw new InputError('This payment needs our review.',409);
  let order=await paypal.get(q.paypalOrderId);
  if(capture&&order.status==='APPROVED'&&q.expiresAt>=now()){await paypal.capture(q.paypalOrderId,q.id);order=await paypal.get(q.paypalOrderId);}
  if(!settled(order,q,env.PAYPAL_MERCHANT_ID))return {...publicQuote(q),paymentPending:true};
  q.status='paid';q.paidAt=now();q.captureId=order.purchase_units[0].payments.captures[0].id;q.email.paid={pending:true};q.email.workshop={pending:true};await save(q);return publicQuote(q);
 });}
 async function webhook(headers,event){ready();if(!await paypal.verifiedEvent(headers,event))throw new InputError('Invalid payment notification.',400);
  const orderId=event.resource?.supplementary_data?.related_ids?.order_id||(['CHECKOUT.ORDER.APPROVED','CHECKOUT.ORDER.COMPLETED'].includes(event.event_type)?event.resource?.id:null);
  if(!orderId)return {received:true};const order=await paypal.get(orderId),id=order.purchase_units?.[0]?.custom_id;
  if(!/^[a-f0-9]{32}$/.test(id||''))return {received:true};const q=await store.get(quotePath(id));if(!q||q.paypalOrderId!==orderId)return {received:true};
  if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED'].includes(event.event_type))await store.lock(quotePath(id),async(current,save)=>{current.status='payment-review';current.email.review={pending:true};await save(current);});
  else if(['CHECKOUT.ORDER.APPROVED','CHECKOUT.ORDER.COMPLETED','PAYMENT.CAPTURE.COMPLETED'].includes(event.event_type))await reconcile(id,event.event_type==='CHECKOUT.ORDER.APPROVED');
  return {received:true};
 }
 async function requestTestOrder(id,secret){ready(true);authorize(id,secret);return store.lock(quotePath(id),async(q,save)=>{
  if(!q?.preview)throw new InputError('This is not a test quote.',409);
  if(q.status==='test-requested')return publicQuote(q);
  if(q.status!=='quoted'||q.expiresAt<now())throw new InputError('This test quote has expired.',409);
  q.status='test-requested';q.requestedAt=now();q.email.testCustomer={pending:true};q.email.testOperator={pending:true};await save(q);return publicQuote(q);
 });}
 function config(){let enabled=false;try{enabled=!!(configured()||previewConfigured());if(enabled){validateRates(rates);validateDiscounts(discounts);}}catch{enabled=false;}return {enabled,preview:!!previewConfigured(),sandbox:env.PAYPAL_ENV!=='live',colours:enabled?rates.colours:[],materials:enabled?rates.materials?.map(({id,label})=>({id,label}))||[]:[],printers:enabled?rates.printers?.map(({id,label})=>({id,label}))||[]:[],countries:enabled?Object.keys(rates.shipping):[],maxUploadBytes:LIMITS.upload,turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',contact:'nigel.webster@mgnconsultancy.co.uk',pricingBasis:rates?.basis||'enclosed-model-volume'};}
 async function estimate(input){
  ready(true);
  if(!input||typeof input!=='object')throw new InputError('Invalid estimate.');
  const selection=input.selection||{},printer=rates.printers?.find(p=>p.id===selection.printer);
  if(!rates.colours.some(c=>c.id===selection.colour))throw new InputError('Choose an available colour.');
  const items=estimateItems(input.items,printer?.buildVolumeMm||rates.buildVolumeMm);
  const result=price(items,{material:selection.material,printer:selection.printer,address:{country:selection.country}},rates,{code:selection.discountCode||'',discounts,now:now()});
  await store.budget('estimates-'+Math.floor(now()/3600000),300);
  return {price:result,preview:!!previewConfigured(),estimatedAt:now(),notice:'Advisory estimate only. The website rechecks uploaded models and current prices before any request. No models or scene layout were uploaded.'};
 }
 return {create,get,checkout,confirm,reconcile,webhook,requestTestOrder,estimate,config,quoteUrl};
}
