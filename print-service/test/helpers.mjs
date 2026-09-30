import {zipSync,strToU8} from 'fflate';
import {readFileSync} from 'node:fs';
import {makeService} from '../src/service.mjs';
export const rates=JSON.parse(readFileSync(new URL('../rates.example.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
export const details={email:'customer@example.test',colour:'stone-grey',name:'Test Customer',line1:'1 Test Street',line2:'',city:'Test Town',region:'',postcode:'AB1 2CD',country:'GB',consent:true};
export const env={PRINT_SERVICE_ENABLED:'true',PRINT_RATES_APPROVED:'true',PRINT_TERMS_APPROVED:'true',PRINT_TOKEN_SECRET:'test-secret-only-'.repeat(4),PAYPAL_ENV:'sandbox',PAYPAL_MERCHANT_ID:'TEST-MERCHANT',PAYPAL_WEBHOOK_ID:'TEST-WEBHOOK',PAYPAL_CLIENT_ID:'test',PAYPAL_CLIENT_SECRET:'test',PRINT_SITE_ORIGIN:'https://terrainfoundry.co.uk',ACS_EMAIL_CONNECTION_STRING:'test',PRINT_EMAIL_SENDER:'test@example.test',PRINT_OPERATOR_EMAIL:'operator@example.test',TURNSTILE_SITE_KEY:'test',TURNSTILE_SECRET_KEY:'test'};
export function cube(){const p=[[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]],faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]];const b=Buffer.alloc(84+50*faces.length);b.writeUInt32LE(faces.length,80);faces.forEach((f,i)=>f.flatMap(n=>p[n]).forEach((v,j)=>b.writeFloatLE(v,84+i*50+12+j*4)));return b;}
export const csv='Piece,File,Quantity,Width_mm,Depth_mm,Height_mm\nCube,cube.stl,2,10,10,10';
export const pack=(entries={})=>Buffer.from(zipSync({'folder/cube.stl':cube(),'folder/quantities.csv':strToU8(csv),...entries}));
export class MemoryStore{
 constructor(){this.data=new Map();this.locked=new Set();}
 async init(){}
 async put(k,v){this.data.set(k,Buffer.isBuffer(v)?Buffer.from(v):structuredClone(v));}
 async get(k){return structuredClone(this.data.get(k)||null);}
 async remove(k){this.data.delete(k);}
 async *list(prefix){for(const key of this.data.keys())if(key.startsWith(prefix))yield key;}
 async lock(k,fn){if(this.locked.has(k))throw Object.assign(Error('Order busy'),{status:409});this.locked.add(k);try{return await fn(await this.get(k),v=>this.put(k,v));}finally{this.locked.delete(k);}}
 async budget(k,max){const n=this.data.get(k)||0;if(n>=max)throw Object.assign(Error('Too many quote requests'),{status:429});this.data.set(k,n+1);}
 downloadLink(k){return 'https://storage.example.test/'+k+'?private=test';}
}
export class FakePayPal{
 constructor(){this.orders=new Map();this.captures=0;this.creates=0;this.validWebhook=true;}
 async create(q){this.creates++;const id='PAYPAL-'+q.id;const order={id,status:'CREATED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token='+id}],purchase_units:[{custom_id:q.id,payee:{merchant_id:env.PAYPAL_MERCHANT_ID},amount:{currency_code:'GBP',value:(q.price.totalPence/100).toFixed(2)}}]};this.orders.set(id,order);return structuredClone(order);}
 async get(id){return structuredClone(this.orders.get(id));}
 async capture(id){this.captures++;const o=this.orders.get(id);o.status='COMPLETED';o.purchase_units[0].payments={captures:[{id:'CAPTURE-1',status:'COMPLETED',final_capture:true,amount:{...o.purchase_units[0].amount}}]};return o;}
 async verifiedEvent(){return this.validWebhook;}
}
export function fixture(){const store=new MemoryStore(),paypal=new FakePayPal();let time=Date.now();const service=makeService({store,paypal,env:{...env,PRINT_COMMERCIAL_RIGHTS_APPROVED:'true'},rates:structuredClone(rates),now:()=>time,verifyHuman:async t=>{if(t!=='human')throw Error('Invalid anti-spam token');}});return {store,paypal,service,advance:n=>time+=n};}
export async function quoted(f=fixture()){const quote=await f.service.create(pack(),details,'human');const secret=new URL(quote.url).hash.split('.')[1];return {...f,quote,secret};}
