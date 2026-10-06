import {defaults,validateProject} from './model.js';
export const TABLES=[['Skirmish · 3 × 3 ft',914.4,914.4],['Battle · 4 × 4 ft',1219.2,1219.2],['Gaming table · 6 × 4 ft',1828.8,1219.2],['Large table · 8 × 4 ft',2438.4,1219.2],['Dining table · 180 × 90 cm',1800,900]];
const id=()=>crypto.randomUUID();
// Imported asset objects are immutable; cache their exact content once per object.
const encodings=new WeakMap();const encode=a=>{if(!encodings.has(a))encodings.set(a,JSON.stringify(a));return encodings.get(a);};
export function toWorld(scene,widthMm=1828.8,depthMm=1219.2){
 const p=structuredClone(scene);p.version=2;p.kind='world';p.world={widthMm,depthMm,activeLevel:'ground',placementOffset:0,levels:[{id:'ground',name:'Ground',elevation:0,visible:true}],encounters:[],instances:[]};
 p.items.forEach(i=>{i.levelId='ground';delete i.encounterId;});return validateProject(p);
}
export const tableSize=p=>p.kind==='world'?[p.world.widthMm,p.world.depthMm]:[p.board*p.grid,p.board*p.grid];
export const activeLevel=p=>p.world?.levels.find(l=>l.id===p.world.activeLevel);
export const placementHeight=p=>Math.max(0,Math.min(10000,(activeLevel(p)?.elevation||0)+(p.world?.placementOffset||0)));
export const visibleItem=(p,i)=>p.kind!=='world'||p.world.levels.find(l=>l.id===i.levelId)?.visible!==false;
export function addEncounter(p,input){
 const scene=validateProject(input);if(scene.kind==='world')throw Error('Choose a saved scene or encounter, not another world.');
 if(scene.grid!==p.grid||scene.connectors!==p.connectors)throw Error('Encounter grid and connector settings must match this world.');
 if(!scene.items.length)throw Error('This encounter is empty.');
 const e={id:id(),scene};const candidate=structuredClone(p);candidate.world.encounters.push(e);validateProject(candidate,false);p.world.encounters.push(e);return e;
}
export function placeEncounter(p,templateId,x,z){
 const e=p.world.encounters.find(e=>e.id===templateId);if(!e)throw Error('Encounter unavailable');
 if(e.scene.grid!==p.grid||e.scene.connectors!==p.connectors)throw Error('Encounter settings no longer match this world');
 if(p.items.length+e.scene.items.length>5000)throw Error('World limit is 5,000 pieces.');
 const level=activeLevel(p);if(!level.visible)throw Error('Show the active level before placing pieces.');
 const items=e.scene.items,cx=(Math.min(...items.map(i=>i.x))+Math.max(...items.map(i=>i.x)))/2,cz=(Math.min(...items.map(i=>i.z))+Math.max(...items.map(i=>i.z)))/2,base=Math.min(...items.map(i=>i.y));
 const group={id:id(),name:e.scene.name,templateId:e.id},assets={...p.assets},mapping={};
 for(const [key,a]of Object.entries(e.scene.assets||{})){let target=key;if(assets[key]&&encode(assets[key])!==encode(a)){const encoded=encode(a);target=Object.keys(assets).find(k=>encode(assets[k])===encoded)||'u-'+id();}mapping[key]=target;if(!assets[target])assets[target]=structuredClone(a);}
 const placed=items.map(i=>({...i,id:id(),type:mapping[i.type]||i.type,x:i.x-cx+x,z:i.z-cz+z,y:i.y-base+level.elevation,levelId:level.id,encounterId:group.id}));
 const [w,d]=tableSize(p);if(placed.some(i=>Math.abs(i.x*p.grid)>w/2||Math.abs(i.z*p.grid)>d/2))throw Error('Encounter piece centres extend beyond this table. Place it further inside.');
 const candidate={...p,assets,items:[...p.items,...placed],world:{...p.world,instances:[...p.world.instances,group]}};validateProject(candidate,false);
 if(Object.keys(assets).length)p.assets=assets;p.items.push(...placed);p.world.instances.push(group);return placed[0].id;
}
export const selectionItems=(p,item)=>item.encounterId?p.items.filter(i=>i.encounterId===item.encounterId):[item];
export function transformSelection(p,item,next){
 const members=selectionItems(p,item),a=(next.rotation-item.rotation)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const result=members.map(i=>{const dx=i.x-item.x,dz=i.z-item.z;return {i,x:next.x+c*dx+s*dz,z:next.z-s*dx+c*dz,y:i.y+next.y-item.y,rotation:i.rotation+next.rotation-item.rotation};});
 if(result.some(i=>!['x','z','y','rotation'].every(k=>Number.isFinite(i[k])&&Math.abs(i[k])<=10000)||i.y<0))throw Error('The encounter must remain above zero with coordinates below 10,000.');
 for(const {i,...values}of result)Object.assign(i,values);
}
export function extractEncounter(p,item){
 return extractScene(p,selectionItems(p,item),p.world?.instances.find(g=>g.id===item.encounterId)?.name||'Saved encounter');
}
export function extractLevel(p){const l=activeLevel(p);return extractScene(p,p.items.filter(i=>i.levelId===l.id),p.name+' · '+l.name);}
function extractScene(p,members,name){
 if(!members.length)throw Error('Add pieces to this level before saving it as a scene.');
 const scene=defaults();scene.name=name.slice(0,120);scene.grid=p.grid;scene.connectors=p.connectors;scene.printer=structuredClone(p.printer);
 const cx=(Math.min(...members.map(i=>i.x))+Math.max(...members.map(i=>i.x)))/2,cz=(Math.min(...members.map(i=>i.z))+Math.max(...members.map(i=>i.z)))/2,y=Math.min(...members.map(i=>i.y));
 scene.items=members.map(i=>{const n={...i,x:i.x-cx,z:i.z-cz,y:i.y-y};delete n.levelId;delete n.encounterId;return n;});scene.assets=Object.fromEntries(Object.entries(p.assets||{}).filter(([key])=>members.some(i=>i.type===key)));
 scene.board=Math.max(24,Math.min(400,Math.ceil(Math.max(...scene.items.map(i=>Math.max(Math.abs(i.x),Math.abs(i.z))))*2+4)));return validateProject(scene);
}
