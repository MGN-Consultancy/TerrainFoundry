import {InputError,LIMITS,readPack} from './geometry.mjs';
// Supported inputs are geometry only. No external links, scripts, G-code or
// third-party project loaders are executed, and archives never reach the disk.
export async function readUpload(buffer,details,filename='pack.zip'){
 const kind=details.uploadKind||'terrainfoundry';
 if(!['terrainfoundry','meshy','other'].includes(kind))throw new InputError('Choose an upload type.');
 if(buffer.length>LIMITS.upload)throw new InputError('Upload a file smaller than 40 MB.');
 if(kind==='terrainfoundry')return readPack(buffer);
 const count=Number(details.copies??1);
 if(!Number.isSafeInteger(count)||count<1||count>LIMITS.pieces)throw new InputError('Choose between 1 and 500 copies of each model.');
 let files;
 if(/\.stl$/i.test(filename))files=new Map([['uploaded-model.stl',{name:'uploaded-model.stl',bytes:buffer}]]);
 else if(/\.zip$/i.test(filename))files=await readPack(buffer,{strictModels:true});
 else throw new InputError('Export your model as STL, or upload a ZIP containing STL models.');
 files.delete('quantities.csv');
 if(!files.size||files.size*count>LIMITS.pieces)throw new InputError('Upload between 1 and 500 total model copies.');
 const rows=['Piece,File,Quantity,Width_mm,Depth_mm,Height_mm'];
 for(const {name} of files.values())rows.push(`Model ${rows.length},${name},${count},0,0,0`);
 files.set('quantities.csv',{name:'quantities.csv',bytes:Buffer.from(rows.join('\n'))});return files;
}
