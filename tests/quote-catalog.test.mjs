import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {KIT} from '../src/model.js';
test('quote catalogue covers registered pieces, fit tests and clip with local previews',async()=>{
 const catalog=JSON.parse(await fs.readFile(new URL('../site/terrain-catalog.json',import.meta.url),'utf8'));
 assert.equal(catalog.schema,1);
 const expected=[...KIT.map(k=>k.id),'fit-floor','fit-wall','openlock-clip'];assert.equal(Object.keys(catalog.assets).length,expected.length);
 for(const id of expected){const entry=catalog.assets[id];assert.ok(entry?.name,id);assert.ok(entry.sha256.length>0,id);assert.ok(entry.sha256.every(hash=>/^[a-f0-9]{64}$/.test(hash)),id);const image=await fs.readFile(new URL('../site/assets/terrain/'+id+'.webp',import.meta.url));assert.equal(image.toString('ascii',0,4),'RIFF',id);assert.equal(image.toString('ascii',8,12),'WEBP',id);assert.ok(image.length<50000,id);}
 for(const item of KIT)assert.equal(catalog.assets[item.id].name,item.name);
});
