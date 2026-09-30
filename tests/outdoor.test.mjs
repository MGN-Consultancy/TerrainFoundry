import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import {OUTDOOR_KIT} from '../src/outdoor-kit.js';
import {outdoorDemo,validateProject} from '../src/model.js';
import {geometry,connectionSpec} from '../src/geometry.js';
import {meshSolid} from '../src/openlock-build.js';
import {connectionReport} from '../src/connections.js';
const expected={
 'o-river':['n','s'],'o-river-bend':['n','w'],'o-river-junction':['n','s','w'],'o-river-end':['n'],
 'o-river-desert':['n','s'],'o-river-desert-bend':['n','w'],'o-river-desert-junction':['n','s','w'],'o-river-desert-end':['n'],
 'o-river-transition':['n','s'],'o-bridge-wood':['n','s'],'o-bridge-stone':['n','s'],'o-oasis':[],'o-oasis-inlet':['s']
};
test('all 29 outdoor pieces retain E-sized footprints and four integrated sockets',()=>{
 assert.equal(OUTDOOR_KIT.length,29);
 for(const k of OUTDOOR_KIT){const spec=connectionSpec(k.id),g=geometry(k.id,25.4,{},true);g.computeBoundingBox();assert.equal(spec.width,50.8);assert.equal(spec.depth,50.8);assert.equal(spec.ports.length,4);assert.ok(g.boundingBox.max.x<=25.401&&g.boundingBox.min.x>=-25.401);assert.ok(g.boundingBox.max.z<=25.401&&g.boundingBox.min.z>=-25.401);g.dispose();}
});
test('river mouths share the same water height and ordinary banks meet at 8mm',()=>{
 for(const [id,mouths]of Object.entries(expected)){const g=geometry(id,25.4,{},true),p=g.attributes.position;
  for(const [edge,x,z]of [['n',0,-25.4],['s',0,25.4],['w',-25.4,0],['e',25.4,0]]){let top=-Infinity;
   for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<.001&&Math.abs(p.getZ(i)-z)<.001)top=Math.max(top,p.getY(i));
   assert.ok(Math.abs(top-(mouths.includes(edge)?7.4:8))<.002,`${id} ${edge}: ${top}`);
  }g.dispose();
 }
});
test('bridges have a real opening beneath their central deck',async()=>{
 const w=await Module();w.setup();const gauge=w.Manifold.cube([8,1,8],true).translate([0,8.6,0]);
 for(const id of ['o-bridge-wood','o-bridge-stone']){const g=geometry(id,25.4,{},true),s=meshSolid(w,g),hit=s.intersect(gauge);assert.ok(hit.volume()<.001);hit.delete();s.delete();g.dispose();}gauge.delete();
});
test('river and oasis sample saves and contains 49 matched ports with no overlaps',()=>{
 const p=outdoorDemo();assert.equal(p.items.length,30);assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const r=connectionReport(p);assert.equal(r.matches.length,49);assert.equal(r.overlaps.length,0);
});

