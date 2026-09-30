const fs=require('node:fs'),path=require('node:path');
// Package locations come from the native launcher, never from renderer paths.
function createSceneryReader(root,packEnvironment=process.env.TERRAIN_ASSET_PACKS){
 const folders=packEnvironment?JSON.parse(packEnvironment):Object.fromEntries(fs.readdirSync(path.join(root,'release','asset-packs'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>[e.name,path.join(root,'release','asset-packs',e.name)]));
 const index={};for(const [pack,folder]of Object.entries(folders)){if(!/^[a-z][a-z0-9-]{0,40}$/.test(pack)||typeof folder!=='string'||!path.isAbsolute(folder))throw Error('Invalid scenery pack location');const entries=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));for(const [id,m]of Object.entries(entries)){if(Object.hasOwn(index,id))throw Error('Duplicate scenery asset');index[id]={...m,file:path.join(folder,'meshes.bin')};}}
 return (id,connected)=>{if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,80}$/.test(id)||typeof connected!=='boolean'||!Object.hasOwn(index,id))throw Error('Unknown scenery asset');const m=index[id],p=connected?m.connected:m.raw,offset=m.offset+(connected?m.raw.length:0),size=p.vertices*24+p.indices*4;if(![offset,p.length,p.vertices,p.indices].every(n=>Number.isSafeInteger(n)&&n>=0)||size!==p.length||size>32*1024*1024)throw Error('Invalid scenery index');const fd=fs.openSync(m.file,'r');try{if(offset+size>fs.fstatSync(fd).size)throw Error('Truncated scenery pack');const bytes=Buffer.alloc(size);if(fs.readSync(fd,bytes,0,size,offset)!==size)throw Error('Truncated scenery read');return {bytes,vertices:p.vertices,indices:p.indices};}finally{fs.closeSync(fd);}};
}
module.exports={createSceneryReader};

