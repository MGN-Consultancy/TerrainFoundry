import {createHmac,timingSafeEqual} from 'node:crypto';
import {InputError} from './geometry.mjs';
export function fulfilment({store,env=process.env,now=()=>Date.now()}){
 const token=id=>createHmac('sha256',env.PRINT_TOKEN_SECRET).update('workshop:'+id).digest('hex');
 const url=id=>env.PRINT_SITE_ORIGIN+'/workshop.html#'+id+'.'+token(id);
 const authorize=(id,secret)=>{if(!/^[a-f0-9]{32}$/.test(id||'')||!/^[a-f0-9]{64}$/.test(secret||'')||!timingSafeEqual(Buffer.from(secret),Buffer.from(token(id))))throw new InputError('Invalid workshop link.',403);};
 const check=q=>{if(!q||q.preview||q.sandbox||q.status!=='paid'||!q.captureId)throw new InputError('Only verified, paid live print orders can be managed here.',409);};
 const view=q=>({id:q.id,status:q.fulfilment?.status||'paid',tracking:q.fulfilment?.tracking||'',customer:q.customer,colour:q.colour,items:q.items});
 async function get(id,secret){authorize(id,secret);const q=await store.get('quotes/'+id+'.json');check(q);return view(q);}
 async function update(id,secret,input){authorize(id,secret);if(!['in-progress','shipped'].includes(input?.status))throw new InputError('Choose a valid order status.');
  const tracking=String(input.tracking||'').trim();if(tracking.length>200||/[\x00-\x1f]/.test(tracking))throw new InputError('Tracking details are invalid.');
  await get(id,secret);return store.lock('quotes/'+id+'.json',async(q,save)=>{check(q);const previous=q.fulfilment?.status||'paid';if(previous===input.status)return view(q);
   if((previous==='paid'&&input.status!=='in-progress')||(previous==='in-progress'&&input.status!=='shipped')||previous==='shipped')throw new InputError('Move orders from paid to in progress, then shipped.',409);
   q.fulfilment={...q.fulfilment,status:input.status,updatedAt:now(),tracking:input.status==='shipped'?tracking:''};q.email[input.status==='shipped'?'shipped':'inProgress']={pending:true};await save(q);return view(q);
  });
 }
 return {get,update,url};
}
