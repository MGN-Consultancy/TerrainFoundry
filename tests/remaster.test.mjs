import test from 'node:test';
import assert from 'node:assert/strict';
import {CURVE_KIT} from '../src/curve-kit.js';
import {DUNGEON_RANGE_KIT} from '../src/dungeon-range-kit.js';
import {KIT,defaults,piece,validateProject} from '../src/model.js';
import {geometry,connectionSpec} from '../src/geometry.js';
import {connectionReport,worldPorts} from '../src/connections.js';
import {materialProfile} from '../src/material-profiles.js';
import {snapPlacement} from '../src/socket-snap.js';
test('every rounded floor has a labelled wall companion in the same family and radius',()=>{
 for(const f of DUNGEON_RANGE_KIT.filter(k=>k.category==='Floors'&&['quarter','arc-strip'].includes(k.shape))){const wall=CURVE_KIT.find(w=>w.matches.includes(f.id));assert.ok(wall,f.id);assert.equal(wall.radius,f.width);assert.equal(wall.innerDepth,f.depth);if(f.width!==f.depth)continue;
  const p=defaults();p.items=[piece(f.id,0,0),piece(wall.id,.25,.25)];const report=connectionReport(p);assert.ok(report.matches.length>=1,f.id+' meets '+wall.id);assert.equal(report.overlaps.length,0,f.id+' bases do not overlap');
 }
});
test('every style has a wide two-tile-radius wall and a gentle 45 degree section',()=>{
 for(const family of new Set(CURVE_KIT.map(k=>k.family))){for(const sweep of [45,90])assert.ok(CURVE_KIT.some(k=>k.family===family&&k.sweep===sweep&&k.radius===101.6),family);}
});
test('gentle sections snap together at 45 degrees without overlapping bases',()=>{
 const type=CURVE_KIT.find(k=>k.family==='Fortress'&&k.sweep===45).id,p=defaults(),a=piece(type,0,0),b=piece(type,0,0,315);const end=worldPorts(a).find(q=>q.roll===90&&q.nx<-.1),start=worldPorts(b).find(q=>q.roll===90&&q.y===end.y&&q.nx*end.nx+q.nz*end.nz<-.999);assert.ok(start);b.x=(end.x-start.x)/25.4;b.z=(end.z-start.z)/25.4;p.items=[a,b];const report=connectionReport(p);assert.equal(report.matches.length,2);assert.equal(report.overlaps.length,0);p.items=[a];const snapped=snapPlacement(p,type,{x:b.x+.1,z:b.z+.1,y:0});assert.equal(snapped.rotation,315);assert.ok(Math.abs(snapped.x-b.x)<.001);assert.deepEqual(validateProject({...p,items:[a,b]}).items,[a,b]);
});
test('grass and planting contain real raised geometry and retain four original sockets',()=>{
 for(const [id,minHeight]of [['o-grass',8.5],['o-daisies',9.5],['o-shrubs',14],['o-mixed',14],['o-tufts',10]]){const g=geometry(id,25.4,{},true);g.computeBoundingBox();assert.ok(g.boundingBox.max.y>minHeight,id);assert.equal(connectionSpec(id).ports.length,4);g.dispose();}
});
test('the full built-in library receives an offline material remaster; imports retain their own finish',()=>{
 for(const k of KIT)assert.notEqual(materialProfile(k.id),'imported');assert.equal(materialProfile('u-owned-mesh'),'imported');assert.equal(materialProfile('o-daisies'),'grass');assert.equal(materialProfile('n-wall'),'rock');assert.equal(materialProfile('w-oak'),'foliage');
});
