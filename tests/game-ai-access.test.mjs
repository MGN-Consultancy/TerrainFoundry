import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {createCampaign} from '../desktop/campaign-schema.mjs';
import {campaignContext,MAX_CONTEXT_BYTES} from '../desktop/campaign-context.mjs';
import {requestedSection} from '../desktop/game-design.mjs';
import {aiCapabilities,generationConfirmation} from '../desktop/ai-capabilities.mjs';
const require = createRequire(import.meta.url);
const {createCampaignAI} = require('../desktop/campaign-ai.cjs');
const {createCampaignUsage} = require('../desktop/campaign-project-usage.cjs');
const {createChatGPTConnection,verifyIdentity} = require('../desktop/chatgpt-connection.cjs');
const storage = {isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value).reverse(), decryptString: value => Buffer.from(value).reverse().toString()};
const requestResult = {status: 'completed',output: [{content: [{type: 'output_text',text: 'Ask about the storm track.'}]}],usage: {input_tokens: 100,output_tokens: 20,total_tokens: 120}};
const stream = value => new Response('data: '+JSON.stringify({type:'response.completed',response:value})+'\n\ndata: [DONE]\n');

test('confirmation names the actual linked or API funding route',()=>{
  const linked={provider:'claude',route:'auto',chatgpt:{signedIn:true}};
  assert.equal(generationConfirmation(linked).title,'Linked ChatGPT request');
  assert.match(generationConfirmation(linked).buttons[1],/linked ChatGPT/);
  assert.match(generationConfirmation({...linked,route:'api'}).detail,/claude API account/);
  assert.match(generationConfirmation(linked,'illustration').detail,/openai API account/);
});

