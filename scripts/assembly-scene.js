import * as THREE from 'three';
const story=document.querySelector('.assembly-story'), stage=document.querySelector('.assembly-stage'), label=document.querySelector('#assembly-caption');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const pin=document.querySelector('.assembly-pin');
let render,frame=0;
const travel=()=>Math.max(1,story.offsetHeight-pin.clientHeight);
const progress=()=>reduce.matches?1:Math.max(0,Math.min(1,-story.getBoundingClientRect().top/travel()));
const schedule=()=>{if(!document.hidden&&!frame)frame=requestAnimationFrame(()=>{frame=0;render?.(progress());});};
async function init(){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-hidden','true');stage.prepend(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,2000);
 scene.add(new THREE.HemisphereLight(0xdcecff,0x544432,2.8));
 const key=new THREE.DirectionalLight(0xffe4b5,4);key.position.set(-100,180,100);scene.add(key);
 const rim=new THREE.DirectionalLight(0x9abfff,2);rim.position.set(100,60,-100);scene.add(rim);
 const group=new THREE.Group();scene.add(group);
 const manifest=await fetch(new URL(/* @vite-ignore */ './assembly-models.json',import.meta.url));if(!manifest.ok)throw Error('Models unavailable');
 const models=await manifest.json(),geometries={};
 await Promise.all(Object.entries(models).map(async([id,m])=>{const r=await fetch(new URL(/* @vite-ignore */ `./assembly-${id}.bin`,import.meta.url));if(!r.ok)throw Error('Model unavailable');const b=await r.arrayBuffer(),n=m.vertices*3,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(b,0,n),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(b,n*4,n),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(b,n*8,m.indices),1));const flat=g.toNonIndexed();flat.computeVertexNormals();g.dispose();geometries[id]=flat;}));
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9});
 const items=[];
 function add(id,x,z,rotation,start,end){const mesh=new THREE.Mesh(geometries[id],material);mesh.rotation.y=rotation;group.add(mesh);items.push({mesh,x,z,start,end});}
 for(const x of [-25.4,25.4])for(const z of [-25.4,25.4])add('v-stone-floor',x,z,0,.04,.42);
 for(const x of [-25.4,25.4])add('b-weathered-wall',x,-57.15,0,.42,.72);
 for(const z of [-25.4,25.4])add('wall-low',-57.15,z,Math.PI/2,.65,.94);
 const pad=new THREE.Mesh(new THREE.CylinderGeometry(105,108,3,96),new THREE.MeshStandardMaterial({color:0x182328,roughness:1}));pad.position.y=-3;scene.add(pad);
 let lastWidth=0,lastHeight=0;
 render=p=>{if(renderer.getContext().isContextLost())return;if(innerWidth<=900&&innerHeight>500){stage.style.top=(document.querySelector('.landing-copy').offsetHeight+25)+'px';}else stage.style.top='';const w=stage.clientWidth,h=stage.clientHeight;if(w<1||h<1)return;if(w!==lastWidth||h!==lastHeight){renderer.setSize(w,h,false);lastWidth=w;lastHeight=h;}camera.aspect=w/h;const d=camera.aspect<.9?340:285;camera.position.set(d*.75,d*.68,d);camera.lookAt(0,9,0);camera.updateProjectionMatrix();group.rotation.y=-.14+p*.14;for(const item of items){let t=Math.max(0,Math.min(1,(p-item.start)/(item.end-item.start)));t=t*t*(3-2*t);const gap=1-t;item.mesh.position.set(item.x+Math.sign(item.x)*gap*45,gap*(item.start>.4?55:15),item.z+Math.sign(item.z)*gap*45);}const step=p<.42?0:p<.72?1:p<.94?2:3;label.textContent=['01 / Scroll to lay the foundations','02 / Bring the walls together','03 / Connect your world','04 / Ready for your table'][step];story.dataset.stage=String(step);story.dataset.progress=p.toFixed(3);renderer.render(scene,camera);};
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();story.classList.add('scene-unavailable');label.textContent='Original scenery. Built for your table.';});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{story.classList.remove('scene-unavailable');schedule();});story.classList.add('scene-ready');if(story.classList.contains('assembly-chapter')&&location.hash){document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'});}schedule();
}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);reduce.addEventListener('change',schedule);
visualViewport?.addEventListener('resize',schedule);document.addEventListener('visibilitychange',schedule);
new ResizeObserver(schedule).observe(document.querySelector('.landing-copy'));
new ResizeObserver(schedule).observe(pin);
document.querySelector('#skip-assembly').addEventListener('click',event=>{const target=event.currentTarget.dataset.next;if(target){document.getElementById(target)?.scrollIntoView({behavior:'instant'});}else scrollTo({top:story.getBoundingClientRect().top+scrollY+travel(),behavior:'instant'});schedule();});
init().catch(()=>{story.classList.add('scene-unavailable');label.textContent='Original scenery. Built for your table.';});

