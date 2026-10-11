
/** One navigation hub for the existing local libraries; never another conversation. */
export function setupContentLibrary({api=window.desktop,toast=()=>{},onPersonal,onTerrain,onSounds}={}){
 const dialog=document.createElement('dialog');dialog.className='content-library studio-dialog';dialog.setAttribute('aria-label','Content library');
 dialog.innerHTML='<header><div><small>ON THIS PC</small><h2>Content library</h2></div><button type="button" aria-label="Close content library">×</button></header><p>Browse your reusable models and campaign audio. Editing and importing are available offline.</p><div class="content-library-grid"></div><section class="content-library-sounds" hidden><h3>Campaign soundboards</h3><p>Sounds remain in their campaign workspace, with their source and licence information.</p><div></div></section><p role="status"></p>';
 document.body.append(dialog);const grid=dialog.querySelector('.content-library-grid'),status=dialog.querySelector('[role=status]'),sounds=dialog.querySelector('.content-library-sounds');let returnFocus;
 const close=()=>{dialog.close();returnFocus?.focus?.();};dialog.querySelector('header button').onclick=close;
 const run=fn=>async()=>{try{await fn();}catch(error){status.textContent=error.message;toast(error.message,true);}};
 function card(title,description,label,fn){const article=document.createElement('article'),heading=document.createElement('h3'),text=document.createElement('p'),button=document.createElement('button');heading.textContent=title;text.textContent=description;button.type='button';button.textContent=label;button.onclick=run(fn);article.append(heading,text,button);grid.append(article);}
 card('Characters','Your imported and generated characters, creatures, portraits and model workspaces.','Browse characters',async()=>{close();await onPersonal?.('character');});
 card('My scenery','Your generated scenery and imported third-party packs, organised by pack name.','Browse my scenery',async()=>{close();await onPersonal?.('scenery');});
 card('Free scenery','Installed free terrain pieces, textures and OpenLOCK variants in the terrain browser.','Browse free scenery',()=>{close();onTerrain?.('free');});
 card('Premium scenery','Installed premium packs you have activated. Missing packs need activation before use.','Browse premium scenery',()=>{close();onTerrain?.('premium');});
 card('Sounds','Your imported recordings and original starter sounds, with each campaign’s soundboard.','Browse sounds',async()=>{sounds.hidden=false;const list=sounds.querySelector('div');list.replaceChildren();status.textContent='Reading saved campaigns…';const records=await api.campaignList();for(const record of records||[]){const button=document.createElement('button');button.type='button';button.textContent=record.name;button.onclick=run(async()=>{close();await onSounds?.(record.id);});list.append(button);}status.textContent=records?.length?'Choose a campaign to open its soundboard.':'Create a campaign to import sounds or add the original starter sounds.';});
 function open(){returnFocus=document.activeElement;status.textContent='';sounds.hidden=true;if(!dialog.open)dialog.showModal();}
 return {open,close,destroy:()=>dialog.remove()};
}
