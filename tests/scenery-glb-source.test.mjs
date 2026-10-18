import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {retainedGLBGeometry} from '../desktop/scenery-glb-source.mjs';
import {inspectSTL} from '../desktop/print-geometry.mjs';

function extractTestSTL(input) {
 const geometry=retainedGLBGeometry(input);assert.ok(geometry.positions instanceof Float32Array);assert.ok(geometry.indices instanceof Uint32Array);
 const bytes=Buffer.alloc(84+geometry.indices.length/3*50);bytes.writeUInt32LE(geometry.indices.length/3,80);
 for(let i=0;i<geometry.indices.length;i++)for(let axis=0;axis<3;axis++)bytes.writeFloatLE(geometry.positions[geometry.indices[i]*3+axis],96+Math.floor(i/3)*50+(i%3)*12+axis*4);
 return {...geometry,bytes};
}

function fixture(edit=()=>{}) {
 const bin=Buffer.alloc(72),points=[0,0,0,1,0,0,0,2,0,0,0,3],indices=[0,2,1,0,1,3,0,3,2,1,2,3];
 points.forEach((n,i)=>bin.writeFloatLE(n,i*4));indices.forEach((n,i)=>bin.writeUInt16LE(n,48+i*2));
 const doc={asset:{version:'2.0'},buffers:[{byteLength:72}],bufferViews:[{buffer:0,byteOffset:0,byteLength:48},{buffer:0,byteOffset:48,byteLength:24}],accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3'},{bufferView:1,componentType:5123,count:12,type:'SCALAR'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
 edit(doc,bin);let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const bytes=Buffer.alloc(12+8+json.length+8+bin.length);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);const at=20+json.length;bytes.writeUInt32LE(bin.length,at);bytes.writeUInt32LE(0x004e4942,at+4);bin.copy(bytes,at+8);return bytes;
}
function bounds(bytes){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let f=0;f<bytes.readUInt32LE(80);f++)for(let v=0;v<3;v++)for(let axis=0;axis<3;axis++){const n=bytes.readFloatLE(96+f*50+v*12+axis*4);min[axis]=Math.min(min[axis],n);max[axis]=Math.max(max[axis],n);}return {min,max};}

test('retained embedded GLB extracts closed geometry with source provenance and unequal Y-up dimensions',()=>{
 const input=fixture(),before=Buffer.from(input),result=extractTestSTL(input);
 assert.equal(result.bytes.readUInt32LE(80),4);assert.deepEqual(bounds(result.bytes),{min:[0,0,0],max:[1,2,3]});assert.doesNotThrow(()=>inspectSTL(result.bytes,[1000,1000,1000]));assert.deepEqual(input,before);
 assert.equal(result.metadata.format,'retained-glb');assert.equal(result.metadata.sourceUpAxis,'y');assert.equal(result.metadata.sourceUnits,'metres');assert.equal(result.metadata.sourceSHA256,createHash('sha256').update(input).digest('hex'));assert.equal(result.metadata.externalResourcesFetched,false);assert.equal(result.metadata.surfaceReconstruction,false);
});
test('node transforms and mirrored winding remain closed',()=>{
 const normal=extractTestSTL(fixture(doc=>Object.assign(doc.nodes[0],{translation:[10,20,30],scale:[2,3,4]})));
 assert.deepEqual(bounds(normal.bytes),{min:[10,20,30],max:[12,26,42]});assert.doesNotThrow(()=>inspectSTL(normal.bytes,[1000,1000,1000]));
 const mirrored=extractTestSTL(fixture(doc=>Object.assign(doc.nodes[0],{translation:[10,20,30],scale:[-2,3,4]})));
 assert.deepEqual(bounds(mirrored.bytes),{min:[8,20,30],max:[10,26,42]});assert.doesNotThrow(()=>inspectSTL(mirrored.bytes,[1000,1000,1000]));
});
test('parent transforms are applied exactly once',()=>{
 const result=extractTestSTL(fixture(doc=>{doc.nodes=[{translation:[10,0,0],children:[1]},{mesh:0,translation:[0,20,0]}];}));
 assert.deepEqual(bounds(result.bytes),{min:[10,20,0],max:[11,22,3]});assert.equal(result.metadata.nodeTransforms.length,1);
});
test('invalid lengths, external resources, accessor overruns and unsupported meshes are rejected',()=>{
 const truncated=fixture().subarray(0,40);assert.throws(()=>extractTestSTL(truncated),/complete retained GLB/);
 for(const edit of [doc=>doc.asset.version='1.0',doc=>doc.animations=[{}],doc=>doc.buffers[0].uri='https://example.invalid/model.bin',doc=>doc.images=[{uri:'https://example.invalid/texture.png'}],doc=>doc.buffers[0].byteLength=60,doc=>doc.bufferViews[0].extensions={EXT_meshopt_compression:{}},doc=>doc.accessors[0].count=500,doc=>doc.accessors[1].componentType=5126,doc=>doc.nodes[0].children=[0],doc=>doc.nodes[0].scale=[0,1,1],doc=>doc.nodes[0].skin=0,doc=>doc.meshes[0].primitives[0].targets=[{POSITION:0}],doc=>doc.meshes[0].primitives[0].extensions={KHR_draco_mesh_compression:{}},(_doc,bin)=>bin.writeUInt16LE(500,48)])assert.throws(()=>extractTestSTL(fixture(edit)));
});
