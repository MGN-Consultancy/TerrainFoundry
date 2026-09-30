const quotePanel=document.querySelector('#order-details');
const quoteStatus=document.querySelector('#print-status');
const quoteMoney=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
const [quoteId,quoteSecret]=location.hash.slice(1).split('&')[0].split('.');
const quoteHeaders={Authorization:'Bearer '+quoteSecret};
const paypalReturn=new URLSearchParams(location.search);for(const [key,value] of new URLSearchParams(location.hash.split('&').slice(1).join('&')))paypalReturn.set(key,value);
if(location.hash.includes('&'))history.replaceState(null,'',location.pathname+location.search+'#'+quoteId+'.'+quoteSecret);
let currentQuote,page=0,activeTab='summary';
const pageSize=()=>{const style=getComputedStyle(quotePanel),height=quotePanel.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);return Math.max(1,Math.min(12,Math.floor((height-(innerHeight<=450?68:144))/(innerHeight<=450?64:88))*(innerWidth>=1200?2:1)));};
const buttons=Object.fromEntries(['pay','test-order','confirm-payment','save-quote','copy-quote'].map(id=>[id,document.getElementById(id+'-button')||document.getElementById(id)]));
function quoteSay(text){quoteStatus.textContent=text;}
async function quoteApi(path,method='GET'){
 const response=await fetch(window.TERRAIN_PRINT_API+'/api/print/'+path,{method,headers:quoteHeaders,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(120000)});
 let body;try{body=await response.json();}catch{throw Error('The quote service is unavailable. Please try again.');}
 if(!response.ok)throw Error(body.error||'Unable to load your quote.');return body;
}
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function pieceCard(item){
 const asset=window.TerrainQuoteCatalog?.lookup(item),name=asset?.name||item.name;
 const card=element('li','','piece-card'),details=element('div','','piece-card-details');card.dataset.file=item.file||item.name;
 const placeholder=()=>element('span','◇','piece-placeholder');
 if(asset){
  const button=element('button','','piece-thumbnail');button.type='button';button.setAttribute('aria-label','Preview '+name);
  const image=document.createElement('img');image.src=asset.image;image.alt='';image.width=88;image.height=66;image.decoding='async';
  image.onerror=()=>{button.replaceChildren(placeholder());button.disabled=true;button.setAttribute('aria-label','Preview unavailable for '+name);};
  button.append(image);button.onclick=()=>showPiecePreview(item,asset);card.append(button);
 }else{const empty=element('div','','piece-thumbnail');empty.setAttribute('aria-label','No registered preview');empty.append(placeholder());card.append(empty);}
 const heading=element('strong',name,'piece-name');heading.title=name;
 details.append(heading,element('span',asset?(asset.matched?'Matched model':'Catalogue reference'):'Uploaded model · no preview','piece-match'));
 const quantity=element('span','×'+item.quantity,'piece-quantity');quantity.setAttribute('aria-label',item.quantity+' copies');
 card.append(details,quantity);return card;
}
let previewDialog;
function showPiecePreview(item,asset){
 if(!previewDialog){previewDialog=document.createElement('dialog');previewDialog.className='piece-preview-dialog';previewDialog.setAttribute('aria-labelledby','piece-preview-title');document.body.append(previewDialog);}
 previewDialog.replaceChildren();const title=element('h2',asset.name);title.id='piece-preview-title';
 const picture=element('div','','piece-preview-picture'),image=document.createElement('img');image.src=asset.image;image.alt=asset.name+' registered design';image.onerror=()=>picture.replaceChildren(element('p','Preview unavailable. Your uploaded piece remains in this quote.'));picture.append(image);
 const size=Array.isArray(item.sizeMm)&&item.sizeMm.every(Number.isFinite)?item.sizeMm.map(n=>Number(n.toFixed(1))).join(' × ')+' mm':'';
 const description=element('p',`${item.quantity} copies · ${currentQuote.colour.label}${size?' · '+size:''}`);
 const caption=element('p',asset.matched?'Matched to the registered model. Colours and textures are a visual guide; printing uses your chosen filament.':'Catalogue reference only. This upload differs from the current registered model; shape, scale or connectors may differ. Printing uses your chosen filament.','piece-preview-caption');
 const source=element('p','Uploaded file: '+item.file,'piece-preview-caption'),actions=element('div','','piece-preview-actions'),credits=element('a','Model credits');credits.href='assets/terrain/NOTICE.txt';credits.target='_blank';credits.rel='noopener';
 const close=element('button','Close preview','button secondary');close.onclick=()=>previewDialog.close();actions.append(credits,close);
 previewDialog.append(title,picture,description,caption,source,actions);previewDialog.showModal();close.focus();
}
function chargeRows(p){
 // Older stored quotes and cached responses retain their agreed total.
 const rows=Number.isInteger(p.filamentPence)?[['Filament',p.filamentPence],[Number.isInteger(p.estimate?.hourlyRatePence)?`Machine time (${quoteMoney(p.estimate.hourlyRatePence)}/hour)`:'Machine time',p.machinePence],['Handling (includes setup)',p.handlingPence]]:[['Printing (saved quote)',p.printBeforeDiscountPence??p.printPence]];
 if(p.minimumAdjustmentPence)rows.push(['Minimum print charge adjustment',p.minimumAdjustmentPence]);
 if(p.discountPence)rows.push(['Parts discount'+(p.discount?.code?' ('+p.discount.code+')':''),-p.discountPence]);
 rows.push(['UK postage',p.shippingPence]);if(p.vatPence)rows.push(['VAT',p.vatPence]);return rows;
}
function renderQuote(){
 const q=currentQuote,p=q.price;quotePanel.replaceChildren();
 const pieces=element('section','','quote-column quote-part-column');pieces.id='quote-parts';
 pieces.append(element('h2','Your pieces'),element('p',`${p.pieceCount} pieces · ${q.colour.label}`,'quote-context'),element('p','Tap a preview to inspect the registered design.','piece-preview-note'));
 const pages=Math.max(1,Math.ceil(q.items.length/pageSize()));page=Math.min(page,pages-1);
 const list=element('ul','','quote-pieces');for(const item of q.items.slice(page*pageSize(),(page+1)*pageSize()))list.append(pieceCard(item));pieces.append(list);
 const nav=element('nav','','quote-pagination');nav.setAttribute('aria-label','Parts pages');
 const previous=element('button','Previous'),next=element('button','Next');previous.disabled=page===0;next.disabled=page===pages-1;
 previous.onclick=()=>{page--;renderQuote();};next.onclick=()=>{page++;renderQuote();};nav.append(previous,element('span',`${page+1} / ${pages}`),next);pieces.append(nav);
 const summary=element('section','','quote-column quote-summary');summary.id='quote-summary';summary.append(element('h2','Your estimate'));
 if(p.estimate){const e=p.estimate;summary.append(element('p',`${e.material} · ${e.printer} · ≈ ${e.grams} g · ${e.hours} hours`,'quote-context'));}
 for(const [name,value] of chargeRows(p)){const row=element('div','','quote-row');row.append(element('span',name),element('strong',quoteMoney(value)));summary.append(row);}
 const total=element('div','','quote-row quote-total');total.append(element('span','Total'),element('strong',quoteMoney(p.totalPence)));summary.append(total);
 summary.append(element('p',`Valid until ${new Date(q.expiresAt).toLocaleDateString('en-GB')}${!p.vatPence?' · No VAT charged':''}`,'quote-context'));
 pieces.hidden=innerWidth<700&&activeTab!=='parts';summary.hidden=innerWidth<700&&activeTab!=='summary';quotePanel.append(pieces,summary);
 for(const button of document.querySelectorAll('[data-quote-tab]'))button.setAttribute('aria-pressed',String(button.dataset.quoteTab===activeTab));
 const expired=Date.now()>q.expiresAt;
 buttons.pay.hidden=true;
 buttons['confirm-payment'].hidden=q.status!=='quoted'||expired||q.demo||q.preview;
 buttons['test-order'].hidden=!q.preview||q.status!=='quoted'||expired;
 buttons['save-quote'].disabled=false;buttons['copy-quote'].disabled=false;
 document.getElementById('quote-reference').textContent=q.status==='payment-review'?'Payment review required'+(q.sandbox?' · Sandbox':''):(q.preview?'Test only · ':q.sandbox?'Sandbox · ':'')+'Reference '+q.id.slice(0,8).toUpperCase();
}
function showQuote(q){
 currentQuote=q;renderQuote();paymentTestButton.hidden=!q.paymentTestAvailable||!!q.paymentTestReceipt;setupPayPal(q);
 if(q.paymentTestReceipt?.status==='paid'){document.querySelector('h1').textContent='Test payment confirmed';document.querySelector('.quote-note').textContent='Real 10p test payment only. No printing or shipping. Your scenery quotation remains separate.';quoteSay('£0.10 test payment received · '+q.paymentTestReceipt.reference+' · No printing or shipping. Scenery quotation remains unpaid.');return;}
 if(q.preview){quoteSay(q.status==='test-requested'?'Test request saved — no payment or printing.':Date.now()>q.expiresAt?'This test quote has expired.':'TEST ESTIMATE — no payment, printing or shipping.');return;}
 if(q.status==='paid'){document.querySelector('h1').textContent='Your print order';document.querySelector('.quote-note').textContent='Your order status appears above. We will email you when printing starts and when it ships.';}
 const prefix=q.sandbox?'SANDBOX — test payment only. ':'';
 quoteSay(prefix+(q.status==='paid'?'Payment received · '+({paid:'Order received','in-progress':'In progress',shipped:'Shipped'}[q.fulfilment?.status||'paid'])+(q.fulfilment?.tracking?' · Tracking: '+q.fulfilment.tracking:''):q.status==='payment-review'?'This order needs a payment review. Please contact the workshop.':Date.now()>q.expiresAt?'This quote has expired.':'Your private quotation is ready.'));
}
for(const button of document.querySelectorAll('[data-quote-tab]'))button.onclick=()=>{if(!currentQuote)return;activeTab=button.dataset.quoteTab;renderQuote();};
addEventListener('resize',()=>{if(currentQuote)renderQuote();});
const privateQuoteLink=()=>location.origin+location.pathname+'#'+quoteId+'.'+quoteSecret;
buttons['copy-quote'].onclick=async()=>{try{await navigator.clipboard.writeText(privateQuoteLink());quoteSay('Private link copied. Keep it safe to reopen this quotation.');}catch{quoteSay('Copy is unavailable. Use Save quotation to keep your private link.');}};
buttons['save-quote'].onclick=()=>{
 const q=currentQuote;const text=['Terrain Foundry '+(q.preview?'TEST estimate':'quotation'),'Reference: '+q.id,'Colour: '+q.colour.label,...q.items.map(item=>item.quantity+' x '+(window.TerrainQuoteCatalog?.lookup(item)?.name||item.name)+' ('+item.file+')'),'',...chargeRows(q.price).map(([label,pence])=>label+': '+quoteMoney(pence)),'Total: '+quoteMoney(q.price.totalPence),'Valid until: '+new Date(q.expiresAt).toLocaleDateString('en-GB'),'Reopen using this private link (do not share):',privateQuoteLink(),'Geometry estimate; final slicing may differ.',q.preview?'TEST ONLY: no payment, printing or shipping.':''].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=element('a','');a.href=url;a.download='TerrainFoundry-quote-'+q.id.slice(0,8)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);quoteSay('Quotation saved with its private link. It keeps its original expiry date.');
};
async function action(button,path){button.disabled=true;try{const result=await quoteApi(path+'/'+quoteId,'POST');if(result.url){const url=new URL(result.url);if(url.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(url.hostname))throw Error('Invalid payment address.');location.assign(url.href);}else if(result.paid)showQuote(await quoteApi('quote/'+quoteId));else{showQuote(result);if(result.paymentPending)quoteSay('PayPal has not confirmed payment yet.');}}catch(error){quoteSay(error.message);}finally{button.disabled=false;}}
buttons.pay.onclick=()=>action(buttons.pay,'checkout');buttons['test-order'].onclick=()=>action(buttons['test-order'],'test-order');buttons['confirm-payment'].onclick=()=>action(buttons['confirm-payment'],'confirm');
(async()=>{try{if(!window.TERRAIN_PRINT_API||!/^[a-f0-9]{32}$/.test(quoteId||'')||!/^[a-f0-9]{64}$/.test(quoteSecret||''))throw Error('Open the complete private link from your quote email.');showQuote(await quoteApi('quote/'+quoteId));if(new URLSearchParams(location.search).get('paymentTest')==='1'){const result=await quoteApi('payment-test-confirm/'+quoteId,'POST');if(result.status==='paid')showQuote(await quoteApi('quote/'+quoteId));else quoteSay('Test payment status: '+result.status+'. No printing or shipping.');return;}if(paypalReturn.has('PayerID')&&!buttons['confirm-payment'].hidden)buttons['confirm-payment'].click();}catch(error){quoteSay(error.message);}})();

