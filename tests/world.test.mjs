import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,piece,validateProject} from '../src/model.js';
import {toWorld,addEncounter,placeEncounter,selectionItems,transformSelection,extractEncounter,extractLevel,tableSize,visibleItem} from '../src/world.js';
const scene=()=>{const p=defaults();p.name='3 by 2 building';p.items=[piece('floor',-2,-1),piece('floor',0,-1),piece('floor',2,-1),piece('floor',-2,1),piece('floor',0,1),piece('floor',2,1),piece('wall',0,-2.25),piece('crate',0,0,0,8)];return p;};
test('legacy scenes still open; rectangular worlds round trip with their reusable scenes',()=>{
 const old=scene();assert.equal(validateProject(old).version,1);const w=toWorld(defaults());assert.deepEqual(tableSize(w),[1828.8,1219.2]);assert.equal(w.version,2);const e=addEncounter(w,old);placeEncounter(w,e.id,20,10);assert.equal(w.items.length,8);assert.equal(w.world.instances[0].templateId,e.id);const saved=JSON.stringify(w);old.items[0].x=999;const restored=validateProject(JSON.parse(saved));assert.equal(restored.world.encounters[0].scene.items[0].x,-2);assert.equal(restored.items[0].x,18);
});
test('encounters rotate, move and rise as a group without changing the saved template',()=>{
 const w=toWorld(defaults()),e=addEncounter(w,scene());placeEncounter(w,e.id,12,0);const first=w.items[0],second=w.items[1],old={...first},before={...second};transformSelection(w,first,{...first,x:first.x+5,z:first.z+3,y:50.8,rotation:90});assert.equal(first.x,old.x+5);assert.equal(second.x,first.x+before.z-old.z);assert.equal(second.z,first.z-(before.x-old.x));assert.equal(second.y,50.8);assert.equal(w.items.at(-1).y,58.8);assert.equal(e.scene.items[0].y,0);assert.equal(selectionItems(w,first).length,8);assert.deepEqual(validateProject(w),w);
});
test('levels keep relative prop heights and can be hidden without removing data',()=>{
 const w=toWorld(defaults());w.world.levels.push({id:'village',name:'Village',elevation:101.6,visible:true});w.world.activeLevel='village';const e=addEncounter(w,scene());placeEncounter(w,e.id,0,0);assert.equal(w.items[0].y,101.6);assert.equal(w.items.at(-1).y,109.6);assert.equal(w.items[0].levelId,'village');w.world.levels[1].visible=false;assert.equal(visibleItem(w,w.items[0]),false);assert.equal(validateProject(w).items.length,8);assert.throws(()=>placeEncounter(w,e.id,0,0),/Show the active level/);
});
test('saving an encounter from an elevated world normalises it for reuse',()=>{
 const w=toWorld(defaults()),e=addEncounter(w,scene());placeEncounter(w,e.id,20,10);transformSelection(w,w.items[0],{...w.items[0],y:100});const out=extractEncounter(w,w.items[0]);assert.equal(out.version,1);assert.equal(out.kind,undefined);assert.equal(out.items.at(-1).y,8);assert.equal(out.items[0].encounterId,undefined);assert.equal(out.items[0].levelId,undefined);assert.equal(out.items.length,8);assert.equal(out.name,scene().name);
});
test('invalid worlds, nested worlds and incompatible scene settings are rejected',()=>{
 const w=toWorld(defaults()),bad=structuredClone(w);bad.world.widthMm=NaN;assert.throws(()=>validateProject(bad));bad.world.widthMm=1000;bad.world.activeLevel='missing';assert.throws(()=>validateProject(bad));assert.throws(()=>addEncounter(w,w),/not another world/);const plain=scene();plain.connectors='none';assert.throws(()=>addEncounter(w,plain),/must match/);const e=addEncounter(w,scene());assert.throws(()=>placeEncounter(w,e.id,1000,1000),/beyond/);assert.equal(w.items.length,0);
});
test('failed group height transform is atomic',()=>{const w=toWorld(defaults()),e=addEncounter(w,scene());placeEncounter(w,e.id,0,0);const before=JSON.stringify(w);assert.throws(()=>transformSelection(w,w.items[0],{...w.items[0],y:-1}));assert.equal(JSON.stringify(w),before);});
test('an entire level can be saved as a reusable village scene',()=>{const w=toWorld(defaults()),e=addEncounter(w,scene());placeEncounter(w,e.id,-8,0);placeEncounter(w,e.id,8,0);const output=extractLevel(w);assert.equal(output.items.length,16);assert.ok(output.items.every(i=>!i.encounterId&&!i.levelId));assert.equal(output.name,'Untitled dungeon · Ground');assert.deepEqual(validateProject(output),output);});
test('different imported geometry with the same asset ID is retained in each placement',()=>{
 const a=scene();a.assets={'u-mesh':{name:'Mesh A',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],colors:Array(9).fill(1)}};a.items.push(piece('u-mesh',0,0));const b=structuredClone(a);b.assets['u-mesh'].name='Mesh B';b.assets['u-mesh'].positions[3]=2;const w=toWorld(defaults()),one=addEncounter(w,a),two=addEncounter(w,b);placeEncounter(w,one.id,-10,0);placeEncounter(w,two.id,10,0);placeEncounter(w,two.id,20,0);assert.equal(Object.keys(w.assets).length,2);const imported=w.items.filter(i=>i.type.startsWith('u-'));assert.notEqual(imported[0].type,imported[1].type);assert.equal(w.assets[imported[0].type].positions[3],1);assert.equal(w.assets[imported[1].type].positions[3],2);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(w))),w);
});

test('version-1 files cannot masquerade as worlds',()=>{const w=toWorld(defaults());w.version=1;assert.throws(()=>validateProject(w),/version 2/);});