test('incomplete linked replies retain bounded partial text locally and preserve reported usage',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-partial-draft-'));
  try{
    const raw='data: '+JSON.stringify({type:'response.output_text.delta',delta:'A partial chapter'})+'\n\ndata: '+JSON.stringify({type:'response.incomplete',response:{incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:100,output_tokens:20}}})+'\n\n';
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat'}],token:async()=>'oauth'},fetchImpl:async()=>new Response(raw)});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',route:'chatgpt',chatgptModel:'fixture-chat'});
    const campaign=createCampaign('Beacon Keepers',{gameType:'custom'});let failure;
    await assert.rejects(ai.generate(campaign,'Draft a chapter','assistant'),error=>{failure=error;return /max_output_tokens/.test(error.message);});
    assert.equal(JSON.parse(await fs.readFile(failure.draftPath,'utf8')).reply,'A partial chapter');
    assert.equal((await ai.projectUsage(campaign.id)).allowanceTokens,120);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('invalid model drafts retain a redacted local reply and schema reason without another request',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-retained-draft-'));
  try{
    let calls=0;
    const secret='sk-fixture-retained-draft-secret',output=JSON.stringify({message:'Storm draft '+secret,nextStep:'Review',choices:[],draftBrief:null,actions:[{type:'unsupported-fixture-action'}]});
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat'}],token:async()=>'oauth'},fetchImpl:async()=>{calls++;return stream({...requestResult,output:[{content:[{type:'output_text',text:output}]}]});}});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',route:'chatgpt',chatgptModel:'fixture-chat'});
    await ai.saveKey('openai',secret);
    const campaign=createCampaign('Beacon Keepers',{gameType:'custom'});let failure;
    await assert.rejects(ai.generate(campaign,'Draft our rules','assistant'),error=>{failure=error;return /local copy was retained/.test(error.message);});
    assert.ok(failure.draftPath.startsWith(directory+path.sep));
    const saved=JSON.parse(await fs.readFile(failure.draftPath,'utf8'));assert.match(saved.reply,/Storm draft/);assert.ok(!saved.reply.includes(secret));assert.ok(saved.validation);assert.equal(saved.project,campaign.id);
    assert.equal(calls,1);assert.equal((await ai.projectUsage(campaign.id)).allowanceTokens,120);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('linked service reads the documented text-delta stream without repeated terminal output',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-linked-delta-'));
  try{
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat'}],token:async()=>'oauth'},fetchImpl:async()=>new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'Ask about the storm.'})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{...requestResult,output:[]}})+'\n\n')});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',route:'chatgpt',chatgptModel:'fixture-chat'});
    const campaign=createCampaign('Beacon Keepers',{gameType:'custom'}),result=await ai.generate(campaign,'Explain the storm.');
    assert.equal(result.text,'Ask about the storm.');assert.equal(result.route,'allowance');assert.equal((await ai.projectUsage(campaign.id)).allowanceTokens,120);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('failed exchange retains the issued registration, reports only safe diagnostics and preserves the active account',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-link-retry-'));
  let link,reopened,authorize;
  try{
    const previous={id:crypto.randomUUID(),subject:'fixture-owner',client_id:'oaiapp_previous',email:'Previously linked',scopes:['chatgpt.tokens.use.direct'],access_token:'fixture-existing-token',expires:Date.now()+3600000};
    await fs.writeFile(path.join(directory,'chatgpt-accounts.protected'),storage.encryptString(JSON.stringify({host:'urn:uuid:'+crypto.randomUUID(),active:previous.id,accounts:[previous]})));
    const fetchImpl=async()=>new Response(JSON.stringify({error:{code:'server_error',message:'DO_NOT_EXPOSE_SENTINEL'},access_token:'DO_NOT_EXPOSE_SENTINEL'}),{status:500});
    link=createChatGPTConnection({directory,safeStorage:storage,fetchImpl,openExternal:async url=>{authorize=new URL(url);}});
    await link.start();
    const callback=new URL(authorize.searchParams.get('redirect_uri'));
    callback.searchParams.set('state',authorize.searchParams.get('state'));callback.searchParams.set('client_id','oaiapp_retry');callback.searchParams.set('code','fixture-code');
    const response=await fetch(callback),body=await response.text();
    assert.match(body,/token exchange failed \(HTTP 500; server_error\)/);assert.doesNotMatch(body,/DO_NOT_EXPOSE_SENTINEL/);
    const failed=await link.status();assert.equal(failed.pending,false);assert.equal(failed.active,previous.id);assert.equal(failed.enabled,true);
    const unfinished=failed.accounts.find(account=>account.registeredOnly);assert.ok(unfinished);assert.equal(unfinished.enabled,false);
    reopened=createChatGPTConnection({directory,safeStorage:storage,fetchImpl,openExternal:async url=>{authorize=new URL(url);}});
    await reopened.start(unfinished.id);
    assert.equal(authorize.searchParams.get('client_id'),'oaiapp_retry');assert.equal(authorize.searchParams.has('agent_name_hint'),false);
    assert.equal((await reopened.status()).active,previous.id);
  }finally{link?.cancel();reopened?.cancel();await fs.rm(directory,{recursive:true,force:true});}
});

