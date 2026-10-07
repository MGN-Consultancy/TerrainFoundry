import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,sign} from 'node:crypto';
const root='test-results/incremental-fixture';await fs.mkdir(root,{recursive:true});
const update=process.argv.includes('update');
const artefacts=update?{
 'client-app-v2.bin':Buffer.from('editor-resource-v2'),
 'asset-r-002-v2.bin':Buffer.from([...Array(48)].map((_,i)=>(i+9)&255))
}:{
 'client-exe-v1.bin':Buffer.from('test editor executable'),
 'client-app-v1.bin':Buffer.from('editor-resource-v1'),
 'asset-r-001-v1.bin':Buffer.from([...Array(48)].map((_,i)=>i+1)),
 'asset-r-002-v1.bin':Buffer.from([...Array(48)].map((_,i)=>i+8))
};
for(const [name,data] of Object.entries(artefacts))await fs.writeFile(path.join(root,name),data);
const url=name=>`https://github.com/MGN-Consultancy/TerrainFoundry/releases/download/v-test/${name}`;
const describe=(name,data,relative)=>({name,url:url(name),path:relative,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});
const priorClient=update?{
 'TerrainFoundry.exe':{name:'client-exe-v1.bin',url:url('client-exe-v1.bin'),path:'TerrainFoundry.exe',size:Buffer.byteLength('test editor executable'),sha256:createHash('sha256').update('test editor executable').digest('hex')},
 'resources/app.js':describe('client-app-v2.bin',artefacts['client-app-v2.bin'],'resources/app.js')
}:null;
const clientFiles=update?priorClient:{
 'TerrainFoundry.exe':describe('client-exe-v1.bin',artefacts['client-exe-v1.bin'],'TerrainFoundry.exe'),
 'resources/app.js':describe('client-app-v1.bin',artefacts['client-app-v1.bin'],'resources/app.js')
};
const digestMap=Object.entries(clientFiles).map(([p,f])=>[p,f.sha256]).sort();const clientHash=createHash('sha256').update(JSON.stringify(digestMap)).digest('hex');
const sizes={vertices:1,indices:0,length:24};
const models={
 'r-001':update?Buffer.from([...Array(48)].map((_,i)=>i+1)):artefacts['asset-r-001-v1.bin'],
 'r-002':update?artefacts['asset-r-002-v2.bin']:artefacts['asset-r-002-v1.bin']
};
const files={},index={};
for(const [id,data] of Object.entries(models)){
 const changed=update&&id==='r-002',name=changed?'asset-r-002-v2.bin':`asset-${id}-v1.bin`,urlValue=url(name);
 if(!update||changed)files[`models/${id}.bin`]=describe(name,data,`models/${id}.bin`);
 else files[`models/${id}.bin`]={name,url:urlValue,path:`models/${id}.bin`,size:data.length,sha256:createHash('sha256').update(data).digest('hex')};
 index[id]={file:`models/${id}.bin`,raw:sizes,connected:sizes,openlock:{},sha256:files[`models/${id}.bin`].sha256};
}
const payload={schema:2,repository:'MGN-Consultancy/TerrainFoundry',version:update?'1.16.1':'1.16.0',sequence:update?2:1,launcher:{name:'Terrain Foundry Launcher',version:'1.15.2.0',url:url('launcher.exe'),size:1,sha256:'0'.repeat(64)},client:{name:'Terrain Foundry editor',version:update?'1.16.1':'1.16.0',sourceHash:clientHash,sha256:clientHash,size:Object.values(clientFiles).reduce((n,f)=>n+f.size,0),files:clientFiles},assets:[{id:'starter',name:'Starter scenery',version:update?'content-2':'content-1',files,index}]};
const key=process.env.TERRAIN_RELEASE_KEY;if(!key)throw Error('Test signing key not configured');const bytes=Buffer.from(JSON.stringify(payload));await fs.writeFile(path.join(root,'component-channel.json'),JSON.stringify({payload:bytes.toString('base64'),signature:sign('RSA-SHA256',bytes,key).toString('base64')}));
