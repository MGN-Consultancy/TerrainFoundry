import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainBatch} from '../desktop/terrain-planner.mjs';
import {validateAction,assistantContext} from '../desktop/campaign-actions.mjs';
import {createRequire} from 'node:module';
const {terrainContext}=createRequire(import.meta.url)('../desktop/campaign-terrain-context.cjs');
const inventory=[{id:'tile',widthMm:50,depthMm:50},{id:'wall',widthMm:100,depthMm:20}];
const project=()=>({version:1,name:'Table',grid:50,board:10,items:[]});
const piece=(type='tile',x=0,z=0,y=0,rotation=0)=>({type,x,z,y,rotation});
const action=(...items)=>({type:'proposeTerrain',name:'Draft',items});
test('rotated actual rectangular footprint determines bounds and keeps source unchanged',()=>{const p=project();p.board=4;const before=structuredClone(p);assert.throws(()=>terrainBatch(p,action(piece('wall',1.5,0)),inventory),/beyond/);const r=terrainBatch(p,action(piece('wall',1.5,0,0,90)),inventory);assert.equal(r.added.length,1);assert.equal(r.project.items.length,1);assert.deepEqual(p,before);assert.match(r.added[0].id,/^[a-f0-9-]+$/);});
test('non-25.4 grid collision normalization checks new against existing and new against new',()=>{const p=project();p.items=[{...piece(),id:'existing',locked:true}];assert.doesNotThrow(()=>terrainBatch(p,action(piece('tile',1)),inventory));assert.throws(()=>terrainBatch(p,action(piece('tile',.9)),inventory),/overlaps/);assert.throws(()=>terrainBatch(project(),action(piece(),piece('tile',.5)),inventory),/overlaps/);assert.doesNotThrow(()=>terrainBatch(p,action(piece('tile',0,0,8)),inventory));});
test('a failed multi-piece batch never mutates original items or locked placement',()=>{const p=project();p.items=[{...piece(),id:'fixed',locked:true}];const before=structuredClone(p);assert.throws(()=>terrainBatch(p,action(piece('tile',2),piece('tile',0)),inventory),/overlaps/);assert.deepEqual(p,before);});
test('world bounds use physical dimensions and active visible level with absolute height',()=>{const p={...project(),version:2,kind:'world',world:{widthMm:300,depthMm:200,activeLevel:'upper',levels:[{id:'upper',elevation:50,visible:true}]}};assert.throws(()=>terrainBatch(p,action(piece('tile',3,0,50)),inventory),/beyond/);assert.throws(()=>terrainBatch(p,action(piece('tile',0,0,49)),inventory),/below/);assert.equal(terrainBatch(p,action(piece('tile',0,0,50)),inventory).added[0].levelId,'upper');p.world.levels[0].visible=false;assert.throws(()=>terrainBatch(p,action(piece('tile',0,0,50)),inventory),/Show/);});
test('invalid table coordinates and metadata cannot bypass bounds or collision validation',()=>{for(const grid of [undefined,NaN,0,-1,Infinity])assert.throws(()=>terrainBatch({...project(),grid},action(piece()),inventory),/grid/);for(const board of [undefined,NaN,0,-1,Infinity])assert.throws(()=>terrainBatch({...project(),board},action(piece()),inventory),/dimensions/);assert.throws(()=>terrainBatch(project(),action(piece('missing')),inventory),/unavailable/);assert.throws(()=>terrainBatch(project(),action(piece('wall',0,0,0,45)),inventory),/placement/);assert.throws(()=>terrainBatch(project(),action(piece('tile',NaN)),inventory),/placement/);assert.throws(()=>terrainBatch(project(),action(piece()),[{id:'tile',widthMm:50,depthMm:50,footprints:[]}]),/footprint/);assert.throws(()=>terrainBatch(project(),action(piece()),[{id:'tile',widthMm:50,depthMm:50,footprints:[[[NaN,0],[1,0],[0,1]]]}]),/footprint/);});
test('convex decomposed measured polygons permit real gaps but constrain extents',()=>{const custom=[{id:'tile',widthMm:100,depthMm:100,footprints:[[[-50,-50],[-30,-50],[-30,50],[-50,50]]]}];const p=project();p.items=[{...piece(),id:'a'}];assert.doesNotThrow(()=>terrainBatch(p,action(piece('tile',1)),custom));assert.throws(()=>terrainBatch(p,action(piece('tile',0)),custom),/overlaps/);});
test('degenerate and concave footprint metadata is refused rather than misleading SAT collision checks',()=>{for(const footprint of [[[0,0],[1,0],[2,0]],[[0,0],[10,0],[5,5],[10,10],[0,10]]])assert.throws(()=>terrainBatch(project(),action(piece()),[{id:'tile',widthMm:50,depthMm:50,footprints:[footprint]}]),/footprint/);});
test('campaign action retains active terrain context and validates provisional owned IDs without mutation',()=>{const p=project(),before=structuredClone(p),proposal=action(piece());assert.equal(assistantContext({terrain:'scene'}).terrain,'scene');assert.deepEqual(validateAction(proposal,{}, {inventory}),proposal);assert.throws(()=>validateAction(action(piece('unowned')),{}, {inventory}),/Invalid terrain/);assert.deepEqual(p,before);});
test('active canvas context includes measured grid and placements while excluding file data and secrets',()=>{const p=project();p.items=[{...piece(),id:'piece',locked:true,privateKey:'secret',rawMesh:'huge mesh'}];p.assets={tile:{name:'Floor',path:'C:/private/model.stl',bytes:'private contents'}};const context=terrainContext(p,{},[{...inventory[0],name:'Known floor',category:'Floors'}]);assert.equal(context.gridMm,50);assert.equal(context.pieces[0].name,'Known floor');assert.equal(context.pieces[0].locked,true);assert.ok(!JSON.stringify(context).includes('private'));assert.ok(!JSON.stringify(context).includes('huge mesh'));assert.deepEqual(context.coordinateUnits,{x:'grid squares',z:'grid squares',y:'millimetres',rotation:'degrees'});});

