import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulePremiumPackSync} from '../src/premium-packs.js';

test('startup pack sync is deferred and refreshes the library only when an update was installed',async()=>{
 let calls=0,refreshed=0,errors=0;
 const scheduled=schedulePremiumPackSync({api:{premiumSync:async()=>{calls++;return {updated:2};}},delayMs:10,onUpdated:()=>refreshed++,onError:()=>errors++});
 assert.equal(calls,0,'the editor can render before checking the network');
 assert.deepEqual(await scheduled.done,{updated:2});
 assert.equal(calls,1);assert.equal(refreshed,1);assert.equal(errors,0);
});

test('startup pack sync reports failures without changing installed library state',async()=>{
 let refreshed=0,reported='';
 const scheduled=schedulePremiumPackSync({api:{premiumSync:async()=>{throw Error('offline');}},delayMs:0,onUpdated:()=>refreshed++,onError:error=>reported=error.message});
 assert.equal(await scheduled.done,null);assert.equal(refreshed,0);assert.equal(reported,'offline');
});

test('startup pack sync can be cancelled before it starts',async()=>{
 let calls=0;
 const scheduled=schedulePremiumPackSync({api:{premiumSync:async()=>{calls++;}},delayMs:20});
 scheduled.cancel();
 assert.equal(await scheduled.done,null);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(calls,0);
});
