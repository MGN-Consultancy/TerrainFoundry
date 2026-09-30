const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const API='https://terrainfoundry-print.azurewebsites.net/api/print/';
function createPrintEstimator({userData,fetchImpl=fetch}){
 const cachePath=path.join(userData,'print-estimate-cache.json');
 async function cache(){try{return JSON.parse(await fs.readFile(cachePath,'utf8'));}catch{return {};}}
 async function save(value){await fs.mkdir(userData,{recursive:true});await fs.writeFile(cachePath,JSON.stringify(value));}
 async function request(route,body){
  let response,text;try{response=await fetchImpl(API+route,{method:body?'POST':'GET',headers:{Origin:'https://terrainfoundry.co.uk',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'});text=await response.text();}catch(cause){const error=Error('Unable to reach the pricing service. Check your connection and try again.');error.network=true;throw error;}
  if(text.length>1000000)throw Error('The pricing response was too large.');
  let value;try{value=JSON.parse(text);}catch{throw Error('The pricing service returned an invalid response.');}
  if(!response.ok){const error=Error(value.error||'The pricing service is unavailable.');error.remote=true;throw error;}
  return value;
 }
 async function config(){const saved=await cache();try{const value=await request('config');if(!Array.isArray(value.materials)||!Array.isArray(value.printers))throw Error('Pricing options are unavailable.');const fetchedAt=Date.now();await save({...saved,config:value,fetchedAt});return {...value,cached:false,fetchedAt};}catch(error){if(!error.network||!saved.config)throw error;return {...saved.config,cached:true,fetchedAt:saved.fetchedAt};}}
 async function measure(files){
  if(!Array.isArray(files)||files.length>180)throw Error('Split this scene into smaller print packs: the website accepts at most 180 files, including notices and project files.');
  let total=0;const entries=new Map();for(const f of files){if(!f||!(/^[a-zA-Z0-9_.-]+$/).test(f.name)||(typeof f.data!=='string'&&!(f.data instanceof Uint8Array)))throw Error('Invalid print file.');const data=Buffer.from(f.data);total+=data.length;if(total>160*1024*1024)throw Error('Split this scene into smaller print packs.');entries.set(f.name,data);}
  const csv=entries.get('quantities.csv');if(!csv)throw Error('Missing quantities.');const rows=csv.toString('utf8').trim().split(/\r?\n/);if(rows.shift()!=='Piece,File,Quantity,Width_mm,Depth_mm,Height_mm')throw Error('Invalid quantities.');
  const {inspectSTL}=await import('./print-geometry.mjs');let copies=0,triangles=0;const seen=new Set();
  const items=rows.map(row=>{const cols=row.split(','),file=cols[1],quantity=Number(cols[2]);if(cols.length!==6||!Number.isSafeInteger(quantity)||quantity<1||!file.endsWith('.stl')||seen.has(file)||!entries.has(file))throw Error('Invalid part quantities.');seen.add(file);copies+=quantity;if(copies>500)throw Error('Estimate at most 500 printed pieces at a time.');const bytes=entries.get(file),mesh=inspectSTL(bytes,[1000,1000,1000]);triangles+=mesh.triangles;if(triangles>600000)throw Error('Split this detailed scene into smaller print packs.');return {file,quantity,volumeCm3:mesh.volumeCm3,surfaceCm2:mesh.surfaceCm2,sizeMm:mesh.sizeMm,sha256:createHash('sha256').update(bytes).digest('hex')};});
  if(!items.length||items.length>180)throw Error('Estimate between 1 and 180 unique shapes.');return items;
 }
 async function estimate(files,selection){
  const items=await measure(files);if(!selection||typeof selection!=='object')throw Error('Choose print options.');
  const clean={};for(const key of ['material','printer','colour','country','discountCode']){if(typeof selection[key]!=='string'||selection[key].length>64)throw Error('Invalid print option.');clean[key]=selection[key];}
  const body={items,selection:clean},key=createHash('sha256').update(JSON.stringify(body)).digest('hex'),saved=await cache();
  try{const result=await request('estimate',body);if(!Number.isSafeInteger(result.price?.totalPence)||result.price.currency!=='GBP')throw Error('Invalid estimate response.');const estimates={...(saved.estimates||{}),[key]:result};while(Object.keys(estimates).length>10)delete estimates[Object.keys(estimates)[0]];await save({...saved,estimates});return {...result,cached:false};}
  catch(error){if(!error.network||!saved.estimates?.[key])throw error;return {...saved.estimates[key],cached:true};}
 }
 return {config,estimate,measure};
}
module.exports={createPrintEstimator};
