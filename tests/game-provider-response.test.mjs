import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {decodeResponse,responseText,responseShape}=createRequire(import.meta.url)('../desktop/campaign-provider-response.cjs');
const event=value=>'data: '+JSON.stringify(value)+'\n\n';
const deltas=event({type:'response.output_text.delta',delta:'Ask about '})+event({type:'response.output_text.delta',delta:'the storm.'});

test('linked streaming retains text deltas when completed response only reports usage',()=>{
  const result=decodeResponse(deltas+event({type:'response.completed',response:{status:'completed',output:[],usage:{input_tokens:100,output_tokens:8}}}),true);
  assert.equal(responseText(result),'Ask about the storm.');assert.equal(result.usage.output_tokens,8);
});
test('terminal text takes precedence without duplicating streamed text',()=>{
  const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Ask about the storm.'}]}]};
  assert.equal(responseText(decodeResponse(deltas+event({type:'response.completed',response}),true)),'Ask about the storm.');
  assert.equal(responseText({output_text:'SDK text'}),'SDK text');
});
test('partial deltas never mask incomplete, failed or interrupted responses',()=>{
  for(const type of ['response.failed','response.incomplete','error'])assert.throws(()=>decodeResponse(deltas+event({type,response:{error:{code:'incomplete'},usage:{input_tokens:10,output_tokens:2}}}),true),/did not complete/);
  assert.throws(()=>decodeResponse(deltas,true),/before completion/);
  assert.throws(()=>decodeResponse(deltas+event({type:'response.incomplete',response:{incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:10,output_tokens:2}}}),true),error=>error.partialText==='Ask about the storm.'&&/max_output_tokens/.test(error.message));
  assert.throws(()=>decodeResponse(event({type:'response.output_text.delta',delta:'x'.repeat(30001)}),true),/oversized/);
});
test('safe diagnostics describe response shape without including provider text or unknown values',()=>{
  const shape=responseShape({status:'completed',output_text:'SECRET_SENTINEL',output:[{type:'reasoning',content:[{type:'SECRET_SENTINEL',text:'SECRET_SENTINEL'}]}]});
  assert.equal(shape.readableCharacters,15);assert.deepEqual(shape.outputKinds,['reasoning']);assert.doesNotMatch(JSON.stringify(shape),/SECRET_SENTINEL/);
});
