import test from 'node:test';
import assert from 'node:assert/strict';
import {fulfilment} from '../src/fulfilment.mjs';
import {quoted,env} from './helpers.mjs';
import {quotePath} from '../src/service.mjs';
test('operator-only paid order transitions notify customer without changing payment state',async()=>{
 const f=await quoted(),ops=fulfilment({...f,env});
 const secret=new URL(ops.url(f.quote.id)).hash.split('.')[1];
 await assert.rejects(ops.get(f.quote.id,f.secret),/Invalid workshop/);
 await assert.rejects(ops.get(f.quote.id,secret),/Only verified/);
 const q=await f.store.get(quotePath(f.quote.id));q.status='paid';q.captureId='CAPTURE';q.sandbox=false;await f.store.put(quotePath(q.id),q);
 await assert.rejects(ops.update(q.id,secret,{status:'shipped'}),/Move orders/);
 assert.equal((await ops.update(q.id,secret,{status:'in-progress'})).status,'in-progress');
 assert.equal((await ops.update(q.id,secret,{status:'shipped',tracking:'Royal Mail ABC123'})).tracking,'Royal Mail ABC123');
 await assert.rejects(ops.update(q.id,secret,{status:'in-progress'}),/Move orders/);
 const saved=await f.store.get(quotePath(q.id));assert.equal(saved.status,'paid');assert.equal(saved.email.inProgress.pending,true);assert.equal(saved.email.shipped.pending,true);
 saved.status='payment-review';await f.store.put(quotePath(q.id),saved);await assert.rejects(ops.get(q.id,secret),/Only verified/);
});
test('test orders never qualify for production even with a capture',async()=>{
 const f=await quoted(),ops=fulfilment({...f,env}),secret=new URL(ops.url(f.quote.id)).hash.split('.')[1];
 const q=await f.store.get(quotePath(f.quote.id));q.status='paid';q.captureId='TEST';q.preview=true;await f.store.put(quotePath(q.id),q);await assert.rejects(ops.get(q.id,secret),/Only verified/);
});
