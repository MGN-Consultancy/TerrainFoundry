// Scroll-scrubbed photographs of our real meshes. No live GPU/3D context required.
const story=document.querySelector('.assembly-story'),stage=document.querySelector('.assembly-stage'),pin=document.querySelector('.assembly-pin'),copy=document.querySelector('.landing-copy'),label=document.querySelector('#assembly-caption');
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();
const picture=new Image();picture.className='assembly-sequence';picture.alt='';picture.setAttribute('aria-hidden','true');picture.width=720;picture.height=580;
let frame=0,wanted=0,shown=-1;
const travel=()=>Math.max(1,story.offsetHeight-pin.clientHeight);
function load(index){
 if(cache.has(index))return cache.get(index);
 const image=new Image();image.decoding='async';image.src=new URL(`assets/assembly-frames/${String(index).padStart(2,'0')}.webp`,import.meta.url).href;
 const promise=image.decode().then(()=>image).catch(error=>{cache.delete(index);throw error;});cache.set(index,promise);
 // Only a small neighbourhood is held as decoded images, not the whole film.
 for(const key of cache.keys())if(Math.abs(key-wanted)>4)cache.delete(key);
 return promise;
}
async function paint(index){
 try{const image=await load(index);if(index!==wanted)return;picture.src=image.src;if(!picture.isConnected)stage.prepend(picture);shown=index;story.dataset.frame=String(index);story.classList.remove('scene-unavailable');
 for(const next of [index-1,index+1])if(next>=0&&next<49)load(next).catch(()=>{});
 }catch{if(shown<0){story.classList.add('scene-unavailable');label.textContent='Preview unavailable. Scroll to continue.';}}
}
function update(){
 frame=0;if(innerWidth<=900&&innerHeight>500)stage.style.top=(copy.offsetHeight+25)+'px';else stage.style.top='';
 const p=reduce.matches?1:Math.max(0,Math.min(1,-story.getBoundingClientRect().top/travel()));wanted=Math.round(p*48);
 const step=p<.42?0:p<.72?1:p<.94?2:3;story.dataset.progress=p.toFixed(3);story.dataset.stage=String(step);
 label.textContent=['01 / Scroll to lay the foundations','02 / Bring the walls together','03 / Connect your world','04 / Ready for your table'][step];
 if(shown!==wanted)paint(wanted);
}
function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(update);}
story.classList.add('scene-ready','sequence-ready');
if(story.classList.contains('assembly-chapter')&&location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'});
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);visualViewport?.addEventListener('resize',schedule);reduce.addEventListener('change',schedule);document.addEventListener('visibilitychange',schedule);
new ResizeObserver(schedule).observe(copy);new ResizeObserver(schedule).observe(pin);
document.querySelector('#skip-assembly').addEventListener('click',event=>{const target=event.currentTarget.dataset.next;if(target)document.getElementById(target)?.scrollIntoView({behavior:'instant'});else scrollTo({top:story.getBoundingClientRect().top+scrollY+travel(),behavior:'instant'});schedule();});schedule();
