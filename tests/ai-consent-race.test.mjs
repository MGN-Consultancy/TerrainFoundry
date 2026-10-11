import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createCampaign} from '../desktop/campaign-schema.mjs';
const require=createRequire(import.meta.url),{createCampaignAI}=require('../desktop/campaign-ai.cjs'),{createCampaignVoice}=require('../desktop/campaign-voice.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const safeStorage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'dpapi',encryptString:s=>Buffer.from(s).map(x=>x^85),decryptString:b=>Buffer.from(b).map(x=>x^85).toString()};
test('revoking consent during text context preparation prevents the later paid POST',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-consent-race-')),entered=deferred(),resume=deferred();let calls=0;
 try{const ai=createCampaignAI({directory,safeStorage,inventory:async()=>{entered.resolve();await resume.promise;return[];},fetchImpl:async()=>{calls++;return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Should not be requested'}]}]}));}});
 await ai.saveKey('openai','sk-fake-consent-race-123456789');await ai.acceptConsent(true);
 const generating=ai.generate(createCampaign('Private campaign'),'Help write this campaign','story');const rejected=assert.rejects(generating,/consent|cancel|stopp|security/i);await entered.promise;await ai.acceptConsent(false);resume.resolve();await rejected;assert.equal(calls,0);assert.equal((await ai.status()).usage.allTime.text.requests,0);
 }finally{resume.resolve();await fs.rm(directory,{recursive:true,force:true});}
});
function voiceFixture({duringContext=false,duringHandshake=false}={}){
 const campaign=createCampaign('Private campaign'),entered=deferred(),resume=deferred();let allowed=true,calls=0;
 const voice=createCampaignVoice({store:{load:async()=>structuredClone(campaign)},ai:{voiceKey:async()=>{if(!allowed)throw Error('Consent is required');return 'fake-key';},requireConsent:async()=>{if(!allowed)throw Error('Consent is required');},packContext:async()=>{if(duringContext){entered.resolve();await resume.promise;}return{};}},inventory:async()=>[],context:async()=>[],actions:{},fetchImpl:async()=>{calls++;if(duringHandshake){entered.resolve();await resume.promise;}return new Response('v=0\r\nfixture');}});
 return {voice,campaign,entered,resume,revoke(){allowed=false;voice.stop();},get calls(){return calls;}};
}
test('revoking consent while voice context loads prevents the voice handshake POST',async()=>{
 const f=voiceFixture({duringContext:true}),starting=f.voice.start(f.campaign.id,'v=0\r\nfixture'),rejected=assert.rejects(starting,/consent|cancel|stopp|security|ended/i);await f.entered.promise;f.revoke();f.resume.resolve();await rejected;assert.equal(f.calls,0);await assert.rejects(f.voice.tool(f.campaign.id,'get_context',{}),/ended/);f.voice.stop();
});
test('late successful voice handshake cannot reactivate a session stopped during its request',async()=>{
 const f=voiceFixture({duringHandshake:true}),starting=f.voice.start(f.campaign.id,'v=0\r\nfixture'),rejected=assert.rejects(starting,/consent|cancel|stopp|security|ended/i);await f.entered.promise;f.revoke();f.resume.resolve();await rejected;assert.equal(f.calls,1);await assert.rejects(f.voice.tool(f.campaign.id,'get_context',{}),/ended/);await assert.rejects(f.voice.usageEvent(f.campaign.id,{type:'response.done'}),/ended/);f.voice.stop();
});
test('revoking consent while a successful voice answer is being read prevents activation',async()=>{
 const campaign=createCampaign('Private campaign'),entered=deferred(),resume=deferred();let allowed=true;
 const voice=createCampaignVoice({store:{load:async()=>structuredClone(campaign)},ai:{voiceKey:async()=> 'fake-key',requireConsent:async()=>{if(!allowed)throw Error('Consent is required');}},inventory:async()=>[],context:async()=>[],actions:{},fetchImpl:async()=>({ok:true,text:async()=>{entered.resolve();await resume.promise;return 'v=0\r\nfixture';}})});
 const starting=voice.start(campaign.id,'v=0\r\nfixture'),rejected=assert.rejects(starting,/consent|cancel|stopp|security|ended/i);await entered.promise;allowed=false;voice.stop();resume.resolve();await rejected;await assert.rejects(voice.tool(campaign.id,'get_context',{}),/ended/);voice.stop();
});
