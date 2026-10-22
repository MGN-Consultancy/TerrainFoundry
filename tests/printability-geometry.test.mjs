import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{stlToPrintGLB,glbToSTL}=require('../desktop/printability-geometry.cjs');
const points=[[10,20,30],[35.4,20,30],[10,70.8,42.7]];
function binary(vertices=points,{header='binary fixture',count=1}={}){const bytes=Buffer.alloc(84+50*count);bytes.write(header);bytes.writeUInt32LE(count,80);for(let i=0;i<count;i++)for(let vertex=0;vertex<3;vertex++)for(let axis=0;axis<3;axis++)bytes.writeFloatLE(vertices[vertex][axis],84+50*i+12+vertex*12+axis*4);return bytes;}
function ascii(vertices=points){return Buffer.from('solid printable\nfacet normal 0 0 1\nouter loop\n'+vertices.map(p=>'vertex '+p.join(' ')).join('\n')+'\nendloop\nendfacet\nendsolid printable\n');}
function unpack(result){const bytes=result.bytes;assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.toString('ascii',16,20),'JSON');const jsonLength=bytes.readUInt32LE(12),document=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),header=20+jsonLength;assert.equal(bytes.toString('ascii',header+4,header+8),'BIN\0');const binLength=bytes.readUInt32LE(header),data=bytes.subarray(header+8);assert.equal(binLength,data.length);assert.equal(data.length,document.buffers[0].byteLength);const positions=[];for(let at=0;at<data.length;at+=12)positions.push([data.readFloatLE(at),data.readFloatLE(at+4),data.readFloatLE(at+8)]);return {document,positions};}
const close=(actual,expected,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('binary STL dimensions remain millimeters while GLB uses meters and rotates Z-up into glTF Y-up',()=>{
 const source=binary(),before=Buffer.from(source),result=stlToPrintGLB(source),{document,positions}=unpack(result);assert.deepEqual(source,before);assert.equal(result.sourceSHA256,createHash('sha256').update(source).digest('hex'));result.sizeMm.forEach((n,i)=>close(n,[25.4,50.8,12.7][i]));close(result.heightMm,12.7);close(result.longestMm,50.8);positions.forEach((p,i)=>p.forEach((n,axis)=>close(n,[points[i][0]/1000,points[i][2]/1000,-points[i][1]/1000][axis],1e-8)));assert.deepEqual(document.nodes,[{mesh:0}]);assert.equal(document.meshes[0].primitives[0].mode,4);assert.equal(document.accessors[0].count,3);assert.equal(document.accessors[0].componentType,5126);assert.equal(document.buffers[0].uri,undefined);assert.equal(JSON.stringify(document).includes('http'),false);assert.equal(result.modelUrl,'data:model/gltf-binary;base64,'+result.bytes.toString('base64'));
});
test('Y-up option preserves orientation and computes height from native Y axis',()=>{
 const result=stlToPrintGLB(ascii(),{sourceUpAxis:'y'}),{positions,document}=unpack(result);close(result.heightMm,50.8);close(result.longestMm,50.8);positions.forEach((p,i)=>p.forEach((n,axis)=>close(n,points[i][axis]/1000,1e-8)));const min=positions[0].map((_,axis)=>Math.min(...positions.map(p=>p[axis]))),max=positions[0].map((_,axis)=>Math.max(...positions.map(p=>p[axis])));assert.deepEqual(document.accessors[0].min,min);assert.deepEqual(document.accessors[0].max,max);max.forEach((n,i)=>close((n-min[i])*1000,result.sizeMm[i]));
});
test('binary exact byte length is checked before misleading solid header',()=>{
 const source=binary(points,{header:'solid deceptively ascii-looking header'}),result=stlToPrintGLB(source);assert.equal(unpack(result).positions.length,3);close(result.heightMm,12.7);
});
test('ASCII supports finite signed/exponent values, multiple solids and whitespace without changing source bytes',()=>{
 const one=Buffer.from(ascii([[-10,20,30],[35.4,20,30],[-10,70.8,42.7]]).toString().replace('vertex -10 20 30','vertex -1.0e1 +2E1 3e+1')),source=Buffer.concat([one,Buffer.from('\n\t'),one]),before=Buffer.from(source),result=stlToPrintGLB(source);assert.equal(unpack(result).positions.length,6);assert.deepEqual(source,before);close(result.sizeMm[0],45.4);assert.equal(unpack(result).document.accessors[0].count,6);
});
test('Uint8Array slices and ArrayBuffer inputs honor their actual byte range',()=>{
 const source=binary(),wrapped=Buffer.concat([Buffer.from([3,4]),source,Buffer.from([5,6])]),view=new Uint8Array(wrapped.buffer,wrapped.byteOffset+2,source.length);assert.equal(stlToPrintGLB(view).sourceSHA256,stlToPrintGLB(source).sourceSHA256);const copy=Uint8Array.from(source);assert.equal(stlToPrintGLB(copy.buffer).sourceSHA256,stlToPrintGLB(source).sourceSHA256);
});
test('empty, truncated, trailing binary bytes, malformed ASCII and nontriangular facets are rejected',()=>{
 const quad=ascii().toString().replace('endloop','vertex 1 2 3\nendloop');for(const source of [Buffer.alloc(0),binary().subarray(0,90),Buffer.concat([binary(),Buffer.from([0])]),Buffer.from('solid empty\nendsolid empty\n'),Buffer.from(quad),Buffer.from(ascii().toString().replace('endfacet','badfacet')),Buffer.from('junk'),binary([[0,0,0],[0,0,0],[0,0,0]])])assert.throws(()=>stlToPrintGLB(source));assert.throws(()=>stlToPrintGLB(binary(),{sourceUpAxis:'x'}));assert.throws(()=>stlToPrintGLB('not bytes'));
});
test('NaN and infinity normals or vertices are rejected in binary and ASCII',()=>{
 const normal=binary();normal.writeFloatLE(NaN,84);for(const source of [normal,binary([[NaN,0,0],[1,1,1],[2,2,2]]),binary([[Infinity,0,0],[1,1,1],[2,2,2]]),Buffer.from(ascii().toString().replace('normal 0 0 1','normal 0 0 1e999')),Buffer.from(ascii().toString().replace('vertex 10 20 30','vertex NaN 20 30')),ascii([[1e100,0,0],[1,1,1],[2,2,2]])])assert.throws(()=>stlToPrintGLB(source),/finite|represented|Invalid ASCII/);
});
test('input size and triangle count limits reject before generating output',()=>{
 assert.throws(()=>stlToPrintGLB(Buffer.alloc(100*1024*1024+1)),/100 MiB/);const bytes=Buffer.alloc(84+50*2000001);bytes.writeUInt32LE(2000001,80);assert.throws(()=>stlToPrintGLB(bytes),/two-million/);
});
test('GLB output and JSON chunks have correct four-byte padding and no external data',()=>{
 const {bytes,modelUrl}=stlToPrintGLB(ascii());assert.equal(bytes.length%4,0);assert.equal(bytes.readUInt32LE(12)%4,0);assert.deepEqual(Buffer.from(modelUrl.slice(modelUrl.indexOf(',')+1),'base64'),bytes);const {document}=unpack({bytes});assert.equal(document.scene,0);assert.deepEqual(document.scenes,[{nodes:[0]}]);assert.equal(document.buffers.length,1);assert.equal(document.bufferViews.length,1);assert.equal(document.accessors.length,1);assert.equal(document.meshes.length,1);
});
test('repaired GLB converts back to Y-up millimeter STL with preserved orientation, dimensions and source bytes',async()=>{
 const original=ascii(),glb=stlToPrintGLB(original),before=Buffer.from(glb.bytes),result=await glbToSTL(glb.bytes);assert.equal(result.sourceUpAxis,'y');assert.equal(result.bytes.length,134);assert.equal(result.bytes.readUInt32LE(80),1);assert.deepEqual(glb.bytes,before);assert.equal(result.sourceSHA256,createHash('sha256').update(glb.bytes).digest('hex'));result.sizeMm.forEach((n,i)=>close(n,[25.4,12.7,50.8][i]));close(result.heightMm,12.7);close(result.longestMm,50.8);for(let corner=0;corner<3;corner++){const values=[points[corner][0],points[corner][2],-points[corner][1]];for(let axis=0;axis<3;axis++)close(result.bytes.readFloatLE(96+corner*12+axis*4),values[axis]);}
 const roundtrip=unpack(stlToPrintGLB(result.bytes,{sourceUpAxis:'y'})).positions,source=unpack(glb).positions;roundtrip.forEach((p,i)=>p.forEach((n,axis)=>close(n,source[i][axis],1e-8)));const normal=[0,4,8].map(offset=>result.bytes.readFloatLE(84+offset));close(Math.hypot(...normal),1,1e-6);
});
test('GLB conversion rejects external buffers and malformed geometry without network access',async()=>{
 const glb=stlToPrintGLB(ascii());await assert.rejects(glbToSTL(Buffer.alloc(0)),/nonempty/);await assert.rejects(glbToSTL(glb.bytes.subarray(0,-4)),/complete retained GLB/);
 const {document}=unpack(glb);document.buffers[0].uri='https://example.invalid/model.bin';const json=Buffer.from(JSON.stringify(document)),jsonLength=(json.length+3)&~3,oldHeader=20+glb.bytes.readUInt32LE(12),bin=glb.bytes.subarray(oldHeader+8),bytes=Buffer.alloc(28+jsonLength+bin.length,0x20);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(jsonLength,12);bytes.write('JSON',16);json.copy(bytes,20);const at=20+jsonLength;bytes.writeUInt32LE(bin.length,at);bytes.write('BIN\0',at+4);bin.copy(bytes,at+8);await assert.rejects(glbToSTL(bytes),/external files are never fetched/);
});
