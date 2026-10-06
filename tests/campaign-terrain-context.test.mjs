import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {terrainContext}=createRequire(import.meta.url)('../desktop/campaign-terrain-context.cjs');
test('placed encounters retain identity, levels and piece positions without sending meshes or file paths',()=>{
 const p={name:'Village',kind:'world',grid:25.4,items:[{id:'door',type:'wb-001',x:5,z:9,y:100,rotation:90,levelId:'hill',encounterId:'tavern'}],assets:{hidden:{vertices:[1,2,3],path:'C:/secret'}},world:{widthMm:1800,depthMm:900,levels:[{id:'hill',name:'Hill',elevation:100,visible:true}],instances:[{id:'tavern',name:'Hilltop tavern'}],encounters:[{id:'template',scene:{name:'Tavern template',items:[{id:'original',type:'wb-001',x:0,z:0,y:0,rotation:0}]}}]}};
 const c=terrainContext(p,{id:'world-link',kind:'world'});assert.equal(c.instances[0].name,'Hilltop tavern');assert.equal(c.instances[0].bounds.minY,100);assert.equal(c.pieces[0].encounterId,'tavern');assert.equal(c.encounterTemplates[0].pieces[0].x,0);assert.equal(c.pieces[0].x,5);assert.doesNotMatch(JSON.stringify(c),/secret|vertices/);
});
