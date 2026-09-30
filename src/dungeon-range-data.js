import index from './generated/dungeon-range-index.json' with {type:'json'};
let bytes;
if(typeof window==='undefined'){
 const fsModule='node:fs/promises';
 const fs=await import(/* @vite-ignore */ fsModule);
 const b=await fs.readFile(new URL('../public/dungeon-range/meshes.bin',import.meta.url));
 bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}else if(!window.desktop?.readBuiltinShape){
 const response=await fetch(new URL('./dungeon-range/meshes.bin',document.baseURI));
 if(!response.ok)throw Error('The dungeon asset pack could not be loaded. Reinstall Terrain Foundry to restore it.');
 bytes=await response.arrayBuffer();
}
export const rangeIndex=index;
export function rangeData(id,connected=false){const m=index[id];if(!m)return null;let data=bytes,offset=m.offset+(connected?m.raw.length:0);if(!data){const b=window.desktop.readBuiltinShape(id,connected);data=b.buffer;offset=b.byteOffset;}const info=connected?m.connected:m.raw,n=info.vertices*3;return {positions:new Float32Array(data,offset,n),colors:new Float32Array(data,offset+n*4,n),indices:new Uint32Array(data,offset+n*8,info.indices),openlock:m.openlock};}
