import {validateCampaign,campaignRecordCandidate,reviewedLayout} from './campaign-schema.mjs';
import {footprintsOverlap} from './campaign-footprints.mjs';
const string=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Assistant text exceeds its limit');return v;};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('Unsupported assistant action fields');};
const tabs=['Story','Items','Connections','Timeline','Notes','Maps','Characters','Linked projects','GM screen','Soundboard','Playbook','Print'];
export function assistantContext(v={}){
 exact(v,['activeTab','selectedCollection','selectedId']);if(!tabs.includes(v.activeTab||'Story'))throw Error('Unknown campaign section');
 if(v.selectedCollection&&!['items','relationships','timeline','notes','characters','widgets','pins'].includes(v.selectedCollection))throw Error('Unknown selected campaign record');
 if(v.selectedId&& !/^[a-f0-9-]{16,40}$/.test(v.selectedId))throw Error('Invalid selected campaign record');
 return {activeTab:v.activeTab||'Story',selectedCollection:v.selectedCollection||null,selectedId:v.selectedId||null};
}
export function briefCandidate(c,value){
 exact(value,['name','setup','summary','progress']);const candidate=structuredClone(validateCampaign(c));
 for(const key of ['name','summary','progress'])if(value[key]!==undefined)candidate[key]=value[key];
 if(value.setup){exact(value.setup,['genre','theme','party','missions','length','rules','boundaries']);Object.assign(candidate.setup,value.setup);}
 return validateCampaign(candidate);
}
export function validateLayout(value,inventory){
 exact(value,['name','items']);const available=new Map(inventory.map(a=>[a.id,a])),layout=reviewedLayout(value,[...available.keys()]);
 const spec=i=>{const a=available.get(i.type);if(![a.widthMm,a.depthMm].every(v=>Number.isFinite(v)&&v>0&&v<=1000))throw Error('Asset footprint is unavailable');return {width:a.widthMm,depth:a.depthMm,footprints:a.footprints};};
 for(const i of layout.items){const s=spec(i),swap=i.rotation%180!==0;if(Math.abs(i.x)*25.4+(swap?s.depth:s.width)/2>304.8||Math.abs(i.z)*25.4+(swap?s.width:s.depth)/2>304.8)throw Error('Proposed scenery extends beyond the encounter');}
 for(let a=0;a<layout.items.length;a++)for(let b=a+1;b<layout.items.length;b++){const i=layout.items[a],j=layout.items[b];if(Math.abs(i.y-j.y)<7.99&&footprintsOverlap(i,spec(i),j,spec(j)))throw Error('Proposed scenery overlaps. Ask for a revised layout.');}
 return layout;
}
export function validateAction(action,c,{inventory=[],savedScenes=[]}={}){
 if(!action||typeof action.type!=='string')throw Error('Invalid assistant action');
 if(['findAssets','findSavedScenes'].includes(action.type)){exact(action,['type','query']);return {type:action.type,query:string(action.query||'',120)};}
 if(action.type==='updateBrief'){
  exact(action,['type','brief']);const candidate=briefCandidate(c,action.brief);return {type:action.type,brief:{name:candidate.name,setup:candidate.setup,summary:candidate.summary,progress:candidate.progress}};
 }
 if(action.type==='upsertRecord'){
  exact(action,['type','collection','record']);const fields={items:['id','category','title','body','visible'],characters:['id','name','details','abilities','equipment','spells','hp','ac','visible'],notes:['id','title','body','visible','itemId'],timeline:['id','date','title','body','visible','itemId'],relationships:['id','from','to','label','body','visible']};
  if(!fields[action.collection])throw Error('This campaign record action is unsupported');exact(action.record,fields[action.collection]);
  if(action.record.id&&!c[action.collection].some(x=>x.id===action.record.id))throw Error('Cannot update an unknown campaign record');
  const old=action.record.id?c[action.collection].find(x=>x.id===action.record.id):null;const r={...old,...action.record,id:action.record.id||crypto.randomUUID(),visible:action.record.visible===undefined?(old?.visible||false):action.record.visible};
  if(action.collection==='items'){r.category??='Lore';if(!c.categories.includes(r.category))throw Error('Unknown campaign category');r.body??='';}
  if(action.collection==='characters'){r.details??='';r.abilities??='';r.equipment??='';r.spells??='';r.hp??=0;r.ac??=0;r.portrait=c.characters.find(x=>x.id===r.id)?.portrait||null;}
  if(['notes','timeline'].includes(action.collection)){r.itemId??=null;r.body??='';}if(action.collection==='relationships')r.body??='';
  const candidate=campaignRecordCandidate(c,action.collection,r);const normalized=candidate[action.collection].find(x=>x.id===r.id);return {type:action.type,collection:action.collection,record:Object.fromEntries(fields[action.collection].filter(k=>k!=='id'||action.record.id).map(k=>[k,normalized[k]]))};
 }
 if(action.type==='linkSavedScene'){
  exact(action,['type','id']);if(!savedScenes.some(x=>x.id===action.id))throw Error('Saved encounter is unavailable');return {type:action.type,id:action.id};
 }
 if(action.type==='chooseProjectFile'){exact(action,['type']);return {type:action.type};}
 if(action.type==='openLinkedProject'){
  exact(action,['type','id']);if(!c.links.some(x=>x.id===action.id))throw Error('Linked world or scene is unavailable');return {type:action.type,id:action.id};
 }
 if(action.type==='proposeEncounter'){
  exact(action,['type','layout']);const layout=validateLayout(action.layout,inventory);return {type:action.type,layout:{name:layout.name,items:layout.items.map(({type,x,z,y,rotation})=>({type,x,z,y,rotation}))}};
 }
 throw Error('Unsupported assistant action');
}
export function parseAssistantReply(text,c,environment){
 const value=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));exact(value,['message','nextStep','actions','draftBrief','choices']);
 const message=string(value.message,20000);if(!message.trim())throw Error('Assistant returned no conversation');const nextStep=string(value.nextStep||'',500);
 if(!Array.isArray(value.actions||[])||(value.actions||[]).length>5)throw Error('Assistant proposed too many actions');
 const actions=(value.actions||[]).map(a=>validateAction(a,c,environment));let draftBrief=null;
 if(value.draftBrief){const d=briefCandidate(c,value.draftBrief);draftBrief={name:d.name,setup:d.setup,summary:d.summary,progress:d.progress};}
 const choices=value.choices||[];if(!Array.isArray(choices)||choices.length>4)throw Error('Assistant choices exceed the limit');return {message,nextStep,actions,draftBrief,choices:choices.map(choice=>{exact(choice,['label','prompt']);return {label:string(choice.label,80),prompt:string(choice.prompt,1000)};})};
}
export const assistantInstructions=`For assistant mode return ONLY JSON {message,nextStep,actions:[],draftBrief:null,choices:[]}. Treat the user as a beginner. Explain one step at a time in plain language and define unfamiliar terms. When asking a question, provide 2 to 4 choices {label,prompt}, each a short suggested answer; allow a free-text alternative. Choosing a suggestion only fills the prompt and never sends a paid request or applies an action. Use linkedProjects piece coordinates, level elevations and encounter instances to ground travel, entrances, obstacles and encounter suggestions; distinguish stored templates from placed instances. Do not infer traversability, hidden doors, traps, line of sight or characters from generic geometry: ask when unknown. For rules outcomes name the selected rules system/version, explain the relevant check and dice, ask for actual roll results and uncertain details, and mark optional rulings as suggestions for DM review. Do not invent official rules or roll outcomes. Never silently change the campaign. Converse naturally. If assistant.phase is brief, ask just ONE manageable question at a time about world/era, tone, party, missions, length, rules or boundaries. Summarise known answers in draftBrief {name,setup:{genre,theme,party,missions,length,rules,boundaries},summary,progress}. Do not invent answers, use empty strings for unknown facts; accept skip/default requests. When ready offer a complete brief for review. Never claim anything was saved, applied, imported or built. The client does those steps only after review. Guide the next useful step for the active section. Explain campaign entries as people, places, missions and lore; relationships join those entries; timeline orders events; linked projects are local copies of worlds/encounters. Read-only lookup actions: findAssets {query}, findSavedScenes {query}. They search the actual complete installed catalogue without modifying it. The context inventory is a relevant bounded selection, not every installed piece. Supported write actions ONLY: updateBrief {brief}; upsertRecord {collection:items|characters|notes|timeline|relationships,record}; linkSavedScene {id}; chooseProjectFile {}; openLinkedProject {id}; proposeEncounter {layout:{name,items:[{type,x,z,y,rotation}]}}. Include type in every action. Use existing IDs only for updates, relationships, saved scenes and links; omit id for new records. New content is DM-only unless the user explicitly requests player visibility. Use actual inventory type IDs and dimensions, no invented scenery. No deletion, arbitrary code, paths, files or URLs. Show reviewable drafts; maximum 5 actions. Layout coordinates use 25.4mm squares x,z within -12..12, y mm0..254 and rotation0/90/180/270. Do not overlap footprints; floor and wall edges may meet. Available saved-scene metadata and installed geometry do not grant access to arbitrary files.`;

export function applyCampaignAction(c,action){
 if(action.type==='updateBrief'){const next=briefCandidate(c,action.brief);next.assistant={phase:'studio',nextStep:'Brief saved. Ask your assistant to draft an opening mission or character.',draftBrief:null};return next;}
 if(action.type==='upsertRecord'){const record={...action.record,id:action.record.id||crypto.randomUUID()};if(action.collection==='characters')record.portrait=c.characters.find(x=>x.id===record.id)?.portrait||null;return campaignRecordCandidate(c,action.collection,record);}
 throw Error('Action requires a project review');
}
