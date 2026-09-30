import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {importSTL} from '../src/import-mesh.js';
import {defaults,validateProject,piece} from '../src/model.js';
test('import retains physical millimetres and embeds geometry in a project',()=>{const source=new THREE.Mesh(new THREE.BoxGeometry(20,30,40));const bytes=new STLExporter().parse(source,{binary:true});const asset=importSTL(bytes.buffer,'Sculpted wall.stl',25.4);assert.equal(asset.name,'Sculpted wall');const p=defaults();p.connectors='none';p.assets={'u-test':asset};p.items=[piece('u-test',0,0)];assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);const ys=asset.positions.filter((_,i)=>i%3===1);assert.equal(Math.min(...ys),0);assert.ok(Math.abs(Math.max(...ys)-40)<.001);});
test('open surfaces and unsafe imported coordinates are rejected',()=>{const source=new THREE.Mesh(new THREE.PlaneGeometry(20,20));const bytes=new STLExporter().parse(source,{binary:true});assert.throws(()=>importSTL(bytes.buffer,'Open.stl',25.4));const p=defaults();p.connectors='none';p.assets={'u-invalid':{name:'Bad mesh',positions:[NaN,0,0],indices:[0,0,0],colors:[1,1,1]}};assert.throws(()=>validateProject(p));});

