const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {check,atomicWrite}=require('./project-store.cjs');
const PNG='data:image/png;base64,';
function previewBytes(value){
 if(typeof value!=='string'||!value.startsWith(PNG)||value.length>600000)throw Error('Invalid scene preview');
 const bytes=Buffer.from(value.slice(PNG.length),'base64');
 if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)<1||bytes.readUInt32BE(16)>2048||bytes.readUInt32BE(20)<1||bytes.readUInt32BE(20)>2048)throw Error('Invalid PNG preview');
 return bytes;
}
function createSceneLibrary({directory}){
 const indexFile=path.join(directory,'index.json');let queue=Promise.resolve();
 const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
 const validId=id=>{if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid saved scene');return id;};
 async function index(){try{const s=await fs.stat(indexFile);if(s.size>1000000)throw Error('Scene library index is too large');const entries=JSON.parse(await fs.readFile(indexFile,'utf8'));if(!Array.isArray(entries)||entries.length>1000||entries.some(e=>!e||!/^[a-f0-9]{32}$/.test(e.id)||typeof e.name!=='string'||e.name.length>120||!Number.isInteger(e.pieces)||e.pieces<0||e.pieces>5000||!Number.isFinite(e.modified)))throw Error('Invalid scene library index');return entries;}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function save(data,source){check(data);const p=JSON.parse(data);if(p.kind==='world'||p.version!==1)throw Error('Save a scene or encounter to this library, rather than a whole world');if(!p.items.length)throw Error('Empty scenes are not added to the encounter library');if(p.name.length>120||p.items.length>5000)throw Error('Invalid scene');const image=previewBytes(p.preview);if(typeof source!=='string'||!source||source.length>4000)throw Error('Invalid scene source');
  return serial(async()=>{await fs.mkdir(directory,{recursive:true});const entries=await index(),id=createHash('sha256').update(path.resolve(source).toLowerCase()).digest('hex').slice(0,32),existing=entries.findIndex(e=>e.id===id);if(existing<0&&entries.length>=1000)throw Error('The local library supports 1,000 scenes');
   const entry={id,name:p.name,pieces:p.items.length,modified:Date.now(),revision:createHash('sha256').update(data).digest('hex')};
   await atomicWrite(path.join(directory,id+'.terrain'),data);await atomicWrite(path.join(directory,id+'.png'),image);if(existing<0)entries.push(entry);else entries[existing]=entry;await atomicWrite(indexFile,JSON.stringify(entries));return entry;
  });
 }
 async function load(id){validId(id);if(!(await index()).some(e=>e.id===id))throw Error('Saved scene is unavailable');const file=path.join(directory,id+'.terrain'),stat=await fs.lstat(file);if(!stat.isFile()||stat.size>100000000)throw Error('Invalid saved scene file');const data=await fs.readFile(file,'utf8');check(data);if(JSON.parse(data).kind==='world')throw Error('Invalid saved scene');return {data,revision:createHash('sha256').update(data).digest('hex')};}
 async function list({query='',page=0}={}){if(typeof query!=='string'||query.length>120||!Number.isInteger(page)||page<0||page>1000)throw Error('Invalid library query');const entries=(await index()).filter(e=>e.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.modified-a.modified||a.id.localeCompare(b.id));const pages=Math.max(1,Math.ceil(entries.length/12)),current=Math.min(page,pages-1),shown=entries.slice(current*12,current*12+12);return {page:current,pages,total:entries.length,entries:await Promise.all(shown.map(async e=>{let preview=null;try{const file=path.join(directory,e.id+'.png'),s=await fs.lstat(file);if(!s.isFile()||s.size>450000)throw Error('Invalid preview');const bytes=await fs.readFile(file);preview=PNG+bytes.toString('base64');previewBytes(preview);}catch{}return {...e,preview};}))};}
 return {directory,save,list,load,flush:()=>queue};
}
module.exports={createSceneLibrary,previewBytes};
