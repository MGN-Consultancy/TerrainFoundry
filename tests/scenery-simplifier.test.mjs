import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Module from 'manifold-3d';
import {prepareScenerySolid,needsScenerySimplification} from '../desktop/scenery-simplifier.mjs';
import {sceneryAdapterSpec} from '../desktop/scenery-adapter.mjs';
const wasm=await Module();wasm.setup();
function bytesFromMesh(mesh){
 const bytes=Buffer.alloc(84+mesh.triVerts.length/3*50);bytes.writeUInt32LE(mesh.triVerts.length/3,80);
 for(let i=0;i<mesh.triVerts.length;i++)for(let k=0;k<3;k++)bytes.writeFloatLE(mesh.vertProperties[mesh.triVerts[i]*mesh.numProp+k],96+Math.floor(i/3)*50+(i%3)*12+k*4);
 return bytes;
}
const spec=sceneryAdapterSpec({gridWidth:1,gridDepth:1,heightMm:24,openlock:true,sourceUpAxis:'y'});
test('dense retained closed scenery simplifies offline within physical error bounds and preserves source',async()=>{
 const sphere=wasm.Manifold.sphere(1,768),raw=bytesFromMesh(sphere.getMesh());sphere.delete();
 const before=crypto.createHash('sha256').update(raw).digest('hex');assert.equal(needsScenerySimplification(raw),true);
 const result=await prepareScenerySolid(raw,spec,wasm);
 try{
  assert.equal(result.solid.status(),'NoError');assert.ok(result.solid.numTri()<=280000);
  assert.ok(result.metadata.toleranceMm>0);assert.ok(result.metadata.toleranceMm<=.0254);
  assert.equal(result.metadata.holeFilling,false);assert.equal(result.metadata.componentPruning,false);
  assert.equal(result.metadata.sourceComponents,result.metadata.outputComponents);
  assert.equal(result.metadata.physicalFitVerified,false);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),before);
  assert.ok(Math.abs(result.solid.boundingBox().max[1]-24)<.00001);
 }finally{result.solid.delete();}
});
test('open, invalid, truncated, or already adapted geometry never produces a fake fitted solid',async()=>{
 const cube=wasm.Manifold.cube([3,4,5]),raw=bytesFromMesh(cube.getMesh());cube.delete();
 const open=Buffer.from(raw.subarray(0,raw.length-50));open.writeUInt32LE(open.readUInt32LE(80)-1,80);
 await assert.rejects(prepareScenerySolid(open,spec,wasm),/closed, outward|Not manifold/);
 await assert.rejects(prepareScenerySolid(raw.subarray(0,100),spec,wasm),/complete binary/);
 const invalid=Buffer.from(raw);invalid.writeFloatLE(NaN,96);await assert.rejects(prepareScenerySolid(invalid,spec,wasm),/invalid coordinates/);
 const adapted=Buffer.from(raw);adapted.write('Terrain Foundry deterministic scenery adapter');await assert.rejects(prepareScenerySolid(adapted,spec,wasm),/retained provider source/);
});
