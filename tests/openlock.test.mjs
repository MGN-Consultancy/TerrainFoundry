import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {KIT,defaults,piece,openlockDemo,validateProject} from '../src/model.js';
import {geometry,connectionSpec} from '../src/geometry.js';
import {meshSolid,socketCut,connectAsset} from '../src/openlock-build.js';
import {connectionReport} from '../src/connections.js';
import {printFiles} from '../src/print-pack.js';
import {snapPlacement} from '../src/socket-snap.js';
const wasm=await Module();wasm.setup();
for(const k of KIT)test(k.id+': integrated geometry is closed and declared ports are unobstructed',()=>{
 const geo=geometry(k.id,25.4,{},true),spec=connectionSpec(k.id),solid=meshSolid(wasm,geo);
 assert.equal(solid.status(),'NoError');const parts=solid.decompose();assert.equal(parts.length,1);parts.forEach(s=>s.delete());assert.ok(solid.volume()>0);
 geo.computeBoundingBox();assert.ok(Math.abs(geo.boundingBox.min.y)<.00001);if(spec.revision===3)assert.ok(spec.ports.length>0);else assert.equal(spec.ports.length,spec.kind==='floor'?4:spec.kind==='wall'?1:0);
 const cut=socketCut(wasm).translate([0,-3.5,0]).scale([.995,.995,.995]).translate([0,3.5,0]);
 for(const port of spec.ports){const transformed=cut.translate([0,-3.5,0]).rotate([port.roll||0,0,0]).rotate([0,port.angle,0]).translate([port.x,port.y??3.5,port.z]);const obstructed=solid.intersect(transformed);assert.ok(Math.abs(obstructed.volume())<.01,'port cavity is empty');obstructed.delete();transformed.delete();}
 // Independent round throat and blind-depth gauges for original Foundry Link.
 for(const port of spec.ports){for(const shape of [wasm.Manifold.cylinder(6.8,2.05,2.05,24,true).rotate([0,90,0]).translate([-3.5,3.5,0]),wasm.Manifold.cube([.5,1,1],true).translate([-7,3.5,0])]){
 const gauge=shape.translate([0,-3.5,0]).rotate([port.roll||0,0,0]).rotate([0,port.angle,0]).translate([port.x,port.y??3.5,port.z]);const hit=solid.intersect(gauge);assert.ok(Math.abs(hit.volume())<.01,'Foundry Link throat and blind depth');hit.delete();gauge.delete();shape.delete();
 }}
 cut.delete();solid.delete();geo.dispose();
});
test('matching ports respect rotation and elevation; base overlap is reported',()=>{
 const p=defaults();p.items=[piece('wall',0,0),piece('floor',0,1.25)];assert.equal(connectionReport(p).matches.length,1);assert.equal(connectionReport(p).overlaps.length,0);
 p.items[1].y=1;assert.equal(connectionReport(p).matches.length,0);
 p.items[1].y=0;p.items[1].z=0;assert.equal(connectionReport(p).overlaps.length,1);
 p.items=[piece('wall',0,0,90),piece('floor',1.25,0)];assert.equal(connectionReport(p).matches.length,1);
 const demo=connectionReport(openlockDemo());assert.equal(demo.overlaps.length,0);assert.ok(demo.matches.length>=12);
});
test('socket scaling is blocked and old projects retain plain geometry',()=>{
 assert.throws(()=>geometry('floor',30,{},true));const p=defaults();p.grid=30;assert.throws(()=>validateProject(p));delete p.connectors;assert.equal(validateProject(p).grid,30);
});
test('imported asset conversion is embedded and round-trips',()=>{
 const raw=geometry('pillar',25.4);const connected=connectAsset(wasm,raw,'Props');
 const p=defaults();const positions=Array.from(raw.attributes.position.array),colors=Array.from(raw.attributes.color.array),indices=raw.index?Array.from(raw.index.array):Array.from({length:raw.attributes.position.count},(_,i)=>i);
 p.assets={'u-column':{name:'Imported column',positions,colors,indices,connected}};p.items=[piece('u-column',0,0)];assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 const g=geometry('u-column',25.4,p.assets,true);assert.ok(g.attributes.position.count>0);g.dispose();raw.dispose();p.assets['u-column'].connected.positions[0]=NaN;assert.throws(()=>validateProject(p));
});
test('print pack contains a physical coupon, assembly checks and honest clip instructions',()=>{
 const p=defaults();p.items=[piece('floor-small',0,0),piece('floor-small',1,0)];const pack=printFiles(p),files=Object.fromEntries(pack.files.map(f=>[f.name,f.data]));
 for(const name of ['fit-floor.stl','fit-wall.stl','floor-small.stl']){const v=new DataView(files[name].buffer);assert.equal(files[name].length,84+v.getUint32(80,true)*50);}
 const report=JSON.parse(files['connections.json']);assert.equal(report.clipCount,1);assert.equal(report.physicalFitVerified,false);assert.match(files['README.txt'],/Included foundry-link-pin.stl/);assert.match(files['quantities.csv'],/fit-floor.stl,1/);
});

test('standard floors reach 8mm without stacked slabs; walls retain height and half-inch footprint',()=>{
 for(const type of ['floor','floor-small','v-stone-floor','v-timber-floor','d-floor']){const g=geometry(type,25.4,{},true);g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.y-8)<.001,type);g.dispose();}
 for(const type of ['wall','b-weathered-wall','b-timber-window','v-stone-door']){const raw=geometry(type,25.4),g=geometry(type,25.4,{},true);raw.computeBoundingBox();g.computeBoundingBox();assert.ok(Math.abs(raw.boundingBox.max.y-g.boundingBox.max.y)<.001,type);assert.equal(connectionSpec(type).depth,12.7);raw.dispose();g.dispose();}
 for(const type of ['v-roof','crate','pillar','d-tomb','d-curved-wall','d-corner']){const raw=geometry(type,25.4),g=geometry(type,25.4,{},true);raw.computeBoundingBox();g.computeBoundingBox();for(const axis of ['x','y','z'])assert.ok(Math.abs(raw.boundingBox.max[axis]-g.boundingBox.max[axis])<.001);assert.equal(connectionSpec(type).ports.length,0);raw.dispose();g.dispose();}
});
test('wall snaps and rotates to floor side without overlapping, and elevation is respected',()=>{
 const p=defaults();p.items=[piece('floor',0,0)];const target=snapPlacement(p,'wall',{x:0,z:1.5,y:0});assert.equal(target.z,1.25);assert.equal(target.rotation,180);p.items.push({...piece('wall',target.x,target.z,target.rotation),y:target.y});const report=connectionReport(p);assert.equal(report.matches.length,1);assert.equal(report.overlaps.length,0);assert.equal(snapPlacement(p,'wall',{x:0,z:-1.5,y:8}).rotation,undefined);
});


