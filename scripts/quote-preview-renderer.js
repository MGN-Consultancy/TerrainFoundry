import * as THREE from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {geometry} from '../src/geometry.js';
import {terrainMaterial} from '../src/surfaces.js';
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(320,240);renderer.setPixelRatio(1);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xe8f1ff,0x524b3b,2.5));
const light=new THREE.DirectionalLight(0xffedcf,3);light.position.set(-70,120,100);scene.add(light);
const camera=new THREE.PerspectiveCamera(35,4/3,.1,2000);
window.renderQuotePreview=async({id,clip})=>{
 let shape;
 if(!clip){const response=await fetch('/__quote-shape/'+id);if(!response.ok||!response.headers.get('X-Vertices'))throw Error('Missing registered mesh');shape={bytes:new Uint8Array(await response.arrayBuffer()),vertices:Number(response.headers.get('X-Vertices')),indices:Number(response.headers.get('X-Indices'))};}
 window.desktop={readBuiltinShape:()=>shape};
 const geo=clip?new STLLoader().parse(Uint8Array.from(clip).buffer):geometry(id,25.4,{},true);
 if(clip)geo.rotateX(-Math.PI/2);
 const material=clip?new THREE.MeshStandardMaterial({color:0xc9c2a5,roughness:.8}):terrainMaterial(id);
 const mesh=new THREE.Mesh(geo,material);scene.add(mesh);
 const bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3()),d=bounds.getSize(new THREE.Vector3()).length();
 if(!Number.isFinite(d)||d<=0)throw Error('Empty registered geometry: '+id);
 camera.position.copy(center).add(new THREE.Vector3(d*.8,d*.6,d*1.3));camera.lookAt(center);renderer.render(scene,camera);
 const check=document.createElement('canvas');check.width=320;check.height=240;const ctx=check.getContext('2d');ctx.drawImage(renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,320,240).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>40)visible++;if(visible<200)throw Error('Blank catalogue preview: '+id);
 const image=renderer.domElement.toDataURL('image/webp',.85);scene.remove(mesh);geo.dispose();material.dispose();return image;
};
