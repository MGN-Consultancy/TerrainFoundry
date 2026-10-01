export function setupLibraryBrowser(){
 const home=document.createElement('div');home.id='library-home';
 const browser=document.createElement('div');browser.id='library-browser';
 const first=document.getElementById('search');first.before(home);home.append(browser);
 for(const id of ['search','categories','family','library-count','kit','more-assets'])browser.append(document.getElementById(id));
 const expand=document.createElement('button');expand.id='expand-library';expand.className='full';expand.textContent='Expand library ↗';expand.setAttribute('aria-haspopup','dialog');home.before(expand);
 const dialog=document.createElement('dialog');dialog.id='library-dialog';dialog.setAttribute('aria-labelledby','library-title');dialog.innerHTML='<div class="library-dialog-heading"><div><p class="eyebrow">FIND YOUR NEXT PIECE</p><h2 id="library-title">Browse terrain</h2><p>Choose a piece to return to your scene and place it.</p></div><button id="close-library">Back to scene</button></div>';document.body.append(dialog);
 let scroll=0;
 function close(){if(!dialog.open)return;scroll=browser.scrollTop;home.append(browser);dialog.close();expand.focus();}
 expand.onclick=()=>{dialog.append(browser);dialog.showModal();browser.scrollTop=scroll;document.getElementById('search').focus();};
 dialog.querySelector('#close-library').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 // Dragging inside a modal cannot target the inert scene. Clicking returns a placement tool.
 browser.addEventListener('dragstart',event=>{if(dialog.open)event.preventDefault();},true);
 return {close,isExpanded:()=>dialog.open};
}
