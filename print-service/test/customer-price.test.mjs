import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {price} from '../src/pricing.mjs';
import {customerPrice} from '../src/customer-price.mjs';
import {makeService} from '../src/service.mjs';
import {emailFor} from '../src/notifications.mjs';
import {env,MemoryStore,FakePayPal,details,pack} from './helpers.mjs';
const rates=JSON.parse(fs.readFileSync(new URL('../rates.preview.json',import.meta.url),'utf8'));
const customer={...details,material:'pla',printer:'a1',address:{country:'GB'}};
const items=[{file:'floor.stl',quantity:20,volumeCm3:50,surfaceCm2:100}];
function noPrivate(value){assert.doesNotMatch(JSON.stringify(value),/filamentCost|machineCost|markup|assumptions|PencePerKg|BasisPoints|partsPence|setupPence|piecePence/i);}
test('30 percent applies to material only, with machine and combined handling charges',()=>{
 const p=price(items,customer,rates),publicPrice=customerPrice(p);
 assert.equal(p.estimate.markupPence,Math.ceil(p.estimate.filamentCostPence*.3));
 assert.equal(publicPrice.machinePence,p.estimate.machineCostPence);
 assert.equal(publicPrice.estimate.hourlyRatePence,150);
 assert.equal(publicPrice.filamentPence,p.estimate.filamentCostPence+p.estimate.markupPence);
 assert.equal(publicPrice.handlingPence,p.piecePence+p.setupPence);
 assert.equal(publicPrice.totalPence,publicPrice.filamentPence+publicPrice.machinePence+publicPrice.handlingPence+publicPrice.minimumAdjustmentPence-publicPrice.discountPence+publicPrice.shippingPence+publicPrice.vatPence);
 noPrivate(publicPrice);
});
test('minimum and discount reconcile to the customer total',()=>{
 for(const quantity of [1,20]){
  const opts=quantity===20?{code:'TEST10',now:1,discounts:[{code:'TEST10',enabled:true,percentBasisPoints:1000,startsAt:'1970-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'}]}:{};
  const p=customerPrice(price([{...items[0],quantity,volumeCm3:quantity===1?1:50}],customer,rates,opts));
  assert.equal(p.totalPence,p.filamentPence+p.machinePence+p.handlingPence+p.minimumAdjustmentPence-p.discountPence+p.shippingPence+p.vatPence);
 }
});
test('legacy quotes keep frozen totals and do not fabricate new charges',()=>{
 const original=price(items,customer,rates);delete original.estimate.assumptions.materialMarkupBasisPoints;original.estimate.assumptions.markupBasisPoints=5000;
 const saved=structuredClone(original),p=customerPrice(original);assert.equal(p.legacyTariff,true);assert.equal(p.estimate.hourlyRatePence,null);assert.equal(p.filamentPence,null);assert.equal(p.totalPence,saved.totalPence);assert.deepEqual(original,saved);noPrivate(p);
});
test('quote API and customer email do not disclose manufacturing costs',async()=>{
 const service=makeService({store:new MemoryStore(),paypal:new FakePayPal(),env:{...env,PRINT_SERVICE_ENABLED:'false',PRINT_PREVIEW_ENABLED:'true',PRINT_PREVIEW_ACCESS_CODE:'private-test-access-code'},rates,verifyHuman:async()=>{}});
 const q=await service.create(pack(),{...customer,testAccessCode:'private-test-access-code'},'');noPrivate(q.price);noPrivate(service.config());
 const mail=emailFor('quote',{...q,customer,price:price(items,customer,rates)},{siteUrl:'https://example.test/private',operator:env.PRINT_OPERATOR_EMAIL});noPrivate(mail);
});
