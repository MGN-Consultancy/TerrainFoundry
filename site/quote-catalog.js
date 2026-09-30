// A catalogue reference never certifies a renamed or modified upload.
(() => {
 const assets=new Map(),hashes=new Map();
 const ready=fetch('terrain-catalog.json',{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();}).then(catalog=>{
  if(catalog.schema!==1||!catalog.assets)throw Error('Unknown catalogue');
  for(const [id,asset] of Object.entries(catalog.assets)){
   if(!/^[a-z][a-z0-9-]{0,80}$/.test(id)||typeof asset.name!=='string'||!Array.isArray(asset.sha256))continue;
   const entry={id,name:asset.name,category:asset.category||'Terrain',hint:asset.hint||'',sha256:asset.sha256.filter(h=>/^[a-f0-9]{64}$/.test(h))};assets.set(id,entry);
   for(const hash of entry.sha256)if(!hashes.has(hash))hashes.set(hash,entry);
  }
 }).catch(()=>{});
 function lookup(item){
  const key=String(item.file||'').replace(/\.stl$/i,'').toLowerCase(),named=assets.get(key);
  const exact=named?.sha256.includes(item.sha256)?named:hashes.get(item.sha256),asset=exact||named;
  return asset?{...asset,matched:!!exact,image:'assets/terrain/'+asset.id+'.webp'}:null;
 }
 window.TerrainQuoteCatalog={ready,lookup};
})();
