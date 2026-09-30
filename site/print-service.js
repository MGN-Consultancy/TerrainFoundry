const form=document.querySelector('#print-form');
const message=document.querySelector('#print-status');
const submit=document.querySelector('#print-submit');
const base=window.TERRAIN_PRINT_API;
let config,widget;
const say=text=>{message.textContent=text;};
function closed(text){form.dataset.available='false';form.insertBefore(message,form.children[1]);say(text);}

async function api(path,options={}){
 const response=await fetch(base+'/api/print/'+path,{...options,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(120000)});
 let body;try{body=await response.json();}catch{throw Error('The print service is unavailable. Please try again later.');}
 if(!response.ok)throw Error(body.error||'Unable to complete the request.');return body;
}

async function setup(){
 if(!base){closed('Print orders are not open yet. We are preparing pricing and checkout. Your files stay on your computer until you submit an available quote request.');return;}
 try{
  const origin=new URL(base);if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Invalid service address.');
  config=await api('config');
  if(!config.enabled){closed('Paid print orders are paused while service setup is completed.');return;}
  for(const c of config.colours){const option=new Option(c.label,c.id);form.elements.colour.add(option);}
  const countries=new Intl.DisplayNames(['en-GB'],{type:'region'});for(const c of config.countries)form.elements.country.add(new Option(countries.of(c),c));
  for(const [field,choices] of [['material',config.materials||[]],['printer',config.printers||[]]]){
   document.querySelector('#'+field+'-field').hidden=!choices.length;form.elements[field].required=!!choices.length;
   for(const choice of choices)form.elements[field].add(new Option(choice.label,choice.id));
  }
  if(config.preview){const note=document.querySelector('#service-mode-note');if(note)note.textContent='Invited quote testing only. No normal payment, printing or shipping.';document.querySelector('#test-access-field').hidden=false;form.elements.testAccessCode.required=true;submit.disabled=false;submit.textContent='Get my test estimate';say(config.demo?'LOCAL DEMO — use access code LOCAL-PRINT-PREVIEW. No email is sent, no payment is taken and no files leave this computer.':'TEST ONLY — invited testing. Prices are estimates; emails are real. No payment, printing or shipping. You may use a fictitious delivery address for this test.');return;}
  if(config.demo){submit.disabled=false;say('LOCAL DEMO — example prices only. No email is sent and no payment is taken.');return;}
  window.terrainTurnstileReady=()=>{widget=window.turnstile.render('#print-antispam',{sitekey:config.turnstileSiteKey,action:'print-quote',callback:()=>{submit.disabled=false;},'expired-callback':()=>{submit.disabled=true;},'error-callback':()=>{submit.disabled=true;say('The anti-spam check could not load. Please refresh and try again.');}});};
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=terrainTurnstileReady&render=explicit';script.async=true;script.onerror=()=>say('The anti-spam check could not load. Please try again later.');document.head.append(script);
  say(config.sandbox?'SANDBOX — test orders only. PayPal sandbox accounts are required.':'Ready for your print pack. Your quote is free; payment is a separate step.');
 }catch(error){say(error.message);}
}
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(!config?.enabled)return;
 const file=form.elements.pack.files[0];const terrain=form.elements.uploadKind.value==='terrainfoundry';if(!file||!(terrain?/\.zip$/i:/\.(stl|zip)$/i).test(file.name))return say(terrain?'Choose your Terrain Foundry print-pack ZIP.':'Choose an STL model or a ZIP containing STL files.');
 if(file.size>config.maxUploadBytes)return say('Choose an upload smaller than 40 MB.');
 const details=Object.fromEntries(new FormData(form));delete details.pack;details.consent=form.elements.consent.checked;
 const body=new FormData();body.set('pack',file);body.set('details',JSON.stringify(details));body.set('cf-turnstile-response',config.preview?'':config.demo?'demo':window.turnstile.getResponse(widget));
 submit.disabled=true;document.querySelector('#print-progress').hidden=false;say('Uploading and checking your models and quantities…');
 try{const result=await api('quotes',{method:'POST',body});const url=new URL(result.url);if(![location.origin,'https://terrainfoundry.co.uk'].includes(url.origin)||url.pathname!=='/print-order.html')throw Error('Invalid quote address.');location.assign(url.href);}
 catch(error){say(error.message);if(config.demo||config.preview)submit.disabled=false;else window.turnstile.reset(widget);}
 finally{document.querySelector('#print-progress').hidden=true;}
});
if(form)setup();


if(form){const updateUpload=()=>{const terrain=form.elements.uploadKind.value==='terrainfoundry';form.elements.pack.value='';form.elements.pack.accept=terrain?'.zip':'.stl,.zip';document.querySelector('#copies-field').hidden=terrain;document.querySelector('#pack-help').textContent=terrain?'Terrain Foundry: upload the exported ZIP with its quantity list. Maximum 40 MB.':'Upload an STL, or a ZIP containing only STL models. For Meshy, choose Export → STL and set the size in millimetres. Copies applies to each STL in the ZIP. Maximum 40 MB.';};form.elements.uploadKind.addEventListener('change',updateUpload);}
