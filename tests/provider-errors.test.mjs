import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {providerError,responseError,reportedCredits}=createRequire(import.meta.url)('../desktop/provider-errors.cjs');
test('provider codes distinguish account credit and spend limits from transient rate limiting',()=>{
 for(const [status,body,expected] of [[429,{error:{code:'insufficient_quota'}},'insufficient_credits'],[429,{error:{code:'billing_hard_limit_reached'}},'spend_limit'],[429,{error:{code:'rate_limit_exceeded'}},'rate_limit'],[402,{},'insufficient_credits'],[401,{},'authentication'],[403,{},'permission'],[503,{},'outage'],[504,{},'timeout']])assert.equal(providerError({status,body,provider:'openai'}).code,expected);
});
test('provider error never reveals freeform text, malformed identifiers or network causes',()=>{
 const secret='sk-secret-private-prompt';for(const body of [{error:{message:secret,code:secret}},{task_error:{message:secret}},secret]){const error=providerError({status:429,body,requestId:secret+'\n',provider:'meshy',cause:Error(secret)});assert.ok(!JSON.stringify(error).includes(secret));assert.ok(!error.message.includes(secret));assert.equal(error.requestId,undefined);}
 const error=providerError({status:401,requestId:'req_valid-123',body:{},provider:'openai'});assert.equal(error.requestId,'req_valid-123');assert.equal(error.httpStatus,401);
});
test('response errors classify bounded parsed bodies and discard oversized untrusted payloads',async()=>{
 const error=await responseError(new Response(JSON.stringify({error:{code:'insufficient_quota',message:'PRIVATE'}}),{status:429,headers:{'x-request-id':'req_123'}}),'openai');assert.equal(error.code,'insufficient_credits');assert.equal(error.requestId,'req_123');assert.ok(!error.message.includes('PRIVATE'));
 assert.equal((await responseError(new Response('x'.repeat(17000),{status:429}),'openai')).code,'rate_limit');
});
test('reported credits only use finite integer counts actually reported by provider',()=>{assert.equal(reportedCredits({usage:{credits:25}}),25);for(const credits of [-1,Infinity,NaN,1.5,'25'])assert.equal(reportedCredits({credits}),null);assert.equal(reportedCredits({}),null);});

test('Anthropic low balance phrase and OpenAI organisation limit do not become generic rate failures',()=>{assert.equal(providerError({provider:'claude',status:400,body:{error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API. sk-secret-123456789'}}}).code,'insufficient_credits');assert.equal(providerError({provider:'openai',status:429,body:{error:{code:'organization_usage_limit_exceeded'}}}).code,'spend_limit');});
