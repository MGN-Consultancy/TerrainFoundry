import woodlandData from '../src/generated/woodland.json' with {type:'json'};

import caveData from '../src/generated/caves.json' with {type:'json'};
import expansionData from '../src/generated/expansions.json' with {type:'json'};
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import outdoorData from '../src/generated/outdoor.json' with {type:'json'};
import * as THREE from 'three';
import {stoneField,finishGeometry} from '../src/surfaces.js';
import villageData from '../src/generated/village.json' with {type:'json'};
import dungeonData from '../src/generated/dungeon.json' with {type:'json'};
import benchmarkData from '../src/generated/benchmarks.json' with {type:'json'};
const village={...woodlandData,...caveData,...expansionData,...outdoorData,...villageData,...dungeonData,...benchmarkData};
export function geometry(type,g,assets={}){if(village[type]||assets[type]){const data=village[type]||assets[type];let b=new THREE.BufferGeometry();b.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));b.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));b.setIndex(new THREE.Uint32BufferAttribute(data.indices,1));if(/^[boqtcnrwa]-/.test(type))b.computeVertexNormals();const flat=b.toNonIndexed();b.dispose();b=flat;b.scale(g/25.4,g/25.4,g/25.4);if(!/^[boqtcnrwa]-/.test(type))b.computeVertexNormals();if(/^[oqtcnrwa]-/.test(type))toCreasedNormals(b,Math.PI/4);const p=b.attributes.position,n=b.attributes.normal,uv=[];for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.7)uv.push(p.getX(i)/g,p.getZ(i)/g);else if(Math.abs(n.getX(i))>.7)uv.push(p.getZ(i)/g,p.getY(i)/g);else uv.push(p.getX(i)/g,p.getY(i)/g);}b.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return b;}let geo;const box=(x,y,z)=>{const b=new THREE.BoxGeometry(x,y,z,Math.ceil(x/.7),Math.ceil(y/.7),Math.ceil(z/.7));b.translate(0,y/2,0);const p=b.attributes.position,n=b.attributes.normal;for(let i=0;i<p.count;i++){const px=p.getX(i),py=p.getY(i),pz=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);if(ny<-.5)continue;let u,v,edge;if(Math.abs(ny)>.5){u=px;v=pz;edge=Math.min(x/2-Math.abs(px),z/2-Math.abs(pz));}else if(Math.abs(nx)>.5){u=pz;v=py;edge=Math.min(z/2-Math.abs(pz),py,y-py);}else{u=px;v=py;edge=Math.min(x/2-Math.abs(px),py,y-py);}const fade=Math.max(0,Math.min(1,edge/.9));let d;if(type==='crate'){const plank=(u+100*g)%(g*.175);d=-.55*Math.max(0,1-Math.min(plank,g*.175-plank)/.6)+.06*Math.sin(u*5+Math.sin(v));}else d=stoneField(u,v,g).relief-.72;p.setXYZ(i,px+nx*d*fade,py+ny*d*fade,pz+nz*d*fade);}return b;};
 switch(type){case 'floor':geo=box(2*g,4,2*g);break;case 'floor-small':geo=box(g,4,g);break;case 'platform':geo=box(2*g,g/2,2*g);break;case 'wall':geo=box(2*g,2*g,5);break;case 'wall-low':geo=box(2*g,g,5);break;case 'crate':geo=box(g*.7,g*.7,g*.7);break;case 'pillar':geo=new THREE.CylinderGeometry(g*.27,g*.32,2*g,24);geo.translate(0,g,0);break;case 'boulder':geo=new THREE.CylinderGeometry(g*.24,g*.55,g*.7,7,1);geo.translate(0,g*.35,0);break;
 case 'door':{const s=new THREE.Shape();const w=g,h=2*g,t=g*.22;s.moveTo(-w,0);s.lineTo(-w,h);s.lineTo(w,h);s.lineTo(w,0);s.lineTo(w-t,0);s.lineTo(w-t,h-t);s.lineTo(-w+t,h-t);s.lineTo(-w+t,0);s.closePath();geo=new THREE.ExtrudeGeometry(s,{depth:5,bevelEnabled:false});geo.translate(0,0,-2.5);break;}
 case 'stairs':{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(2*g,0);s.lineTo(2*g,g);for(let k=4;k>0;k--){s.lineTo((k-1)*g/2,k*g/4);s.lineTo((k-1)*g/2,(k-1)*g/4);}s.closePath();geo=new THREE.ExtrudeGeometry(s,{depth:g,bevelEnabled:false});geo.translate(-g,0,-g/2);break;}
 default:throw Error('Unknown piece');}finishGeometry(geo,type,g);geo.computeVertexNormals();return geo;}







