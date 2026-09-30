import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {geometry} from '../src/geometry.js';
import {meshSolid} from '../src/openlock-build.js';
import {caveDemo,validateProject} from '../src/model.js';
import {connectionReport} from '../src/connections.js';
import {printFiles} from '../src/print-pack.js';
test('cave entrances have usable through openings above floor height',async()=>{
 const wasm=await Module();wasm.setup();
 for(const [id,width]of [['n-entrance',25],['n-entrance-wide',40]]){
  const geo=geometry(id,25.4,{},true),solid=meshSolid(wasm,geo);
  const gauge=wasm.Manifold.cube([width,25,20],true).translate([0,21,0]);
  const hit=solid.intersect(gauge);assert.ok(hit.volume()<.001,id);hit.delete();gauge.delete();solid.delete();geo.dispose();
 }
});
test('cavern example saves and exports with matching floor-wall connections and clips',()=>{
 const p=caveDemo(),report=connectionReport(p);assert.equal(p.items.length,21);assert.equal(report.overlaps.length,0);assert.equal(report.matches.length,24);
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const pack=printFiles(p);assert.equal(pack.clipQuantity,25);assert.ok(pack.files.some(f=>f.name==='n-entrance.stl'));
});
