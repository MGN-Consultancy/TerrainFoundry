// Matches the full-detail scenery reader's maximum binary STL size.
const MAX_EXPORT_FILE_BYTES=130000000;
function validateExportFiles(files){
 if(!Array.isArray(files)||files.length<1||files.length>1000)throw Error('Invalid export.');
 const names=new Set();for(const f of files){
  if(!f||typeof f.name!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,150}$/.test(f.name)||names.has(f.name.toLowerCase())||(typeof f.data!=='string'&&!(f.data instanceof Uint8Array)))throw Error('Invalid print pack file.');
  const size=typeof f.data==='string'?Buffer.byteLength(f.data,'utf8'):f.data.byteLength;if(size>MAX_EXPORT_FILE_BYTES)throw Error('A print pack file exceeds 130 MB.');names.add(f.name.toLowerCase());
 }
 return files;
}
module.exports={validateExportFiles,MAX_EXPORT_FILE_BYTES};
