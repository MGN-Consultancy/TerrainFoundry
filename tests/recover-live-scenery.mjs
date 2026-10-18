// Explicit offline recovery of a retained local candidate. Never submits provider requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),directory=process.env.TERRAIN_RECOVERY_LIBRARY,id=process.env.TERRAIN_RECOVERY_ASSET;
if(!directory||!id)throw Error('Set the explicit recovery library and asset ID.');
const library=require('../desktop/creative-library.cjs').createCreativeLibrary({directory}),generation=require('../desktop/creative-generation.cjs').createCreativeGeneration({library,ai:{},fetchImpl:async()=>{throw Error('Offline recovery cannot call providers');}}),original=await library.load(id),source=await library.readModelArtifacts(id,original.model.id),before=crypto.createHash('sha256').update(source.rawStl||source.bytes).digest('hex'),output=path.resolve(process.env.TERRAIN_RECOVERY_OUTPUT||'test-results/game-designer/offline-recovery.json');
console.log(JSON.stringify({phase:'adapting-retained-source',assetId:id,sourceCandidateId:original.model.id,sourceBytes:(source.rawStl||source.bytes).length,sourceSHA256:before}));
try{
 const result=await generation.adaptModel(id,original.model.id),candidate=result.model.id===original.model.id?result.model.history.at(-1):result.model,files=await library.readModelArtifacts(id,candidate.id),after=crypto.createHash('sha256').update(files.rawStl).digest('hex');
 if(after!==before)throw Error('Recovery changed the retained provider source.');
 const receipt={passed:true,offline:true,providerRequests:0,assetId:id,originalCandidateId:original.model.id,recoveredCandidateId:candidate.id,rawSHA256:before,rawPreserved:true,sizeMm:candidate.sizeMm,validation:candidate.validation,adapter:candidate.adapter,artifacts:candidate.artifacts};await fs.writeFile(output,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(error){await fs.writeFile(output,JSON.stringify({passed:false,offline:true,providerRequests:0,assetId:id,sourceSHA256:before,message:error.message},null,2));throw error;}
