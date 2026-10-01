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
 const overlaps=[];for(let i=0;i<project.items.length;i++)for(let j=i+1;j<project.items.length;j++)if(overlap(project.items[i],project.items[j],project.assets))overlaps.push([project.items[i].id,project.items[j].id]);
 return {matches,overlaps,freePorts:ports.length-used.size};
}

