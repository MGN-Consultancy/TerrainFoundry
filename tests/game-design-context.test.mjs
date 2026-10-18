import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createCampaign,validateCampaign,playerCampaign} from '../desktop/campaign-schema.mjs';
import {contextDocuments,mergeContext,designInstruction,characterGameFields} from '../desktop/game-design.mjs';
import {gameDesignContext} from '../desktop/game-design-context.mjs';
import {validateAction,applyCampaignAction} from '../desktop/campaign-actions.mjs';
const require=createRequire(import.meta.url);
const {createCampaignStore}=require('../desktop/campaign-store.cjs');
const {rulebookHTML}=require('../desktop/rulebook-print.cjs');
const {createCampaignActions}=require('../desktop/campaign-action-service.cjs');

test('rulebook proposals use existing review, revision binding and save without silently mutating chapters',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-rulebook-review-'));
  try{
    const store=createCampaignStore(directory);let c=await store.save(createCampaign('Beacon Keepers'));
    const action={type:'upsertRulebookChapter',chapter:{title:'Taking a turn',body:'Two actions. Draw coloured stones.',visible:false}};
    validateAction(action,c);assert.equal(c.rulebook.chapters.length,0);
    const preview=applyCampaignAction(c,action);assert.equal(preview.rulebook.chapters.length,1);assert.equal(c.rulebook.chapters.length,0);
    const service=createCampaignActions({store,inventory:async()=>[],savedScenes:async()=>[]});
    const stale=await service.review(c.id,action);c.summary='A later authored edit';c=await store.save(c);
    await assert.rejects(service.apply(c.id,stale.token),/changed/i);
    const fresh=await service.review(c.id,action),applied=await service.apply(c.id,fresh.token);
    assert.equal(applied.campaign.rulebook.chapters[0].title,'Taking a turn');
    assert.equal(applied.campaign.summary,'A later authored edit');
    assert.throws(()=>validateAction({...action,chapter:{...action.chapter,id:crypto.randomUUID()}},c),/unavailable/);
    assert.throws(()=>validateAction({...action,chapter:{...action.chapter,command:'anything'}},c),/Unsupported/);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('custom game context survives the official workspace save pipeline without leaking into player exports',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'tf-universal-'));
  try{
    const store=createCampaignStore(directory),c=createCampaign('Beacon Keepers',{gameType:'custom'});
    c.contextDocs=[{name:'rules.md',text:'# Core rules\nTwo actions. Resolve uncertainty with coloured stones. No dice.'}];
    c.rulebook.chapters=[{id:crypto.randomUUID(),title:'Actions',body:'Two actions per round.',visible:true},{id:crypto.randomUUID(),title:'Private',body:'PRIVATE RULE',visible:false}];
    const saved=await store.save(c),reopened=await store.load(saved.id);
    assert.equal(reopened.gameType,'custom');assert.deepEqual(reopened.contextDocs,c.contextDocs);assert.deepEqual(reopened.rulebook,c.rulebook);
    const player=playerCampaign(reopened);assert.ok(!('contextDocs' in player));assert.equal(player.rulebook.chapters.length,1);
    const html=await rulebookHTML(reopened,{audience:'player'});assert.match(html,/Contents/);assert.doesNotMatch(html,/PRIVATE RULE|coloured stones/);
    const legacy=structuredClone(c);delete legacy.gameType;delete legacy.contextDocs;delete legacy.rulebook;
    assert.equal(validateCampaign(legacy).gameType,'dnd');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('Markdown imports reject paths, binary controls, duplicate filenames and excess byte counts',()=>{
  assert.throws(()=>contextDocuments([{name:'../rules.md',text:'Rules'}]));
  assert.throws(()=>contextDocuments([{name:'rules.txt',text:'Rules'}]));
  assert.throws(()=>contextDocuments([{name:'rules.md',text:'Rules\0'}]));
  assert.throws(()=>contextDocuments([{name:'rules.md',text:'é'.repeat(32769)}]));
  assert.throws(()=>contextDocuments([{name:'rules.md',text:'One'},{name:'RULES.md',text:'Two'}]));
  assert.deepEqual(mergeContext([{name:'rules.md',text:'One'}],[{name:'Rules.md',text:'Two'}]),[{name:'Rules.md',text:'Two'}]);
  assert.doesNotMatch(designInstruction('custom'),/dnd|warhammer|d20/i);
});

test('official context bounds all sources, preserves selected UI facts and excludes unrelated designers and worlds',()=>{
  const c=createCampaign('Beacon Keepers',{gameType:'custom'});
  c.contextDocs=[{name:'rules.md',text:'# Turn rules\nTwo actions.\n\n'+Array.from({length:50},(_,i)=>'# Location '+i+'\n'+'History. '.repeat(70)).join('\n\n')},{name:'storm.md',text:'# Storm\nDraw coloured stones.'}];
  c.chat=Array.from({length:80},(_,i)=>({role:'user',text:'Old discussion '+i,at:'today'}));
  const raw={view:{activeTab:'Items',selectedId:'selected-item'},assistant:c.assistant,inventory:{total:2000,assets:[]},savedScenes:Array.from({length:100},(_,i)=>({id:i,name:'Unrelated scene'})),designerLibrary:{assets:Array(100).fill({name:'UNRELATED DESIGNER'})},workspace:{documents:Array(10).fill({text:'Local notes. '.repeat(4000)})},linkedProjects:[{name:'UNRELATED WORLD',pieces:Array(1000).fill({x:1})}]};
  const selectedId=crypto.randomUUID();c.items=[{id:selectedId,title:'Selected beacon',body:'Exact selected source.',category:'Lore',visible:false}];
  raw.view.selectedCollection='items';raw.view.selectedId=selectedId;
  const context=gameDesignContext(raw,c,'Help with storm resolution','assistant');
  assert.ok(Buffer.byteLength(JSON.stringify(context),'utf8')<=24576);
  assert.equal(context.view.selectedId,selectedId);
  assert.equal(context.selectedRecord.body,'Exact selected source.');
  assert.ok(context.contextDocuments.some(source=>source.name==='storm.md'));
  assert.ok(context.chat.length<=6);assert.ok(context.contextDocuments.length<=8);
  assert.doesNotMatch(JSON.stringify(context),/UNRELATED DESIGNER|UNRELATED WORLD|Unrelated scene/);
  assert.equal(c.chat.length,80);
});

test('imported custom and Warhammer characters retain their described rules without default DND statistics',()=>{
  const sheet={abilities:{strength:10},currentHitPoints:1,armourClass:10,features:'Resolve: three stones',attacks:'Push: one action'};
  for(const type of ['custom','warhammer'])assert.deepEqual(characterGameFields(sheet,type),{abilities:'Resolve: three stones\n\nPush: one action',hp:1,ac:0});
  assert.deepEqual(characterGameFields(sheet,'dnd'),{abilities:'{"strength":10}',hp:1,ac:10});
});
