import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentTests,paymentTestPath} from '../src/payment-test.mjs';
import {PayPal} from '../src/paypal.mjs';
import {quoted,env} from './helpers.mjs';
import {quotePath} from '../src/service.mjs';
const code='private-test-code-12345';
async function setup(){const f=await quoted(),q=await f.store.get(quotePath(f.quote.id));
 const config={...env,PAYPAL_ENV:'live',PAYPAL_TEST_WEBHOOK_ID:'test-hook',PRINT_PAYMENT_TEST_ENABLED:'true',PRINT_PAYMENT_TEST_CODE:code,PRINT_PAYMENT_TEST_EXPIRES:'2099-01-01T00:00:00Z',PRINT_OPERATOR_EMAIL:q.customer.email};
 const create=f.paypal.create.bind(f.paypal);f.paypal.create=async(...args)=>{const o=await create(...args);o.links[0].href=o.links[0].href.replace('www.sandbox.paypal.com','www.paypal.com');return o;};
 return {...f,q,config,tests:paymentTests({...f,env:config})};}
test('10p payment settles only the separate test record, never the print quote or workshop',async()=>{
 const f=await setup();const original=structuredClone(f.q);await f.tests.start(f.q,code,'https://example.test/return');await f.tests.start(f.q,code,'https://example.test/return');assert.equal(f.paypal.creates,1);
 const record=await f.store.get(paymentTestPath(f.q.id));assert.equal(record.price.totalPence,10);assert.equal(record.id,'test-'+f.q.id);
 f.paypal.orders.get(record.paypalOrderId).status='APPROVED';assert.equal((await f.tests.reconcile(f.q.id,true)).status,'paid');await f.tests.reconcile(f.q.id,true);assert.equal(f.paypal.captures,1);
 const parent=await f.store.get(quotePath(f.q.id));assert.deepEqual(parent.price,original.price);assert.equal(parent.status,original.status);assert.equal(parent.email.workshop,undefined);assert.equal(parent.paymentTestReceipt.amountPence,10);assert.equal(parent.email.paymentTestCustomer.pending,true);assert.equal((await f.store.get(paymentTestPath(f.q.id))).email,undefined);
});
test('wrong code, other customer, expired code, disabled mode and sandbox fail closed',async()=>{
 const f=await setup();await assert.rejects(f.tests.start(f.q,'wrong','https://example.test'),/unavailable/);
 await assert.rejects(f.tests.start({...f.q,customer:{...f.q.customer,email:'stranger@example.test'}},code,'https://example.test'),/unavailable/);
 for(const change of [{PRINT_PAYMENT_TEST_ENABLED:'false'},{PAYPAL_ENV:'sandbox'},{PRINT_PAYMENT_TEST_EXPIRES:'2020-01-01T00:00:00Z'},{PAYPAL_CLIENT_SECRET:''}])await assert.rejects(paymentTests({...f,env:{...f.config,...change}}).start(f.q,code,'https://example.test'),/not configured/);
 assert.equal(f.paypal.creates,0);
});
test('webhook validates signature and cannot turn a refund into a paid print order',async()=>{
 const f=await setup();await f.tests.start(f.q,code,'https://example.test');const q=await f.store.get(paymentTestPath(f.q.id));f.paypal.orders.get(q.paypalOrderId).status='APPROVED';
 const event={event_type:'CHECKOUT.ORDER.APPROVED',resource:{id:q.paypalOrderId}};f.paypal.validWebhook=false;await assert.rejects(f.tests.webhook(new Headers(),event),/Invalid/);f.paypal.validWebhook=true;await f.tests.webhook(new Headers(),event);assert.equal((await f.store.get(paymentTestPath(f.q.id))).status,'paid');
 await f.tests.webhook(new Headers(),{event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{supplementary_data:{related_ids:{order_id:q.paypalOrderId}}}});assert.equal((await f.tests.reconcile(f.q.id,true)).status,'payment-review');assert.equal((await f.store.get(quotePath(f.q.id))).status,'quoted');
});
test('PayPal request explicitly charges GBP 0.10 without shipping',async()=>{
 const f=await setup(),paypal=new PayPal(f.config);let body;paypal.call=async(path,method,value)=>{body=value;return {};};
 await paypal.create({...f.q,id:'test-'+f.q.id,paymentTest:true,price:{totalPence:10}},'https://example.test');assert.deepEqual(body.purchase_units[0].amount,{currency_code:'GBP',value:'0.10'});assert.equal(body.purchase_units[0].shipping,undefined);assert.equal(body.payment_source.paypal.experience_context.shipping_preference,'NO_SHIPPING');
});
