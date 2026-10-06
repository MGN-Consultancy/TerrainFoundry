async function terrainEdit(project,changes,inventory){
 if(!Array.isArray(changes)||!changes.length||changes.length>100)throw Error('Choose 1–100 existing pieces');
 const p=structuredClone(project),seen=new Set(),assets=new Map(inventory.map(a=>[a.id,a]));
 const halfX=(p.world?.widthMm||p.board*p.grid)/2,halfZ=(p.world?.depthMm||p.board*p.grid)/2;
 for(const change of changes){if(!change||Object.keys(change).some(k=>!['pieceId','x','z','y','rotation'].includes(k))||seen.has(change.pieceId))throw Error('Invalid terrain edit');seen.add(change.pieceId);const item=p.items.find(i=>i.id===change.pieceId);if(!item)throw Error('Unknown placed piece');for(const key of ['x','z','y','rotation'])if(change[key]!==undefined){if(!Number.isFinite(change[key]))throw Error('Invalid terrain coordinate');item[key]=change[key];}if(item.y<0||item.y>10000||![0,90,180,270].includes(item.rotation))throw Error('Unsupported elevation or rotation');const a=assets.get(item.type);if(!a||![a.widthMm,a.depthMm].every(v=>Number.isFinite(v)&&v>0))throw Error('Piece dimensions unavailable');const swap=item.rotation%180!==0;if(Math.abs(item.x*p.grid)+(swap?a.depthMm:a.widthMm)/2>halfX||Math.abs(item.z*p.grid)+(swap?a.widthMm:a.depthMm)/2>halfZ)throw Error('Edited piece extends beyond the table');}
 require('./project-store.cjs').check(JSON.stringify(p));
 const {footprintsOverlap}=await import('./campaign-footprints.mjs'),spec=i=>{const a=assets.get(i.type);return {width:a.widthMm,depth:a.depthMm,footprints:a.footprints};};
 // Reject newly introduced collisions; pre-existing assemblies can retain deliberate overlaps.
 for(const item of p.items.filter(i=>seen.has(i.id)))for(const other of p.items){if(item.id===other.id||Math.abs(item.y-other.y)>=7.99||!assets.has(other.type))continue;const old=project.items.find(i=>i.id===item.id),oldOther=project.items.find(i=>i.id===other.id);if(footprintsOverlap(item,spec(item),other,spec(other))&&!(Math.abs(old.y-oldOther.y)<7.99&&footprintsOverlap(old,spec(old),oldOther,spec(oldOther))))throw Error('Edited pieces introduce an overlap');}
 return p;
}
module.exports={terrainEdit};
