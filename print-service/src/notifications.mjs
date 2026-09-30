import {EmailClient} from '@azure/communication-email';
import {quotePath} from './service.mjs';

const money=p=>'£'+(p/100).toFixed(2);
export function emailFor(kind,q,{siteUrl,downloadUrl,operator}) {
 const summary=q.items.map(p=>`${p.quantity} × ${p.name}`).join('\n');
 const prefix=q.preview?'TEST ONLY — ':q.sandbox?'TEST ORDER — ':'';
 const reduction=q.price.discountPence?`Printing before discount: ${money(q.price.printBeforeDiscountPence)}\nParts discount (${q.price.discount.code}): -${money(q.price.discountPence)}\n`:'';
 const common=`Terrain Foundry reference: ${q.id}\nColour: ${q.colour.label}\n\n${summary}\n\n${reduction}Printing: ${money(q.price.printPence)}\nShipping: ${money(q.price.shippingPence)}\nVAT: ${money(q.price.vatPence)}\nTotal: ${money(q.price.totalPence)} GBP`;
 const address=q.customer.address;const delivery='Ship to:\n'+[address.name,address.line1,address.line2,address.city,address.region,address.postcode,address.country].filter(Boolean).join('\n');
 const estimate=q.price.estimate;const calculation=estimate?`\n\nEstimated material: ${estimate.material}, ${estimate.grams} g\nPrinter: ${estimate.printer}, approximately ${estimate.hours} hours\nFilament cost: ${money(estimate.filamentCostPence)}\nMachine time cost: ${money(estimate.machineCostPence)}\n${estimate.notice}${estimate.assumptions.vatConfirmed?'':' VAT treatment is unconfirmed in this test.'}`:'';
 if(q.preview){
  const submitted=kind!=='quote';
  return {to:kind==='testOperator'?operator:q.customer.email,subject:prefix+(submitted?'Test print request recorded':'Your Terrain Foundry test estimate'),text:`TEST ONLY — no payment, no production and no shipment. This is not an accepted commercial order.\n\n${common}${calculation}\n\n${submitted?'The test request has been recorded. Do not print or ship it.':'Review the estimate and optionally submit a test request:'}\n${siteUrl}\n\nQuestions and replies: ${operator}`};
 }
 if(kind==='quote')return {to:q.customer.email,subject:prefix+'Your Terrain Foundry print quote',text:`${common}\n\n${delivery}\n\nThis quote uses our enclosed-model-volume tariff, not a Bambu Studio estimate of filament or printing time. PLA, one colour, unpainted.\n\nReview your quote and pay securely with PayPal:\n${siteUrl}\n\nValid until ${new Date(q.expiresAt).toISOString()}. No payment has been taken.\n\nYour upload is held privately for this print request. Questions: ${operator}`};
 if(kind==='paid')return {to:q.customer.email,subject:prefix+'Payment received — Terrain Foundry',text:`${common}\n\n${delivery}\n\nPayment received. We will check the sliced pieces in Bambu Studio before printing. We will contact you if there is a printability issue.\n\nOrder status: ${siteUrl}\nQuestions: ${operator}`};
 if(kind==='review')return {to:operator,subject:prefix+'ACTION REQUIRED — payment change '+q.id,text:`Do not start or ship this order until the payment has been reviewed in PayPal.\n\n${common}`};
 const a=q.customer.address;
 return {to:operator,subject:prefix+'PAID — print and ship '+q.id,text:`${common}\n\nCustomer: ${q.customer.email}\nShip to:\n${[a.name,a.line1,a.line2,a.city,a.region,a.postcode,a.country].filter(Boolean).join('\n')}\n\nCapture: ${q.captureId}\n\nDownload the validated STL files and quantities.csv (private link, valid 24 hours):\n${downloadUrl}\n\nOpen the models in Bambu Studio, apply the quantities.csv copy counts (including connectors and fit-test pieces), choose the requested PLA colour, arrange, slice and inspect supports before printing. This is a paid work order, not a remote printer command. Check payment has not been refunded before dispatch.\n\nFiles remain in the private print-orders storage container under packs/${q.id}.zip.`};
}

export async function processNotifications({store,service,env=process.env,emailClient}) {
 if(!env.ACS_EMAIL_CONNECTION_STRING||!env.PRINT_EMAIL_SENDER||!service.config().enabled)return;
 const client=emailClient||new EmailClient(env.ACS_EMAIL_CONNECTION_STRING);
 for await(const path of store.list('quotes/')){
  const current=await store.get(path);if(!current||!Object.values(current.email).some(v=>v.pending))continue;
  await store.lock(quotePath(current.id),async(q,save)=>{
   for(const [kind,state] of Object.entries(q.email)){
    if(!state.pending||state.retryAfter>Date.now())continue;
     if((kind==='workshop'&&q.status!=='paid')||(q.preview&&['paid','workshop','review'].includes(kind))){state.pending=false;await save(q);continue;}
    try{
     const mail=emailFor(kind,q,{operator:env.PRINT_OPERATOR_EMAIL,siteUrl:service.quoteUrl(q.id),downloadUrl:kind==='workshop'?store.downloadLink('packs/'+q.id+'.zip'):''});
     // Persist the resumable provider operation, so retries poll the same email rather than resending it.
     const poller=await client.beginSend({senderAddress:env.PRINT_EMAIL_SENDER,replyTo:[{address:env.PRINT_OPERATOR_EMAIL,displayName:'Terrain Foundry'}],recipients:{to:[{address:mail.to}]},content:{subject:mail.subject,plainText:mail.text}},{...(state.operation?{resumeFrom:state.operation}:{}),updateIntervalInMs:1000});
     state.operation=poller.toString();await save(q);
     const result=await poller.pollUntilDone({abortSignal:AbortSignal.timeout(30000)});
     if(result.status!=='Succeeded'){delete state.operation;throw Error('Email delivery was not accepted.');}
     state.pending=false;state.sentAt=Date.now();state.providerId=result.id;delete state.operation;await save(q);
    }catch{state.attempts=(state.attempts||0)+1;state.retryAfter=Date.now()+Math.min(3600000,60000*2**Math.min(state.attempts,6));await save(q);}
   }
  });
 }
}

export async function cleanup(store,now=Date.now()) {
 for await(const path of store.list('quotes/')){const q=await store.get(path);if(!q)continue;
  const retention=q.preview||q.status==='quoted'?30:180;
  if(now-q.createdAt>retention*86400000){await store.remove('packs/'+q.id+'.zip');await store.remove(path);}
 }
 for await(const path of store.list('limits/')){const value=await store.get(path);if(value&&now-value.createdAt>2*86400000)await store.remove(path);}
}
