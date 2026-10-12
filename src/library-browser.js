export function setupLibraryBrowser(){
 const home=document.createElement('div');home.id='library-home';
 const browser=document.createElement('div');browser.id='library-browser';
 document.getElementById('search').before(home);home.append(browser);
 for(const id of ['search','asset-appearance-control','categories','family','library-count','kit','more-assets'])browser.append(document.getElementById(id));
 const expand=document.createElement('button');expand.id='expand-library';expand.textContent='Float scenery library ↗';expand.setAttribute('aria-expanded','false');home.before(expand);
 const panel=document.createElement('section');panel.id='library-dialog';panel.hidden=true;panel.setAttribute('aria-label','Floating scenery library');panel.innerHTML='<header class="library-float-heading"><strong>Scenery library</strong><button type="button" id="close-library" aria-label="Dock scenery library">Dock ↙</button></header>';document.body.append(panel);
 function close(){if(panel.hidden)return;home.append(browser);panel.hidden=true;expand.setAttribute('aria-expanded','false');expand.focus();}
 expand.onclick=()=>{panel.append(browser);panel.hidden=false;expand.setAttribute('aria-expanded','true');document.getElementById('search').focus();};
 panel.querySelector('#close-library').onclick=close;
 const grip=panel.querySelector('header');let drag;
 grip.onpointerdown=e=>{if(e.target.closest('button'))return;const r=panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};grip.setPointerCapture(e.pointerId);};
 grip.onpointermove=e=>{if(!drag)return;panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,e.clientX-drag.x))+'px';panel.style.top=Math.max(0,Math.min(innerHeight-60,e.clientY-drag.y))+'px';};
 grip.onpointerup=()=>{drag=null;};grip.onlostpointercapture=()=>{drag=null;};
 return {close,isExpanded:()=>!panel.hidden};
}
