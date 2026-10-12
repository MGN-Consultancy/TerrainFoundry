const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tf-ai-master-'));
 const env={...process.env,TERRAIN_CAMPAIGN_DIR:dir+'/campaigns',TERRAIN_SCENE_LIBRARY:dir+'/scenes'};delete env.ELECTRON_RUN_AS_NODE;
 let app;const launch=()=>_electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['.','--user-data-dir='+dir+'/profile'],env});
 async function openSettings(){const page=await app.firstWindow();await page.waitForSelector('#campaign-home',{timeout:120000,state:'attached'});for(const [modal,close]of [['#release-dialog','#release-acknowledge'],['#tutorial-dialog','#tutorial-close']])if(await page.locator(modal).isVisible())await page.locator(close).click();await page.locator('#studio-home[open]').waitFor();await page.locator('#studio-settings').click();await page.locator('[data-settings-section=ai]').click();return page;}
 try{
  app=await launch();let page=await openSettings();
  await page.locator('#campaign-setup-close').click();await page.locator('#studio-home-close').click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].maximize());
  await page.locator('.header-actions .editor-menu>summary').click();
  for(const id of ['editor-close','editor-windowed','editor-exit'])assert.equal(await page.locator('#'+id).isVisible(),true);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(true));await page.locator('#editor-windowed').click();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),false);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:1100,height:720}));
  const sceneName=await page.locator('#name').inputValue();await page.locator('#editor-close').click();await page.locator('#studio-home[open]').waitFor();assert.equal(await page.locator('#name').inputValue(),sceneName);page=await openSettings();
  assert.equal(await page.locator('#campaign-setup-dialog .studio-heading button').count(),0);
  assert.deepEqual(await page.locator('.settings-footer-actions button').allTextContents(),['Apply','Save and close','Close']);
  await page.locator('[data-settings-section=general]').click();await page.locator('#settings-startup').selectOption('fullscreen');await page.locator('#settings-apply').click();await page.waitForFunction(()=>document.querySelector('.ai-settings-footer span').textContent==='Settings saved on this PC.');assert.equal(await page.locator('#campaign-setup-dialog').isVisible(),true);assert.equal(await page.evaluate(async()=>(await window.desktop.clientPreferencesRead()).startupMode),'fullscreen');
  await page.locator('#settings-startup').selectOption('windowed');await page.locator('#campaign-setup-close').click();page=await openSettings();assert.equal(await page.locator('#settings-startup').inputValue(),'fullscreen');
  await page.locator('[data-settings-section=general]').click();await page.locator('#settings-startup').selectOption('windowed');await page.locator('#settings-save-close').click();await page.waitForFunction(()=>!document.querySelector('#campaign-setup-dialog').open);assert.equal(await page.evaluate(async()=>(await window.desktop.clientPreferencesRead()).startupMode),'windowed');page=await openSettings();
  assert.equal(await page.locator('#settings-section-general #settings-default-ai').count(),0);
  assert.equal(await page.locator('#ai-panel-general #settings-default-ai').count(),1);
  assert.equal(await page.locator('.ai-settings-tabs [role=tab]:visible').count(),1);
  assert.equal(await page.locator('#campaign-provider-form').isVisible(),false);
  assert.equal(await page.locator('.campaign-key-actions').isVisible(),false);
  await page.locator('#settings-ai-enabled').click();await page.locator('#settings-ai-consent-dialog[open]').waitFor();
  assert.equal(await page.evaluate(async()=>(await window.desktop.campaignAIStatus()).consent.accepted),false);
  await page.getByRole('button',{name:'Cancel enabling AI'}).click();assert.equal(await page.locator('#settings-ai-enabled').isChecked(),false);
  await page.locator('#settings-ai-enabled').click();await page.locator('#settings-ai-consent-dialog #campaign-ai-consent').check();
  await page.waitForFunction(()=>document.querySelector('#settings-ai-enabled').checked&&!document.querySelector('#settings-ai-consent-dialog').open);
  assert.equal(await page.locator('.ai-settings-tabs [role=tab]:visible').count(),7);
  await page.locator('#ai-tab-openai').click();assert.equal(await page.locator('#ai-panel-openai').isVisible(),true);
  await page.locator('#campaign-setup-close').click();await page.locator('#studio-settings').click();await page.locator('[data-settings-section=ai]').click();assert.equal(await page.locator('#settings-ai-enabled').isChecked(),true);
  await app.close();app=await launch();page=await openSettings();assert.equal(await page.locator('#settings-ai-enabled').isChecked(),true);
  const profilePath=await app.evaluate(({app})=>app.getPath('userData'));const {createCampaignAI}=require('../desktop/campaign-ai.cjs');const fakeAI=createCampaignAI({directory:path.join(profilePath,'private'),safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value)},inventory:async()=>[]});for(const provider of ['openai','claude','meshy'])await fakeAI.saveKey(provider,'fake-test-only-key-not-a-real-credential');
  await page.locator('#settings-ai-enabled').uncheck();await page.waitForFunction(()=>!document.querySelector('#settings-ai-enabled').disabled&&document.querySelector('#ai-tab-openai').hidden);
  await page.locator('#settings-ai-disable-dialog[open]').waitFor();
  await page.locator('[data-keys=retain]').click();
  assert.deepEqual(await page.evaluate(async()=>(await window.desktop.campaignAIStatus()).configured),{openai:true,claude:true,meshy:true});
  assert.equal(await page.locator('.ai-settings-tabs [role=tab]:visible').count(),1);
  const blocked=await page.evaluate(async()=>{try{await window.desktop.campaignVoiceStart('unused');return false;}catch(error){return /consent|accept|security/i.test(error.message);}});assert.equal(blocked,true);
  await page.locator('#settings-ai-enabled').click();await page.locator('#settings-ai-consent-dialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#settings-ai-enabled').isChecked(),false);
  await page.locator('#settings-ai-enabled').click();await page.locator('#settings-ai-consent-dialog #campaign-ai-consent').check();await page.waitForFunction(()=>document.querySelector('#settings-ai-enabled').checked&&!document.querySelector('#settings-ai-consent-dialog').open);
  await page.locator('#settings-ai-enabled').uncheck();await page.locator('#settings-ai-disable-dialog[open]').waitFor();await page.locator('[data-keys=remove]').click();await page.waitForFunction(()=>!document.querySelector('#settings-ai-disable-dialog').open);
  assert.deepEqual(await page.evaluate(async()=>(await window.desktop.campaignAIStatus()).configured),{openai:false,claude:false,meshy:false});
  await app.close();app=await launch();page=await openSettings();assert.equal(await page.locator('#settings-ai-enabled').isChecked(),false);assert.deepEqual(await page.evaluate(async()=>(await window.desktop.campaignAIStatus()).configured),{openai:false,claude:false,meshy:false});
  console.log(JSON.stringify({passed:true,consentRequired:true,cancelStaysOff:true,providerTabsGated:true,defaultOnAIGeneral:true,persistedOnRestart:true,disabledInNativeProcess:true,retainKeys:true,removeAllProviderKeys:true,realProviderCalls:0}));
 }finally{if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
