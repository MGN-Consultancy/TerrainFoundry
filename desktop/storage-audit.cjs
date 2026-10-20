const fs=require('node:fs/promises'),path=require('node:path');
const labels={campaigns:'Campaigns and design conversations',projects:'Worlds and encounters',library:'Personal asset library',free:'Installed free scenery',premium:'Installed premium scenery',recovery:'Recovery and project backups',cache:'Disposable cache',logs:'Logs',indexes:'Indexes and settings',editor:'Editor installation',profile:'Other local application data'};
const inside=(file,root)=>{const r=path.relative(root,file);return r===''||r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const identity=file=>process.platform==='win32'?file.toLowerCase():file;
async function noLinks(file){let current=path.resolve(file),parts=[];for(;;){parts.push(current);const parent=path.dirname(current);if(parent===current)break;current=parent;}for(const part of parts.reverse()){const stat=await fs.lstat(part);if(stat.isSymbolicLink()){const error=Error('Linked storage folder omitted');error.code='ELINK';throw error;}}return fs.realpath(file);}
// Metadata only: never reads pack payloads, private settings or model contents.
// Work is bounded and yields regularly so an audit cannot freeze the editor.
async function auditStorage(options={}){
 const {installRoot,userData,documents}=options;if(![installRoot,userData,documents].every(p=>typeof p==='string'&&p.length))throw Error('Storage audit requires application and user directories');
 const campaign=options.campaignDirectory||process.env.TERRAIN_CAMPAIGN_DIR||path.join(documents,'Terrain Foundry','Campaigns'),library=options.creativeDirectory||process.env.TERRAIN_CREATIVE_LIBRARY||path.join(documents,'Terrain Foundry','Asset Library'),scenes=options.sceneDirectory||process.env.TERRAIN_SCENE_LIBRARY||path.join(documents,'Terrain Foundry','Encounter Library'),projects=options.projectsDirectory||path.join(documents,'Terrain Foundry','Projects');
 const result={totalBytes:0,totalFiles:0,categories:Object.entries(labels).map(([id,label])=>({id,label,bytes:0,files:0})),partial:false,skippedSymlinks:0,skippedOutsideRoots:0,measuredAt:new Date().toISOString()};
 const categories=new Map(result.categories.map(c=>[c.id,c])),seen=new Set(),visited=new Set(),roots=[];
 const limits={maxFiles:100000,maxDirectories:20000,maxMs:10000,...options.limits};for(const key of Object.keys(limits))if(!Number.isFinite(limits[key])||limits[key]<1)throw Error('Invalid storage audit limits');
 const started=Date.now();let operations=0,dirs=0;
 const expired=()=>result.totalFiles>=limits.maxFiles||dirs>=limits.maxDirectories||Date.now()-started>=limits.maxMs;
 async function tick(){if(++operations%64===0)await new Promise(resolve=>setImmediate(resolve));if(expired()){result.partial=true;return false;}return true;}
 function add(id,folder){if(typeof folder==='string'&&folder.length&&roots.length<3000)roots.push({id,folder:path.resolve(folder)});else if(roots.length>=3000)result.partial=true;}
 const allowed=[documents,userData,library,campaign,scenes,projects,...(options.userRoots||[])].filter(p=>typeof p==='string').map(p=>path.resolve(p));
 // Registered folders are supplied by the native owner, never renderer input.
 for(const folder of options.registeredFolders||[])add('campaigns',folder);
 try{const registry=path.join(campaign,'workspaces.json');await noLinks(registry);const stat=await fs.lstat(registry);if(stat.isFile()&&stat.size<=2000000){const value=JSON.parse(await fs.readFile(registry,'utf8'));for(const [id,folder] of Object.entries(value).slice(0,2000)){if(!/^[a-f0-9-]{16,40}$/.test(id)||typeof folder!=='string')continue;const resolved=path.resolve(folder);if(allowed.some(root=>inside(resolved,root)))add('campaigns',resolved);else result.skippedOutsideRoots++;}}else result.partial=true;}catch(e){if(e.code==='ELINK')result.skippedSymlinks++;else if(e.code!=='ENOENT')result.partial=true;}
 let packs=options.assetPacks??process.env.TERRAIN_ASSET_PACKS;
 if(typeof packs==='string'){try{packs=JSON.parse(packs);}catch{result.partial=true;packs={};}}
 if(packs&&typeof packs==='object'&&!Array.isArray(packs))for(const folder of Object.values(packs).slice(0,2000))add('free',folder);
 else if(packs==null)add('free',path.join(installRoot,'release','asset-packs'));
 add('premium',options.premiumDirectory||path.join(userData,'premium','packs'));add('recovery',options.recoveryDirectory||path.join(userData,'projects'));add('cache',options.cacheDirectory||path.join(library,'Cache'));add('cache',path.join(library,'Cache'));add('logs',path.join(userData,'logs'));
 for(const name of ['Cache','Code Cache','GPUCache','DawnCache','Session Storage'])add('cache',path.join(userData,name));
 add('campaigns',campaign);add('projects',projects);add('projects',scenes);add('library',library);add('indexes',path.join(documents,'Terrain Foundry','Preferences'));add('profile',userData);add('editor',installRoot);
 function classify(id,file){if(id==='library'&&['library.json','owned-packs.json'].includes(path.basename(file)))return 'indexes';if(id==='profile'&&/\.(?:json|db|sqlite)$/i.test(file))return 'indexes';if(id==='profile'&&/\.(?:log|old)$/i.test(file))return 'logs';return id;}
 async function walk(folder,id,depth=0){if(!await tick())return;if(depth>24){result.partial=true;return;}let stat,canonical;try{stat=await fs.lstat(folder);if(stat.isSymbolicLink()){result.skippedSymlinks++;return;}canonical=await fs.realpath(folder);}catch(e){if(e.code!=='ENOENT')result.partial=true;return;}const key=identity(canonical);
  if(stat.isFile()){if(seen.has(key))return;seen.add(key);const c=categories.get(classify(id,folder));c.bytes+=stat.size;c.files++;result.totalBytes+=stat.size;result.totalFiles++;return;}
  if(!stat.isDirectory()||visited.has(key))return;visited.add(key);dirs++;try{const handle=await fs.opendir(folder);for await(const entry of handle){if(expired()){result.partial=true;break;}await walk(path.join(folder,entry.name),id,depth+1);}}catch(e){if(e.code!=='ENOENT')result.partial=true;}
 }
 for(const root of roots){if(expired()){result.partial=true;break;}try{await noLinks(root.folder);await walk(root.folder,root.id);}catch(e){if(e.code==='ELINK')result.skippedSymlinks++;else if(e.code!=='ENOENT')result.partial=true;}}
 return result;
}
module.exports={auditStorage,createStorageAudit:options=>()=>auditStorage(options)};
