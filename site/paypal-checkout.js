window.TerrainPayPal=(()=>{
 let loading;
 function load(clientId){
  if(!clientId)return Promise.reject(Error('PayPal is not configured.'));
  if(!loading)loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');const query=new URLSearchParams({'client-id':clientId,currency:'GBP',intent:'capture',components:'buttons','disable-funding':'card,credit,paylater,venmo'});
   script.src='https://www.paypal.com/sdk/js?'+query;script.referrerPolicy='no-referrer';
   const timeout=setTimeout(()=>{loading=null;script.remove();reject(Error('PayPal could not load. Please reload the page.'));},20000);
   script.onload=()=>{clearTimeout(timeout);resolve(window.paypal);};script.onerror=()=>{clearTimeout(timeout);loading=null;reject(Error('PayPal could not load. Please reload the page.'));};document.head.append(script);
  });return loading;
 }
 async function render(host,clientId,{create,approve,message}){
  try{const sdk=await load(clientId);if(!host.isConnected)return;
   await sdk.Buttons({fundingSource:sdk.FUNDING.PAYPAL,style:{layout:'vertical',color:'gold',shape:'rect',label:'paypal',height:40,tagline:false},
    createOrder:async()=>{try{return await create();}catch(e){message(e.message);throw e;}},
    onApprove:async()=>{try{await approve();}catch(e){message(e.message);}},
    onCancel:()=>message('PayPal checkout cancelled. No new payment confirmed.'),
    onError:()=>message('PayPal could not complete checkout. Check your code or reload and try again.')
   }).render(host);
  }catch(e){message(e.message);}
 }
 return {render};
})();
