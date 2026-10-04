const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
const safeImage=p=>typeof p==='string'&&/^assets\/premium\/tf-willowbrook-village\/wb-\d{3}-(?:engineered-)?(?:perspective|front|right|rear|left)\.webp$/.test(p);
try{
 const response=await fetch('willowbrook-gallery.json');if(!response.ok)throw Error('Gallery unavailable');const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.pieces))throw Error('Invalid gallery');
 $('gallery-status').textContent=`${data.modelRenderCount} of ${data.pieceCount} pieces have actual model renders. ${data.modelRenderCount===data.pieceCount?'Final model and print checks are in progress.':'Remaining models and final checks are in progress.'}`;
 for(const category of [...new Set(data.pieces.map(p=>p.subcategory))].sort()){const o=node('option',category);o.value=category;$('gallery-category').append(o);}
 function render(){const query=$('gallery-search').value.toLowerCase().trim(),category=$('gallery-category').value,side=$('gallery-view').value,mode=$('gallery-render').value;
  const pieces=data.pieces.filter(p=>(!category||p.subcategory===category)&&`${p.id} ${p.name} ${p.description}`.toLowerCase().includes(query));$('gallery-count').textContent=`Showing ${pieces.length} of ${data.pieceCount} pieces`;$('gallery-grid').replaceChildren();
  for(const p of pieces){const card=node('article');card.className='piece-card';const path=(mode==='engineering'?p.engineeringImages:p.images)?.[side];
   if(safeImage(path)){const a=node('a');a.href=path;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',`Enlarge ${p.name}, ${side} view`);const im=node('img');im.src=path;im.alt=`${p.name} — ${side} ${mode==='engineering'?'engineering preview':'returned model'}`;im.loading='lazy';im.width=1100;im.height=920;a.append(im);card.append(a);}else {const pending=node('p',mode==='engineering'?'Engineering preview in preparation':'Actual model render in preparation');pending.className='piece-preview-pending';card.append(pending);}
   card.append(node('h2',p.name),node('p',`${p.id} · ${p.subcategory}`));const d=p.targetDimensionsMm;card.append(node('p',`Design target: ${d.width} × ${d.depth} × ${d.height} mm`));const details=node('details');details.append(node('summary','Piece details'),node('p',p.description));card.append(details);$('gallery-grid').append(card);
  }
  if(!pieces.length)$('gallery-grid').append(node('p','No pieces match. Try another search or category.'));
 }
 $('gallery-render').addEventListener('change',()=>{const engineering=$('gallery-render').value==='engineering';$('gallery-view').querySelector('option[value="perspective"]').disabled=engineering;if(engineering&&$('gallery-view').value==='perspective')$('gallery-view').value='front';render();});
 for(const id of ['gallery-search','gallery-category','gallery-view'])$(id).addEventListener(id==='gallery-search'?'input':'change',render);render();
}catch{$('gallery-status').textContent='The model gallery could not be loaded. Please try again later.';}
