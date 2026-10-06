const fs=require('node:fs/promises'),path=require('node:path');
const {atomicWrite}=require('./project-store.cjs');
const digest=text=>require('node:crypto').createHash('sha256').update(text).digest('hex');
function workingMemory(c){
 return {brief:{name:c.name,setup:c.setup,summary:c.summary},progress:c.progress,
 facts:[...c.items.map(x=>({id:x.id,title:x.title,body:x.body,visible:x.visible})),...c.characters.map(x=>({id:x.id,name:x.name,details:x.details,visible:x.visible}))],
 relationships:c.relationships,timeline:c.timeline,notes:c.notes,links:c.links.map(({id,name,kind})=>({id,name,kind}))};
}
async function writeMemory(folder,c){
 const dir=path.join(folder,'memory');await fs.mkdir(path.join(dir,'history'),{recursive:true});
 const files={'brief.md':`# ${c.name}\n\n${c.summary}\n\n${Object.entries(c.setup).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n`,
 'established-facts.md':`# Approved campaign records\n\n${c.items.map(x=>`## ${x.title} [${x.id}]\n${x.body}\nVisibility: ${x.visible?'players':'DM only'}`).join('\n\n')}\n`,
 'current-session.md':`# Current session and unresolved threads\n\n${c.progress}\n\n${c.notes.map(x=>`## ${x.title} [${x.id}]\n${x.body}`).join('\n\n')}\n`,
 'context.md':`# Campaign working context\n\nGenerated from approved campaign records. Suggestions in conversation are not established facts. Exact positions remain in linked terrain files.\n\n${JSON.stringify(workingMemory(c),null,2)}\n`};
 for(const [name,text]of Object.entries(files)){const dest=path.join(dir,name);let old;try{old=await fs.readFile(dest,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(old!==text){if(old)await atomicWrite(path.join(dir,'history',name.replace('.md','')+'-'+digest(old)+'.md'),old);await atomicWrite(dest,text);}}
 await fs.mkdir(path.join(folder,'conversations'),{recursive:true});
 // Content-addressed chunks preserve the full conversation before the in-memory window is compacted.
 for(const message of c.chat){const text=JSON.stringify(message),file=path.join(folder,'conversations',digest(text)+'.json');try{await fs.access(file);}catch(e){if(e.code!=='ENOENT')throw e;await atomicWrite(file,text);}}
}
module.exports={workingMemory,writeMemory};
