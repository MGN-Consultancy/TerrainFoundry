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
 // The launcher owns update checks. Refresh the in-memory catalogue after an
 // explicit activation in Settings, without polling or downloading here.
 window.addEventListener('premium-assets-changed',async()=>{try{const inventory=await loadPremiumInventory(kit);onChange();if(inventory.warnings.length)toast(inventory.warnings[0],true);}catch(e){toast(e.message,true);}});
}
export function schedulePremiumPackSync({api,onUpdated=()=>{},onError=()=>{},delayMs=1800}){
 if(typeof api?.premiumSync!=='function')return null;
 let timer,finish;
 const done=new Promise(resolve=>{finish=resolve;timer=setTimeout(async()=>{try{const result=await api.premiumSync();if(result?.updated)onUpdated(result);resolve(result);}catch(error){onError(error);resolve(null);}},delayMs);});
 return {done,cancel(){clearTimeout(timer);finish(null);}};
}
