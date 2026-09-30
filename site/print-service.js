const form=document.querySelector('#print-form');
const message=document.querySelector('#print-status');
const submit=document.querySelector('#print-submit');
const base=window.TERRAIN_PRINT_API;
let config,widget;
const say=text=>{message.textContent=text;};
function closed(text){form.dataset.available='false';form.insertBefore(message,form.children[1]);say(text);}

async function api(path,options={}){
 const response=await fetch(base+'/api/print/'+path,{...options,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(120000)});
 let body;try{body=await response.json();}catch{throw Error('The print service is unavailable. Please try again later.');}
 if(!response.ok)throw Error(body.error||'Unable to complete the request.');return body;
}

async function setup(){
 if(!base){closed('Print orders are not open yet. We are preparing pricing and checkout. Your files stay on your computer until you submit an available quote request.');return;}
 try{
  const origin=new URL(base);if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Invalid service address.');
  config=await api('config');
  if(!config.enabled){closed('Paid print orders are paused. This OpenLOCK edition is for non-commercial use; commercial printing requires separate permission.');return;}
  for(const c of config.colours){const option=new Option(c.label,c.id);form.elements.colour.add(option);}
  const countries=new Intl.DisplayNames(['en-GB'],{type:'region'});for(const c of config.countries)form.elements.country.add(new Option(countries.of(c),c));
  for(const [field,choices] of [['material',config.materials||[]],['printer',config.printers||[]]]){
   document.querySelector('#'+field+'-field').hidden=!choices.length;form.elements[field].required=!!choices.length;
   for(const choice of choices)form.elements[field].add(new Option(choice.label,choice.id));
  }
  if(config.preview){document.querySelector('#test-access-field').hidden=false;form.elements.testAccessCode.required=true;submit.disabled=false;submit.textContent='Get my test estimate';say(config.demo?'LOCAL DEMO — use access code LOCAL-PRINT-PREVIEW. No email is sent, no payment is taken and no files leave this computer.':'TEST ONLY — invited testing. Prices are estimates; emails are real. No payment, printing or shipping. You may use a fictitious delivery address for this test.');return;}
  if(config.demo){submit.disabled=false;say('LOCAL DEMO — example prices only. No email is sent and no payment is taken.');return;}
  window.terrainTurnstileReady=()=>{widget=window.turnstile.render('#print-antispam',{sitekey:config.turnstileSiteKey,action:'print-quote',callback:()=>{submit.disabled=false;},'expired-callback':()=>{submit.disabled=true;},'error-callback':()=>{submit.disabled=true;say('The anti-spam check could not load. Please refresh and try again.');}});};
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=terrainTurnstileReady&render=explicit';script.async=true;script.onerror=()=>say('The anti-spam check could not load. Please try again later.');document.head.append(script);
  say(config.sandbox?'SANDBOX — test orders only. PayPal sandbox accounts are required.':'Ready for your print pack. Your quote is free; payment is a separate step.');
 }catch(error){say(error.message);}
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(!config?.enabled)return;
 const file=form.elements.pack.files[0];if(!file||!file.name.toLowerCase().endsWith('.zip'))return say('Choose the ZIP of your exported print-pack folder.');
 if(file.size>config.maxUploadBytes)return say('Please split this scene into ZIP packs smaller than 40 MB.');
 const details=Object.fromEntries(new FormData(form));delete details.pack;details.consent=form.elements.consent.checked;
 const body=new FormData();body.set('pack',file);body.set('details',JSON.stringify(details));body.set('cf-turnstile-response',config.preview?'':config.demo?'demo':window.turnstile.getResponse(widget));
 submit.disabled=true;document.querySelector('#print-progress').hidden=false;say('Uploading and checking your models and quantities…');
 try{const result=await api('quotes',{method:'POST',body});const url=new URL(result.url);if(![location.origin,'https://terrainfoundry.co.uk'].includes(url.origin)||url.pathname!=='/print-order.html')throw Error('Invalid quote address.');location.assign(url.href);}
 catch(error){say(error.message);if(config.demo||config.preview)submit.disabled=false;else window.turnstile.reset(widget);}
 finally{document.querySelector('#print-progress').hidden=true;}
});
if(form)setup();

