import test from 'node:test';import assert from 'node:assert/strict';import {createCampaign} from '../desktop/campaign-schema.mjs';import {parseAssistantReply,assistantInstructions} from '../desktop/campaign-actions.mjs';
test('beginner choices are bounded editable text, never executable actions',()=>{
 const c=createCampaign('New adventure'),environment={inventory:[],savedScenes:[]};const reply={message:'Choose your next step',nextStep:'Choose a tone',actions:[],choices:[{label:'Gentle mystery',prompt:'I would like a gentle mystery with easy encounters.'}]};
 const r=parseAssistantReply(JSON.stringify(reply),c,environment);assert.equal(r.choices[0].prompt,reply.choices[0].prompt);assert.equal(r.actions.length,0);assert.equal(c.chat.length,0);assert.match(assistantInstructions,/actual roll results/);assert.match(assistantInstructions,/placed instances/);
 assert.throws(()=>parseAssistantReply(JSON.stringify({...reply,choices:Array(5).fill(reply.choices[0])}),c,environment),/limit/);
 assert.throws(()=>parseAssistantReply(JSON.stringify({...reply,choices:[{...reply.choices[0],type:'deleteEverything'}]}),c,environment));
});