window.TerrainQuoteCatalog?.ready.then(()=>{if(currentQuote)renderQuote();});


const paymentTestButton=element('button','Test a 10p PayPal payment');paymentTestButton.hidden=true;
buttons['save-quote'].parentElement.append(paymentTestButton);
paymentTestButton.onclick=()=>{
 const dialog=document.createElement('dialog');dialog.className='piece-preview-dialog';
 const title=element('h2','Real £0.10 payment test'),notice=element('p','This charges 10p through live PayPal. It does not pay for this quotation and will never trigger printing or shipping.');
 const label=element('label','Private testing code'),input=document.createElement('input');input.className='payment-test-code';input.type='password';input.autocomplete='off';input.maxLength=128;label.append(input);
 const status=element('p',''),pay=element('div','','official-paypal'),close=element('button','Cancel','button secondary');close.onclick=()=>dialog.close();
 dialog.append(title,notice,label,status,pay,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();input.focus();
 window.TerrainPayPal.render(pay,currentQuote.paypalClientId,{
  create:async()=>{if(!input.value.trim())throw Error('Enter your private testing code.');const r=await fetch(window.TERRAIN_PRINT_API+'/api/print/payment-test/'+quoteId,{method:'POST',headers:{...quoteHeaders,'Content-Type':'application/json'},body:JSON.stringify({code:input.value}),credentials:'omit'});const result=await r.json();if(!r.ok)throw Error(result.error);if(!result.orderId)throw Error('This test has already been paid or needs review.');return result.orderId;},
  approve:async()=>{const result=await quoteApi('payment-test-confirm/'+quoteId,'POST');if(result.status!=='paid')throw Error('Payment is awaiting confirmation. Please check again shortly.');dialog.close();showQuote(await quoteApi('quote/'+quoteId));},
  message:text=>{status.textContent=text;}
 });
};
let checkoutKey;
function setupPayPal(q){
 const host=document.getElementById('paypal-checkout');if(!host)return;
 const eligible=!q.preview&&q.status==='quoted'&&q.expiresAt>Date.now()&&!!q.paypalClientId;
 host.hidden=!eligible;buttons.pay.hidden=true;
 if(!eligible){checkoutKey=null;host.replaceChildren();return;}if(checkoutKey===q.id)return;checkoutKey=q.id;
 window.TerrainPayPal.render(host,q.paypalClientId,{create:async()=>{const result=await quoteApi('checkout/'+quoteId,'POST');if(!result.orderId)throw Error('This order has already been paid.');return result.orderId;},approve:async()=>{const result=await quoteApi('confirm/'+quoteId,'POST');showQuote(result);if(result.paymentPending)quoteSay('PayPal payment is awaiting confirmation.');},message:quoteSay});
}

