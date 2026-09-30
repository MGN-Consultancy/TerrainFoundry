import {naturalRock} from './natural-rock.mjs';
import fs from 'node:fs/promises';
import {wasm,M,noise,paint,box} from './sculpt-library.mjs';
import {solidData,connectAsset} from '../src/openlock-build.js';
import {cleanMeshData} from './clean-mesh-data.mjs';
import * as THREE from 'three';
const stone=[.40,.39,.35],G=25.4;
// Continuous rock with real strata, fractures and chipped relief, never masonry courses.
const rock=naturalRock;
const wall=(w=2*G,h=46,seed=1)=>rock(w,h,10.8,seed).translate([0,h/2,0]);
function entrance(w,seed){
 const body=wall(w,w===2*G?55:68,seed),radius=w===2*G?14:24;
 // Opening clears an 8 mm floor; the arch leaves a thick, printable stone crown.
 const tunnel=M.union([M.cube([radius*2,23,30],true).translate([0,19,0]),M.cylinder(30,radius,radius,64,true).translate([0,30,0])]);
 const result=body.subtract(tunnel).warp(p=>{if(p[1]>40)p[1]-=Math.pow(Math.abs(p[0])/(w/2),2)*9*Math.min(1,(p[1]-40)/10);});body.delete();tunnel.delete();return result;
}
function floor(seed=2){return M.cube([2*G,8.7,2*G],true).refineToLength(.8).warp(p=>{if(p[1]>4.349){const fade=Math.max(0,Math.min(1,(G-Math.max(Math.abs(p[0]),Math.abs(p[2])))/2));p[1]-=.7+.6*fade*noise(p[0]*.3,seed,p[2]*.3);}}).translate([0,4.35,0]).setProperties(3,(c,p)=>{stone.forEach((v,i)=>c[i]=v*(.85+.23*noise(p[0]*.22,seed,p[2]*.22)));});}
function stoneLump(x,z,r,h,seed){return paint(M.sphere(1,20).refineToLength(.2).warp(p=>{const n=1+.14*noise(p[0]*3+seed,p[1]*3,p[2]*3);p[0]*=r*n;p[1]*=h*n;p[2]*=r*.8*n;}).translate([x,8+h*.35,z]),stone);}
function floorFeature(kind){const parts=[floor()];
 if(kind==='corner')parts.push(wall(2*G-.4,40,4).translate([0,7,-19.8]),wall(2*G-.4,40,7).rotate([0,90,0]).translate([-19.8,7,0]));
 if(kind==='rubble')for(let i=0;i<11;i++)parts.push(stoneLump(-18+(i%4)*11,-16+Math.floor(i/4)*16,3+(i%3),2+i%4,i));
 if(kind==='stalagmites')for(const [x,z,h,r]of [[-13,-12,29,5],[11,-14,21,4],[-16,12,15,3.6],[15,10,10,3]])parts.push(paint(M.cylinder(h,r,.8,20,false).rotate([-90,0,0]).refineToLength(1).warp(p=>{const n=noise(p[0]*.5,p[1]*.3,p[2]*.5);p[0]+=.25*n;p[2]+=.25*n;}).translate([x,7,z]),[.48,.43,.32]));
 return M.union(parts);
}
const specs=[
 ['n-entrance','Rocky cave entrance','Walls',()=>entrance(2*G,3)],
 ['n-entrance-wide','Wide cavern entrance','Walls',()=>entrance(3*G,9)],
 ['n-wall','Layered cave wall','Walls',()=>wall()],
 ['n-wall-fractured','Fractured cave wall','Walls',()=>wall(2*G,51,12)],
 ['n-wall-low','Low cave wall','Walls',()=>wall(2*G,25,7)],
 ['n-wall-short','Short cave wall','Walls',()=>wall(G,46,14)],
 ['n-corner','Cavern corner floor','Floors',()=>floorFeature('corner')],
 ['n-floor','Cavern stone floor','Floors',()=>floor()],
 ['n-rubble','Rockfall floor','Terrain',()=>floorFeature('rubble')],
 ['n-stalagmites','Stalagmite floor','Terrain',()=>floorFeature('stalagmites')]
];
const raw={},connected=JSON.parse(await fs.readFile('src/generated/openlock.json','utf8'));
function valid(data){const edges=new Map();for(let i=0;i<data.indices.length;i+=3)for(let j=0;j<3;j++){const a=data.indices[i+j],b=data.indices[i+(j+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}return [...edges.values()].every(n=>n===2);}
for(const [id,name,category,build]of specs){let solid=build();if(solid.status()!=='NoError')throw Error(id+': '+solid.status());
 let data=cleanMeshData(solidData(solid));if(!valid(data)){for(const tol of [.003,.01,.02,.03]){const simpler=solid.simplify(tol),candidate=cleanMeshData(solidData(simpler));if(valid(candidate)){solid.delete();solid=simpler;data=candidate;break;}simpler.delete();}if(!valid(data))throw Error(id+' topology');}raw[id]={name,category,...data,volume:solid.volume()};
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geo.setIndex(data.indices);
 connected[id]=cleanMeshData(connectAsset(wasm,geo,category,id));geo.dispose();solid.delete();console.log(id,data.indices.length/3);
}
await fs.writeFile('src/generated/caves.json',JSON.stringify(raw));await fs.writeFile('src/generated/openlock.json',JSON.stringify(connected));
await fs.writeFile('src/cave-kit.js','export const CAVE_KIT = '+JSON.stringify(specs.map(([id,name,category])=>({id,name,category,icon:'',hint:'Caverns / sculpted rock / integrated Foundry Link'})),null,2)+';\n');


