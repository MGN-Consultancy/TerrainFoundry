import {builtinData,builtinIndex} from './builtin-data.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {geometry as original} from './raw-geometry.js';

const connectedCache=new Map();
export function connectionSpec(type,assets={}){return builtinIndex[type]?.openlock;}
export function geometry(type,g,assets={},openlock=false){
 if(!openlock)return original(type,g,assets);
 if(Math.abs(g-25.4)>.00001)throw Error('OpenLOCK requires a 25.4 mm grid. Do not scale connectors.');
 if(assets[type])return original(type,g,assets);
 if(connectedCache.has(type))return connectedCache.get(type).clone();
 const data=builtinData(type,true)||builtinData({'fit-floor':'floor','fit-wall':'wall-low'}[type],true);
 if(!data)throw Error('This imported model needs an OpenLOCK base.');
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geo.setIndex(new THREE.Uint32BufferAttribute(data.indices,1));
 if(/^[boqtcnrwa]-/.test(type))geo.computeVertexNormals();
 const flat=geo.toNonIndexed();geo.dispose();if(!/^[boqtcnrwa]-/.test(type))flat.computeVertexNormals();if(/^[oqtcnrwa]-/.test(type))toCreasedNormals(flat,Math.PI/4);
 const p=flat.attributes.position,n=flat.attributes.normal,uv=[];
 for(let i=0;i<p.count;i++)if(Math.abs(n.getY(i))>.7)uv.push(p.getX(i)/g,p.getZ(i)/g);else if(Math.abs(n.getX(i))>.7)uv.push(p.getZ(i)/g,p.getY(i)/g);else uv.push(p.getX(i)/g,p.getY(i)/g);
 flat.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(connectedCache.size>=32){const oldest=connectedCache.keys().next().value;connectedCache.get(oldest).dispose();connectedCache.delete(oldest);}connectedCache.set(type,flat.clone());return flat;
}



export function clearConnectedGeometry(ids){for(const id of ids){connectedCache.get(id)?.dispose();connectedCache.delete(id);}}
