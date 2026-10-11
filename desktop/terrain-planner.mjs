import {sceneryReadiness} from './scenery-metadata.mjs';
import {footprintsOverlap} from './campaign-footprints.mjs';
function convexPolygon(p){
 if(!Array.isArray(p)||p.length<3||p.length>1000||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(n=>Number.isFinite(n)&&Math.abs(n)<=22000)))return false;
 let area=0,sign=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length];area+=a[0]*b[1]-b[0]*a[1];const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)>1e-8){if(sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross);}}return Math.abs(area)>1e-8&&sign!==0;
}
// Validate a provisional batch against the current canvas, never against a model's claims.
export function terrainBatch(project,action,inventory){
 if(action?.type!=='proposeTerrain'||!Array.isArray(action.items)||!action.items.length||action.items.length>100)throw Error('Propose 1–100 pieces per batch');
 if(!project||!Array.isArray(project.items)||!Number.isFinite(project.grid)||project.grid<=0||project.grid>1000)throw Error('Invalid active table grid');
 if(!Array.isArray(inventory))throw Error('Installed asset metadata is unavailable');
 const available=new Map(inventory.map(a=>[a.id,a])),grid=project.grid;
 const width=project.kind==='world'?project.world?.widthMm:project.board*grid,depth=project.kind==='world'?project.world?.depthMm:project.board*grid;
 if(![width,depth].every(n=>Number.isFinite(n)&&n>0&&n<=22000))throw Error('Invalid active table dimensions');
 const spec=type=>{const a=available.get(type);if(!a||![a.widthMm,a.depthMm].every(n=>Number.isFinite(n)&&n>0&&n<22000))throw Error('A measured footprint is unavailable for '+type);if(a.footprints!==undefined&&(!Array.isArray(a.footprints)||!a.footprints.length||a.footprints.length>100||a.footprints.some(p=>!convexPolygon(p))))throw Error('Invalid measured footprint for '+type);return {width:a.widthMm,depth:a.depthMm,footprints:a.footprints};};
 const level=project.kind==='world'&&Array.isArray(project.world?.levels)?project.world.levels.find(l=>l.id===project.world.activeLevel):null;
 if(project.kind==='world'&&(!level||!Number.isFinite(level.elevation)||level.elevation<0||level.elevation>9000))throw Error('Choose a valid active world level');
 if(level?.visible===false)throw Error('Show the active level before proposing scenery');
 const validPlacement=i=>i&&typeof i.type==='string'&&['x','z','y','rotation'].every(k=>Number.isFinite(i[k]))&&i.y>=0&&i.y<=10000&&[0,90,180,270].includes(i.rotation);
 if(project.items.some(i=>!validPlacement(i)))throw Error('An existing placement has invalid coordinates');
 const added=action.items.map(i=>{if(!validPlacement(i)||Object.keys(i).some(k=>!['type','x','z','y','rotation'].includes(k)))throw Error('Invalid terrain placement');
  if(level&&i.y<level.elevation)throw Error('A proposed piece is below the active level elevation');
  const record=available.get(i.type);if(record?.assetKind==='scenery'&&!sceneryReadiness(record.design||{}).ready)throw Error('Complete scenery metadata before automatic placement: '+i.type);
  const s=spec(i.type),angle=i.rotation*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle),shapes=s.footprints||[[[-s.width/2,-s.depth/2],[s.width/2,-s.depth/2],[s.width/2,s.depth/2],[-s.width/2,s.depth/2]]];
  for(const [x,z]of shapes.flat()){if(Math.abs(i.x*grid+c*x+sn*z)>width/2+.01||Math.abs(i.z*grid-sn*x+c*z)>depth/2+.01)throw Error('A proposed footprint extends beyond the table');}
  return {...i,id:crypto.randomUUID(),color:'#ffffff',...(level?{levelId:level.id}:{})};
 });
 const all=[...(project.items||[]),...added];if(all.length>5000)throw Error('World limit is 5,000 pieces');
 const normalized=i=>({...i,x:i.x*grid/25.4,z:i.z*grid/25.4});
 for(let a=project.items.length;a<all.length;a++)for(let b=0;b<a;b++){const i=all[a],j=all[b];if(Math.abs(i.y-j.y)<7.99){const si=spec(i.type),sj=spec(j.type);if(footprintsOverlap(normalized(i),si,normalized(j),sj))throw Error('Proposed scenery overlaps another footprint. Ask for a revised batch.');const gap=Math.max(available.get(i.type)?.design?.scenery?.spacingMm||0,available.get(j.type)?.design?.scenery?.spacingMm||0);if(gap>0&&footprintsOverlap(normalized(i),{width:si.width+gap,depth:si.depth+gap},normalized(j),{width:sj.width+gap,depth:sj.depth+gap}))throw Error('Scenery spacing clearance is too small. Ask for a revised batch.');}}
 return {added,project:{...project,items:all},warnings:['Footprints and table bounds checked. Entrances, routes, structural support and physical connector fit need your review.']};
}
export const terrainInstructions=`When view.terrain is present you are designing the active world or encounter with the same companion. Preserve its agreed size, levels, existing placements and locked pieces. Use activeEditor and findAssets to choose existing owned assets before offering generation. Plan in short stages: size/style/important areas, then buildings and entrances with spacing, then roads/rivers connecting areas, then props. Ask whether caves should be separate reusable lift-on encounters or playable interiors in the world. Keep one compact evolving draftBrief as the design plan; do not stack briefs. Never invent available packs or matching geometry. Missing assets must be explained; ask whether to design/import them. To show a provisional batch use proposeTerrain {name,items:[{type,x,z,y,rotation}]}, at most100 real installed types. This only previews on the active canvas, even in agent mode. The user keeps it, tries again or adjusts manually; never claim applied until confirmed. Coordinate x,z is grid squares at activeEditor.gridMm; y is absolute millimetres and must respect the chosen level elevation. Valid rotations0/90/180/270. Keep the whole footprint inside table bounds and avoid overlapping bases at the same elevation. Treat door paths, stair transitions and unknown connectors as unverified. Existing pieces are preserved; propose additions in small connected batches. Refresh activeEditor after changes. Use shared library metadata, not mesh contents. Personal scenery requires complete design.scenery metadata before automatic placement. Match environment, era, scale, style and materials; use floor datum, seam/connector family, entrances, traversal, elevations and spacing constraints to propose believable layouts. Unknown metadata is a reason to ask, not to guess. Only suggest a purchasable pack if its real catalogue metadata is available; never assume ownership.`;
