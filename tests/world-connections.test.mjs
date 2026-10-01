import test from 'node:test';import assert from 'node:assert/strict';
import {defaults,piece} from '../src/model.js';import {toWorld} from '../src/world.js';
import {connectionReport,overlap} from '../src/connections.js';import {snapPlacement} from '../src/socket-snap.js';
test('world overlap sweep agrees with all-pairs checking for rotated and curved pieces on several elevations',()=>{
 const p=toWorld(defaults());const types=['floor','floor-small','wall','wall-low','a-001'];for(let i=0;i<150;i++)p.items.push({...piece(types[i%5],((i*17)%31-15)*.75,((i*11)%23-11)*.75,(i%8)*45,(i%3)*8),levelId:'ground'});
 const expected=[];for(let i=0;i<p.items.length;i++)for(let j=i+1;j<p.items.length;j++)if(overlap(p.items[i],p.items[j],p.assets))expected.push([p.items[i].id,p.items[j].id]);assert.deepEqual(connectionReport(p).overlaps,expected);
});
test('connector snapping remains available beyond the old encounter board on a world table',()=>{
 const p=toWorld(defaults());p.items=[{...piece('wall',20,0),levelId:'ground'}];const result=snapPlacement(p,'floor',{x:20.1,z:1.25,y:0});assert.equal(result.x,20);assert.equal(result.z,1.25);
});
