import {connectionSpec} from './geometry.js';
import {worldPorts,overlap} from './connections.js';
export function snapPlacement(project,type,point,rotations){
 const spec=connectionSpec(type,project.assets);if(project.connectors!=='openlock'||!spec?.ports.length)return point;
 const targets=project.items.flatMap(i=>worldPorts(i,project.assets));
 let best=null,distance=25.4*.65;
 for(const rotation of rotations||(spec.rotationStep===45?[0,45,90,135,180,225,270,315]:['wall','column'].includes(spec.kind)?[0,90,180,270]:[0])){
  const candidate={id:'placing',type,...point,rotation};
  for(const a of worldPorts(candidate,project.assets))for(const b of targets){
   if(a.roll!==b.roll||Math.abs(a.y-b.y)>.01||a.nx*b.nx+a.nz*b.nz>-.999)continue;
   const d=Math.hypot(a.x-b.x,a.z-b.z);if(d>=distance)continue;
   const placed={...candidate,x:point.x+(b.x-a.x)/25.4,z:point.z+(b.z-a.z)/25.4};
   if(Math.abs(placed.x)>project.board/2||Math.abs(placed.z)>project.board/2||project.items.some(i=>overlap(placed,i,project.assets)))continue;
   distance=d;best={x:Math.round(placed.x*1e6)/1e6,z:Math.round(placed.z*1e6)/1e6,y:placed.y,rotation};
  }
 }
 return best||point;
}

