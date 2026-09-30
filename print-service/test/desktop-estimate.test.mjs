import {customerPrice} from '../src/customer-price.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {makeService} from '../src/service.mjs';import {inspectPack,readPack} from '../src/geometry.mjs';import {price} from '../src/pricing.mjs';
import {rates,env,details,pack,MemoryStore,FakePayPal} from './helpers.mjs';
test('advisory desktop measurements use the same price as the website upload without creating orders',async()=>{
 const store=new MemoryStore(),paypal=new FakePayPal(),service=makeService({store,paypal,rates,env:{...env,PRINT_PREVIEW_ENABLED:'true',PRINT_PREVIEW_ACCESS_CODE:'test-access-123456789'},verifyHuman:async()=>{}});
 const items=inspectPack(await readPack(pack()),rates.buildVolumeMm),selection={country:'GB',colour:details.colour,discountCode:''};const result=await service.estimate({items,selection});
 assert.deepEqual(result.price,customerPrice(price(items,{address:{country:'GB'}},rates)));assert.equal(result.preview,true);assert.equal(paypal.orders.size,0);assert.equal([...store.data.keys()].filter(k=>k.startsWith('quotes/')||k.startsWith('packs/')).length,0);
 await assert.rejects(service.estimate({items:[{...items[0],volumeCm3:NaN}],selection}),/invalid/);
 await assert.rejects(service.estimate({items:[{...items[0],quantity:501}],selection}),/500/);
 await assert.rejects(service.estimate({items:[{...items[0],sizeMm:[1000,1,1]}],selection}),/build volume/);
});
test('estimate client limits are independent and apply before price calculation',async()=>{
 const store=new MemoryStore(),service=makeService({store,paypal:new FakePayPal(),rates,env:{...env,PRINT_PREVIEW_ENABLED:'true',PRINT_PREVIEW_ACCESS_CODE:'test-access-123456789'},verifyHuman:async()=>{}});
 const input={items:inspectPack(await readPack(pack()),rates.buildVolumeMm),selection:{country:'GB',colour:details.colour,discountCode:''}};
 for(let i=0;i<60;i++)await service.estimate(input,'198.51.100.1');
 await assert.rejects(service.estimate(input,'198.51.100.1'),e=>e.status===429);
 assert.equal((await service.estimate(input,'198.51.100.2')).price.currency,'GBP');
});
