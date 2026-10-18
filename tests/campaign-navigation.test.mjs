import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createCampaign} from '../desktop/campaign-schema.mjs';
import {validateAction, assistantInstructions, assistantInstructionsFor} from '../desktop/campaign-actions.mjs';
import {sectionForCampaignAction} from '../src/campaign-workflow.js';
const require = createRequire(import.meta.url);

test('navigation accepts only app sections in general and writing protocols', () => {
  const campaign = createCampaign('Navigation', {gameType: 'custom'});
  for (const tab of ['Characters', 'Rulebook', 'Context', 'Maps']) {
    const action = {type: 'navigate', tab};
    assert.deepEqual(validateAction(action, campaign), action);
    assert.equal(sectionForCampaignAction(action), tab);
  }
  for (const action of [{type:'navigate',tab:'../../private'}, {type:'navigate',tab:'https://example.com'}, {type:'navigate',tab:'Rulebook',url:'https://example.com'}, {type:'navigate'}]) assert.throws(() => validateAction(action, campaign));
  for (const instructions of [assistantInstructions, assistantInstructionsFor('Help me decide what comes next'), assistantInstructionsFor('Back to the rulebook', {activeTab:'Rulebook'})]) assert.match(instructions, /"type":"navigate"/);
});

test('normalized custom character proposals remain valid at the review boundary', () => {
  const campaign = createCampaign('Keepers', {gameType:'custom'});
  const action = {type:'upsertRecord',collection:'characters',record:{name:'Mara Venn',details:'Beacon keeper',abilities:'Reads coloured stones',visible:false}};
  const checked = validateAction(action, campaign);
  assert.equal(Object.hasOwn(checked.record, 'modelFile'), false);
  assert.deepEqual(validateAction(checked, campaign), checked);
  assert.throws(() => validateAction({...action,record:{...action.record,modelFile:'../private.glb'}},campaign), /fields/);
});

test('reviewed navigation preserves project revision and agent mode defers it without undo', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-navigation-'));
  try {
    const store = require('../desktop/campaign-store.cjs').createCampaignStore(directory);
    const campaign = await store.save(createCampaign('Navigation', {gameType:'custom'}));
    const actions = require('../desktop/campaign-action-service.cjs').createCampaignActions({store, inventory:async()=>[], savedScenes:async()=>[]});
    for (const tab of ['Characters', 'Rulebook']) {
      const review = await actions.review(campaign.id, {type:'navigate',tab});
      assert.deepEqual(await actions.apply(campaign.id, review.token), {navigate:tab});
      assert.deepEqual(await store.load(campaign.id), campaign);
      await assert.rejects(actions.apply(campaign.id, review.token), /expired/);
    }
    const agent = require('../desktop/campaign-agent.cjs').createCampaignAgent({store, actions, ai:{status:async()=>({agentMode:true})}});
    const navigation = {type:'navigate',tab:'Rulebook'};
    const result = await agent.apply(campaign.id, [navigation]);
    assert.deepEqual(result.results, [{type:'navigate',deferred:true,action:navigation}]);
    assert.match((await agent.apply(campaign.id, [{type:'navigate',tab:'https://example.com'}])).error, /Unknown campaign section/);
    assert.deepEqual(await agent.history(campaign.id), []);
    assert.deepEqual(await store.load(campaign.id), campaign);
  } finally { await fs.rm(directory, {recursive:true,force:true}); }
});
