const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#main-navigation');
function closeMenu(){toggle.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
matchMedia('(min-width: 901px)').addEventListener('change',closeMenu);

// Keep existing app links and saved section bookmarks working after the page split.
if(location.pathname==='/'||location.pathname==='/index.html'){
 const destinations={'#print-form':'print.html#print-form','#print-service':'print.html','#printing':'how-it-works.html','#workshop':'editor.html','#offline-choice':'editor.html#offline-choice','#download':'#download-link'};
 const target=destinations[location.hash];if(target&&target[0]!=='#')location.replace(target);
}