test('actual provider requests retrieve a bounded slice while the full project remains local',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-outgoing-context-'));
  try{
    const outgoing=[];
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat'}],token:async()=>'oauth'},fetchImpl:async(url,options)=>{outgoing.push(JSON.parse(options.body));return stream(requestResult);}});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',route:'chatgpt',chatgptModel:'fixture-chat'});
    const c=createCampaign('Beacon Keepers',{gameType:'custom'});
    c.contextDocs=[{name:'storm.md',text:'# Storm resolution\nDraw coloured stones. Never roll dice.'},{name:'archive.md',text:'# Unrelated history\n'+('ARCHIVE_ONLY_SENTINEL '.repeat(2000))}];
    c.chat=Array.from({length:100},(_,i)=>({role:'user',text:i===0?'EARLIEST_MESSAGE_SENTINEL':'Earlier discussion '+i,at:'today'}));
    c.items=Array.from({length:100},(_,i)=>({id:crypto.randomUUID(),category:'Locations',title:'Distant place '+i,body:'Distant history. '.repeat(100),visible:false}));
    const before=JSON.stringify(c);
    await ai.generate(c,'How does storm resolution work?');
    await ai.generate(c,'Explain storm resolution again briefly.');
    assert.equal(outgoing.length,2);
    for(const payload of outgoing){
      const context=JSON.parse(payload.input[0].content.split('\nMode: ')[0]);
      assert.ok(Buffer.byteLength(JSON.stringify(context),'utf8')<=MAX_CONTEXT_BYTES);
      assert.ok(context.chat.length<=6);assert.ok(context.contextDocuments.length<=8);
      assert.ok(context.contextDocuments.some(source=>source.name==='storm.md'));
      assert.doesNotMatch(JSON.stringify(payload),/EARLIEST_MESSAGE_SENTINEL/);
      assert.ok(context.items.length<100);
      assert.ok(JSON.stringify(payload).length<before.length/2);
    }
    assert.equal(JSON.stringify(c),before,'provider retrieval must preserve the full local project');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('linked account, image API and Meshy capabilities remain independent',()=>{
  const status={provider:'openai',route:'auto',consent:{accepted:true},chatgpt:{signedIn:true,enabled:true},configured:{openai:false,meshy:true}};
  const caps=aiCapabilities(status);assert.equal(caps.conversation,true);assert.equal(caps.images,false);assert.equal(caps.models,true);assert.match(caps.imageReason,/Upload your own concept art/);
  assert.equal(aiCapabilities({...status,configured:{}}).models,false);
  assert.equal(aiCapabilities({...status,consent:{accepted:false}}).conversation,false);
  assert.equal(aiCapabilities({...status,route:'api'}).conversation,false);
  assert.equal(aiCapabilities({...status,provider:'claude',route:'chatgpt'}).conversation,true);
  assert.equal(aiCapabilities({...status,provider:'claude',route:'auto'}).conversation,true);
});

test('explicit context switches are local and do not swallow content-generation requests', () => {
  assert.equal(requestedSection("Let's work on characters again"), 'Characters');
  assert.equal(requestedSection('Please go back to the rule book.'), 'Rulebook');
  assert.equal(requestedSection('I want to work on scenery'), 'Scenery');
  assert.equal(requestedSection('Switch to my world'), 'Linked projects');
  assert.equal(requestedSection('Create a character and describe their equipment'), null);
  assert.equal(requestedSection('How should I go back to the rulebook after combat?'), null);
});

test('large projects retrieve bounded relevant sources; unrelated world geometry and history stay local', () => {
  const c = createCampaign('Beacon Keepers');
  c.contextDocs = [{name:'rules.md',text: '# Actions\nTwo actions per round.\n\n'+Array.from({length:70},(_,i)=>`# Location ${i}\n`+'Atmosphere. '.repeat(70)).join('\n\n')}, {name:'storm.md',text:'# Storm resolution\nDraw coloured stones. Never roll dice.'}];
  c.chat = Array.from({length:100},(_,i)=>({role:'user',text:'Old message '+i,at:'today'}));
  c.items = Array.from({length:100},(_,i)=>({id:crypto.randomUUID(),category:'Locations',title:'Place '+i,body:'Long lore. '.repeat(100),visible:false}));
  const context = campaignContext(c,'How does storm resolution work?','story',[{id:'scenery-unused',name:'Not relevant'}],[{name:'Private world',pieces:Array(1000).fill({x:0})}]);
  assert.ok(Buffer.byteLength(JSON.stringify(context),'utf8')<=MAX_CONTEXT_BYTES);
  assert.ok(context.contextDocuments.some(source=>source.name==='storm.md'));
  assert.equal(context.inventory.length,0);
  assert.equal(context.linkedProjects.length,0);
  assert.equal(context.chat.length,6);
  assert.equal(context.retrieval.earlierMessagesOmitted,94);
  assert.ok(context.items.length<=6);
  assert.doesNotMatch(JSON.stringify(context),/Old message 0|Private world|scenery-unused/);
  assert.equal(c.chat.length,100,'local history is never rewritten by retrieval');
});

