import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {manufacturing3mf} from '../src/manufacturing.mjs';
import {readPack,inspectPack} from '../src/geometry.mjs';
import {pack,cube,quoted} from './helpers.mjs';

test('3MF contains one mesh resource per model and every quoted copy including clips',async()=>{
 const files=await readPack(pack());files.set('openlock-clip.stl',{name:'openlock-clip.stl',bytes:cube()});
 const items=[{name:'Floor & wall',file:'cube.stl',quantity:2,sizeMm:[10,10,10]},{name:'Clip',file:'openlock-clip.stl',quantity:5,sizeMm:[10,10,10]}];
 const zip=unzipSync(manufacturing3mf(files,items)),s=strFromU8(zip['3D/3dmodel.model']);
 assert.ok(zip['_rels/.rels']);assert.ok(zip['[Content_Types].xml']);
 assert.equal((s.match(/<object /g)||[]).length,2);assert.equal((s.match(/<item /g)||[]).length,7);
 assert.equal((s.match(/<vertex /g)||[]).length,16);assert.equal((s.match(/<triangle /g)||[]).length,24);
 assert.ok(s.includes('Floor &amp; wall'));assert.ok(s.includes('unit="millimeter"'));
 const transforms=[...s.matchAll(/transform="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(transforms).size,7);
});
test('ASCII meshes preserve coordinates and sit at Z zero through instance transforms',async()=>{
 const b=cube();let s='solid ascii\n';for(let i=0;i<12;i++)for(let j=0;j<3;j++)s+='vertex '+[0,1,2].map(k=>b.readFloatLE(84+i*50+12+j*12+k*4)-20).join(' ')+'\n';s+='endsolid ascii';
 const files=await readPack(pack());files.set('cube.stl',{name:'cube.stl',bytes:Buffer.from(s)});
 const result=strFromU8(unzipSync(manufacturing3mf(files,inspectPack(files)))['3D/3dmodel.model']);
 assert.ok(result.includes('x="-20"'));assert.ok(result.includes('1 0 0 0 1 0 0 0 1 20 20 20'));
});
test('stored order pack includes generated 3MF without accepting uploaded 3MF or scene content',async()=>{
 const f=await quoted(),zip=unzipSync(f.store.data.get('packs/'+f.quote.id+'.zip'));
 assert.deepEqual(Object.keys(zip).sort(),['OPEN-IN-BAMBU.3mf','WORKSHOP-README.txt','cube.stl','quantities.csv']);
 assert.equal((strFromU8(unzipSync(zip['OPEN-IN-BAMBU.3mf'])['3D/3dmodel.model']).match(/<item /g)||[]).length,2);
});
