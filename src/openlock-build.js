// Assembly code: MIT. Official Printable Scenery template derivative.
// Public CC BY-NC / MGN commercial grant: third-party/openlock/NOTICE.md.
import {socketCut} from './openlock-profile.js';
export {socketCut} from './openlock-profile.js';
export const OPENLOCK_GRID=25.4;
export const BASE_HEIGHT=8;
export function meshSolid(wasm,geo){
 const p=geo.attributes.position,c=geo.attributes.color,values=new Float32Array(p.count*6);
 for(let i=0;i<p.count;i++){values.set([p.getX(i),p.getY(i),p.getZ(i),c?.getX(i)??.48,c?.getY(i)??.45,c?.getZ(i)??.38],i*6);}
 const mesh=new wasm.Mesh({numProp:6,vertProperties:values,triVerts:geo.index?new Uint32Array(geo.index.array):Uint32Array.from({length:p.count},(_,i)=>i),tolerance:.00005});
 mesh.merge();const solid=new wasm.Manifold(mesh);
 if(solid.status()!=='NoError')throw Error('The model could not be converted to a closed printable solid: '+solid.status());
 return solid;
}
export function baseSpec(geo,category='Props',type=''){
 geo.computeBoundingBox();const b=geo.boundingBox;
 const width=Math.max(25.4,Math.round((b.max.x-b.min.x)/25.4)*25.4);
 const depth=Math.max(25.4,Math.round((b.max.z-b.min.z)/25.4)*25.4);
 const scenic=!['Walls','Floors','Terrain','Water','Bridges'].includes(category)||['d-curved-wall','d-corner'].includes(type);
 if(scenic)return {templateSource:'printable-scenery-8.6',revision:2,kind:'scenic',width:b.max.x-b.min.x,depth:b.max.z-b.min.z,height:0,ports:[]};
 if(category==='Walls')return {templateSource:'printable-scenery-8.6',revision:2,kind:'wall',width,depth:12.7,height:8,ports:[{x:0,z:6.35,nx:0,nz:1,angle:-90}]};
 return {templateSource:'printable-scenery-8.6',revision:2,kind:'floor',width,depth,height:8,ports:[
 {x:width/2,z:0,nx:1,nz:0,angle:0},{x:-width/2,z:0,nx:-1,nz:0,angle:180},
 {x:0,z:depth/2,nx:0,nz:1,angle:-90},{x:0,z:-depth/2,nx:0,nz:-1,angle:90}]};
}
export function socketBase(wasm,spec){
 const M=wasm.Manifold,cut=socketCut(wasm),parts=spec.ports.map(p=>cut.rotate([0,p.angle,0]).translate([p.x,0,p.z]));
 let base=M.cube([spec.width,8,spec.depth],true).translate([0,4,0]);
 if(spec.frame){const hole=M.cube([spec.width-25.4,12,spec.depth-25.4],true).translate([0,4,0]);const next=base.subtract(hole);base.delete();hole.delete();base=next;}
 const cuts=M.union(parts),result=base.subtract(cuts).setProperties(3,p=>{p[0]=.40;p[1]=.38;p[2]=.33;});
 base.delete();cut.delete();cuts.delete();parts.forEach(p=>p.delete());return result;
}
export function solidData(solid){
 const mesh=solid.getMesh(),positions=[],colors=[];
 for(let i=0;i<mesh.vertProperties.length;i+=mesh.numProp){positions.push(...mesh.vertProperties.slice(i,i+3));colors.push(...mesh.vertProperties.slice(i+3,i+6));}
 return {positions,colors,indices:Array.from(mesh.triVerts)};
}
export function connectAsset(wasm,geo,category,type='',specOverride){
 const spec=specOverride??baseSpec(geo,category,type),original=meshSolid(wasm,geo),M=wasm.Manifold;
 let body;
 if(spec.kind==='scenic'){const data={...solidData(original),openlock:spec,volume:original.volume()};original.delete();return data;}
 if(spec.kind==='floor'){
  const h=geo.boundingBox.max.y-geo.boundingBox.min.y;
  // Extend the existing lower solid; retain surface relief instead of adding a slab.
  const offset=h<=4.5?8-h:(['d-channel','d-track'].includes(type)?4:0);
  body=original.warp(p=>{if(p[1]<=3)p[1]*=(3+offset)/3;else p[1]+=offset;});
 }else{
  // A single-faced half-inch A-style footing is part of the wall, at its existing height.
  const trim=M.cube([spec.width,geo.boundingBox.max.y+2,2000],true).translate([0,geo.boundingBox.max.y/2,0]);
  const sculpt=original.intersect(trim);
  const foot=M.cube([spec.width,8,12.7],true).translate([0,4,0]).setProperties(3,p=>{p[0]=.40;p[1]=.38;p[2]=.33;});
  body=sculpt.add(foot);trim.delete();sculpt.delete();foot.delete();
 }
 const cut=socketCut(wasm),cuts=spec.ports.map(p=>cut.rotate([0,p.angle,0]).translate([p.x,0,p.z]));
 const cavity=M.union(cuts);let solid=body.subtract(cavity);const components=solid.decompose();
 components.sort((a,b)=>Math.abs(b.volume())-Math.abs(a.volume()));
 const componentVolumes=components.map(s=>s.volume());const dust=components.slice(1);const connected=components.length===1||(dust.every(s=>Math.abs(s.volume())<.1)&&dust.reduce((v,s)=>v+Math.abs(s.volume()),0)<.1);
 if(connected&&components.length>1){solid.delete();solid=components[0];dust.forEach(s=>s.delete());}else if(connected)components.forEach(s=>s.delete());
 if(solid.status()!=='NoError'||!connected)throw Error(type+': integrated connector is not one solid ('+solid.status()+') '+componentVolumes.join(','));
 const data={...solidData(solid),openlock:spec,volume:solid.volume()};
 solid.delete();body.delete();cavity.delete();cut.delete();cuts.forEach(c=>c.delete());original.delete();return data;
}





