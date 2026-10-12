// Keep existing controls and their handlers; organise them into focused panels.
export function setupAISettingsLayout(root,api,{onKeysChanged=async()=>{}}={}){
 const get=id=>root.querySelector('#'+id),form=get('campaign-provider-form');
 const nav=document.createElement('div');nav.className='ai-settings-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','AI integration settings');
 const body=document.createElement('div');body.className='ai-settings-body';
 const panels={};
 for(const [id,title]of Object.entries({general:'General',openai:'OpenAI options',claude:'Claude options',meshy:'Meshy options',workspace:'Workspace',privacy:'Privacy & consent',usage:'Usage'})){
  const button=document.createElement('button');button.type='button';button.id='ai-tab-'+id;button.textContent=title;button.setAttribute('role','tab');button.setAttribute('aria-controls','ai-panel-'+id);button.onclick=()=>select(id);nav.append(button);
  const panel=document.createElement('section');panel.id='ai-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.hidden=true;panels[id]=panel;body.append(panel);
 }
 root.querySelector('.studio-heading').after(nav,body);
 const move=(node,panel)=>{if(node)panels[panel].append(node);};
 for(const id of ['campaign-agent-mode','campaign-shared-style']){const label=get(id).closest('label'),note=label.nextElementSibling;move(label,'workspace');move(note,'workspace');}
 get('campaign-shared-style').rows=4;
 const security=root.querySelector('.ai-settings-security'),tests=security.querySelector('.ai-provider-tests');move(security,'privacy');
 panels.openai.append(tests);for(const card of tests.children)card.hidden=card.dataset.provider!=='openai';
 move(root.querySelector('.campaign-meshy-settings'),'meshy');
 move(get('campaign-ai-spending'),'usage');move(root.querySelector('.campaign-cost-note'),'usage');
 const providerLabel=get('campaign-provider').closest('label');providerLabel.hidden=true;
 const advanced=get('campaign-ai-advanced');advanced.open=true;advanced.querySelector('summary').textContent='Models and response length';
 // Provider settings share a draft, so moving the same form preserves unsaved edits.
 const providerNodes=[form,get('campaign-key-status'),root.querySelector('.campaign-key-actions'),get('campaign-key-test-status')];
 const testNote=get('campaign-key-test-status').nextElementSibling;
 if(testNote?.tagName==='P')move(testNote,'privacy');
 move(advanced.querySelector('p'),'privacy');
 get('campaign-model-name').hidden=true;
 get('campaign-voice-provider').closest('label').nextElementSibling.textContent='Live voice sends audio to OpenAI and is billed separately. Native dictation remains available without a key.';
 const save=form.querySelector('button.primary');save.setAttribute('form',form.id);save.textContent='Apply';save.id='settings-apply';save.classList.remove('primary');
 const saveClose=document.createElement('button');saveClose.type='submit';saveClose.id='settings-save-close';saveClose.className='primary';saveClose.textContent='Save and close';saveClose.setAttribute('form',form.id);
 const close=get('campaign-setup-close');close.textContent='Close';close.type='button';
 const actions=document.createElement('div');actions.className='settings-footer-actions';actions.append(save,saveClose,close);
 const footer=document.createElement('footer');footer.className='ai-settings-footer';footer.innerHTML='<span role="status">Keys stay encrypted on this PC. Online AI is optional.</span>';footer.append(actions);root.append(footer);
 panels.openai.append(...providerNodes);
 let active='general',enabled=false;
 function select(id,{syncProvider=true}={}){
  if(!enabled&&id!=='general')id='general';
  active=id;
  if(id==='openai'||id==='claude'){
   if(syncProvider&&get('campaign-provider').value!==id){get('campaign-provider').value=id;get('campaign-provider').dispatchEvent(new Event('change'));}
   for(const node of providerNodes)panels[id].append(node);
   get('campaign-voice-provider').closest('label').hidden=id!=='openai';
   get('campaign-voice-provider').closest('label').nextElementSibling.hidden=id!=='openai';
  }
  if(['openai','claude','meshy'].includes(id)){
   panels[id].prepend(tests);
   for(const card of tests.children)card.hidden=card.dataset.provider!==id;
  }
  for(const [key,panel]of Object.entries(panels)){panel.hidden=key!==id;const tab=get('ai-tab-'+key);tab.setAttribute('aria-selected',String(key===id));tab.tabIndex=key===id?0:-1;}
  body.scrollTop=0;
 }
 nav.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const ids=Object.keys(panels).filter(id=>!get('ai-tab-'+id).hidden),index=ids.indexOf(active),next=event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length;select(ids[next]);get('ai-tab-'+ids[next]).focus();};
 select('general',{syncProvider:false});
 root.querySelector('.studio-heading h2').textContent='Settings';
 const shell=document.createElement('div');shell.className='settings-shell';
 const menu=document.createElement('nav');menu.className='settings-root-menu';menu.setAttribute('aria-label','Settings sections');
 const content=document.createElement('div');content.className='settings-root-content';
 root.querySelector('.studio-heading').after(shell);shell.append(menu,content);
 const sections={};
 for(const [id,title]of Object.entries({general:'General',visuals:'Visuals',ai:'AI integration',purchases:'Purchases'})){
  const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.settingsSection=id;button.onclick=()=>showSection(id);menu.append(button);
  const section=document.createElement('section');section.id='settings-section-'+id;section.hidden=true;sections[id]=section;content.append(section);
 }
 sections.ai.append(nav,body);
 sections.general.innerHTML='<h3>General</h3><p>Choose how Terrain Foundry starts and manage your local files.</p><div class="settings-fields"><label>Start the client in<select id="settings-startup"><option value="windowed">Windowed</option><option value="fullscreen">Fullscreen</option></select><small>Applies the next time you open the client.</small></label></div><section class="settings-storage"><h3>Storage & backup</h3><p>Review disk usage, export your personal library, restore a backup or clear disposable caches.</p><div id="settings-storage-action"></div></section>';
 panels.general.innerHTML='<h3>AI companion</h3><p>Optional help with campaigns, characters, scenery and world building. You can continue editing and use native dictation with AI switched off.</p><label class="ai-master-choice"><input id="settings-ai-enabled" type="checkbox" role="switch" aria-describedby="settings-ai-enabled-status"><span>AI companion <strong id="settings-ai-enabled-label">Off</strong></span></label><p id="settings-ai-enabled-status" role="status"></p><div id="settings-ai-defaults" class="settings-fields" hidden><label>Default AI companion<select id="settings-default-ai"><option value="openai">OpenAI</option><option value="claude">Claude</option></select><small>Used for text and planning. OpenAI supplies live voice and images; Meshy supplies 3D generation.</small></label></div>';
 const consentDialog=document.createElement('dialog');consentDialog.id='settings-ai-consent-dialog';consentDialog.className='studio-dialog';consentDialog.setAttribute('aria-labelledby','settings-ai-consent-heading');consentDialog.innerHTML='<div class="studio-heading"><h2 id="settings-ai-consent-heading">Enable AI companion</h2><button type="button" aria-label="Cancel enabling AI">Not now</button></div><div class="ai-consent-content"></div>';
 document.body.append(consentDialog);
 const disableDialog=document.createElement('dialog');disableDialog.id='settings-ai-disable-dialog';disableDialog.className='studio-dialog';disableDialog.setAttribute('aria-labelledby','settings-ai-disable-heading');disableDialog.innerHTML='<h2 id="settings-ai-disable-heading">AI companion is off</h2><p>Would you like to retain your encrypted OpenAI, Claude and Meshy API keys on this PC for later, or remove all saved provider keys?</p><p>If you remove your keys, you will need to enter them again and test each provider before using AI later. Removing keys here does not revoke them with the providers. Your campaigns, assets and usage history are retained.</p><div class="ai-disable-actions"><button type="button" data-keys="retain">Keep keys on this PC</button><button type="button" data-keys="remove">Remove saved keys</button></div><p role="status"></p><small>Closing this window keeps your keys. AI remains off.</small>';
 document.body.append(disableDialog);let offerKeys=false,removingKeys=false;
 disableDialog.querySelector('[data-keys=retain]').onclick=()=>{get('settings-ai-enabled-status').textContent='AI is off. Your encrypted provider keys are retained on this PC.';disableDialog.close();};
 disableDialog.querySelector('[data-keys=remove]').onclick=async()=>{
  removingKeys=true;for(const button of disableDialog.querySelectorAll('button'))button.disabled=true;
  const message=disableDialog.querySelector('[role=status]');message.textContent='Removing saved provider keys…';
  try{for(const provider of ['openai','claude','meshy'])await api.campaignAIForget(provider);await onKeysChanged();get('settings-ai-enabled-status').textContent='AI is off. All saved provider keys have been removed from this PC. Enter and test your keys again before using AI later.';disableDialog.close();}
  catch(error){message.textContent='AI remains off. Some keys could not be removed: '+error.message+' You can try again.';}
  finally{removingKeys=false;for(const button of disableDialog.querySelectorAll('button'))button.disabled=false;}
 };
 disableDialog.oncancel=event=>{if(removingKeys)event.preventDefault();};
 const master=get('settings-ai-enabled'),consent=security.querySelector('#campaign-ai-consent');
 consent.addEventListener('change',()=>{if(!consent.checked&&enabled)offerKeys=true;});
 consentDialog.querySelector('button').onclick=()=>consentDialog.close();
 consentDialog.onclose=()=>{panels.privacy.prepend(security);master.checked=enabled;master.disabled=false;};
 master.onchange=()=>{
  if(master.checked){master.checked=false;consent.checked=false;security.querySelector('details').open=true;consentDialog.querySelector('.ai-consent-content').append(security);consentDialog.showModal();}
  else{offerKeys=true;master.disabled=true;consent.checked=false;consent.dispatchEvent(new Event('change'));}
 };
 function syncConsent(state){enabled=state?.consent?.accepted===true;master.checked=enabled;master.disabled=false;get('settings-ai-enabled-label').textContent=enabled?'On':'Off';get('settings-ai-enabled-status').textContent=enabled?'Online AI enabled. Configure your providers in the tabs above.':'AI is off. Switch it on to review privacy, data sharing and API charges before enabling it.';get('settings-ai-defaults').hidden=!enabled;for(const id of Object.keys(panels))get('ai-tab-'+id).hidden=id!=='general'&&!enabled;if(!enabled&&active!=='general')select('general');if(enabled&&consentDialog.open)consentDialog.close();}
 security.addEventListener('ai-consent-updated',event=>{syncConsent(event.detail);if(offerKeys){offerKeys=false;if(!enabled){disableDialog.querySelector('[role=status]').textContent='';disableDialog.showModal();}}});
 sections.visuals.innerHTML='<h3>Visuals</h3><p>Make the workshop comfortable to use on your display.</p><div class="settings-fields"><label>Interface size<select id="settings-interface-scale"><option value="0.9">Compact · 90%</option><option value="1">Standard · 100%</option><option value="1.1">Larger · 110%</option><option value="1.25">Largest · 125%</option></select><small>Applies when you save settings.</small></label><label class="settings-checkbox"><input type="checkbox" id="settings-reduced-motion"> Reduce interface animation</label></div><p>This reduces interface movement. You can still rotate and inspect models normally.</p>';
 sections.purchases.innerHTML='<h3>Purchased scenery packs</h3><p>Your activated packs remain available offline once downloaded. Activating a pack requires its activation key and acceptance of its licence.</p><div id="settings-pack-summary" role="status"></div><button type="button" id="settings-manage-packs">Manage packs & activation…</button>';
 get('settings-manage-packs').onclick=()=>api.premiumOpen().then(()=>window.dispatchEvent(new Event('premium-assets-changed'))).catch(error=>{get('settings-pack-summary').textContent=error.message;});
 function showSection(id){for(const [key,section]of Object.entries(sections))section.hidden=key!==id;for(const button of menu.children)button.setAttribute('aria-current',button.dataset.settingsSection===id?'page':'false');}
 async function refresh(){const preferences=await api.clientPreferencesRead();get('settings-startup').value=preferences.startupMode;get('settings-interface-scale').value=String(preferences.interfaceScale);get('settings-reduced-motion').checked=preferences.reducedMotion;document.documentElement.classList.toggle('reduce-motion',preferences.reducedMotion);syncConsent(await api.campaignAIStatus());select('general');showSection('general');try{const inventory=await api.premiumInventory();const packs=inventory.packs||[];get('settings-pack-summary').textContent=packs.length?packs.map(pack=>pack.name||pack.title||pack.id||pack.packId).join(' · '):'No activated premium packs on this PC.';}catch(error){get('settings-pack-summary').textContent='Pack status unavailable: '+error.message;}}
 async function savePreferences(){const saved=await api.clientPreferencesSave({startupMode:get('settings-startup').value,interfaceScale:Number(get('settings-interface-scale').value),reducedMotion:get('settings-reduced-motion').checked});document.documentElement.classList.toggle('reduce-motion',saved.reducedMotion);}
 // Apply accessibility preference even before Settings is opened.
 void api.clientPreferencesRead?.().then(value=>document.documentElement.classList.toggle('reduce-motion',value.reducedMotion)).catch(()=>{});
 return {select,refresh,savePreferences,syncConsent};
}