test('allowance-only text uses streaming, records its actual route and never falls back to a saved API key', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-allowance-'));
  try {
    let calls=0,fail=false;
    const linked={status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat',name:'Fixture'}],token:async()=>'fixture-oauth-token'};
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked,fetchImpl:async(url,options)=>{
      calls++;const payload=JSON.parse(options.body);
      assert.equal(url,'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization,'Bearer fixture-oauth-token');
      assert.equal(payload.stream,true);assert.equal(payload.store,false);
      return fail?new Response('data: '+JSON.stringify({type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}})+'\n'):stream(requestResult);
    }});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',model:'api-model',chatgptModel:'fixture-chat'});
    await ai.saveKey('openai','sk-fixture-not-used-fallback');
    const c=createCampaign('Budgeted');
    const result=await ai.generate(c,'Help with rules');assert.equal(result.route,'allowance');
    assert.equal((await ai.projectUsage(c.id)).allowanceTokens,120);
    assert.equal((await ai.projectUsage(c.id)).apiTokens,0);
    await ai.configure({provider:'claude',model:'unused-api-model',route:'chatgpt',chatgptModel:'fixture-chat'});fail=true;await assert.rejects(ai.generate(c,'Try another idea'),/No API fallback/);
    assert.equal(calls,2,'no duplicate request on exhausted allowance');
    await ai.configure({provider:'claude',model:'unused-api-model',route:'auto',chatgptModel:'fixture-chat'});
    fail=false;const automatic=await ai.generate(c,'Help with the rules again');assert.equal(automatic.route,'allowance');
    assert.equal(calls,3,'automatic funding must prefer the connected account over a previously selected API provider');
    const totals=await createCampaignUsage(directory).summary(c.id);
    assert.equal(totals.unknownRequests,1);
    assert.equal(totals.cost,null);assert.equal(totals.remainingAllowance,null);
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('linked text cannot buy an image without an API key; token budgets stop calls before network submission',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-budget-'));
  try{
    let calls=0;
    const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:true,enabled:true}),models:async()=>[{id:'fixture-chat'}],token:async()=>'oauth'},fetchImpl:async()=>{calls++;return stream(requestResult);}});
    await ai.acceptConsent(true);await ai.configure({provider:'openai',model:'api-model',chatgptModel:'fixture-chat'});
    const c=createCampaign('No surprise charges');
    await assert.rejects(ai.generate(c,'Draw a cover','illustration'),/Upload your own artwork/);
    await ai.setProjectTokenLimit(c.id,100);
    await assert.rejects(ai.generate(c,'Help with the rules'),/remaining project token limit/);
    assert.equal(calls,0);
    assert.equal((await ai.projectUsage(c.id)).requests,0);
    const ledger=createCampaignUsage(directory);
    await ledger.begin(c.id,'api','story');
    await ai.setProjectTokenLimit(c.id,100000);
    await assert.rejects(ai.generate(c,'Continue'),/unreported/);
    assert.equal(calls,0,'an interrupted recorded request is never assumed free');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('identity verification checks signature, issuer, audience, expiry, nonce and returning subject',()=>{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const jwk={...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'};
  const claims={iss:'https://auth.openai.com',aud:'oaiapp_fixture',sub:'user-fixture',nonce:'nonce-fixture',exp:Math.floor(Date.now()/1000)+300};
  const sign=value=>{const content=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(value)).toString('base64url');return content+'.'+crypto.sign('RSA-SHA256',Buffer.from(content),privateKey).toString('base64url');};
  assert.equal(verifyIdentity(sign(claims),[jwk],'oaiapp_fixture','nonce-fixture').sub,'user-fixture');
  for(const change of [{iss:'https://wrong.test'},{aud:'wrong-client'},{nonce:'wrong-nonce'},{exp:0}])assert.throws(()=>verifyIdentity(sign({...claims,...change}),[jwk],'oaiapp_fixture','nonce-fixture'));
  assert.throws(()=>verifyIdentity(sign(claims),[jwk],'oaiapp_fixture','nonce-fixture','wrong-subject'));
  const tampered=sign(claims).split('.');tampered[1]=Buffer.from(JSON.stringify({...claims,sub:'attacker'})).toString('base64url');assert.throws(()=>verifyIdentity(tampered.join('.'),[jwk],'oaiapp_fixture','nonce-fixture'));
});

