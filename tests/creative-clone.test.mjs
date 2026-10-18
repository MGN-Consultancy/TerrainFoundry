import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const {createCreativeLibrary}=createRequire(import.meta.url)('../desktop/creative-library.cjs');
const stl=name=>Buffer.from('solid '+name+'\nendsolid '+name);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-clone-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return createCreativeLibrary({directory});}

test('clone keeps the approved brief, art, pack and verified raw model without sharing IDs or remote jobs',async t=>{
 const library=await fixture(t);let source=await library.create({kind:'scenery',name:'Ruined well',packName:'Acceptance pack',design:{purpose:'other',style:'Weathered stone',gridWidth:2,gridDepth:2,heightMm:48,openlock:true}});
 const concept={id:randomUUID(),name:'Approved concept',image:'data:image/png;base64,aGVsbG8=',approved:true,retained:true,createdAt:Date.now()};
 source=await library.save({...source,description:'A stone well with a broken rim.',concepts:[concept],mainConceptId:concept.id,selectedConceptId:concept.id,references:[{type:'design-conversation',campaignId:randomUUID()}]});
 source=await library.installModel(source.id,{bytes:stl('adapted'),rawStl:stl('provider-original'),filename:'well.stl'});
 source=await library.acceptModel(source.id,source.model.id);
 const before=await library.load(source.id),copy=await library.cloneAsset(source.id,{name:'Ruined well — lower rim'});
 assert.notEqual(copy.id,source.id);assert.equal(copy.packId,source.packId);assert.equal(copy.description,source.description);assert.deepEqual(copy.design,source.design);
 assert.notEqual(copy.concepts[0].id,concept.id);assert.equal(copy.mainConceptId,copy.concepts[0].id);assert.equal(copy.concepts[0].approved,true);
 assert.equal(copy.modelJob,null);assert.equal(copy.model.accepted,false);assert.equal(copy.model.history.length,0);assert.notEqual(copy.model.id,source.model.id);
 assert.equal(copy.references.some(ref=>ref.type==='design-conversation'),false);assert.equal(copy.references.at(-1).assetId,source.id);
 const model=await library.readModelArtifacts(copy.id);assert.deepEqual(model.bytes,stl('adapted'));assert.deepEqual(model.rawStl,stl('provider-original'));
 assert.equal(digest(model.rawStl),copy.model.artifacts.find(item=>item.filename.endsWith('-raw.stl')).sha256);
 assert.deepEqual(await library.load(source.id),before,'Cloning must not edit the source or its accepted model');
 await library.save({...copy,description:'Same stone and style, lower broken rim.',design:{...copy.design,gridDepth:3}});
 assert.deepEqual(await library.load(source.id),before,'Variant adjustments stay independent');
});

test('clone selects one requested candidate and rejects damaged sources before creating a partial copy',async t=>{
 const library=await fixture(t);let source=await library.create({kind:'scenery',name:'Pillar'});
 source=await library.installModel(source.id,{bytes:stl('first'),rawStl:stl('raw-first')});const first=source.model.id;
 source=await library.installModel(source.id,{bytes:stl('second'),rawStl:stl('raw-second')});
 const copy=await library.cloneAsset(source.id,{candidateId:first});
 assert.deepEqual((await library.readModel(copy.id)).bytes,stl('first'));assert.deepEqual((await library.readModelArtifacts(copy.id)).rawStl,stl('raw-first'));
 const count=(await library.list()).length,artifact=source.model.artifacts[0];
 await fs.writeFile(path.join(await library.folder(source.id),artifact.filename),Buffer.alloc(artifact.size));
 await assert.rejects(library.cloneAsset(source.id),/checksum/);assert.equal((await library.list()).length,count);
 await assert.rejects(library.cloneAsset(source.id,{candidateId:'../model.stl'}),/identifier/);
});
