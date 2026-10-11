import {clearConnectedGeometry} from './geometry.js';
import {builtinIndex,clearBuiltinData} from './builtin-data.js';
export async function loadPremiumInventory(kit){
 if(!window.desktop?.premiumInventory)return {packs:[],assets:[],warnings:[]};
 const inventory=await window.desktop.premiumInventory();clearBuiltinData(inventory.assets.map(a=>a.id));clearConnectedGeometry(inventory.assets.map(a=>a.id));
 for(const asset of inventory.assets){
  const existing=kit.find(k=>k.id===asset.id);if(existing&&!existing.premium)throw Error('Premium asset conflicts with installed free scenery.');
  builtinIndex[asset.id]={raw:asset.raw,connected:asset.connected,openlock:asset.openlock,dimensionsMm:asset.dimensionsMm,printFiles:asset.printFiles,premium:true};
  const definition={id:asset.id,name:asset.name,category:asset.category,subcategory:asset.subcategory,hint:asset.hint,explicitCategory:true,premium:true,...(asset.design?{design:asset.design}:{})};if(existing)Object.assign(existing,definition);else kit.push(definition);
 }
 return inventory;
}
export function setupPremiumPacks({kit,onChange,toast}){
 if(!window.desktop?.premiumOpen)return;
 const button=document.createElement('button');button.id='premium-packs';button.className='full';button.textContent='Activate purchased scenery…';button.title='Download a purchased pack using the code in your email. Installed scenery works offline.';document.getElementById('expand-library').before(button);
 const status=document.createElement('p');status.id='premium-update-status';status.className='premium-update-status';status.setAttribute('role','status');button.after(status);
 const updates=document.createElement('button');updates.type='button';updates.className='full';updates.textContent='Check purchased updates';status.after(updates);
 let checking=false;
 async function sync(){if(checking||!window.desktop.premiumSync)return;checking=true;updates.disabled=true;status.textContent='Checking purchased scenery…';try{const result=await window.desktop.premiumSync();if(result.updated){await loadPremiumInventory(kit);onChange();status.textContent=`Updated ${result.updated} scenery sections · ${(result.downloadedBytes/1048576).toFixed(1)} MB downloaded`;toast('Your purchased scenery has been updated.');}else status.textContent=result.checked?'Purchased scenery is up to date.':'';}catch(error){status.textContent='Purchased updates unavailable · installed scenery remains available offline.';status.title=error.message;}finally{checking=false;updates.disabled=false;}}
 window.desktop.onPremiumUpdateProgress?.(progress=>{if(checking)status.textContent=progress.stage+(progress.total?` · ${progress.completed} / ${progress.total} files`: '');});updates.onclick=sync;setTimeout(()=>void sync(),1000);
 button.onclick=async()=>{button.disabled=true;try{await window.desktop.premiumOpen();const inventory=await loadPremiumInventory(kit);onChange();if(inventory.warnings.length)toast(inventory.warnings[0],true);}catch(e){toast(e.message,true);}finally{button.disabled=false;}};
}
