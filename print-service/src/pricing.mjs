import {InputError} from './geometry.mjs';

export function validateRates(rates) {
 if(!rates||rates.currency!=='GBP'||rates.basis!=='enclosed-model-volume'||!rates.version)throw new Error('A versioned GBP model-volume tariff is required.');
 for(const key of ['pencePerCm3','perPiecePence','setupPence','minimumPrintPence','vatBasisPoints','maximumQuotePence'])if(!Number.isSafeInteger(rates[key])||rates[key]<0)throw new Error('Invalid pricing: '+key);
 if(!rates.pencePerCm3||!rates.maximumQuotePence||rates.vatBasisPoints>10000||!Array.isArray(rates.buildVolumeMm)||rates.buildVolumeMm.length!==3||rates.buildVolumeMm.some(n=>!Number.isFinite(n)||n<=0||n>1000))throw new Error('Invalid pricing limits.');
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
 return {email,colour,address:{name:clean('name',120),line1:clean('line1',180),line2:clean('line2',180,false),city:clean('city',100),region:clean('region',100,false),postcode:clean('postcode',20),country},consentVersion:'print-service-v1'};
}

export function price(items,details,rates) {
 validateRates(rates);const count=items.reduce((n,p)=>n+p.quantity,0);const shipping=rates.shipping[details.address.country];
 if(!shipping||count>shipping.maxPieces)throw new InputError('This order needs a shipping quote from us. Please split it into smaller orders.');
 const volumeCm3=items.reduce((n,p)=>n+p.volumeCm3*p.quantity,0);
 const modelPence=Math.ceil(volumeCm3*rates.pencePerCm3),piecePence=count*rates.perPiecePence;
 const printPence=Math.max(rates.minimumPrintPence,modelPence+piecePence+rates.setupPence);
 const subtotalPence=printPence+shipping.pence,vatPence=Math.round(subtotalPence*rates.vatBasisPoints/10000),totalPence=subtotalPence+vatPence;
 if(!Number.isSafeInteger(totalPence)||totalPence>rates.maximumQuotePence)throw new InputError('This order is above the automatic quote limit. Please split it into smaller orders.');
 return {currency:'GBP',rateVersion:rates.version,basis:rates.basis,pieceCount:count,volumeCm3:+volumeCm3.toFixed(3),modelPence,piecePence,setupPence:rates.setupPence,minimumApplied:printPence>modelPence+piecePence+rates.setupPence,printPence,shippingPence:shipping.pence,vatBasisPoints:rates.vatBasisPoints,vatPence,totalPence};
}
