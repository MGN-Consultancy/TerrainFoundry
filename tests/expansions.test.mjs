import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {EXPANSION_KIT} from '../src/expansion-kit.js';
import {expansionDemo,validateProject} from '../src/model.js';
import {geometry,connectionSpec} from '../src/geometry.js';
import {meshSolid} from '../src/openlock-build.js';
import {connectionReport} from '../src/connections.js';
const w=await Module();w.setup();
test('51 expansions have real sockets beneath attached sculpts, not floating socket metadata',()=>{
 assert.equal(EXPANSION_KIT.length,51);
 for(const k of EXPANSION_KIT){const g=geometry(k.id,25.4,{},true),s=meshSolid(w,g),spec=connectionSpec(k.id);
  assert.ok(spec.ports.length>0,k.id);
  for(const p of spec.ports){const roof=w.Manifold.cube([3,.4,10],true).translate([-4,6.8,0]).rotate([0,p.angle,0]).translate([p.x,0,p.z]);const hit=s.intersect(roof);assert.ok(hit.volume()>10,k.id+' has material over its socket');roof.delete();hit.delete();}
  s.delete();g.dispose();
 }
});
test('castle, quarry and trap examples round-trip and connect without footprint overlap',()=>{
 for(const prefix of ['c-','q-','t-']){const p=expansionDemo(prefix);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const r=connectionReport(p);assert.equal(r.overlaps.length,0,prefix);assert.ok(r.matches.length>=10,prefix);}
});
test('portcullis, arrow slit and castle window retain actual openings',()=>{
 for(const [id,size,y]of [['c-gate',[2,5,20],14],['c-slit',[2,12,20],28],['c-window',[10,10,20],27]]){const g=geometry(id,25.4,{},true),s=meshSolid(w,g),probe=w.Manifold.cube(size,true).translate([0,y,0]),hit=s.intersect(probe);assert.ok(hit.volume()<.01,id);hit.delete();probe.delete();s.delete();g.dispose();}
});
