const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_MODEL_BYTES=100*1024*1024;
export function validId(id){if(typeof id!=='string'||!UUID.test(id))throw Error('Invalid asset identifier');return id;}
export function safeName(value){if(typeof value!=='string'||!value.trim()||value.length>120||/[\x00-\x1f]/.test(value))throw Error('Choose a name of 1 to 120 characters');return value.trim();}
function jsonData(value,depth=0){if(depth>12)throw Error('Asset metadata is too deeply nested');if(value===null||typeof value==='boolean')return;if(typeof value==='number'&&Number.isFinite(value))return;if(typeof value==='string'&&value.length<=200000)return;if(Array.isArray(value)&&value.length<=1000){value.forEach(v=>jsonData(v,depth+1));return;}if(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length<=200){for(const [key,v] of Object.entries(value)){if(/^(?:__proto__|constructor|prototype|api[-_]?key|accessToken|refreshToken|authorization|token|secret|password|activationCode|entitlement|privateKey)$/i.test(key))throw Error('Credentials cannot be stored in an asset');jsonData(v,depth+1);}return;}throw Error('Invalid asset metadata');}
export function validateRecord(record){
 if(!record||typeof record!=='object'||record.schema!==1)throw Error('Unsupported asset schema');
 const allowed=['schema','id','kind','name','description','stage','packId','packName','concepts','selectedConceptId','sheet','design','model','modelJob','references','source','licence','createdAt','updatedAt'];
 if(Object.keys(record).some(k=>!allowed.includes(k)))throw Error('Unknown asset field');validId(record.id);safeName(record.name);
 if(!['character','scenery'].includes(record.kind)||!['brief','concept','model','sheet'].includes(record.stage))throw Error('Invalid asset kind or stage');
 if(typeof record.description!=='string'||record.description.length>20000)throw Error('Asset description is too long');
 if(record.packId!==null&&record.packId!==undefined)validId(record.packId);if(record.packName)safeName(record.packName);
 if(!Array.isArray(record.concepts)||record.concepts.length>30)throw Error('Keep at most 30 concepts per asset');const ids=new Set();let imageBytes=0;
 for(const c of record.concepts){validId(c.id);if(ids.has(c.id))throw Error('Duplicate concept');ids.add(c.id);if(Object.keys(c).some(k=>!['id','image','name','retained','approved','createdAt','prompt','provider','model','usage'].includes(k)))throw Error('Unknown concept field');safeName(c.name);if(typeof c.retained!=='boolean'||typeof c.approved!=='boolean'||!Number.isFinite(c.createdAt))throw Error('Invalid concept');if(typeof c.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(c.image)||c.image.length>16*1024*1024)throw Error('Invalid concept image');if(c.prompt!==undefined&&(typeof c.prompt!=="string"||c.prompt.length>20000))throw Error("Invalid concept prompt");for(const key of ["provider","model","usage"])if(c[key]!==undefined)jsonData(c[key]);imageBytes+=c.image.length;}
 if(imageBytes>64*1024*1024)throw Error('Concept collection is too large');if(record.selectedConceptId!=null&&!ids.has(record.selectedConceptId))throw Error('Selected concept is unavailable');
 if(!Array.isArray(record.references)||record.references.length>1000||record.references.some(r=>!r||typeof r!=='object'||Array.isArray(r)||typeof r.type!=='string'||r.type.length>120))throw Error('Invalid asset references');
 for(const r of record.references)if(r.type==='design-conversation')validId(r.campaignId);
 for(const key of ['sheet','design','model','modelJob','references','source','licence'])if(record[key]!==undefined)jsonData(record[key]);
 for(const key of ['createdAt','updatedAt'])if(!Number.isFinite(record[key])||record[key]<0)throw Error('Invalid asset timestamp');return record;
}
export function validateOwnedReferences(refs){if(!Array.isArray(refs)||refs.length>1000)throw Error('Invalid owned pack references');return refs.map(r=>{if(!r||Object.keys(r).some(k=>!['packId','name','version','licence','source','sha256'].includes(k))||typeof r.packId!=='string'||r.packId.length>200)throw Error('Backups contain pack references, not activation credentials');jsonData(r);return r;});}


