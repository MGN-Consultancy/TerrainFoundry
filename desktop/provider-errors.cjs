const SAFE_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
function providerError({status,body,requestId,provider='Provider',cause}={}){
 const label=provider==='openai'?'OpenAI':provider==='meshy'?'Meshy':provider==='claude'?'Anthropic':'Provider';
 let data=body;if(typeof data==='string'&&Buffer.byteLength(data)<=16384){try{data=JSON.parse(data);}catch{data=null;}}
 const detail=data&&typeof data==='object'&&!Array.isArray(data)?data:null;
 const error=detail?.error||detail?.task_error||detail;
 const raw=[error?.code,error?.type,detail?.code,detail?.error_code].filter(v=>typeof v==='string'&&v.length<=100).join(' ').toLowerCase();
 // Classify known codes and fixed billing phrases; never echo provider prose, which can contain secrets.
 const billingPhrase=typeof error?.message==='string'&&error.message.length<=2000&&/credit balance is too low|insufficient credits|not enough credits/i.test(error.message);
 let code='provider_failure',message='could not complete this request. Check provider service status before trying again.';
 if(billingPhrase||/billing[_ -]?not[_ -]?active|credit[_ -]?balance[_ -]?too[_ -]?low/.test(raw)||/insufficient[_ -]?(credits?|quota|balance)|credit[_ -]?(balance[_ -]?)?insufficient|quota[_ -]?exceeded|out[_ -]?of[_ -]?credits/.test(raw)||status===402){code='insufficient_credits';message='reports insufficient credits or API quota. Add credits or review billing in your provider account; a ChatGPT subscription does not fund API usage.';}
 else if(/spend[_ -]?limit|billing[_ -]?hard[_ -]?limit|budget[_ -]?exceeded|usage[_ -]?limit[_ -]?(reached|exceeded)/.test(raw)){code='spend_limit';message='reports an account spending limit. Review your API billing budget and limits before trying again.';}
 else if(status===401||/invalid[_ -]?(api[_ -]?)?key|authentication/.test(raw)){code='authentication';message='API key was rejected. Update the saved key in Settings.';}
 else if(status===403||/permission|model[_ -]?(not[_ -]?found|access)|access[_ -]?denied/.test(raw)){code='permission';message='does not allow this key to use the selected model or operation. Check model access and key permissions in Settings.';}
 else if(status===429||/rate[_ -]?limit|too[_ -]?many[_ -]?requests/.test(raw)){code='rate_limit';message='rate limit reached. Wait briefly before trying again; check provider rate limits if this continues.';}
 else if(status===408||status===504||cause?.name==='TimeoutError'||cause?.name==='AbortError'||/timeout|timed[_ -]?out/.test(raw)){code='timeout';message='request timed out. Check saved task history before resubmitting a paid generation.';}
 else if(status>=500){code='outage';message='service is temporarily unavailable. Resume any saved task later; paid requests are never retried automatically.';}
 else if(cause){code='connection';message='connection failed. Check your connection; paid requests are never retried automatically.';}
 else if(status===400){code='invalid_request';message='rejected these generation settings. Check the selected model and input before trying again.';}
 else if(status===404){code='not_found';message='selected model or task is unavailable. Check Settings or the provider task history.';}
 const result=Error(label+' '+message+(Number.isInteger(status)&&status>=100?' (HTTP '+status+').':''));result.code=code;
 if(Number.isInteger(status)){result.httpStatus=status;result.status=status;}
 if(typeof requestId==='string'&&SAFE_ID.test(requestId))result.requestId=requestId;
 return result;
}
function reportedCredits(task){for(const value of [task?.credits,task?.usage?.credits,task?.consumed_credits,task?.credit_cost])if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=100000000)return value;return null;}
async function responseError(response,provider){
 let body=null;const reader=response.body?.getReader();
 if(reader){const parts=[];let size=0;try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>16384){await reader.cancel();parts.length=0;break;}parts.push(Buffer.from(next.value));}if(parts.length)body=Buffer.concat(parts).toString('utf8');}catch{}finally{reader.releaseLock?.();}}
 return providerError({provider,status:response.status,body,requestId:response.headers?.get('x-request-id')||response.headers?.get('request-id')});
}
module.exports={providerError,responseError,reportedCredits};
