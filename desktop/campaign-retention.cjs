const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const digest=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const DEFAULTS={conversations:{count:10000,bytes:32*1024*1024},documents:{count:250,bytes:32*1024*1024},memory:{count:64,bytes:32*1024*1024},memoryPerKind:8,scan:20000};
async function localDirectory(folder){try{const s=await fs.lstat(folder);if(!s.isDirectory()||s.isSymbolicLink())throw Error('History must be a local directory');}catch(e){if(e.code==='ENOENT')return false;throw e;}return true;}
async function boundedJSON(file,limit){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>limit)throw Error('Invalid retained undo history');return JSON.parse(await fs.readFile(file,'utf8'));}
async function retainCampaignHistory(folder,current,{limits={},protectedDocumentContents=[]}={}){
 const policy={...DEFAULTS,...limits},protectedMessages=new Set((current.chat||[]).map(digest)),protectedDocuments=new Set(protectedDocumentContents.filter(v=>typeof v==='string').map(digest));
 for(const relative of ['conversations','.document-history','memory',path.join('memory','history')])await localDirectory(path.join(folder,relative));
 // Never drop material still referenced by an active undo snapshot. Fail closed
 // if a log cannot be understood: cleanup is optional, undo preservation is not.
 const agent=path.join(folder,'.agent');
 if(await localDirectory(agent)){let log;try{log=await boundedJSON(path.join(agent,'activity.json'),1000000);}catch(e){if(e.code!=='ENOENT')throw e;log=[];}
  if(!Array.isArray(log)||log.length>10)throw Error('Invalid retained undo history');
  for(const entry of log){if(typeof entry.snapshot!=='string'||!/^[a-f0-9-]+\.json$/.test(entry.snapshot))throw Error('Invalid retained undo history');const previous=await boundedJSON(path.join(agent,entry.snapshot),15000000);for(const m of previous.chat||[])protectedMessages.add(digest(m));if(typeof entry.documentUndo?.previous==='string')protectedDocuments.add(digest(entry.documentUndo.previous));}
 }
 const report={schema:1,removedFiles:0,removedBytes:0,categories:{},protectedOverflow:false};
 async function prune(name,relative,pattern,pinned,group){
  const dir=path.join(folder,relative);if(!await localDirectory(dir))return;
  const rows=[];let scanned=0;const handle=await fs.opendir(dir);for await(const entry of handle){if(++scanned>policy.scan){report.categories[name]={scanLimitReached:true,removedFiles:0};return;}if(!entry.isFile()||!pattern.test(entry.name))continue;const file=path.join(dir,entry.name),s=await fs.lstat(file);if(s.isSymbolicLink()||!s.isFile())continue;rows.push({file,name:entry.name,bytes:s.size,at:s.mtimeMs});}
  rows.sort((a,b)=>b.at-a.at||a.name.localeCompare(b.name));const keep=new Set(rows.filter(r=>pinned.has(r.name)).map(r=>r.name)),groups=new Map();
  if(group)for(const r of rows){const key=group(r.name),n=groups.get(key)||0;if(n<policy.memoryPerKind)keep.add(r.name);groups.set(key,n+1);}
  let count=0,bytes=0;for(const r of rows)if(keep.has(r.name)){count++;bytes+=r.bytes;}
  for(const r of rows)if(!keep.has(r.name)&&count<policy[name].count&&bytes+r.bytes<=policy[name].bytes){keep.add(r.name);count++;bytes+=r.bytes;}
  let removed=0;for(const r of rows)if(!keep.has(r.name)){const s=await fs.lstat(r.file);if(s.isFile()&&!s.isSymbolicLink()&&s.size===r.bytes&&s.mtimeMs===r.at){await fs.unlink(r.file);removed++;report.removedBytes+=r.bytes;}}
  const overflow=count>policy[name].count||bytes>policy[name].bytes;report.protectedOverflow||=overflow;report.removedFiles+=removed;report.categories[name]={retainedFiles:count,retainedBytes:bytes,removedFiles:removed,protectedOverflow:overflow};
 }
 await prune('conversations','conversations',/^[a-f0-9]{64}\.json$/,new Set([...protectedMessages].map(h=>h+'.json')));
 await prune('documents','.document-history',/^[a-f0-9]{64}\.md$/,new Set([...protectedDocuments].map(h=>h+'.md')));
 if(await localDirectory(path.join(folder,'memory')))await prune('memory',path.join('memory','history'),/^(brief|established-facts|current-session|context)-[a-f0-9]{64}\.md$/,new Set(),name=>name.replace(/-[a-f0-9]{64}\.md$/,''));
 return report;
}
module.exports={retainCampaignHistory,DEFAULTS};
