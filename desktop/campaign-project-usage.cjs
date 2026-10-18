const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {atomicWrite} = require('./project-store.cjs');
function createCampaignUsage(directory) {
  const filename = path.join(directory, 'campaign-ai-usage.json');
  let queue = Promise.resolve();
  async function read() {
    try {
      if ((await fs.stat(filename)).size > 8000000) throw Error('Usage ledger is too large. Export or archive it before continuing.');
      const value = JSON.parse(await fs.readFile(filename, 'utf8'));
      if (!value || value.schema !== 1 || !Array.isArray(value.requests)) throw Error('Usage ledger is invalid. AI requests are paused to preserve accounting.');
      return value;
    } catch (error) { if (error.code === 'ENOENT') return {schema: 1, requests: [], limits: {}}; throw error; }
  }
  function update(fn) {
    const task = queue.then(async () => { const ledger = await read(); const result = fn(ledger); await fs.mkdir(directory, {recursive: true}); await atomicWrite(filename, JSON.stringify(ledger)); return result; });
    queue = task.catch(() => {}); return task;
  }
  async function begin(project, route, kind) {
    const id = crypto.randomUUID();
    await update(ledger => { ledger.requests.push({id, project, route, kind, outcome: 'pending', at: new Date().toISOString(), input: null, output: null}); });
    return id;
  }
  async function record(project, route, kind, usage, outcome, id) {
    return update(ledger => {
      const input = usage?.input_tokens, output = usage?.output_tokens;
      const valid = Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0;
      const row = {id: id || crypto.randomUUID(), project, route, kind, outcome, at: new Date().toISOString(), input: valid ? input : null, output: valid ? output : null};
      if (id) {
        const index = ledger.requests.findIndex(row => row.id === id && row.project === project && row.route === route && row.kind === kind);
        if (index < 0) throw Error('Usage ledger request is missing; usage cannot be reconciled.');
        ledger.requests[index] = row;
      } else ledger.requests.push(row);
    });
  }
  async function summary(project) {
    await queue;
    const ledger = await read(), requests = ledger.requests.filter(row => row.project === project);
    const totals = {allowanceTokens: 0, apiTokens: 0, unknownRequests: 0, imageRequests: 0, requests: requests.length, limit: ledger.limits?.[project] || 0, cost: null, remainingAllowance: null};
    for (const row of requests) {
      if (row.kind === 'illustration') { totals.imageRequests++; continue; }
      if (row.input === null || row.output === null) totals.unknownRequests++;
      else totals[row.route === 'allowance' ? 'allowanceTokens' : 'apiTokens'] += row.input + row.output;
    }
    return totals;
  }
  async function setLimit(project, maximum) {
    if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > 100000000) throw Error('Choose a whole-number token limit from 0 to 100,000,000.');
    await update(ledger => { ledger.limits ??= {}; ledger.limits[project] = maximum; });
    return summary(project);
  }
  async function reserve(project, payload) {
    const status = await summary(project);
    if (!status.limit) return;
    if (status.unknownRequests) throw Error('Some earlier token usage is unreported. A bounded request cannot continue until usage is reconciled or you explicitly remove the project limit.');
    const available = status.limit - status.allowanceTokens - status.apiTokens - Buffer.byteLength(JSON.stringify(payload), 'utf8') - 4096;
    if (available < 128) throw Error('This request cannot fit safely within the remaining project token limit. Shorten it or increase the limit.');
    if (payload.max_tokens !== undefined) payload.max_tokens = Math.min(payload.max_tokens, available);
    else payload.max_output_tokens = Math.min(payload.max_output_tokens || 2000, available);
  }
  return {begin, record, summary, setLimit, reserve};
}
module.exports = {createCampaignUsage};
