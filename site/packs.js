const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;};
try{
 const response=await fetch('premium-catalogue.json');if(!response.ok)throw Error('Catalogue unavailable');
 const data=await response.json();if(data.schemaVersion!==1||!Array.isArray(data.packs))throw Error('Invalid catalogue');
 const id=new URLSearchParams(location.search).get('pack');
 const selected=id?data.packs.find(p=>p.id===id):null;
 if(id&&!selected){$('catalogue-status').textContent='This collection could not be found.';$('all-packs').hidden=false;}
 else if(selected){
  document.title=selected.name+' — Terrain Foundry';$('pack-heading').textContent=selected.name;$('pack-intro').textContent=selected.summary;$('all-packs').hidden=false;$('pack-cards').hidden=true;$('pack-detail').hidden=false;
  $('catalogue-status').textContent=selected.status==='in-development'?'In development · planned collection':'85 pieces · £9.99 · client and STL downloads';
  if(selected.purchaseAvailable===true){const config=await fetch('https://terrainfoundry-premium.azurewebsites.net/api/premium/config').then(r=>r.json()).catch(()=>({enabled:false}));if(config.enabled&&config.products?.some(p=>p.id===selected.id&&p.readyForSale)){const buy=node('a','Purchase pack','button');buy.href='premium-purchase.html?pack='+encodeURIComponent(selected.id);$('pack-summary').append(buy);}}
  const summary=$('pack-summary');const licence=node('a','Read and save the scenery licence');licence.href='premium-licence.txt';summary.append(licence);summary.append(node('p',`${selected.pieceCount} designs · ${selected.delivery}`),node('p',selected.licensing));
  summary.append(node('p',selected.status==='in-development'?'This is the planned piece inventory. Individual preview artwork and finished models are still being prepared.':'Explore the individual piece previews below.','availability'));
  const categories=[...new Set(selected.pieces.map(p=>p.subcategory))].sort();for(const category of categories){const option=node('option',category);option.value=category;$('piece-category').append(option);}
  function render(){
   const search=$('piece-search').value.toLowerCase().trim(),category=$('piece-category').value;
   const pieces=selected.pieces.filter(p=>(!category||p.subcategory===category)&&`${p.name} ${p.category} ${p.subcategory}`.toLowerCase().includes(search));
   $('piece-count').textContent=`Showing ${pieces.length} of ${selected.pieceCount} pieces`;$('piece-grid').replaceChildren();
   for(const p of pieces){const card=node('article',null,'piece-card');
    if(p.image&&/^assets\/premium\/[a-z0-9-]+\/[a-z0-9-]+\.(png|webp)$/.test(p.image)){const image=node('img');image.src=p.image;image.alt=p.name;image.loading='lazy';image.width=1024;image.height=1024;card.append(image);}
    else card.append(node('p','Individual preview in preparation','piece-preview-pending'));
    card.append(node('h3',p.name),node('p',`${p.id} · ${p.subcategory}${p.optional?' · Optional scenery':''}`));$('piece-grid').append(card);
   }
   if(!pieces.length)$('piece-grid').append(node('p','No pieces match. Try another category or search.'));
  }
  $('piece-search').addEventListener('input',render);$('piece-category').addEventListener('change',render);render();
 }else{
  $('catalogue-status').textContent=data.packs.length?'Browse collections and view every piece before buying.':'New collections are being prepared.';
  for(const p of data.packs){const card=node('article',null,'pack-card');card.append(node('p',p.status==='in-development'?'IN DEVELOPMENT':(p.purchaseAvailable?'£9.99 · AVAILABLE':'COMING SOON'),'pack-state'),node('h2',p.name),node('p',p.summary),node('p',`${p.pieceCount} designs`));const link=node('a','Explore every piece →','button');link.href='packs.html?pack='+encodeURIComponent(p.id);card.append(link);$('pack-cards').append(card);}
 }
}catch{$('catalogue-status').textContent='The pack catalogue could not be loaded. Please try again later.';}
