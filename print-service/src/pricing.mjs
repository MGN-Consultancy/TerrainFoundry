import {InputError} from './geometry.mjs';

export function validateRates(rates) {
 // Allow the prior tariff during a rolling deployment; preserve its arithmetic.
 if(rates && rates.materialMarkupBasisPoints === undefined && rates.markupBasisPoints !== undefined) rates={...rates,materialMarkupBasisPoints:rates.markupBasisPoints};
 if(!rates||rates.currency!=='GBP'||!['enclosed-model-volume','estimated-filament-and-time'].includes(rates.basis)||!rates.version)throw new Error('A versioned GBP tariff is required.');
 for(const key of ['pencePerCm3','perPiecePence','setupPence','minimumPrintPence','vatBasisPoints','maximumQuotePence'])if(!Number.isSafeInteger(rates[key])||rates[key]<0)throw new Error('Invalid pricing: '+key);
 if((rates.basis==='enclosed-model-volume'&&!rates.pencePerCm3)||!rates.maximumQuotePence||rates.vatBasisPoints>10000||!Array.isArray(rates.buildVolumeMm)||rates.buildVolumeMm.length!==3||rates.buildVolumeMm.some(n=>!Number.isFinite(n)||n<=0||n>1000))throw new Error('Invalid pricing limits.');
 if(rates.basis==='estimated-filament-and-time'){
  for(const key of ['shellMm','infillFraction','allowanceFraction','materialMarkupBasisPoints'])if(!Number.isFinite(rates[key])||rates[key]<0)throw new Error('Invalid estimate assumptions.');
  if(!rates.shellMm||rates.shellMm>5||rates.infillFraction>1||rates.allowanceFraction>1||!Number.isInteger(rates.materialMarkupBasisPoints)||rates.materialMarkupBasisPoints>10000)throw new Error('Invalid estimate assumptions.');
  if(!Array.isArray(rates.materials)||!rates.materials.length||rates.materials.some(m=>!m.id||!m.label||!Number.isSafeInteger(m.pencePerKg)||m.pencePerKg<=0||!Number.isFinite(m.densityGPerCm3)||m.densityGPerCm3<=0))throw new Error('Invalid materials.');
  if(!Array.isArray(rates.printers)||!rates.printers.length||rates.printers.some(p=>!p.id||!p.label||!Number.isFinite(p.gramsPerHour)||p.gramsPerHour<=0||!Number.isSafeInteger(p.pencePerHour)||p.pencePerHour<=0||!Array.isArray(p.buildVolumeMm)||p.buildVolumeMm.length!==3||p.buildVolumeMm.some(n=>!Number.isFinite(n)||n<=0)))throw new Error('Invalid printers.');
 }
 if(!Array.isArray(rates.colours)||!rates.colours.length||rates.colours.some(c=>!c.id||!c.label))throw new Error('Filament colours are required.');
 if(!rates.shipping||!Object.keys(rates.shipping).length)throw new Error('Shipping rates are required.');
 for(const [country,rate] of Object.entries(rates.shipping))if(!/^[A-Z]{2}$/.test(country)||!Number.isSafeInteger(rate.pence)||rate.pence<0||!Number.isSafeInteger(rate.maxPieces)||rate.maxPieces<1)throw new Error('Invalid shipping rate.');
 return rates;
}

export function customerDetails(input,rates) {
 const clean=(key,max,required=true)=>{const value=String(input[key]||'').trim();if(value.length>max||(required&&!value)||/[\x00-\x1f\x7f]/.test(value))throw new InputError('Please check '+key+'.');return value;};
 const email=clean('email',254);if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw new InputError('Enter a valid email address.');
 const colour=clean('colour',50),country=clean('country',2);if(!rates.colours.some(c=>c.id===colour))throw new InputError('Choose an available filament colour.');if(!rates.shipping[country])throw new InputError('Shipping is not available to this country.');
 if(input.consent!==true)throw new InputError('Please agree to the print-service terms and upload privacy notice.');
 const material=String(input.material||''),printer=String(input.printer||'');
 if(rates.basis==='estimated-filament-and-time'&&(!rates.materials.some(m=>m.id===material)||!rates.printers.some(p=>p.id===printer)))throw new InputError('Choose an available material and printer.');
 return {email,colour,material,printer,address:{name:clean('name',120),line1:clean('line1',180),line2:clean('line2',180,false),city:clean('city',100),region:clean('region',100,false),postcode:clean('postcode',20),country},consentVersion:'print-service-v1'};
}

function estimateParts(items,details,rates){
 const material=rates.materials.find(m=>m.id===details.material),printer=rates.printers.find(p=>p.id===details.printer);
 if(!material||!printer)throw new InputError('Choose an available material and printer.');
 const lines=items.map(item=>{
  if(!Number.isFinite(item.surfaceCm2)||item.surfaceCm2<=0)throw new InputError('Unable to estimate this model.');
  const shell=Math.min(item.volumeCm3,item.surfaceCm2*rates.shellMm/10);
  const grams=(shell+(item.volumeCm3-shell)*rates.infillFraction)*material.densityGPerCm3*(1+rates.allowanceFraction)*item.quantity;
  return {file:item.file,grams,hours:grams/printer.gramsPerHour};
 });
 const grams=lines.reduce((n,l)=>n+l.grams,0),hours=lines.reduce((n,l)=>n+l.hours,0);
 const filamentCostPence=Math.ceil(grams*material.pencePerKg/1000),machineCostPence=Math.ceil(hours*printer.pencePerHour);
 const manufacturingPence=filamentCostPence+machineCostPence,markupPence=Math.ceil((rates.materialMarkupBasisPoints===undefined?manufacturingPence:filamentCostPence)*(rates.materialMarkupBasisPoints??rates.markupBasisPoints)/10000);
 return {estimated:true,material:material.label,printer:printer.label,grams:+grams.toFixed(2),hours:+hours.toFixed(2),filamentCostPence,machineCostPence,markupPence,manufacturingPence,chargePence:manufacturingPence+markupPence,lines,assumptions:{shellMm:rates.shellMm,infillFraction:rates.infillFraction,allowanceFraction:rates.allowanceFraction,gramsPerHour:printer.gramsPerHour,materialPencePerKg:material.pencePerKg,machinePencePerHour:printer.pencePerHour,...(rates.materialMarkupBasisPoints===undefined?{markupBasisPoints:rates.markupBasisPoints}:{materialMarkupBasisPoints:rates.materialMarkupBasisPoints}),vatConfirmed:rates.vatConfirmed===true},notice:'Geometry estimate, not a Bambu Studio slice. Actual filament, supports and print time require slicing and review before a firm price.'};
}

