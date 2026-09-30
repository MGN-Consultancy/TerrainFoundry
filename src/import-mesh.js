import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import * as THREE from 'three';

export function importSTL(buffer,name,grid){
 if(buffer.byteLength>20000000)throw Error('Choose an STL smaller than 20 MB.');
 const mesh=new STLLoader().parse(buffer);const p=mesh.attributes.position;
 if(p.count>900000||p.count<12)throw Error('STL must contain 4–300,000 triangles.');
 mesh.rotateX(-Math.PI/2);mesh.computeBoundingBox();const center=mesh.boundingBox.getCenter(new THREE.Vector3());
 mesh.translate(-center.x,-mesh.boundingBox.min.y,-center.z);mesh.scale(25.4/grid,25.4/grid,25.4/grid);
 const positions=[],indices=[],lookup=new Map(),edges=new Map();let volume=0;
 for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];if(!v.every(n=>Number.isFinite(n)&&Math.abs(n)<10000))throw Error('Invalid STL coordinates.');const key=v.map(n=>Math.round(n*10000)).join(',');let vi=lookup.get(key);if(vi===undefined){vi=positions.length/3;lookup.set(key,vi);positions.push(...v);}indices.push(vi);}
 for(let i=0;i<indices.length;i+=3){const t=indices.slice(i,i+3);if(new Set(t).size!==3)throw Error('STL has collapsed faces. Repair it before importing.');for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}const [a,b,c]=t.map(j=>positions.slice(j*3,j*3+3));volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
 mesh.dispose();if([...edges.values()].some(e=>e[0]!==2||e[1]!==0)||volume<=0)throw Error('STL must be closed, consistently oriented solid geometry. Repair it before importing.');
 return{name:name.replace(/\.stl$/i,'').slice(0,80),category:'Imported',positions,indices,colors:new Array(positions.length).fill(.7)};
}