const order=document.querySelector('#order-details');
if(order){
 const [id,secret]=location.hash.slice(1).split('.');const headers={Authorization:'Bearer '+secret};
 const pay=document.querySelector('#pay-button'),confirm=document.querySelector('#confirm-payment'),testOrder=document.querySelector('#test-order-button');
 const money=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
 function line(label,value){const row=document.createElement('div');row.className='quote-row';const key=document.createElement('span'),val=document.createElement('strong');key.textContent=label;val.textContent=value;row.append(key,val);order.append(row);}
 function show(q){
  order.replaceChildren();line('Reference',q.id);line('Filament',q.colour.label);line('Pieces (including connectors)',String(q.price.pieceCount));
  const list=document.createElement('ul');for(const item of q.items){const li=document.createElement('li');li.textContent=`${item.quantity} × ${item.name}`;list.append(li);}order.append(list);
  if(q.price.estimate){const e=q.price.estimate;line('Material',e.material);line('Printer',e.printer);line('Estimated filament',e.grams+' g');line('Estimated printer time',e.hours+' hours');line('Filament cost',money(e.filamentCostPence));line('Machine time cost',money(e.machineCostPence));line('Manufacturing markup',money(e.markupPence));line('Parts handling',money(q.price.piecePence));line('Setup',money(q.price.setupPence));line('Calculation note',e.notice);if(!e.assumptions.vatConfirmed)line('VAT status','Unconfirmed — test calculation only');}
  if(q.price.discountPence){line('Printing before discount',money(q.price.printBeforeDiscountPence));line('Parts discount ('+q.price.discount.code+')','−'+money(q.price.discountPence));}
  line('Printing',money(q.price.printPence));line('Shipping',money(q.price.shippingPence));line('VAT',money(q.price.vatPence));line('Total',money(q.price.totalPence));line('Quote valid until',new Date(q.expiresAt).toLocaleDateString('en-GB'));
  const expired=Date.now()>q.expiresAt;pay.hidden=q.status!=='quoted'||expired||q.demo||q.preview;confirm.hidden=pay.hidden;
  testOrder.hidden=!q.preview||q.status!=='quoted'||expired;
  if(q.preview){say(q.demo?'LOCAL DEMO — '+(q.status==='test-requested'?'Test request recorded. ':'')+'No email, payment, printing or shipping.':q.status==='test-requested'?'Test request recorded. No payment, printing or shipping will take place. Confirmation emails are queued.':expired?'This test quote has expired. Please request another.':'TEST ESTIMATE — no payment, printing or shipping. '+(q.emailStatus==='sent'?'Your estimate email was accepted by the email provider.':'Your estimate email is queued.'));return;}
  say(q.demo?'LOCAL DEMO — example price only. No email was sent; checkout is disabled.':q.status==='paid'?'Payment received. Your order is queued for printing checks. We will email your confirmation.':q.status==='payment-review'?'This order needs a payment review. Please contact us.':expired?'This quote has expired. Please request a new quote.':`${q.sandbox?'SANDBOX — test payment only. ':''}Your quote is ready. ${q.emailStatus==='sent'?'A copy has been emailed to you.':'Your quote email is queued.'}`);
 }
 async function load(){try{if(!base||!/^[a-f0-9]{32}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(secret||''))throw Error('Please open the complete private link from your quote email.');show(await api('quote/'+id,{headers}));}catch(error){say(error.message);}}
 pay.addEventListener('click',async()=>{pay.disabled=true;try{const result=await api('checkout/'+id,{method:'POST',headers});if(result.paid)return load();const url=new URL(result.url);if(url.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(url.hostname))throw Error('Invalid payment link.');location.assign(url.href);}catch(error){say(error.message);}finally{pay.disabled=false;}});
 confirm.addEventListener('click',async()=>{confirm.disabled=true;try{const q=await api('confirm/'+id,{method:'POST',headers});show(q);if(q.paymentPending)say('PayPal has not confirmed a completed payment yet. You can try checking again shortly.');}catch(error){say(error.message);}finally{confirm.disabled=false;}});
 testOrder.addEventListener('click',async()=>{testOrder.disabled=true;try{show(await api('test-order/'+id,{method:'POST',headers}));}catch(error){say(error.message);}finally{testOrder.disabled=false;}});
 load();
 // PayPal return parameters are not proof of payment. Confirmation is checked server-side.
 if(new URLSearchParams(location.search).has('PayerID'))confirm.click();
}
