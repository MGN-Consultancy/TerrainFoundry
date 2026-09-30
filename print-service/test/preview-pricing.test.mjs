import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {price,validateDiscounts} from '../src/pricing.mjs';
import {makeService,quotePath} from '../src/service.mjs';import {emailFor,processNotifications} from '../src/notifications.mjs';
import {rates,details,env,MemoryStore,FakePayPal,pack} from './helpers.mjs';
const now=Date.parse('2026-09-30T12:00:00Z');
const promo={code:'TEST10',enabled:true,percentBasisPoints:1000,startsAt:'2026-09-01T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z'};
const items=[{file:'floor.stl',sha256:'a'.repeat(64),quantity:10,volumeCm3:50,surfaceCm2:100},{file:'wall.stl',sha256:'b'.repeat(64),quantity:10,volumeCm3:25,surfaceCm2:80}];
const customer={...details,address:{country:'GB'}};
test('parts discounts exclude setup and shipping and tax follows reduced total',()=>{
 const tariff={...rates,vatBasisPoints:2000};const before=price(items,customer,tariff),after=price(items,customer,tariff,{code:' test10 ',discounts:[promo],now});
 assert.equal(after.discountPence,Math.floor(before.partsPence*.1));assert.equal(after.shippingPence,before.shippingPence);assert.equal(after.setupPence,before.setupPence);
 assert.equal(after.vatPence,Math.round((after.printPence+after.shippingPence)*.2));assert.equal(after.totalPence,after.printPence+after.shippingPence+after.vatPence);
});
test('discount scope, cap, expiry and minimum charge are enforced server-side',()=>{
 const scoped={...promo,sha256:['a'.repeat(64)],maximumDiscountPence:100};const q=price(items,customer,rates,{code:'TEST10',discounts:[scoped],now});assert.equal(q.discountPence,100);
 assert.throws(()=>price(items,customer,rates,{code:'TEST10',discounts:[promo],now:Date.parse(promo.expiresAt)}),/expired/);
 assert.throws(()=>price(items,customer,rates,{code:'TEST10',discounts:[{...promo,sha256:['c'.repeat(64)]}],now}),/requirements/);
 const low=[{file:'floor.stl',quantity:1,volumeCm3:1,surfaceCm2:6}];assert.throws(()=>price(low,customer,rates,{code:'TEST10',discounts:[promo],now}),/minimum/);
 const full=price(items,customer,rates,{code:'TEST10',discounts:[{...promo,percentBasisPoints:10000}],now});assert.ok(full.printPence>=rates.minimumPrintPence);assert.equal(full.shippingPence,rates.shipping.GB.pence);
 assert.throws(()=>validateDiscounts([promo,promo]),/Invalid/);
});
const estimateRates=JSON.parse(fs.readFileSync(new URL('../rates.preview.json',import.meta.url),'utf8'));
test('PLA/PETG estimates use supplied material costs, printer rate and disclosed assumptions',()=>{
 const a=price(items,{...customer,material:'pla',printer:'a1'},estimateRates);const b=price(items,{...customer,material:'petg',printer:'h2s'},estimateRates);
 assert.equal(a.estimate.assumptions.materialPencePerKg,1200);assert.equal(b.estimate.assumptions.materialPencePerKg,1600);
 assert.equal(a.estimate.filamentCostPence,Math.ceil(a.estimate.lines.reduce((n,l)=>n+l.grams,0)*1.2));
 assert.equal(a.estimate.machineCostPence,Math.ceil(a.estimate.lines.reduce((n,l)=>n+l.hours,0)*150));assert.ok(a.estimate.estimated);assert.match(a.estimate.notice,/not a Bambu Studio slice/);
});
function preview(){const store=new MemoryStore(),paypal=new FakePayPal(),settings={...env,PRINT_SERVICE_ENABLED:'false',PRINT_COMMERCIAL_RIGHTS_APPROVED:'false',PRINT_PREVIEW_ENABLED:'true',PRINT_PREVIEW_ACCESS_CODE:'private-test-access-code'};const service=makeService({store,paypal,env:settings,rates,discounts:[promo],now:()=>now,verifyHuman:async()=>{throw Error('Must use test invitation instead');}});return {store,paypal,env:settings,service};}
test('preview reaches idempotent test request without commercial permission or payment access',async()=>{
 const f=preview();assert.equal(f.service.config().enabled,true);assert.equal(f.service.config().preview,true);
 await assert.rejects(f.service.create(pack(),details,''),/private test access/);
 const q=await f.service.create(pack(),{...details,testAccessCode:f.env.PRINT_PREVIEW_ACCESS_CODE},'');const token=q.url.split('.')[q.url.split('.').length-1];
 await assert.rejects(f.service.checkout(q.id,token),/disabled/);await assert.rejects(f.service.confirm(q.id,token),/disabled/);await assert.rejects(f.service.reconcile(q.id,true),/never be paid/);
 assert.equal((await f.service.requestTestOrder(q.id,token)).status,'test-requested');assert.equal((await f.service.requestTestOrder(q.id,token)).status,'test-requested');assert.equal(f.paypal.orders.size,0);
 const stored=await f.store.get(quotePath(q.id));assert.equal(stored.email.workshop,undefined);assert.equal(stored.email.testOperator.pending,true);
 const mail=emailFor('testOperator',stored,{operator:env.PRINT_OPERATOR_EMAIL,siteUrl:q.url});assert.match(mail.subject,/TEST ONLY/);assert.match(mail.text,/Do not print or ship/);assert.doesNotMatch(mail.text,/pay securely/);
 let sent=0;await processNotifications({...f,emailClient:{async beginSend(message){assert.equal(message.replyTo[0].address,env.PRINT_OPERATOR_EMAIL);sent++;return {toString:()=>'{"id":"test"}',pollUntilDone:async()=>({status:'Succeeded',id:'test'})};}}});assert.equal(sent,3);
});
test('test quotes cannot be paid even after enabling a future live service',async()=>{
 const f=preview(),q=await f.service.create(pack(),{...details,testAccessCode:f.env.PRINT_PREVIEW_ACCESS_CODE},''),token=new URL(q.url).hash.split('.')[1];
 const live=makeService({...f,env:{...env,PRINT_COMMERCIAL_RIGHTS_APPROVED:'true'},rates,verifyHuman:async()=>{}});
 await assert.rejects(live.checkout(q.id,token),/never be paid/);await assert.rejects(live.confirm(q.id,token),/never be paid/);
});
