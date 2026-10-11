import * as THREE from 'three';
import {geometry} from './geometry.js';
import {terrainMaterial} from './surfaces.js';
export function createThumbnailRenderer(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(200,150);renderer.setPixelRatio(1);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xe8f1ff,0x524b3b,2.5));const light=new THREE.DirectionalLight(0xffedcf,3);light.position.set(-70,120,100);scene.add(light);const camera=new THREE.PerspectiveCamera(35,4/3,.1,1000);
 return {render(item,assets={},openlock=false,unpainted=false){let mesh;try{mesh=new THREE.Mesh(geometry(item.id,25.4,assets,openlock),unpainted?new THREE.MeshStandardMaterial({color:'#b6b2aa',roughness:.92}):terrainMaterial(item.id));scene.add(mesh);const bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3()),d=bounds.getSize(new THREE.Vector3()).length();camera.position.copy(center).add(new THREE.Vector3(d*.8,d*.6,d*1.3));camera.lookAt(center);renderer.render(scene,camera);return renderer.domElement.toDataURL();}finally{if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}}},dispose(){renderer.dispose();renderer.forceContextLoss();}};
}
export function makeThumbnails(kit,assets={},openlock=false,unpainted=false){const renderer=createThumbnailRenderer(),images={};try{for(const item of kit)images[item.id]=renderer.render(item,assets,openlock,unpainted);return images;}finally{renderer.dispose();}}