// Imported geometry metadata reaches the planner without sending vertex arrays.
test('imported asset inventory measures the real scaled bounds and rejects invalid coordinates',()=>{
 const {editorInventory}=createRequire(import.meta.url)('../desktop/campaign-terrain-context.cjs');
 const values=editorInventory({grid:50.8,assets:{'u-fixture':{name:'My bridge',positions:[-10,0,-5,10,20,5],libraryId:'personal'}}});
 assert.equal(values.length,1);assert.equal(values[0].widthMm,40);assert.equal(values[0].depthMm,20);assert.equal(values[0].heightMm,40);assert.equal(values[0].connector,'unverified');assert.equal(values[0].positions,undefined);
 assert.throws(()=>editorInventory({grid:25.4,assets:{'u-fixture':{positions:[NaN,0,0]}}}),/Invalid imported/);
});


const edge=(id,x,normal,extra={})=>({id,type:'road',group:'village-stone',x,z:0,y:0,widthMm:20,normal,required:false,...extra});
const route=(id,extra={})=>({id,widthMm:50,depthMm:50,heightMm:8,sceneryMetadata:{category:'road',connectionPoints:[edge('west',-25,[-1,0]),edge('east',25,[1,0])],...extra}});
test('structured road seams use actual quarter-turn geometry and report intentional open ends',()=>{
 const p={...project(),grid:25},roads=[route('road')];const r=terrainBatch(p,action(piece('road'),piece('road',2)),roads);assert.ok(r.warnings.some(w=>w.startsWith('Open road endpoint')));assert.ok(!r.warnings.some(w=>w.includes('No structured connection points')));assert.doesNotThrow(()=>terrainBatch(p,action(piece('road',0,0,0,90),piece('road',0,-2,0,90)),roads));
});
test('structured road and river seam group, width, elevation and facing cannot silently mismatch',()=>{
 const p={...project(),grid:25};for(const bad of [{group:'other'},{widthMm:21},{type:'river'},{normal:[1,0]}]){const a=route('a'),b=route('b',{connectionPoints:[edge('west',-25,[-1,0],bad)]});assert.throws(()=>terrainBatch(p,action(piece('a'),piece('b',2)),[a,b]),/Incompatible spatial seam/);}
 assert.throws(()=>terrainBatch(p,action(piece('a'),piece('b',2,0,8)),[route('a'),route('b')]),/Incompatible spatial seam/);
});
test('required endpoints enforce a matching neighbour and stairs check absolute landing height',()=>{
 const p={...project(),grid:25},stair={id:'stairs',widthMm:50,depthMm:50,heightMm:32,sceneryMetadata:{category:'stairs',connectionPoints:[edge('upper',25,[1,0],{type:'stair-landing',group:'walkway',y:24,required:true})]}},landing={id:'landing',widthMm:50,depthMm:50,heightMm:8,sceneryMetadata:{category:'floor',connectionPoints:[edge('left',-25,[-1,0],{type:'stair-landing',group:'walkway'})]}};
 assert.throws(()=>terrainBatch(p,action(piece('stairs')),[stair,landing]),/Required spatial seam/);assert.doesNotThrow(()=>terrainBatch(p,action(piece('stairs'),piece('landing',2,0,24)),[stair,landing]));assert.throws(()=>terrainBatch(p,action(piece('stairs'),piece('landing',2,0,25)),[stair,landing]),/Incompatible spatial seam/);
});
const approach={id:'front',type:'entrance',polygon:[[-10,25],[10,25],[10,55],[-10,55]],minY:8,maxY:40};
const building={id:'house',widthMm:50,depthMm:50,heightMm:60,sceneryMetadata:{category:'building',accessConstraints:[approach]}},prop={id:'crate',widthMm:20,depthMm:20,heightMm:25,sceneryMetadata:{category:'prop'}};
test('entrance clearance rotates with the building and tests actual obstacle footprint and height',()=>{
 const p={...project(),grid:25};assert.throws(()=>terrainBatch(p,action(piece('house'),piece('crate',0,1.6)),[building,prop]),/blocks entrance/);assert.throws(()=>terrainBatch(p,action(piece('house',0,0,0,90),piece('crate',1.6,0)),[building,prop]),/blocks entrance/);assert.doesNotThrow(()=>terrainBatch(p,action(piece('house',0,0,0,90),piece('crate',0,1.6)),[building,prop]));assert.doesNotThrow(()=>terrainBatch(p,action(piece('house'),piece('crate',0,1.6,40)),[building,prop]));
 const asym={...prop,footprints:[[[20,-10],[40,-10],[40,10],[20,10]]]};assert.doesNotThrow(()=>terrainBatch(p,action(piece('house'),piece('crate',0,1.6)),[building,asym]));
});
test('new obstacles cannot block existing entrance zones but passable floors are allowed',()=>{
 const p={...project(),grid:25,items:[{...piece('house'),id:'existing'}]},before=structuredClone(p);assert.throws(()=>terrainBatch(p,action(piece('crate',0,1.6)),[building,prop]),/blocks entrance/);assert.deepEqual(p,before);assert.doesNotThrow(()=>terrainBatch(p,action(piece('crate',0,1.6)),[building,{...prop,heightMm:8,sceneryMetadata:{category:'floor'}}]));assert.throws(()=>terrainBatch(p,action(piece('crate',0,1.6)),[building,{...prop,heightMm:undefined}]),/Unknown obstacle height/);assert.throws(()=>terrainBatch(p,action(piece('crate',0,1.6,24)),[building,{...prop,heightMm:8,sceneryMetadata:{category:'floor'}}]),/blocks entrance/);
});
test('descriptive seam and entrance text never become verified structure',()=>{
 const p=project(),a={...inventory[0],sceneryMetadata:{entrances:'wide front doorway',edgeRules:'all edges fit perfectly'}};const r=terrainBatch(p,action(piece()),[a]);assert.ok(r.warnings.some(w=>w.includes('No structured connection points')));assert.ok(r.warnings.some(w=>w.includes('No structured access constraints')));assert.ok(r.warnings.some(w=>w.includes('physical connector fit remain unverified')));
});
