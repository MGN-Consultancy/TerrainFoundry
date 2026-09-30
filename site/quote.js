const quotePanel=document.querySelector('#order-details');
const quoteStatus=document.querySelector('#print-status');
const quoteMoney=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(p/100);
const [quoteId,quoteSecret]=location.hash.slice(1).split('.');
const quoteHeaders={Authorization:'Bearer '+quoteSecret};
let currentQuote,page=0,activeTab='summary';
const pageSize=()=>innerWidth<700?3:innerHeight<800?5:8;
const buttons=Object.fromEntries(['pay','test-order','confirm-payment','save-quote','copy-quote'].map(id=>[id,document.getElementById(id+'-button')||document.getElementById(id)]));
function quoteSay(text){quoteStatus.textContent=text;}
async function quoteApi(path,method='GET'){
 const response=await fetch(window.TERRAIN_PRINT_API+'/api/print/'+path,{method,headers:quoteHeaders,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(120000)});
 let body;try{body=await response.json();}catch{throw Error('The quote service is unavailable. Please try again.');}
 if(!response.ok)throw Error(body.error||'Unable to load your quote.');return body;
}
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function chargeRows(p){
 // Older stored quotes and cached responses retain their agreed total.
 const rows=Number.isInteger(p.filamentPence)?[['Filament',p.filamentPence],['Machine time',p.machinePence],['Handling (includes setup)',p.handlingPence]]:[['Printing (saved quote)',p.printBeforeDiscountPence??p.printPence]];
 if(p.minimumAdjustmentPence)rows.push(['Minimum print charge adjustment',p.minimumAdjustmentPence]);
 if(p.discountPence)rows.push(['Parts discount'+(p.discount?.code?' ('+p.discount.code+')':''),-p.discountPence]);
 rows.push(['UK postage',p.shippingPence]);if(p.vatPence)rows.push(['VAT',p.vatPence]);return rows;
}
function renderQuote(){
 const q=currentQuote,p=q.price;quotePanel.replaceChildren();
 const pieces=element('section','','quote-column quote-part-column');pieces.id='quote-parts';
 pieces.append(element('h2','Your pieces'),element('p',`${p.pieceCount} pieces · ${q.colour.label}`,'quote-context'));
 const pages=Math.max(1,Math.ceil(q.items.length/pageSize()));page=Math.min(page,pages-1);
 const list=element('ul','','quote-pieces');for(const item of q.items.slice(page*pageSize(),(page+1)*pageSize()))list.append(element('li',`${item.quantity} × ${item.name}`));pieces.append(list);
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
 buttons.pay.hidden=q.status!=='quoted'||expired||q.demo||q.preview;
 buttons['confirm-payment'].hidden=buttons.pay.hidden;
 buttons['test-order'].hidden=!q.preview||q.status!=='quoted'||expired;
 buttons['save-quote'].disabled=false;buttons['copy-quote'].disabled=false;
 document.getElementById('quote-reference').textContent=q.status==='payment-review'?'Payment review required'+(q.sandbox?' · Sandbox':''):(q.preview?'Test only · ':q.sandbox?'Sandbox · ':'')+'Reference '+q.id.slice(0,8).toUpperCase();
}
function showQuote(q){
 currentQuote=q;renderQuote();
 if(q.preview){quoteSay(q.status==='test-requested'?'Test request saved — no payment or printing.':Date.now()>q.expiresAt?'This test quote has expired.':'TEST ESTIMATE — no payment, printing or shipping.');return;}
 const prefix=q.sandbox?'SANDBOX — test payment only. ':'';
 quoteSay(prefix+(q.status==='paid'?'Payment received.':q.status==='payment-review'?'This order needs a payment review. Please contact the workshop.':Date.now()>q.expiresAt?'This quote has expired.':'Your private quotation is ready.'));
}
for(const button of document.querySelectorAll('[data-quote-tab]'))button.onclick=()=>{if(!currentQuote)return;activeTab=button.dataset.quoteTab;renderQuote();};
addEventListener('resize',()=>{if(currentQuote)renderQuote();});
const privateQuoteLink=()=>location.origin+location.pathname+'#'+quoteId+'.'+quoteSecret;
buttons['copy-quote'].onclick=async()=>{try{await navigator.clipboard.writeText(privateQuoteLink());quoteSay('Private link copied. Keep it safe to reopen this quotation.');}catch{quoteSay('Copy is unavailable. Use Save quotation to keep your private link.');}};
buttons['save-quote'].onclick=()=>{
 const q=currentQuote;const text=['Terrain Foundry '+(q.preview?'TEST estimate':'quotation'),'Reference: '+q.id,'Colour: '+q.colour.label,...q.items.map(item=>item.quantity+' x '+item.name),'',...chargeRows(q.price).map(([label,pence])=>label+': '+quoteMoney(pence)),'Total: '+quoteMoney(q.price.totalPence),'Valid until: '+new Date(q.expiresAt).toLocaleDateString('en-GB'),'Reopen using this private link (do not share):',privateQuoteLink(),'Geometry estimate; final slicing may differ.',q.preview?'TEST ONLY: no payment, printing or shipping.':''].join('\r\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=element('a','');a.href=url;a.download='TerrainFoundry-quote-'+q.id.slice(0,8)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);quoteSay('Quotation saved with its private link. It keeps its original expiry date.');
};
async function action(button,path){button.disabled=true;try{const result=await quoteApi(path+'/'+quoteId,'POST');if(result.url){const url=new URL(result.url);if(url.protocol!=='https:'||!['www.paypal.com','www.sandbox.paypal.com'].includes(url.hostname))throw Error('Invalid payment address.');location.assign(url.href);}else if(result.paid)showQuote(await quoteApi('quote/'+quoteId));else{showQuote(result);if(result.paymentPending)quoteSay('PayPal has not confirmed payment yet.');}}catch(error){quoteSay(error.message);}finally{button.disabled=false;}}
buttons.pay.onclick=()=>action(buttons.pay,'checkout');buttons['test-order'].onclick=()=>action(buttons['test-order'],'test-order');buttons['confirm-payment'].onclick=()=>action(buttons['confirm-payment'],'confirm');
(async()=>{try{if(!window.TERRAIN_PRINT_API||!/^[a-f0-9]{32}$/.test(quoteId||'')||!/^[a-f0-9]{64}$/.test(quoteSecret||''))throw Error('Open the complete private link from your quote email.');showQuote(await quoteApi('quote/'+quoteId));if(new URLSearchParams(location.search).has('PayerID')&&!buttons['confirm-payment'].hidden)buttons['confirm-payment'].click();}catch(error){quoteSay(error.message);}})();
