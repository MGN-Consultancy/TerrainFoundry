import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {readUpload} from '../src/uploads.mjs';
import {inspectPack} from '../src/geometry.mjs';
import {price,validateDiscounts,customerDetails} from '../src/pricing.mjs';
import {emailFor} from '../src/notifications.mjs';
import {details as baseDetails,MemoryStore,FakePayPal,env} from './helpers.mjs';
import {makeService} from '../src/service.mjs';
import {customerPrice} from '../src/customer-price.mjs';
import {readFileSync} from 'node:fs';
import {cube,pack} from './helpers.mjs';
const rates=JSON.parse(readFileSync(new URL('../rates.preview.json',import.meta.url),'utf8'));

test('H2S is enforced and optional primer is once per order, retained for fulfilment and emails',async()=>{
 const details={...baseDetails,material:'pla',printer:'a1',finish:'primed'};
 assert.equal(customerDetails(details,rates).printer,'h2s');
 assert.equal(customerDetails({...details,finish:undefined},rates).finish,'unprimed');
 assert.throws(()=>customerDetails({...details,finish:'free-primer'},rates),/finish/);
 const store=new MemoryStore(),service=makeService({store,paypal:new FakePayPal(),rates,env:{...env,PRINT_COMMERCIAL_RIGHTS_APPROVED:'true'},verifyHuman:async()=>{}});
 const q=await service.create(pack(),details,'human');const saved=await store.get('quotes/'+q.id+'.json');
 assert.equal(saved.customer.finish,'primed');assert.equal(q.price.primerPence,1000);assert.match(q.price.estimate.printer,/H2S/);
 const unprimed=price(q.items,{...saved.customer,finish:'unprimed'},rates);
 assert.equal(q.price.totalPence-unprimed.totalPence,1000);
 for(const kind of ['quote','paid','workshop'])assert.match(emailFor(kind,saved,{siteUrl:'https://example.test',operator:'operator@example.test'}).text,/Spray primed before posting\nSpray primer: £10.00/);
 const discounts=[{code:'FILAMENTONLY',mode:'filament-only',enabled:true,startsAt:'2026-01-01T00:00:00Z',expiresAt:'2027-10-01T00:00:00Z'}];
 const discounted=price(q.items,saved.customer,rates,{code:'FILAMENTONLY',discounts,now:Date.parse('2026-09-30')});
 assert.equal(discounted.totalPence,discounted.estimate.filamentCostPence+1000);assert.equal(discounted.shippingPence,0);
 const pub=customerPrice(discounted);assert.equal(pub.filamentPence+pub.machinePence+pub.handlingPence+pub.minimumAdjustmentPence-pub.discountPence+pub.primerPence,pub.totalPence);
 assert.equal(customerPrice({...unprimed,finish:undefined,primerPence:undefined}).primerPence,0);
});
test('Meshy and general STL uploads need no Terrain Foundry manifest and honour copies',async()=>{
 for(const uploadKind of ['meshy','other']){const files=await readUpload(cube(),{uploadKind,copies:3},'my-model.stl');const items=inspectPack(files);assert.equal(items.length,1);assert.equal(items[0].quantity,3);}
 const files=await readUpload(Buffer.from(zipSync({'one.stl':cube(),'two.stl':cube()})),{uploadKind:'other',copies:2},'models.zip');assert.equal(inspectPack(files).reduce((n,i)=>n+i.quantity,0),4);
 assert.equal(inspectPack(await readUpload(pack(),{uploadKind:'terrainfoundry'}))[0].quantity,2);
});
test('generic uploads reject executables, disguised models, nested archives and traversal',async()=>{
 for(const name of ['run.exe','script.js','model.gcode','nested.zip'])await assert.rejects(readUpload(Buffer.from(zipSync({'one.stl':cube(),[name]:strToU8('unsafe')})),{uploadKind:'other'},'models.zip'));
 await assert.rejects(readUpload(Buffer.from(zipSync({'../one.stl':cube()})),{uploadKind:'other'},'models.zip'));
 assert.throws(()=>inspectPack(new Map([['bad.stl',{name:'bad.stl',bytes:Buffer.from('<script>bad</script>')}],['quantities.csv',{name:'quantities.csv',bytes:Buffer.from('Piece,File,Quantity,Width_mm,Depth_mm,Height_mm\nBad,bad.stl,1,0,0,0')}]])));
 for(const copies of [0,501,1.5])await assert.rejects(readUpload(cube(),{uploadKind:'other',copies},'one.stl'));
});
test('filament-only promotion charges raw filament, no minimum, fees or postage',async()=>{
 const items=inspectPack(await readUpload(cube(),{uploadKind:'other',copies:2},'one.stl'));
 const discounts=[{code:'FILAMENTONLY',mode:'filament-only',enabled:true,startsAt:'2026-01-01T00:00:00Z',expiresAt:'2027-10-01T00:00:00Z'}];validateDiscounts(discounts);
 const p=price(items,{material:'pla',printer:'h2s',address:{country:'GB'}},rates,{discounts,code:'FILAMENTONLY',now:Date.parse('2026-09-30')});
 assert.equal(p.totalPence,p.estimate.filamentCostPence);assert.equal(p.shippingPence,0);assert.equal(p.minimumApplied,false);assert.ok(p.totalPence<rates.minimumPrintPence);
 const pub=customerPrice(p);assert.equal(pub.filamentPence+pub.machinePence+pub.handlingPence+pub.minimumAdjustmentPence-pub.discountPence,pub.totalPence);assert.equal(pub.discount.mode,'filament-only');
 assert.throws(()=>price(items,{material:'pla',printer:'h2s',address:{country:'GB'}},rates,{discounts,code:'FILAMENTONLY',now:Date.parse('2028-01-01')}),/expired/);
});
