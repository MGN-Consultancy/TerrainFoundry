import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {inspectSTL} from './print-geometry.mjs';
import {needsScenerySimplification,prepareScenerySolid} from './scenery-simplifier.mjs';


const GRID = 25.4, DATUM = 8, OVERLAP = .2, MAX_TRIANGLES = 600000;
let runtime;
async function productionRuntime() {
  if (!runtime) runtime = (async () => {
    let module, helpers, repair;
    try {
      await fs.access(new URL('./vendor/manifold.js', import.meta.url));
      await fs.access(new URL('./vendor/clean-mesh-data.mjs', import.meta.url));
      module = await import('./vendor/manifold.js');
      helpers = await import('./vendor/openlock-build.js');
      repair = await import('./vendor/clean-mesh-data.mjs');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      module = await import('manifold-3d');
      helpers = await import('../src/openlock-build.js');
      repair = await import('../scripts/clean-mesh-data.mjs');
    }
    const wasm = await module.default();
    wasm.setup();
    return {wasm, socketBase: helpers.socketBase, repairMeshData:repair.repairMeshData};
  })().catch(error => { runtime = null; throw error; });
  return runtime;
}

export function sceneryAdapterSpec(value = {}) {
  const {gridWidth = 1, gridDepth = 1, gridMm = GRID, heightMm, openlock = false, sourceUpAxis = 'z', floorDatumMm = DATUM} = value;
  if (![gridWidth, gridDepth].every(n => Number.isInteger(n) && n >= 1 && n <= 16)) throw Error('Choose scenery module dimensions from 1 to 16 whole tiles.');
  if (!Number.isFinite(gridMm) || gridMm <= 0 || gridMm > 1000 || !Number.isFinite(heightMm) || heightMm < 1 || heightMm > 1000 || typeof openlock !== 'boolean' || !['y','z'].includes(sourceUpAxis)) throw Error('Choose finite scenery dimensions and a Y or Z source up axis.');
  if (openlock && (gridMm !== GRID || floorDatumMm !== DATUM || heightMm <= DATUM + OVERLAP)) throw Error('OpenLOCK scenery requires a 25.4 mm grid, 8 mm joining datum and height above the datum.');
  const widthMm = gridWidth * gridMm, depthMm = gridDepth * gridMm;
  if (widthMm > 1000 || depthMm > 1000) throw Error('Scenery footprint exceeds 1000 mm.');
  return {gridWidth, gridDepth, gridMm, widthMm, depthMm, heightMm, openlock, sourceUpAxis, floorDatumMm:openlock ? DATUM : 0};
}

export function scenerySpecForDesign(design = {}) {
  return sceneryAdapterSpec({gridWidth:design.gridWidth??1,gridDepth:design.gridDepth??1,gridMm:design.scenery?.gridMm??GRID,heightMm:design.heightMm,openlock:design.openlock??false,sourceUpAxis:design.upAxis||'y',floorDatumMm:design.floorDatumMm??(design.scenery?.connectorSystem==='openlock'?design.scenery.floorDatumMm:undefined)??DATUM});
}

export function sceneryCandidateMatches(design, candidate) {
  try {
    const wanted = scenerySpecForDesign(design), actual = candidate?.validation?.moduleSpec;
    return candidate?.validation?.adapterStatus === 'completed' && !!actual && ['gridWidth','gridDepth','gridMm','heightMm','openlock','floorDatumMm','sourceUpAxis'].every(key => actual[key] === wanted[key]);
  } catch { return false; }
}

function vertices(input, axis) {
  if (!Buffer.isBuffer(input) || input.length > 32 * 1024 * 1024) throw Error('Use an STL under 32 MiB for local scenery adaptation.');
  if (input.subarray(0,80).toString('ascii').startsWith('Terrain Foundry deterministic scenery adapter')) throw Error('Use the retained provider source, not an already adapted model.');
  const values = [];
  if (input.length >= 84 && 84 + input.readUInt32LE(80) * 50 === input.length) {
    const count = input.readUInt32LE(80);
    if (!count || count > MAX_TRIANGLES) throw Error('Scenery must contain between 1 and 600,000 triangles.');
    for (let i = 0; i < count; i++) for (let j = 0; j < 9; j++) values.push(input.readFloatLE(96 + i * 50 + j * 4));
  } else {
    const text = input.toString('utf8');
    if (!/^\s*solid\b/i.test(text) || !text.includes('endsolid')) throw Error('Invalid scenery STL.');
    for (const match of text.matchAll(/\bvertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
      values.push(Number(match[1]), Number(match[2]), Number(match[3]));
      if (values.length > MAX_TRIANGLES * 9) throw Error('Scenery exceeds 600,000 triangles.');
    }
  }
  if (!values.length || values.length % 9) throw Error('Scenery has no complete triangles.');
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (let i = 0; i < values.length; i += 3) {
    const point = axis === 'z' ? [values[i], values[i+2], -values[i+1]] : values.slice(i, i+3);
    for (let k = 0; k < 3; k++) {
      if (!Number.isFinite(point[k]) || Math.abs(point[k]) > 1e9) throw Error('Scenery has invalid coordinates.');
      values[i+k] = point[k]; min[k] = Math.min(min[k], point[k]); max[k] = Math.max(max[k], point[k]);
    }
  }
  const size = max.map((n,k) => n-min[k]);
  if (size.some(n => n <= 1e-8)) throw Error('Scenery has a flat or degenerate dimension.');
  return {values, min, max, size};
}

function stlFromTriangles(values) {
  if (!values.length || values.length % 9 || values.length / 9 > MAX_TRIANGLES) throw Error('Adapted scenery exceeds the triangle limit.');
  const bytes = Buffer.alloc(84 + values.length / 9 * 50);
  bytes.write('Terrain Foundry deterministic scenery adapter; physical fit unverified');
  bytes.writeUInt32LE(values.length / 9, 80);
  for (let i = 0; i < values.length; i += 9) {
    // Production connector helpers are Y-up; print STL is Z-up, preserving handedness.
    const p = [];
    for (let j = 0; j < 9; j += 3) p.push(values[i+j], -values[i+j+2], values[i+j+1]);
    const u = [p[3]-p[0],p[4]-p[1],p[5]-p[2]], v = [p[6]-p[0],p[7]-p[1],p[8]-p[2]];
    const n = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], length = Math.hypot(...n);
    const at = 84 + i / 9 * 50;
    for (let k = 0; k < 3; k++) bytes.writeFloatLE(length ? n[k]/length : 0, at+k*4);
    for (let k = 0; k < 9; k++) bytes.writeFloatLE(p[k], at+12+k*4);
  }
  return bytes;
}