test('real loopback sign-in verifies state and saves protected app-owned tokens that survive restart',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-chatgpt-auth-'));
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  let authorize;
  const sign=nonce=>{const body=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({iss:'https://auth.openai.com',aud:'oaiapp_fixture',sub:'subject-fixture',nonce,exp:Date.now()/1000+300})).toString('base64url');return body+'.'+crypto.sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');};
  const fetchImpl=async(url,options)=>{
    if(url.endsWith('/jwks.json'))return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256'}]});
    if(url.endsWith('/oauth/token')){const form=new URLSearchParams(options.body);assert.equal(form.get('client_id'),'oaiapp_fixture');assert.ok(form.get('code_verifier'));return Response.json({access_token:'secret-access-token',refresh_token:'secret-refresh-token',id_token:sign(authorize.searchParams.get('nonce')),expires_in:3600,token_type:'Bearer',scope:'openid chatgpt.tokens.use.direct'});}
    if(url.endsWith('/models'))return Response.json({models:[{slug:'fixture-model',display_name:'Fixture model',visibility:'list'}]});
    throw Error('Unexpected URL');
  };
  const link=createChatGPTConnection({directory,safeStorage:storage,fetchImpl,openExternal:async url=>{authorize=new URL(url);}});
  try{
    await link.start();assert.equal(authorize.origin,'https://auth.openai.com');assert.equal(authorize.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(authorize.searchParams.get('agent_name_hint'),'Terrain Foundry');
    const callback=new URL(authorize.searchParams.get('redirect_uri'));callback.searchParams.set('state','wrong');assert.equal((await fetch(callback)).status,400);
    callback.searchParams.set('state',authorize.searchParams.get('state'));callback.searchParams.set('client_id','oaiapp_fixture');callback.searchParams.set('code','fixture-code');assert.equal((await fetch(callback)).status,200);
    assert.equal((await link.status()).enabled,true);
    const reopened=createChatGPTConnection({directory,safeStorage:storage,fetchImpl,openExternal:async()=>{}});
    assert.equal(await reopened.token(),'secret-access-token');
    assert.equal((await reopened.models())[0].id,'fixture-model');
    const publicStatus=JSON.stringify(await reopened.status());assert.doesNotMatch(publicStatus,/secret-access-token|secret-refresh-token|id_token/);
    assert.doesNotMatch((await fs.readFile(path.join(directory,'chatgpt-accounts.protected'))).toString(),/secret-access-token|secret-refresh-token/);
  }finally{link.cancel();await fs.rm(directory,{recursive:true,force:true});}
});