export function validateDiscounts(discounts=[]) {
 if(!Array.isArray(discounts)||discounts.length>100)throw new Error('Invalid discount configuration.');
 const codes=new Set();
 for(const d of discounts){
  if(!d||typeof d.code!=='string'||!/^[A-Z0-9_-]{3,32}$/.test(d.code)||codes.has(d.code)||typeof d.enabled!=='boolean'||!Number.isInteger(d.percentBasisPoints)||d.percentBasisPoints<1||d.percentBasisPoints>10000)throw new Error('Invalid discount code.');
  codes.add(d.code);
  for(const key of ['startsAt','expiresAt'])if(typeof d[key]!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/.test(d[key])||!Number.isFinite(Date.parse(d[key])))throw new Error('Discount dates must be UTC timestamps.');
  if(Date.parse(d.expiresAt)<=Date.parse(d.startsAt))throw new Error('Invalid discount period.');
  for(const key of ['minimumPartsPence','maximumDiscountPence'])if(d[key]!==undefined&&(!Number.isSafeInteger(d[key])||d[key]<0))throw new Error('Invalid discount amount.');
  if(d.sha256!==undefined&&(!Array.isArray(d.sha256)||!d.sha256.length||d.sha256.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h))))throw new Error('Discount scope requires STL SHA-256 hashes.');
 }
 return discounts;
}

export function price(items,details,rates,{code='',discounts=[],now=Date.now()}={}) {
 validateRates(rates);const count=items.reduce((n,p)=>n+p.quantity,0);const shipping=rates.shipping[details.address.country];
 if(!shipping||count>shipping.maxPieces)throw new InputError('This order needs a shipping quote from us. Please split it into smaller orders.');
 const volumeCm3=items.reduce((n,p)=>n+p.volumeCm3*p.quantity,0);
 const estimate=rates.basis==='estimated-filament-and-time'?estimateParts(items,details,rates):null;
 const modelPence=estimate?estimate.chargePence:Math.ceil(volumeCm3*rates.pencePerCm3),piecePence=count*rates.perPiecePence;
 const partsPence=modelPence+piecePence,printBeforeDiscountPence=Math.max(rates.minimumPrintPence,partsPence+rates.setupPence);
 validateDiscounts(discounts);
 if(typeof code!=='string'||code.length>32)throw new InputError('Please check the discount code.');
 code=code.trim().toUpperCase();let discount=null,discountPence=0;
 if(code){
  const d=discounts.find(d=>d.code===code&&d.enabled&&now>=Date.parse(d.startsAt)&&now<Date.parse(d.expiresAt));
  if(!d)throw new InputError('This discount code is invalid or has expired.');
  const eligible=items.filter(item=>!d.sha256||d.sha256.includes(item.sha256));
  const eligibleModels=estimate?estimateParts(eligible,details,rates).chargePence:Math.ceil(eligible.reduce((n,item)=>n+item.volumeCm3*item.quantity,0)*rates.pencePerCm3);
  const eligiblePartsPence=Math.min(partsPence,eligibleModels+eligible.reduce((n,item)=>n+item.quantity,0)*rates.perPiecePence);
  if(!eligiblePartsPence||eligiblePartsPence<(d.minimumPartsPence||0))throw new InputError('This order does not meet the discount code requirements.');
  const requestedPence=Math.min(eligiblePartsPence,Math.floor(eligiblePartsPence*d.percentBasisPoints/10000),d.maximumDiscountPence??Number.MAX_SAFE_INTEGER);
  discountPence=Math.min(requestedPence,Math.max(0,printBeforeDiscountPence-rates.minimumPrintPence));
  if(!discountPence)throw new InputError('This order is already at the minimum print charge; this code cannot reduce it further.');
  discount={code,percentBasisPoints:d.percentBasisPoints,eligiblePartsPence,requestedPence,appliedPence:discountPence};
 }
 const printPence=printBeforeDiscountPence-discountPence;
 const subtotalPence=printPence+shipping.pence,vatPence=Math.round(subtotalPence*rates.vatBasisPoints/10000),totalPence=subtotalPence+vatPence;
 if(!Number.isSafeInteger(totalPence)||totalPence>rates.maximumQuotePence)throw new InputError('This order is above the automatic quote limit. Please split it into smaller orders.');
 return {currency:'GBP',rateVersion:rates.version,basis:rates.basis,estimate,pieceCount:count,volumeCm3:+volumeCm3.toFixed(3),modelPence,piecePence,partsPence,setupPence:rates.setupPence,minimumApplied:printPence>partsPence+rates.setupPence-(discount?.requestedPence||0),printBeforeDiscountPence,discountPence,discount,printPence,shippingPence:shipping.pence,vatBasisPoints:rates.vatBasisPoints,vatPence,totalPence};
}
