import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import Module from 'manifold-3d';import {STLLoader} from 'three/addons/loaders/STLLoader.js';import {socketCut} from '../src/openlock-profile.js';
const wasm=await Module();wasm.setup();
test('official template provenance is pinned and community sources are absent',async()=>{
 const p=JSON.parse(await fs.readFile('third-party/openlock/official/provenance.json','utf8'));
 for(const f of p.files)assert.equal(createHash('sha256').update(await fs.readFile('third-party/openlock/official/'+f.file)).digest('hex'),f.sha256);
 assert.equal(await fs.stat('third-party/openlock/OpenLock.scad').catch(()=>null),null);
 const code=await fs.readFile('src/openlock-profile.js','utf8');assert.match(code,/OFFICIAL_SOCKET/);assert.doesNotMatch(code,/clipcut\(|CrossSection/);
 const licence=await fs.readFile('third-party/openlock/MGN-COMMERCIAL-LICENSE.txt','utf8');assert.match(licence,/non-transferable/);assert.match(licence,/AS IS/);
});
test('official clip clearance matches the source template, including latch interference',async()=>{
 const b=await fs.readFile('third-party/openlock/official/OpenLOCK_Clip_v5.4.stl');const g=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const m=new wasm.Mesh({numProp:3,vertProperties:g.attributes.position.array,triVerts:Uint32Array.from({length:g.attributes.position.count},(_,i)=>i),tolerance:.0001});m.merge();
 const original=new wasm.Manifold(m),clip=original.warp(p=>{const [x,y,z]=p;p[0]=y;p[1]=z;p[2]=x-12.7;});
 const cut=socketCut(wasm),other=cut.rotate([0,180,0]),pair=wasm.Manifold.union([cut,other]);
 const obstruction=clip.subtract(pair);
 const source=await fs.readFile('third-party/openlock/official/A-TRP-v7.0.stl');const sg=new STLLoader().parse(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));const sm=new wasm.Mesh({numProp:3,vertProperties:sg.attributes.position.array,triVerts:Uint32Array.from({length:sg.attributes.position.count},(_,i)=>i),tolerance:.0001});sm.merge();const st=new wasm.Manifold(sm);
 const supports=wasm.Manifold.union([22.86,27.94].map(x=>wasm.Manifold.cube([1.8,2.6,4.02]).translate([x-.9,10.5,1.49])));const relieved=st.subtract(supports).warp(p=>{const [x,y,z]=p;p[0]=y-12.7;p[1]=z;p[2]=x-25.4;});const mirror=relieved.rotate([0,180,0]),reference=wasm.Manifold.union([relieved,mirror]),referenceHit=clip.intersect(reference);
 assert.ok(obstruction.volume()<=referenceHit.volume()+.002,'derived socket must not add obstruction beyond the official reference');
 assert.ok(obstruction.volume()/clip.volume()<.0002,'nominal latch interference remains below 0.02 percent of clip volume');
 for(const o of [st,supports,relieved,mirror,reference,referenceHit])o.delete();sg.dispose();
 for(const o of [original,clip,cut,other,pair,obstruction])o.delete();g.dispose();
});

// Distribution evidence: the exported project carries both public and MGN terms.
test('connected print exports carry official provenance, grant and logo',async()=>{
 const {defaults,piece}=await import('../src/model.js');const {printFiles}=await import('../src/print-pack.js');
 const p=defaults();p.items=[piece('floor',0,0)];const files=Object.fromEntries(printFiles(p).files.map(f=>[f.name,f.data]));
 const report=JSON.parse(files['connections.json']);assert.equal(report.templateSource,'printable-scenery-8.6');assert.equal(report.commercialLicenseEntity,'MGN Consultancy');
 assert.match(files['MGN-OPENLOCK-COMMERCIAL-LICENSE.txt'],/non-transferable/);assert.ok(files['OpenLOCK-Compatible.png'].length>100);assert.doesNotMatch(files['OPENLOCK-NOTICE.txt'],/caitlynb/);
});

test('every built-in connected STL passes the quote service geometry checks',async()=>{
 const {KIT,defaults}=await import('../src/model.js');const {stlFile}=await import('../src/print-pack.js');const {inspectSTL}=await import('../print-service/src/geometry.mjs');
 const p=defaults();for(const id of [...KIT.map(k=>k.id),'fit-floor','fit-wall']){
  assert.doesNotThrow(()=>inspectSTL(Buffer.from(stlFile(id,p).file.data),[1000,1000,1000]),id+' must export closed geometry without collapsed or degenerate triangles');
 }
});
