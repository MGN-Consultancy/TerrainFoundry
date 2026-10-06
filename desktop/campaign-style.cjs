const fs=require('node:fs/promises'),path=require('node:path');
const {atomicWrite}=require('./project-store.cjs');
function createCampaignStyle(directory){const file=path.join(directory,'game-style.md');let queue=Promise.resolve();
 async function read(){try{const stat=await fs.lstat(file);if(stat.isSymbolicLink()||stat.size>20000)throw Error('Invalid shared style document');return await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}}
 function write(content){if(typeof content!=='string'||Buffer.byteLength(content)>20000)throw Error('Shared style must be at most 20 KB');const task=queue.then(async()=>{await fs.mkdir(directory,{recursive:true});if((await fs.lstat(directory)).isSymbolicLink())throw Error('Shared style folder cannot be a link');const previous=await read();await atomicWrite(file,content);return previous;});queue=task.catch(()=>{});return task;}
 return {read,write};
}module.exports={createCampaignStyle};
