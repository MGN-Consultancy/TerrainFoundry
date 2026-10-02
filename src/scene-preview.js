import * as THREE from 'three';
import {geometry} from './geometry.js';
import {terrainMaterial} from './surfaces.js';
let renderer;
// Render the whole saved build, independently of the editor camera, selection or hidden roofs.
export function scenePreview(project){
 if(!project.items.length)return null;
 renderer??=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(560,360);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#152530');scene.add(new THREE.HemisphereLight(0xe8f1ff,0x524b3b,2.5));const sun=new THREE.DirectionalLight(0xffedcf,3);sun.position.set(-200,500,350);scene.add(sun);
 const group=new THREE.Group(),cache=new Map();scene.add(group);
 try{
  for(const item of project.items){if(!cache.has(item.type))cache.set(item.type,geometry(item.type,project.grid,project.assets,project.connectors==='openlock'));const mesh=new THREE.Mesh(cache.get(item.type),terrainMaterial(item.type,item.color));mesh.position.set(item.x*project.grid,item.y,item.z*project.grid);mesh.rotation.y=item.rotation*Math.PI/180;group.add(mesh);}
  const box=new THREE.Box3().setFromObject(group),centre=box.getCenter(new THREE.Vector3()),radius=Math.max(10,box.getSize(new THREE.Vector3()).length()/2),camera=new THREE.PerspectiveCamera(35,560/360,.1,100000),distance=radius/Math.sin(THREE.MathUtils.degToRad(35/2))*1.12;
  camera.position.copy(centre).add(new THREE.Vector3(.9,.8,1.2).normalize().multiplyScalar(distance));camera.lookAt(centre);camera.near=Math.max(.1,distance-radius*1.5);camera.far=distance+radius*3;camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');
 }finally{for(const mesh of group.children)mesh.material.dispose();for(const g of cache.values())g.dispose();}
}
export const validPreview=value=>typeof value==='string'&&value.length<=600000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