export async function adaptScenerySTL(input, options, {sourceGLB} = {}) {
  const spec = sceneryAdapterSpec(options);
  const {wasm, socketBase, repairMeshData} = await productionRuntime(), owned = new Set();
  const keep = solid => { owned.add(solid); return solid; };
  let scales,recovery,sculpt;
  try {
    if(sourceGLB||needsScenerySimplification(input)){
      recovery=await prepareScenerySolid(input,spec,wasm,{sourceGLB});sculpt=keep(recovery.solid);scales=recovery.scales;
    }else{
      const source=vertices(input,spec.sourceUpAxis),centerX=(source.min[0]+source.max[0])/2,centerZ=(source.min[2]+source.max[2])/2;
      const horizontal=Math.min((spec.widthMm-.1)/source.size[0],(spec.depthMm-.1)/source.size[2]);
      scales=spec.openlock?[horizontal,(spec.heightMm-DATUM+OVERLAP)/source.size[1],horizontal]:[spec.widthMm/source.size[0],spec.heightMm/source.size[1],spec.depthMm/source.size[2]];
      const fitted=source.values.map((n,i)=>(n-[centerX,source.min[1],centerZ][i%3])*scales[i%3]+(i%3===1?(spec.openlock?DATUM-OVERLAP:0):0));
      inspectSTL(stlFromTriangles(fitted),[1000,1000,1000]);
      const mesh=new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(fitted),triVerts:Uint32Array.from({length:fitted.length/3},(_,i)=>i),tolerance:.00005});mesh.merge();
      sculpt=keep(new wasm.Manifold(mesh));
      if(sculpt.status()!=='NoError'||sculpt.volume()<=0)throw Error('The provider scenery is not a closed, outward-facing solid.');
    }
    const ports = [
      {x:spec.widthMm/2,z:0,nx:1,nz:0,angle:0}, {x:-spec.widthMm/2,z:0,nx:-1,nz:0,angle:180},
      {x:0,z:spec.depthMm/2,nx:0,nz:1,angle:-90}, {x:0,z:-spec.depthMm/2,nx:0,nz:-1,angle:90},
    ];
    const baseSpec = {templateSource:'printable-scenery-8.6',revision:2,kind:'floor',width:spec.widthMm,depth:spec.depthMm,height:DATUM,ports};
    const result = spec.openlock ? keep(keep(socketBase(wasm,baseSpec)).add(sculpt)) : sculpt;
    if (result.status() !== 'NoError') throw Error('Scenery could not be joined to the deterministic base.');
    const parts = result.decompose(); parts.forEach(keep);
    if (parts.length !== 1) throw Error('Scenery contains disconnected parts after base assembly. Repair the retained provider source.');
    const final = result.getMesh(), positions = [], colors = [], triangles = [];
    for(let i=0;i<final.vertProperties.length;i+=final.numProp){positions.push(...final.vertProperties.slice(i,i+3));colors.push(.5,.5,.5);}
    const repaired = repairMeshData({positions,colors,indices:Array.from(final.triVerts)},wasm);
    for (const index of repaired.indices) triangles.push(...repaired.positions.slice(index*3,index*3+3));
    if(recovery&&triangles.length/9>300000)throw Error('Adapted scenery exceeds the 300,000 project triangle limit.');
    const bytes = stlFromTriangles(triangles), geometry = inspectSTL(bytes,[1000,1000,1000]);
    const expected = [spec.widthMm,spec.depthMm,spec.heightMm];
    if (geometry.sizeMm.some((n,k) => Math.abs(n-expected[k]) > .005)) throw Error('Adapted scenery did not retain its exact requested dimensions.');
    const metadata = {...spec,status:'completed',sourceSHA256:crypto.createHash('sha256').update(input).digest('hex'),outputUpAxis:'z',sculptScale:scales,...(recovery?{simplification:recovery.metadata}:{}),...(recovery?.sourceRecovery?{sourceRecovery:recovery.sourceRecovery}:{}),
      openlock:spec.openlock ? {requested:true,status:'completed',floorDatumMm:DATUM,profile:'official-template',coordinateFrame:'y-up-mm',ports} : {requested:false},physicalFitVerified:false};
    return {bytes,spec,sizeMm:geometry.sizeMm,metadata,validation:{geometry,status:'needs-print-review',physicalFitVerified:false,minimumWallThicknessVerified:false,moduleSpec:spec,adapterStatus:'completed',adapter:metadata}};
  } finally { for (const solid of owned) solid.delete(); }
}
