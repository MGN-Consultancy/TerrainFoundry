import {InputError,LIMITS} from './geometry.mjs';
// Advisory measurements only. Paid/test quotes still independently inspect uploaded STLs.
export function estimateItems(input,buildVolume){
 if(!Array.isArray(input)||!input.length||input.length>LIMITS.files)throw new InputError('Estimate between 1 and 180 unique shapes.');
 let copies=0;const names=new Set();
 return input.map(item=>{
  if(!item||typeof item.file!=='string'||!(/^[a-zA-Z0-9_.-]{1,120}\.stl$/).test(item.file)||names.has(item.file)||!Number.isSafeInteger(item.quantity)||item.quantity<1)throw new InputError('Invalid part quantities.');
  names.add(item.file);copies+=item.quantity;if(copies>LIMITS.pieces)throw new InputError('Estimate at most 500 printed pieces at a time.');
  if(!Number.isFinite(item.volumeCm3)||item.volumeCm3<=0||item.volumeCm3>1000000||!Number.isFinite(item.surfaceCm2)||item.surfaceCm2<=0||item.surfaceCm2>10000000||!Array.isArray(item.sizeMm)||item.sizeMm.length!==3||item.sizeMm.some((n,i)=>!Number.isFinite(n)||n<=0||n>buildVolume[i]+0.01)||typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256))throw new InputError('A part is invalid or exceeds this printer’s build volume.');
  return {file:item.file,quantity:item.quantity,volumeCm3:item.volumeCm3,surfaceCm2:item.surfaceCm2,sizeMm:item.sizeMm,sha256:item.sha256};
 });
}
