import test from 'node:test';import assert from 'node:assert/strict';
import {makeService} from '../src/service.mjs';import {inspectPack,readPack} from '../src/geometry.mjs';import {price} from '../src/pricing.mjs';
import {rates,env,details,pack,MemoryStore,FakePayPal} from './helpers.mjs';
test('advisory desktop measurements use the same price as the website upload without creating orders',async()=>{
 const store=new MemoryStore(),paypal=new FakePayPal(),service=makeService({store,paypal,rates,env:{...env,PRINT_PREVIEW_ENABLED:'true',PRINT_PREVIEW_ACCESS_CODE:'test-access-123456789'},verifyHuman:async()=>{}});
 const items=inspectPack(await readPack(pack()),rates.buildVolumeMm),selection={country:'GB',colour:details.colour,discountCode:''};const result=await service.estimate({items,selection});
 assert.deepEqual(result.price,price(items,{address:{country:'GB'}},rates));assert.equal(result.preview,true);assert.equal(paypal.orders.size,0);assert.equal([...store.data.keys()].filter(k=>k.startsWith('quotes/')||k.startsWith('packs/')).length,0);
 await assert.rejects(service.estimate({items:[{...items[0],volumeCm3:NaN}],selection}),/invalid/);
 await assert.rejects(service.estimate({items:[{...items[0],quantity:501}],selection}),/500/);
 await assert.rejects(service.estimate({items:[{...items[0],sizeMm:[1000,1,1]}],selection}),/build volume/);
});
