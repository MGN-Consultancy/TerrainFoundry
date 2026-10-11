import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {zipSync} from 'fflate';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {importCreativeMesh} from '../src/creative-mesh.js';
const obj=`v 0 0 0
v 10 0 0
v 0 10 0
v 0 0 10
f 1 3 2
f 1 2 4
f 1 4 3
f 2 3 4
`;
const bytes=s=>new TextEncoder().encode(s);
function extent(asset,axis){const v=asset.positions.filter((_,i)=>i%3===axis);return Math.max(...v)-Math.min(...v);}
function cubeGLB({external=false}={}){const geometry=new THREE.BoxGeometry(.01,.01,.01),p=geometry.attributes.position.array,indices=geometry.index.array,bin=Buffer.alloc(p.byteLength+indices.byteLength);Buffer.from(p.buffer).copy(bin);Buffer.from(indices.buffer).copy(bin,p.byteLength);const json={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.byteLength},{buffer:0,byteOffset:p.byteLength,byteLength:indices.byteLength}],accessors:[{bufferView:0,componentType:5126,count:p.length/3,type:'VEC3',min:[-.005,-.005,-.005],max:[.005,.005,.005]},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.2,.4,.8,1]}}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};if(external)json.images=[{uri:'https://example.com/secret.png'}];const raw=Buffer.from(JSON.stringify(json)),jsonBytes=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(jsonBytes);const result=Buffer.alloc(12+8+jsonBytes.length+8+bin.length);result.writeUInt32LE(0x46546c67);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(jsonBytes.length,12);result.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(result,20);const offset=20+jsonBytes.length;result.writeUInt32LE(bin.length,offset);result.writeUInt32LE(0x004e4942,offset+4);bin.copy(result,offset+8);return result;}
test('OBJ imports closed solids into named character library at millimetre scale',async()=>{const asset=await importCreativeMesh(bytes(obj),'obj',{name:'Rowan.obj',kind:'character'},25.4);assert.equal(asset.name,'Rowan');assert.equal(asset.category,'My Characters');assert.equal(asset.indices.length,12);assert.equal(extent(asset,0),10);assert.equal(extent(asset,1),10);assert.equal(Math.min(...asset.positions.filter((_,i)=>i%3===1)),0);assert.equal(asset.colors.length,asset.positions.length);});
test('project grid scaling matches existing STL convention',async()=>{const asset=await importCreativeMesh(bytes(obj),'.obj','Cave stone',50.8);assert.equal(extent(asset,0),5);assert.equal(asset.category,'My Scenery');});
test('GLB embedded geometry converts metres to millimetres and retains material colors',async()=>{const asset=await importCreativeMesh(cubeGLB(),'glb','Blue cube',25.4);assert.ok(Math.abs(extent(asset,0)-10)<.001);assert.equal(asset.indices.length,36);assert.ok(Math.abs(asset.colors[0]-.2)<.001);assert.ok(Math.abs(asset.colors[2]-.8)<.001);});
test('GLB external references fail before loader execution',async()=>{await assert.rejects(importCreativeMesh(cubeGLB({external:true}),'glb','Blocked'),/external resource/);});
test('open surfaces, invalid grids, unsupported formats and corrupt GLB are refused',async()=>{await assert.rejects(importCreativeMesh(bytes('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'),'obj','Open'),/four triangles/);await assert.rejects(importCreativeMesh(bytes(obj),'obj','Grid',0),/grid/);await assert.rejects(importCreativeMesh(bytes(obj),'ply','File'),/STL/);await assert.rejects(importCreativeMesh(bytes(obj),'glb','File'),/GLB/);});
test('3MF rejects archive traversal and external XML references before DOM parse',async()=>{const unsafe=zipSync({'../bad.model':bytes('<model/>')});await assert.rejects(importCreativeMesh(unsafe,'3mf','Bad'),/archive path/);const external=zipSync({'3D/model.model':bytes('<model unit="millimeter"/>'),'_rels/.rels':bytes('<Relationships><Relationship TargetMode="External" Target="https://example.com/a"/></Relationships>')});await assert.rejects(importCreativeMesh(external,'3mf','Bad'),/unsafe XML/);});

test('STL uses the existing closed-solid import path',async()=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(8,12,16));const data=new STLExporter().parse(mesh);const asset=await importCreativeMesh(bytes(data),'stl','Stone block.stl',25.4);assert.equal(asset.name,'Stone block');assert.equal(extent(asset,0),8);assert.equal(extent(asset,1),16);assert.equal(asset.indices.length,36);});
