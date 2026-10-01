import {footprintsOverlap} from './footprints.js';
import {connectionSpec} from './geometry.js';
export const CONNECTOR_NOTICE="OpenLOCK system, official tessellation templates 8.6 and Clip 5.4 by Printable Scenery (https://www.printablescenery.com/). Terrain Foundry sockets are derived directly from the official A-TRP-v7.0 template; two sacrificial entrance supports are omitted. MGN Consultancy uses the system under its non-transferable commercial BSD licence: https://www.printablescenery.com/2026/10/01/mgn-consultancy/. The MGN licence is not transferred to recipients. Other users retain the public CC BY-NC 4.0 terms unless they obtain their own commercial permission. Original connector-free Terrain Foundry sculpts are CC0; imported models retain their own rights. Print a fit test first; physical fit is not yet verified.";
export function worldPorts(item,assets={}){
 const s=connectionSpec(item.type,assets);if(!s)return [];
 const r=item.rotation*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
 return s.ports.map((p,index)=>({piece:item.id,index,x:item.x*25.4+c*p.x+sn*p.z,y:item.y+(p.y??3.5),roll:p.roll||0,z:item.z*25.4-sn*p.x+c*p.z,nx:c*p.nx+sn*p.nz,nz:-sn*p.nx+c*p.nz}));
}
export function overlap(a,b,assets){
 if(Math.abs(a.y-b.y)>=8-.01)return false;
 const sa=connectionSpec(a.type,assets),sb=connectionSpec(b.type,assets);if(!sa?.ports.length||!sb?.ports.length)return false;
 return footprintsOverlap(a,sa,b,sb);
}
export function connectionReport(project){
 if(project.connectors!=='openlock')return {matches:[],overlaps:[],freePorts:0};
 const ports=project.items.flatMap(i=>worldPorts(i,project.assets)),matches=[],used=new Set(),cells=new Map();
 for(const p of ports){const key=[p.x,p.y,p.z].map(n=>Math.round(n*100)).join(',');const bucket=cells.get(key)||[];for(const q of bucket){if(p.piece!==q.piece&&p.roll===q.roll&&!used.has(q)&&!used.has(p)&&p.nx*q.nx+p.nz*q.nz<-.9999){matches.push({a:p,b:q});used.add(p);used.add(q);break;}}bucket.push(p);cells.set(key,bucket);}
 // Sweep horizontal bounds before checking polygon intersections on larger worlds.
 const entries=project.items.flatMap((item,index)=>{const s=connectionSpec(item.type,project.assets);if(!s?.ports.length)return [];const a=item.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),shapes=s.footprints||[[[-s.width/2,-s.depth/2],[s.width/2,-s.depth/2],[s.width/2,s.depth/2],[-s.width/2,s.depth/2]]],points=shapes.flat().map(([x,z])=>[item.x*25.4+c*x+sn*z,item.z*25.4-sn*x+c*z]);return [{item,index,s,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))}];}).sort((a,b)=>a.minX-b.minX);
 const pairs=[];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const a=entries[i],b=entries[j];if(b.minX>=a.maxX-.01)break;if(a.minZ>=b.maxZ-.01||b.minZ>=a.maxZ-.01||Math.abs(a.item.y-b.item.y)>=8-.01)continue;if(footprintsOverlap(a.item,a.s,b.item,b.s))pairs.push([Math.min(a.index,b.index),Math.max(a.index,b.index)]);}
 const overlaps=pairs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).map(([i,j])=>[project.items[i].id,project.items[j].id]);
 return {matches,overlaps,freePorts:ports.length-used.size};
}

