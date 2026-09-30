import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const {createPrintEstimator}=createRequire(import.meta.url)('../desktop/print-estimate.cjs');
// Minimal closed binary STL independent of the terrain generator.
function cube(){const p=[[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]],faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]];const b=Buffer.alloc(84+50*faces.length);b.writeUInt32LE(faces.length,80);faces.forEach((f,i)=>f.flatMap(n=>p[n]).forEach((v,j)=>b.writeFloatLE(v,84+i*50+12+j*4)));return b;}
test('client sends only measured summaries and caches matching estimates without bypassing server rejection',async()=>{
 const userData=await fs.mkdtemp(path.join(os.tmpdir(),'terrain-estimate-'));let offline=false,reject=false,captured;
 const estimator=createPrintEstimator({userData,fetchImpl:async(url,options)=>{if(offline)throw Error('Offline');captured=JSON.parse(options.body);return new Response(JSON.stringify(reject?{error:'Invalid discount'}:{price:{currency:'GBP',totalPence:1495},estimatedAt:123,preview:true}),{status:reject?400:200});}});
 const files=[{name:'cube.stl',data:cube()},{name:'quantities.csv',data:'Piece,File,Quantity,Width_mm,Depth_mm,Height_mm\nCube,cube.stl,2,10,10,10'},{name:'project.terrain',data:'PRIVATE SCENE CONTENT'}],selection={material:'pla',printer:'a1',colour:'stone-grey',country:'GB',discountCode:''};
 try{assert.equal((await estimator.estimate(files,selection)).cached,false);assert.ok(Math.abs(captured.items[0].volumeCm3-1)<1e-9);assert.equal(captured.items[0].surfaceCm2,6);assert.equal(captured.items[0].quantity,2);assert.ok(!JSON.stringify(captured).includes('PRIVATE'));
 offline=true;assert.equal((await estimator.estimate(files,selection)).cached,true);await assert.rejects(estimator.estimate(files,{...selection,printer:'h2s'}),/Offline/);
 offline=false;reject=true;await assert.rejects(estimator.estimate(files,selection),/Invalid discount/);
 }finally{await fs.rm(userData,{recursive:true,force:true});}
});
test('the client geometry inspector matches the canonical website inspector',async()=>{const source=await fs.readFile('print-service/src/geometry.mjs','utf8'),generated=await fs.readFile('desktop/print-geometry.mjs','utf8');assert.ok(generated.includes(source.slice(source.indexOf('export function inspectSTL('),source.indexOf('export function inspectPack('))));});
