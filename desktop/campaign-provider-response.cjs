function responseText(result) {
  const nested=(Array.isArray(result?.output)?result.output:[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text'&&typeof item.text==='string').map(item=>item.text).join('\n');
  return nested || (typeof result?.output_text==='string'?result.output_text:'');
}
function responseShape(result) {
  const items=Array.isArray(result?.output)?result.output:[];
  const kind=value=>['message','reasoning','function_call','output_text','text','refusal'].includes(value)?value:'other';
  return {status:['completed','incomplete','failed'].includes(result?.status)?result.status:'other',outputType:Array.isArray(result?.output)?'array':typeof result?.output,outputItems:items.length,outputKinds:items.slice(0,12).map(item=>kind(item.type)),contentKinds:items.slice(0,12).flatMap(item=>Array.isArray(item.content)?item.content.slice(0,8).map(content=>kind(content.type)):[]),topLevelText:typeof result?.output_text==='string',readableCharacters:responseText(result).length};
}
function decodeResponse(raw, streaming) {
  if (!streaming) return JSON.parse(raw);
  let result = null, text = '';
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    const event = JSON.parse(line.slice(6));
    if(event.type==='response.output_text.delta'){
      if(typeof event.delta!=='string'||text.length+event.delta.length>30000)throw Error('Provider returned invalid or oversized text deltas.');
      text+=event.delta;
    }
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
      const code = event.response?.error?.code || event.error?.code || event.response?.incomplete_details?.reason || 'incomplete';
      const safeCode = typeof code === 'string' && /^[-a-zA-Z0-9_]{1,100}$/.test(code) ? code : 'incomplete';
      const error = Error('Provider response did not complete (' + safeCode + '). No API fallback was made.');
      error.reportedUsage = event.response?.usage;
      if(text)error.partialText=text;
      throw error;
    }
    if (event.type === 'response.completed') {
      if (result || event.response?.status !== 'completed') throw Error('Provider returned an invalid terminal response.');
      result = event.response;
    }
  }
  if (!result) throw Error('Provider stream ended before completion. No automatic retry or API fallback was made.');
  // The documented streaming contract supplies text in deltas. A completed
  // response can report usage without repeating its streamed output.
  return !responseText(result)&&text ? {...result,output_text:text} : result;
}
module.exports = {decodeResponse,responseText,responseShape};