test('cancelled browser sign-in can retry immediately without changing an active account',async()=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-link-cancel-'));let link,authorize,calls=0;try{const previous={id:crypto.randomUUID(),subject:'fixture-owner',client_id:'oaiapp_previous',email:'Previously linked',scopes:['chatgpt.tokens.use.direct'],access_token:'fixture-existing-token',expires:Date.now()+3600000};await fs.writeFile(path.join(directory,'chatgpt-accounts.protected'),storage.encryptString(JSON.stringify({host:'urn:uuid:'+crypto.randomUUID(),active:previous.id,accounts:[previous]})));link=createChatGPTConnection({directory,safeStorage:storage,fetchImpl:async()=>{calls++;throw Error('Unexpected provider call');},openExternal:async url=>{authorize=new URL(url);}});await link.start();const first=authorize;assert.equal((await link.status()).pending,true);link.cancel();const cancelled=await link.status();assert.equal(cancelled.pending,false);assert.equal(cancelled.active,previous.id);assert.equal(cancelled.enabled,true);assert.match(cancelled.message,/cancelled/);assert.equal(await link.token(),'fixture-existing-token');await link.start();assert.equal((await link.status()).pending,true);assert.notEqual(authorize.searchParams.get('state'),first.searchParams.get('state'));const stale=new URL(authorize.searchParams.get('redirect_uri'));stale.searchParams.set('state',first.searchParams.get('state'));stale.searchParams.set('code','stale-fixture-code');assert.equal((await fetch(stale)).status,400);assert.equal((await link.status()).pending,true);assert.equal((await link.status()).active,previous.id);assert.equal(calls,0);}finally{link?.cancel();await fs.rm(directory,{recursive:true,force:true});}});

test('unreadable ChatGPT state stays recoverable without blocking settings or touching API keys',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-link-repair-'));let link,opened=0;
 try{
  const file=path.join(directory,'chatgpt-accounts.protected'),original=Buffer.from('unreadable encrypted fixture'),apiFile=path.join(directory,'ai-settings.json'),apiBytes=Buffer.from('{"fixture":"preserve API settings"}');
  await fs.writeFile(file,original);await fs.writeFile(apiFile,apiBytes);
  link=createChatGPTConnection({directory,safeStorage:storage,fetchImpl:async()=>{throw Error('Unexpected provider request');},openExternal:async()=>{opened++;}});
  const broken=await link.status();assert.equal(broken.unreadable,true);assert.equal(broken.enabled,false);assert.deepEqual(await fs.readFile(file),original);
  const repaired=await link.repair();assert.equal(repaired.unreadable,undefined);assert.equal(repaired.signedIn,false);
  const backups=(await fs.readdir(directory)).filter(n=>n.startsWith('chatgpt-accounts.protected.recovery-'));assert.equal(backups.length,1);assert.deepEqual(await fs.readFile(path.join(directory,backups[0])),original);assert.deepEqual(await fs.readFile(apiFile),apiBytes);
  await assert.rejects(link.repair(),/readable/);await link.start();assert.equal(opened,1);assert.equal((await link.status()).pending,true);await assert.rejects(link.repair(),/Cancel/);
 }finally{link?.cancel();await fs.rm(directory,{recursive:true,force:true});}
});
test('unreadable ChatGPT state requires explicit API funding instead of silent fallback',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-link-funding-'));let calls=0;
 try{
  const ai=createCampaignAI({directory,safeStorage:storage,inventory:async()=>[],linked:{status:async()=>({signedIn:false,enabled:false,unreadable:true})},fetchImpl:async()=>{calls++;return new Response(JSON.stringify(requestResult));}});
  await ai.acceptConsent(true);await ai.saveKey('openai','sk-fixture-not-used-fallback');await ai.configure({provider:'openai',route:'auto',model:'fixture-model'});
  const c=createCampaign('Funding recovery',{gameType:'custom'}),status=await ai.status();assert.equal(status.configured.openai,true);assert.equal(aiCapabilities(status).conversation,false);
  await assert.rejects(ai.generate(c,'One small scenery planning sentence.','story'),/API key only explicitly/);assert.equal(calls,0);
  await ai.configure({provider:'openai',route:'api'});assert.equal(aiCapabilities(await ai.status()).conversation,true);await ai.generate(c,'One small scenery planning sentence.','story');assert.equal(calls,1);assert.equal((await ai.projectUsage(c.id)).apiTokens,120);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
