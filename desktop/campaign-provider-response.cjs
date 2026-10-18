function decodeResponse(raw, streaming) {
  if (!streaming) return JSON.parse(raw);
  let result = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    const event = JSON.parse(line.slice(6));
    if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
      const code = event.response?.error?.code || event.error?.code || 'incomplete';
      const safeCode = typeof code === 'string' && /^[-a-zA-Z0-9_]{1,100}$/.test(code) ? code : 'incomplete';
      const error = Error('Provider response did not complete (' + safeCode + '). No API fallback was made.');
      error.reportedUsage = event.response?.usage;
      throw error;
    }
    if (event.type === 'response.completed') {
      if (result || event.response?.status !== 'completed') throw Error('Provider returned an invalid terminal response.');
      result = event.response;
    }
  }
  if (!result) throw Error('Provider stream ended before completion. No automatic retry or API fallback was made.');
  return result;
}
module.exports = {decodeResponse};
