import crypto from 'node:crypto';
import {retainedGLBGeometry} from './scenery-glb-source.mjs';
const INPUT_BYTES=100*1024*1024, SCULPT_LIMIT=280000;
export function needsScenerySimplification(input){return Buffer.isBuffer(input)&&(input.length>32*1024*1024||input.length>=84&&84+input.readUInt32LE(80)*50===input.length&&input.readUInt32LE(80)>SCULPT_LIMIT);}
function stlGeometry(input,axis){
  if(input.length<84||84+input.readUInt32LE(80)*50!==input.length)throw Error('Dense scenery recovery requires a complete binary STL or retained GLB.');
  const count=input.readUInt32LE(80);if(!count)throw Error('Scenery has no triangles.');
  const positions=new Float32Array(count*9),indices=new Uint32Array(count*3);
  for(let i=0;i<count;i++)for(let j=0;j<3;j++){
    const at=96+i*50+j*12,x=input.readFloatLE(at),y=input.readFloatLE(at+4),z=input.readFloatLE(at+8);
    if(![x,y,z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9))throw Error('Scenery has invalid coordinates.');
    positions.set(axis==='z'?[x,z,-y]:[x,y,z],i*9+j*3);indices[i*3+j]=i*3+j;
  }
  return {positions,indices,metadata:{format:'retained-stl',sourceUpAxis:axis,sourceUnits:'provider-units'}};
}
export async function prepareScenerySolid(input,spec,wasm,{sourceGLB}={}){
  if(!Buffer.isBuffer(input)||input.length>INPUT_BYTES)throw Error('Use a retained STL under 100 MiB for local scenery recovery.');
  if(input.subarray(0,80).toString('ascii').startsWith('Terrain Foundry deterministic scenery adapter'))throw Error('Use the retained provider source, not an already adapted model.');
  const started=Date.now(),source=sourceGLB?retainedGLBGeometry(sourceGLB):stlGeometry(input,spec.sourceUpAxis),owned=new Set();
  const keep=solid=>{owned.add(solid);return solid;};
  try{
    const mesh=new wasm.Mesh({numProp:3,vertProperties:source.positions,triVerts:source.indices,tolerance:0});mesh.merge();
    const original=keep(new wasm.Manifold(mesh));
    if(original.status()!=='NoError'||original.volume()<=0)throw Error('The retained scenery source is not a closed, outward-facing solid.');
    const sourceParts=original.decompose();sourceParts.forEach(keep);const sourceComponents=sourceParts.length;
    const bounds=original.boundingBox(),size=bounds.max.map((n,k)=>n-bounds.min[k]);
    if(size.some(n=>!Number.isFinite(n)||n<=1e-8))throw Error('Scenery has a flat or degenerate dimension.');
    const horizontal=Math.min((spec.widthMm-.1)/size[0],(spec.depthMm-.1)/size[2]);
    const scales=spec.openlock?[horizontal,(spec.heightMm-8+.2)/size[1],horizontal]:[spec.widthMm/size[0],spec.heightMm/size[1],spec.depthMm/size[2]];
    const center=[(bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2];
    const translated=keep(original.translate(center.map(n=>-n))),scaled=keep(translated.scale(scales)),fitted=keep(scaled.translate([0,spec.openlock?7.8:0,0]));
    let solid=fitted,toleranceMm=0;const attempts=[];
    const maximumToleranceMm=Math.min(.05,Math.max(spec.widthMm,spec.depthMm,spec.heightMm)*.001);
    if(solid.numTri()>SCULPT_LIMIT){
      const tolerances=[...new Set([.01,.015,.02,maximumToleranceMm].filter(n=>n<=maximumToleranceMm))].sort((a,b)=>a-b);
      for(const tolerance of tolerances){
        if(Date.now()-started>60000)throw Error('Local scenery recovery exceeded the bounded processing window.');
        const candidate=keep(fitted.simplify(tolerance));
        if(candidate.status()!=='NoError'){attempts.push({tolerance,status:candidate.status()});continue;}
        const parts=candidate.decompose();parts.forEach(keep);
        attempts.push({tolerance,triangles:candidate.numTri(),components:parts.length,sourceComponents});
        if(candidate.numTri()<=SCULPT_LIMIT){solid=candidate;toleranceMm=tolerance;break;}
      }
      if(solid.numTri()>SCULPT_LIMIT)throw Error('The source cannot be reduced within the bounded print tolerance and 280,000 sculpt triangle limit: '+JSON.stringify(attempts));
    }
    const finalBounds=solid.boundingBox(),targetBottom=spec.openlock?7.8:0,targetHeight=spec.heightMm-targetBottom;
    const currentHeight=finalBounds.max[1]-finalBounds.min[1];
    // Manifold simplification preserves a bounded surface approximation, but can
    // move extremal vertices. Restore the chosen printable vertical datum/height.
    const verticalCorrection={scale:targetHeight/currentHeight,translationMm:targetBottom-finalBounds.min[1]*targetHeight/currentHeight};
    if(toleranceMm){
      const corrected=keep(solid.scale([1,verticalCorrection.scale,1]));
      solid=keep(corrected.translate([0,verticalCorrection.translationMm,0]));
    }
    const finalParts=solid.decompose();finalParts.forEach(keep);
    if(solid.status()!=='NoError'||solid.volume()<=0)throw Error('Scenery recovery did not retain closed outward-facing solids.');
    const metadata={method:'bounded-manifold-simplification',inputTriangles:source.indices.length/3,outputTriangles:solid.numTri(),toleranceMm,maximumToleranceMm,maximumRelativeTolerance:.001,sourceUnits:source.metadata.sourceUnits,sourceUpAxis:source.metadata.sourceUpAxis,scales,sourceComponents,outputComponents:finalParts.length,verticalCorrection:toleranceMm?verticalCorrection:null,estimatedTotalErrorMm:toleranceMm+Math.max(Math.abs(finalBounds.min[1]-targetBottom),Math.abs(finalBounds.max[1]-spec.heightMm)),fittedBounds:solid.boundingBox(),surfaceReconstruction:false,holeFilling:false,componentPruning:false,physicalFitVerified:false,attempts,elapsedMs:Date.now()-started,sourceSHA256:crypto.createHash('sha256').update(input).digest('hex')};
    owned.delete(solid);return {solid,scales,metadata,sourceRecovery:sourceGLB?source.metadata:null};
  }finally{for(const solid of owned)solid.delete();}
}
