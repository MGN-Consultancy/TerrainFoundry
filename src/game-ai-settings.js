export function linkedAISettings({setup, api, run}) {
  const section = document.createElement('section');
  section.className = 'game-linked-ai';
  section.innerHTML = '<h3>Linked ChatGPT account</h3><p>Use your linked account for companion conversation. Account usage follows your ChatGPT plan and credit settings. Concept image generation requires a separate OpenAI API key; you can upload your own art instead. Mesh generation uses Meshy separately.</p><label>Saved ChatGPT account<select data-account><option value="">Add a ChatGPT account</option></select></label><button type="button" data-connect>Continue with ChatGPT</button><button type="button" data-repair hidden>Back up and repair saved connection</button><button type="button" data-cancel hidden>Cancel sign-in</button><button type="button" data-refresh>Refresh connection</button><button type="button" data-disconnect>Disconnect selected account</button><p data-status role="status"></p><label>ChatGPT conversation model<select data-model><option value="">Connect to see available models</option></select></label><label>Conversation funding<select data-route><option value="auto">Linked ChatGPT when connected; otherwise configured API</option><option value="chatgpt">Linked ChatGPT only</option><option value="api">API key only</option></select></label><button type="button" data-save>Save conversation route and model</button><p>No silent API-key fallback after a linked-account request fails. Token counts are recorded locally; remaining plan allowance and monetary charges are unknown. Review your app limits and credit settings in ChatGPT.</p>';
  (setup.querySelector('.studio-heading')||setup.firstElementChild).after(section);
  const find = selector => section.querySelector(selector);
  let savedModel = '', pendingRefresh;
  async function refresh() {
    clearTimeout(pendingRefresh);
    const status = await api.campaignAIStatus();
    const account = status.chatgpt || {};
    const choose = find('[data-account]');
    choose.replaceChildren(new Option('Add a ChatGPT account', ''));
    for (const item of account.accounts || []) choose.append(new Option(item.label + ' · ' + item.id.slice(0,8), item.id));
    choose.value = account.active || account.accounts?.find(item=>item.registeredOnly)?.id || '';
    find('[data-status]').textContent = account.message || (account.signedIn ? 'ChatGPT linked.' : 'No ChatGPT account connected.');
    find('[data-connect]').disabled = !!account.pending;find('[data-connect]').textContent=account.pending?'Waiting for browser…':'Continue with ChatGPT';find('[data-cancel]').hidden=!account.pending;find('[data-repair]').hidden=!account.unreadable;find('[data-repair]').disabled=!!account.pending;if(account.pending)find('[data-status]').textContent+=' If the browser fails, cancel sign-in here and try again.';
    find('[data-disconnect]').disabled = !account.active;
    find('[data-route]').value = status.route || 'auto';
    savedModel = status.chatgptModel || '';
    const model = find('[data-model]');
    model.replaceChildren(new Option(account.enabled ? 'Choose an available model' : 'Connect to see available models', ''));
    if (account.enabled && !account.pending) {
      try {
        const models = await api.campaignChatGPTModels();
        for (const item of models) model.append(new Option(item.name, item.id));
        model.value = savedModel;
    } catch (error) { find('[data-status]').textContent = error.message; }
    }
    if(account.pending)pendingRefresh=setTimeout(()=>refresh().catch(error=>{find('[data-status]').textContent=error.message;}),1500);
  }
  find('[data-connect]').onclick = run(async () => { await api.campaignChatGPTStart(find('[data-account]').value || undefined); await refresh(); });
  find('[data-repair]').onclick = run(async () => { await api.campaignChatGPTRepair(); await refresh(); });
  find('[data-cancel]').onclick = run(async () => { await api.campaignChatGPTCancel(); await refresh(); });
 find('[data-refresh]').onclick = run(refresh);
  find('[data-disconnect]').onclick = run(async () => { await api.campaignChatGPTDisconnect(); await refresh(); });
  find('[data-account]').onchange = run(async () => { const id = find('[data-account]').value; if (id) { await api.campaignChatGPTSelect(id); await refresh(); } });
  find('[data-save]').onclick = run(async () => {
    const old = await api.campaignAIStatus();
    await api.campaignAIConfigure({provider: old.provider, model: old.model, imageModel: old.imageModel, outputBudget: old.outputBudget,
      route: find('[data-route]').value, chatgptModel: find('[data-model]').value || savedModel});
    await refresh();
  });
  return {refresh};
}

export function campaignUsageControls({heading, api, run, getCampaign}) {
  const meter = document.createElement('small'); meter.id = 'campaign-token-meter'; meter.setAttribute('role', 'status');
  meter.style.cssText = 'max-width:25rem;white-space:normal;text-align:right';
  heading.prepend(meter);
  async function refresh() {
    const campaign = getCampaign(); if (!campaign) return;
    const id = campaign.id;
    meter.textContent = 'Loading project usage…';
    try {
      const usage = await api.campaignAIUsage(id);
      if (getCampaign()?.id !== id) return;
      meter.textContent = `Recorded ChatGPT: ${usage.allowanceTokens.toLocaleString()} tokens · API: ${usage.apiTokens.toLocaleString()} tokens · Images: ${usage.imageRequests}`
        + (usage.unknownRequests ? ` · ${usage.unknownRequests} unreported` : '')
        + (usage.limit ? ` · Limit ${usage.limit.toLocaleString()}` : ' · No text token limit');
      meter.title = 'This project’s recorded usage since this update only. Earlier unclassified activity is not included. Remaining ChatGPT allowance and monetary charges are unknown. Images and Meshy are separate from text token limits.';
    } catch { meter.textContent = 'Project usage unavailable — totals unknown'; }
  }
  function limits(container) {
    const label = document.createElement('label'); label.textContent = 'Project companion token limit (linked ChatGPT + API text; 0 = no limit)';
    const input = document.createElement('input'); input.type = 'number'; input.min = 0; input.max = 100000000; input.step = 1; input.value = 0;
    input.setAttribute('aria-label', 'Project token limit'); label.append(input);
    const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save project token limit';
    const id = getCampaign().id;
    api.campaignAIUsage(id).then(usage => { if (getCampaign()?.id === id) input.value = usage.limit; }).catch(() => { input.placeholder = 'Unknown'; });
    save.onclick = run(async () => { await api.campaignAITokenLimit(id, Number(input.value)); await refresh(); });
    const note = document.createElement('p'); note.textContent = 'The limit conservatively bounds text requests. Images, voice and Meshy have separate charges. Unreported prior usage prevents further bounded requests; no remaining subscription balance or dollar cost is assumed.';
    container.append(label, save, note);
  }
  return {refresh, limits};
}
