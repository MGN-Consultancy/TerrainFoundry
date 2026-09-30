import {timingSafeEqual} from 'node:crypto';
import {InputError} from './geometry.mjs';
import {settled} from './paypal.mjs';

export const paymentTestPath=id=>'payment-tests/'+id+'.json';
export function paymentTests({store,paypal,env=process.env,now=()=>Date.now()}){
 const available=()=>env.PRINT_PAYMENT_TEST_ENABLED==='true'&&env.PAYPAL_ENV==='live'&&env.PRINT_PAYMENT_TEST_CODE?.length>=16&&Number.isFinite(Date.parse(env.PRINT_PAYMENT_TEST_EXPIRES))&&now()<Date.parse(env.PRINT_PAYMENT_TEST_EXPIRES)&&['PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_MERCHANT_ID','PAYPAL_TEST_WEBHOOK_ID','PRINT_OPERATOR_EMAIL'].every(k=>!!env[k]);
 const publicResult=q=>({paymentTest:true,status:q.status,amountPence:10,noProduction:true});
 function ready(){if(!available())throw new InputError('Live payment testing is not configured or has expired.',503);}
 async function start(quote,code,returnUrl){
  ready();const expected=Buffer.from(env.PRINT_PAYMENT_TEST_CODE),given=Buffer.from(typeof code==='string'?code:'');
  await store.budget('payment-test-attempts-'+Math.floor(now()/3600000),20);
  if(expected.length!==given.length||!timingSafeEqual(expected,given)||quote.customer.email.toLowerCase()!==env.PRINT_OPERATOR_EMAIL.toLowerCase())throw new InputError('This test code is unavailable for this quotation.',403);
  const path=paymentTestPath(quote.id);
  // Separate record and invoice: a 10p payment can never settle the print quote.
  if(!await store.get(path))try{await store.put(path,{id:'test-'+quote.id,quoteId:quote.id,createdAt:now(),status:'quoted',price:{totalPence:10},paymentTest:true,sandbox:false,customer:{address:{}}},{conditions:{ifNoneMatch:'*'}});}catch(e){if(e.statusCode!==409&&e.statusCode!==412)throw e;}
  return store.lock(path,async(q,save)=>{
   if(q.status!=='quoted')return publicResult(q);
   if(!q.paypalOrderId){const order=await paypal.create(q,returnUrl),approval=order.links?.find(l=>['approve','payer-action'].includes(l.rel))?.href;
    const url=new URL(approval);if(url.protocol!=='https:'||url.hostname!=='www.paypal.com')throw Error('Invalid live checkout address.');
    q.paypalOrderId=order.id;q.approvalUrl=approval;await save(q);
   }return {...publicResult(q),url:q.approvalUrl};
  });
 }
 async function reconcile(id,capture=false){
  // Existing payments can still be reconciled after the invitation expires.
  if(env.PAYPAL_ENV!=='live')throw new InputError('Live payment testing is unavailable.',503);
  if(!await store.get(paymentTestPath(id)))throw new InputError('No test transaction exists for this quote.',404);
  return store.lock(paymentTestPath(id),async(q,save)=>{
   if(!q)throw new InputError('No test transaction exists for this quote.',404);
   if(q.status!=='quoted')return publicResult(q);
   let order=await paypal.get(q.paypalOrderId);
   if(capture&&order.status==='APPROVED'&&available()){await paypal.capture(q.paypalOrderId,q.id);order=await paypal.get(q.paypalOrderId);}
   if(settled(order,q,env.PAYPAL_MERCHANT_ID)){q.status='paid';q.paidAt=now();q.captureId=order.purchase_units[0].payments.captures[0].id;await save(q);}
   return publicResult(q);
  });
 }
 async function webhook(headers,event){
  if(!await paypal.verifiedEvent(headers,event))throw new InputError('Invalid payment notification.',400);
  const orderId=event.resource?.supplementary_data?.related_ids?.order_id||(['CHECKOUT.ORDER.APPROVED','CHECKOUT.ORDER.COMPLETED'].includes(event.event_type)?event.resource?.id:null);
  if(!orderId)return {received:true};const order=await paypal.get(orderId),custom=order.purchase_units?.[0]?.custom_id;
  if(!/^test-[a-f0-9]{32}$/.test(custom||''))return {received:true};const id=custom.slice(5),q=await store.get(paymentTestPath(id));
  if(!q||q.paypalOrderId!==orderId)return {received:true};
  if(['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED'].includes(event.event_type))await store.lock(paymentTestPath(id),async(q,save)=>{q.status='payment-review';await save(q);});
  else if(['CHECKOUT.ORDER.APPROVED','CHECKOUT.ORDER.COMPLETED','PAYMENT.CAPTURE.COMPLETED'].includes(event.event_type))await reconcile(id,event.event_type==='CHECKOUT.ORDER.APPROVED');
  return {received:true};
 }
 return {available,start,reconcile,webhook};
}
