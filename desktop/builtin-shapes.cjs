const fs=require('node:fs'),path=require('node:path');
function builtinShapeReader(directory){
 let index;
 return (id,connected)=>{
  if(typeof id!=='string'||!/^[ra]-\d{3}$/.test(id)||typeof connected!=='boolean')throw Error('Invalid built-in piece');
  index??=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8'));
  const entry=index[id];if(!entry)throw Error('Unknown built-in piece');
  const shape=connected?entry.connected:entry.raw,offset=entry.file?(connected?entry.raw.length:0):entry.offset+(connected?entry.raw.length:0);
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(shape.length)||shape.length<1||shape.length>20000000)throw Error('Invalid asset catalogue');
  const file=entry.file?path.resolve(directory,entry.file):path.join(directory,'meshes.bin');
  if(entry.file&&!file.startsWith(path.resolve(directory)+path.sep))throw Error('Unsafe asset file path');
  const fd=fs.openSync(file,'r');
  try{const bytes=Buffer.alloc(shape.length);let read=0;while(read<bytes.length){const n=fs.readSync(fd,bytes,read,bytes.length-read,offset+read);if(!n)throw Error('Incomplete asset pack; reinstall Terrain Foundry.');read+=n;}return bytes;}
  finally{fs.closeSync(fd);}
 };
}
module.exports={builtinShapeReader};

