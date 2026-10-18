import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {adaptScenerySTL,sceneryAdapterSpec,scenerySpecForDesign} from '../desktop/scenery-adapter.mjs';
import {sceneryCandidateMatches} from '../desktop/scenery-adapter.mjs';
import {socketBase} from '../src/openlock-build.js';

const wasm=await Module();wasm.setup();
function fixture(axis='y'){
  const points=[[0,0,0],[12,0,0],[0,4,0],[0,0,7]],faces=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]],bytes=Buffer.alloc(284);
  bytes.writeUInt32LE(4,80);
  faces.forEach((face,i)=>face.forEach((index,j)=>{const p=points[index],value=axis==='y'?p:[p[0],-p[2],p[1]];value.forEach((n,k)=>bytes.writeFloatLE(n,96+i*50+j*12+k*4));}));
  return bytes;
}
function solid(bytes){
  const values=[];for(let i=0;i<bytes.readUInt32LE(80);i++)for(let j=0;j<3;j++){const at=96+i*50+j*12;values.push(bytes.readFloatLE(at),bytes.readFloatLE(at+8),-bytes.readFloatLE(at+4));}
  const mesh=new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(values),triVerts:Uint32Array.from({length:values.length/3},(_,i)=>i),tolerance:.00005});mesh.merge();return new wasm.Manifold(mesh);
}
const options=(gridWidth,gridDepth)=>({gridWidth,gridDepth,heightMm:24,openlock:true,sourceUpAxis:'y'});
test('client vendor geometry runtime works without development packages or source fallbacks',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'tf-scenery-runtime-'));
  try{
    const vendor=path.join(folder,'vendor');await fs.mkdir(vendor);
    await fs.writeFile(path.join(folder,'package.json'),JSON.stringify({type:'module'}));
    for(const file of ['scenery-adapter.mjs','print-geometry.mjs'])await fs.copyFile(new URL('../desktop/'+file,import.meta.url),path.join(folder,file));
    for(const file of ['manifold.js','manifold.wasm'])await fs.copyFile(new URL('../node_modules/manifold-3d/'+file,import.meta.url),path.join(vendor,file));
    for(const file of ['openlock-build.js','openlock-profile.js','official-socket-data.js'])await fs.copyFile(new URL('../src/'+file,import.meta.url),path.join(vendor,file));
    await fs.copyFile(new URL('../scripts/clean-mesh-data.mjs',import.meta.url),path.join(vendor,'clean-mesh-data.mjs'));
    const code=`import {adaptScenerySTL} from ${JSON.stringify(pathToFileURL(path.join(folder,'scenery-adapter.mjs')).href)};const result=await adaptScenerySTL(Buffer.from(${JSON.stringify(fixture().toString('base64'))},'base64'),${JSON.stringify(options(2,3))});process.stdout.write(JSON.stringify({sizeMm:result.sizeMm,status:result.validation.adapterStatus}));`;
    const child=spawnSync(process.execPath,['--input-type=module','--eval',code],{cwd:folder,encoding:'utf8',timeout:30000});
    assert.equal(child.status,0,child.stderr||child.error?.message);
    assert.deepEqual(JSON.parse(child.stdout),{sizeMm:[50.8,76.2,24],status:'completed'});
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('requested joining datum takes precedence and a previous connectorless result does not block OpenLOCK',()=>{
  const design={gridWidth:2,gridDepth:3,heightMm:24,openlock:true,scenery:{connectorSystem:'none',floorDatumMm:0}};
  assert.equal(scenerySpecForDesign(design).floorDatumMm,8);
  assert.equal(scenerySpecForDesign({...design,floorDatumMm:8,scenery:{connectorSystem:'openlock',floorDatumMm:0}}).floorDatumMm,8);
  assert.throws(()=>scenerySpecForDesign({...design,floorDatumMm:7}),/8 mm joining datum/);
});

test('1x1,2x2,2x3 use exact licensed connector bases and a single requested total height',async()=>{
  for(const [width,depth]of [[1,1],[2,2],[2,3]]){
    const raw=fixture(),before=Buffer.from(raw),result=await adaptScenerySTL(raw,options(width,depth));
    assert.deepEqual(raw,before);
    assert.deepEqual(result.sizeMm,[width*25.4,depth*25.4,24].map(n=>+n.toFixed(3)));
    assert.equal(result.validation.physicalFitVerified,false);
    assert.equal(result.metadata.openlock.status,'completed');
    const design={gridWidth:width,gridDepth:depth,heightMm:24,openlock:true};
    assert.equal(sceneryCandidateMatches(design,{validation:result.validation}),true);
    assert.equal(sceneryCandidateMatches({...design,gridWidth:width+1},{validation:result.validation}),false);
    assert.equal(sceneryCandidateMatches(design,{validation:{status:'needs-print-review'}}),false);
    const actual=solid(result.bytes),spec={width:width*25.4,depth:depth*25.4,ports:result.metadata.openlock.ports};
    const expected=socketBase(wasm,spec),cube=wasm.Manifold.cube([spec.width,8,spec.depth],true),clip=cube.translate([0,4,0]),lower=actual.intersect(clip),missing=expected.subtract(lower),extra=lower.subtract(expected);
    try{
      assert.equal(actual.status(),'NoError');
      const parts=actual.decompose();assert.equal(parts.length,1);parts.forEach(part=>part.delete());
      assert.ok(Math.abs(missing.volume())<.005,'All production base material retained');
      assert.ok(Math.abs(extra.volume())<.005,'Actual production socket cavities stay empty');
      assert.deepEqual(result.metadata.openlock.ports.map(({x,z})=>[x,z]),[[spec.width/2,0],[-spec.width/2,0],[0,spec.depth/2],[0,-spec.depth/2]]);
      await assert.rejects(adaptScenerySTL(result.bytes,options(width,depth)),/retained provider source/);
    }finally{for(const part of [actual,expected,cube,clip,lower,missing,extra])part.delete();}
  }
});

test('asymmetric Y-up and Z-up input produce the same final print geometry',async()=>{
  const a=await adaptScenerySTL(fixture('y'),options(2,3)),b=await adaptScenerySTL(fixture('z'),{...options(2,3),sourceUpAxis:'z'});
  const left=solid(a.bytes),right=solid(b.bytes),difference=left.subtract(right);
  try{assert.ok(Math.abs(difference.volume())<.005);assert.deepEqual(a.sizeMm,b.sizeMm);}finally{left.delete();right.delete();difference.delete();}
  const plain=await adaptScenerySTL(fixture('z'),{...options(2,3),sourceUpAxis:'z',openlock:false});
  assert.deepEqual(plain.sizeMm,[50.8,76.2,24]);assert.deepEqual(plain.metadata.openlock,{requested:false});
});

test('invalid dimensions, malformed triangles and open source meshes fail before usable output',async()=>{
  for(const patch of [{gridWidth:1.5},{gridDepth:Infinity},{gridMm:20},{heightMm:8},{sourceUpAxis:'x'},{floorDatumMm:9}])assert.throws(()=>sceneryAdapterSpec({...options(1,1),...patch}));
  const bad=fixture();bad.writeFloatLE(NaN,96);await assert.rejects(adaptScenerySTL(bad,options(1,1)),/invalid coordinates/);
  const open=fixture().subarray(0,234);open.writeUInt32LE(3,80);await assert.rejects(adaptScenerySTL(open,options(1,1)),/open or non-manifold/);
  const excess=Buffer.alloc(84);excess.writeUInt32LE(600001,80);await assert.rejects(adaptScenerySTL(excess,options(1,1)),/Invalid scenery STL/);
});
