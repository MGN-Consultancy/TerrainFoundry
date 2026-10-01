import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {KIT} from '../src/model.js';
import {stlFile} from '../src/print-pack.js';
import {connectionSpec} from '../src/geometry.js';
import {inspectSTL} from '../print-service/src/geometry.mjs';
const pieces=KIT.filter(k=>k.id.startsWith('n-grotto-'));assert.equal(pieces.length,10);
await fs.mkdir('test-results/grotto-printables',{recursive:true});
for(const k of pieces){const spec=connectionSpec(k.id);assert.ok(spec.ports.length);assert.equal(spec.templateSource,'printable-scenery-8.6');const {file}=stlFile(k.id,{grid:25.4,assets:{},connectors:'openlock'});const result=inspectSTL(Buffer.from(file.data));assert.ok(result.volumeCm3>0);await fs.writeFile('test-results/grotto-printables/'+file.name,file.data);console.log(k.name,JSON.stringify(result.sizeMm),result.triangles,'triangles',spec.ports.length,'OpenLOCK sockets');}

