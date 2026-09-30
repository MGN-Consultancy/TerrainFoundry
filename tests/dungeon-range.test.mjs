import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DUNGEON_RANGE_KIT as kit} from '../src/dungeon-range-kit.js';
import {rangeIndex} from '../src/dungeon-range-data.js';
import {defaults,piece,validateProject} from '../src/model.js';
import {connectionSpec} from '../src/geometry.js';
import {connectionReport,worldPorts} from '../src/connections.js';
import {footprintsOverlap} from '../src/footprints.js';
import {printFiles} from '../src/print-pack.js';

test('431 reference entries each resolve to a distinct stable original asset',async()=>{

 assert.equal(kit.length,431);assert.equal(new Set(kit.map(k=>k.id)).size,431);
 for(const [i,k]of kit.entries()){assert.equal(k.id,'r-'+String(i+1).padStart(3,'0'));assert.ok(k.name&&k.family);assert.ok(rangeIndex[k.id]?.raw.vertices>0);assert.ok(connectionSpec(k.id).ports.length>0,k.id+' has connector support');}
 assert.equal(kit.filter(k=>k.referenceCategory.startsWith('curved')).length,59);
 assert.equal(kit.filter(k=>k.referenceCategory==='column').length,36);
});
test('all new asset identities and user edits survive save/reopen',()=>{const p=defaults();p.items=kit.map((k,i)=>piece(k.id,i%20,Math.floor(i/20),i%4*90,i%3*8));assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);});
test('upright column and wall sockets match at their actual elevation',()=>{const p=defaults();p.items=[piece('r-022',0,0),piece('r-005',1.25,0)];const report=connectionReport(p);assert.equal(report.overlaps.length,0);assert.equal(report.matches.length,2);assert.deepEqual(report.matches.map(m=>m.a.y).sort((a,b)=>a-b),[12.7,38.1]);p.items[1].y=1;assert.equal(connectionReport(p).matches.length,0);assert.ok(worldPorts(p.items[0]).some(p=>p.roll===90));});
test('curved footprints leave their empty interior usable',()=>{const a=piece('r-029',0,0),b=piece('r-037',-.5,-.5);assert.equal(footprintsOverlap(a,connectionSpec(a.type),b,connectionSpec(b.type)),false);b.x=.5;b.z=.5;assert.equal(footprintsOverlap(a,connectionSpec(a.type),b,connectionSpec(b.type)),true);});
test('nominal two-square curved walls nest outside their matching floor',()=>{const p=defaults();p.items=[piece('r-041',0,0),piece('r-029',.25,.25)];assert.equal(connectionSpec('r-041').width,50.8);assert.equal(connectionSpec('r-029').width,63.5);const report=connectionReport(p);assert.equal(report.matches.length,1);assert.equal(report.overlaps.length,0);});
test('new dungeon pieces export millimetre STLs with the original connector and editable project',()=>{const p=defaults();p.items=[piece('r-022',0,0),piece('r-005',1.25,0),piece('r-100',4,0),piece('r-352',7,0)];const pack=printFiles(p);assert.equal(pack.clipQuantity,3);for(const id of ['r-022','r-005','r-100','r-352']){const file=pack.files.find(f=>f.name===id+'.stl');assert.ok(file.data.length>1000);assert.equal(file.data.length,84+new DataView(file.data.buffer).getUint32(80,true)*50);}assert.ok(pack.files.some(f=>f.name==='openlock-clip.stl'));assert.deepEqual(JSON.parse(pack.files.find(f=>f.name==='project.terrain').data),p);});


