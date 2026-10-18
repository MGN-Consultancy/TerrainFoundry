const {_electron} = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-game-designer-'));
  const artifacts = path.resolve('test-results/game-designer-official');
  await fs.mkdir(artifacts, {recursive: true});
  const fixture = path.join(root, 'fixture');
  await fs.mkdir(fixture);
  // Reuse the packaged smoke's tiny geometry fixture; these tests inspect design flows, not production mesh quality.
  const vertex = [0,0,0,25,0,0,0,8,0,0,0,25];
  const indices = [0,2,1,0,1,3,0,3,2,1,2,3];
  const data = Buffer.concat([Buffer.from(new Float32Array(vertex).buffer), Buffer.from(new Float32Array(vertex.length).fill(.7).buffer), Buffer.from(new Uint32Array(indices).buffer)]);
  await fs.writeFile(path.join(fixture, 'meshes.bin'), Buffer.concat([data, data]));
  const ids = Object.keys(JSON.parse(await fs.readFile('src/generated/builtin-index.json', 'utf8')));
  const part = {vertices: 4, indices: 12, length: data.length};
  await fs.writeFile(path.join(fixture, 'index.json'), JSON.stringify(Object.fromEntries(ids.map(id => [id, {offset: 0, raw: part, connected: part}]))));
  const packs = {test: fixture};
  await fs.writeFile(path.join(artifacts, 'fixture-receipt.json'), JSON.stringify({version: '1.19.1', fixture: true, packs}));
  const markdown = '# Beacon Keepers\nCooperative game for three players. Each player gets two actions per round. Movement follows connected locations. Resolve uncertainty with a bag of coloured stones. No dice, character levels, classes, spell slots or game master. Relight three beacons before the storm track reaches eight.\nPRIVATE-SOURCE-BEACON-773' + Array.from({length: 40}, (_, index) => '\n\n# Purple archive ' + index + '\n' + 'Old harmless purple archive material. '.repeat(15)).join('') + '\nARCHIVE-SENTINEL-778';
  const source = path.join(root, 'beacon-keepers.md');
  await fs.writeFile(source, markdown);
  const launch = async () => {
    const instance = await _electron.launch({
    executablePath: process.env.TERRAIN_EXECUTABLE || require('electron'),
    args: [...(process.env.TERRAIN_EXECUTABLE ? [] : ['.']), '--user-data-dir=' + path.join(root, 'profile')],
    env: {...process.env, TERRAIN_CAMPAIGN_DIR: path.join(root, 'campaigns'), TERRAIN_SCENE_LIBRARY: path.join(root, 'scenes'), TERRAIN_CREATIVE_LIBRARY: path.join(root, 'creative'), TERRAIN_COMPANION_DIR: path.join(root, 'companion'), TERRAIN_DOCUMENTS_DIR: path.join(root, 'documents'), TERRAIN_ASSET_PACKS: JSON.stringify(packs)},
    });
    instance.process().stderr.on('data', value => console.error(value.toString()));
    console.log('Native startup:', JSON.stringify(await instance.evaluate(({app,BrowserWindow}) => ({ready:app.isReady(), windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,url:w.webContents.getURL()}))}))));
    return instance;
  };
  const enter = async (app, create = true) => {
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => console.error('Renderer error:', error.stack));
    console.log('Native window ready');
    await page.waitForSelector('#campaign-home', {state: 'attached', timeout: 15000});
    for (const [dialog, button] of [['#release-dialog', '#release-acknowledge'], ['#tutorial-dialog', '#tutorial-close']]) {
      if (await page.locator(dialog).isVisible()) await page.locator(button).click();
    }
    await page.waitForSelector('#studio-home[open]');
    if (create) await page.locator('[data-route=campaign]').click();
    return page;
  };
  const tab = (page, name) => page.locator('#campaign-tabs').getByRole('button', {name: {Story: 'Campaign overview', Context: 'Game context', Rulebook: 'Rulebook', Print: 'Print & share'}[name] || name, exact: true}).click();
  const savedCampaign = async () => {
    const page = await app.firstWindow();
    return page.evaluate(async () => {
      const saved = (await window.desktop.campaignList()).find(item => item.name === 'Beacon Keepers');
      return window.desktop.campaignLoad(saved.id);
    });
  };
  let app = await launch();
  try {
    let page = await enter(app);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.locator('#studio-new-name').fill('Beacon Keepers');

    assert.equal(await page.locator('#campaign-game-type').inputValue(), 'custom');
    const values = await page.locator('#campaign-game-type option').evaluateAll(options => options.map(o => o.value));
    assert.deepEqual(new Set(values), new Set(['custom', 'dnd', 'warhammer']));
    for (const type of ['dnd', 'warhammer', 'custom']) {
      await page.locator('#campaign-game-type').selectOption(type);
      assert.equal(await page.locator('#campaign-game-type').inputValue(), type);
    }
    await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]}); }, source);
    await page.locator('#campaign-context-import').click();
    await page.getByText('beacon-keepers.md', {exact: true}).waitFor();
    await page.locator('#studio-create button.primary').click();
    await page.waitForSelector('#campaign-tabs');
    await tab(page, 'Context');
    assert.match(await page.locator('#campaign-body #campaign-context-files').textContent(), /beacon-keepers.md/);
    await page.locator('#campaign-body #campaign-context-files summary').click();
    assert.match(await page.locator('#campaign-body #campaign-context-files pre').textContent(), /two actions per round/);
    await tab(page, 'Rulebook');
    const addChapter = async (title, body, visible) => {
      await page.getByRole('combobox', {name: 'Edit chapter'}).selectOption('');
      await page.getByRole('textbox', {name: 'Chapter title'}).fill(title);
      await page.getByRole('textbox', {name: 'Chapter text'}).fill(body);
      await page.getByRole('checkbox', {name: 'Player-visible chapter'}).setChecked(visible);
      await page.getByRole('button', {name: 'Save chapter', exact: true}).click();
      await page.waitForFunction(title => [...document.querySelectorAll('#game-rulebook-editor select option')].some(o => o.textContent === title), title);
    };
    await addChapter('Taking a turn', 'Each keeper takes two actions. Move along one connection or relight a beacon.', true);
    await addChapter('Storm secrets', 'PRIVATE-CHAPTER-STORM-447: the storm follows hidden keeper choices.', false);
    await page.getByRole('button', {name: 'Move chapter earlier'}).click();
    await page.waitForFunction(() => document.querySelector('#game-rulebook-editor select').options[1]?.textContent === 'Storm secrets');
    await page.getByRole('button', {name: 'Next page', exact: true}).click();
    assert.match(await page.locator('#game-rulebook-page').textContent(), /Contents/);
    await page.locator('#game-rulebook-page').getByRole('button', {name: 'Taking a turn', exact: true}).click();
    assert.match(await page.locator('#game-rulebook-page').textContent(), /two actions/);
    await page.getByRole('button', {name: 'Previous page', exact: true}).click();
    assert.match(await page.locator('#game-rulebook-page').textContent(), /Storm secrets/);
    await page.locator('#game-rulebook-page').scrollIntoViewIfNeeded();
    const pageContrast = await page.locator('#game-rulebook-page').evaluate(viewer => {
      const luminance = colour => {
        const rgb = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const foreground = getComputedStyle(viewer.querySelector('h2') || viewer).color, background = getComputedStyle(viewer).backgroundColor;
      const a = luminance(foreground), b = luminance(background);
      return {foreground, background, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05)};
    });
    assert.ok(pageContrast.ratio >= 4.5, 'Rulebook text must remain readable: ' + JSON.stringify(pageContrast));
    const pageLayout = await page.locator('#game-rulebook-page').evaluate(viewer => {
      const describe = node => ({tag:node.tagName,text:node.textContent,display:getComputedStyle(node).display,visibility:getComputedStyle(node).visibility,position:getComputedStyle(node).position,rectangle:node.getBoundingClientRect().toJSON()});
      return {page:describe(viewer),children:[...viewer.children].map(describe)};
    });
    await fs.writeFile(path.join(artifacts, 'rulebook-layout.json'), JSON.stringify(pageLayout, null, 2));
    assert.equal(await page.locator('#game-rulebook-page').getByRole('heading', {name: 'Storm secrets', exact: true}).isVisible(), true, 'Rulebook heading must actually be visible, not only have readable computed colour');
    await page.screenshot({path: path.join(artifacts, 'rulebook.png')});

    await page.locator('#campaign-settings').click();
    await page.getByRole('button', {name: 'AI integration', exact: true}).click();
    await page.locator('#settings-ai-enabled').click();
    await page.locator('#campaign-ai-consent').setChecked(true);
    await page.locator('#ai-tab-openai').click();
    const accountSettings = page.locator('.game-linked-ai');
    assert.match(await accountSettings.textContent(), /Concept image generation requires a separate OpenAI API key/);
    assert.equal(await accountSettings.locator('[data-disconnect]').isDisabled(), true);
    assert.equal(await accountSettings.locator('[data-connect]').isVisible(), true);
    await accountSettings.locator('[data-route]').selectOption('api');
    await accountSettings.locator('[data-save]').click();
    await page.locator('#campaign-setup-close').click();
    await app.evaluate(({dialog}) => { dialog.showMessageBox = async () => ({response: 1}); });
    await page.locator('#campaign-prompt').fill('Generate a cover for this game');
    await page.locator('#campaign-prompt-form button.primary').click();
    await page.waitForFunction(() => !document.querySelector('#campaign-chat-fields').disabled);
    assert.match(await page.locator('#campaign-state').textContent(), /OpenAI API key|upload your own/i);
    await page.locator('#campaign-settings').click();
    await page.getByRole('button', {name: 'AI integration', exact: true}).click();
    await page.locator('#ai-tab-openai').click();
    const keyOpened = app.waitForEvent('window');
    await page.locator('#campaign-key-add').click();
    const keyWindow = await keyOpened;
    await keyWindow.locator('#key').fill('sk-fake-game-designer-test-key');
    await keyWindow.locator('form button').click();
    await page.locator('#campaign-setup-close').click();
    await app.evaluate(({dialog, net}) => {
      globalThis.gameDesignerRequests = [];
      dialog.showMessageBox = async () => ({response: 1});
      net.fetch = async (url, options) => {
        if (url !== 'https://api.openai.com/v1/responses') throw Error('Unexpected network request: ' + url);
        globalThis.gameDesignerRequests.push(JSON.parse(options.body));
        const reply = globalThis.gameDesignerRequests.length === 1
          ? {message: 'Beacon Keepers has two actions and coloured stones. What bag composition, starting resources and defeat rules do you want?', nextStep: 'Choose the missing mechanics.', draftBrief: null, actions: []}
          : {message: 'Review this original beacon procedure.', nextStep: 'Review the proposed chapter.', draftBrief: null, actions: [{type: 'upsertRulebookChapter', chapter: {id: null, title: 'Beacon ritual', body: 'Use two actions and coloured stones to relight a beacon.', visible: true}}]};
        return new Response(JSON.stringify({output: [{content: [{type: 'output_text', text: JSON.stringify(reply)}]}], usage: {input_tokens: 30, output_tokens: 25}}));
      };
    });
    await tab(page, 'Story');
    await page.locator('#campaign-prompt').fill('Help me finish the rules. What must we decide first?');
    await page.locator('#campaign-prompt-form button.primary').click();
    await page.locator('#campaign-chat').getByText(/What bag composition/).waitFor();
    const requests = await app.evaluate(() => globalThis.gameDesignerRequests);
    assert.equal(requests.length, 1);
    assert.match(requests[0].instructions, /custom/i);
    assert.match(requests[0].instructions, /supplementary questions/i);
    assert.doesNotMatch(requests[0].instructions, /This is a DND campaign|This is a Warhammer campaign|Establish rules edition, party/);
    const transmitted = requests[0].input[0].content;
    assert.match(transmitted, /PRIVATE-SOURCE-BEACON-773/);
    assert.match(transmitted, /two actions per round/);
    assert.match(transmitted, /Taking a turn/);
    assert.match(transmitted, /Partial locally retrieved context/);
    assert.doesNotMatch(transmitted, /ARCHIVE-SENTINEL-778/);
    assert.ok(Buffer.byteLength(transmitted, 'utf8') < 25000, 'Selected provider context must stay bounded');
    const selectedContext = JSON.parse(transmitted.slice(0, transmitted.lastIndexOf('\nMode:')));
    assert.ok(selectedContext.retrieval.sourceChunksIncluded < selectedContext.retrieval.sourceChunksTotal);
    assert.ok(selectedContext.chat.length <= 6);
    assert.deepEqual(selectedContext.inventory.assets, []);
    assert.deepEqual(selectedContext.linkedProjects, []);

    await page.waitForFunction(() => /API: 55 tokens/.test(document.querySelector('#campaign-token-meter').textContent));
    await fs.writeFile(path.join(artifacts, 'mock-request.json'), JSON.stringify(requests[0], null, 2));
    await tab(page, 'Rulebook');
    await page.locator('#campaign-prompt').fill('Draft a short beacon ritual chapter using my uploaded rules.');
    await page.locator('#campaign-prompt-form button.primary').click();
    await page.locator('#campaign-action-drafts').getByRole('button', {name: /^Review/}).first().waitFor();
    assert.equal((await savedCampaign()).rulebook.chapters.length, 2, 'Proposal must wait for review and Apply');
    await page.locator('#campaign-action-drafts').getByRole('button', {name: /^Review/}).first().click();
    await page.locator('.campaign-review[open]').waitFor();
    await page.locator('#campaign-apply-action').click();
    await page.locator('.campaign-review[open]').waitFor({state: 'detached'});
    assert.equal((await savedCampaign()).rulebook.chapters.length, 3);
    await tab(page, 'Print');
    for (const [format, audience, filename] of [['rulebook-html', 'dm', 'gm-rulebook.html'], ['rulebook-html', 'player', 'player-rulebook.html'], ['rulebook', 'player', 'player-rulebook.pdf'], ['player-json', 'player', 'player.json']]) {
      const output = path.join(artifacts, filename);
      await app.evaluate(({dialog}, file) => { dialog.showSaveDialog = async () => ({canceled: false, filePath: file}); }, output);
      await page.locator('#campaign-print-audience').selectOption(audience);
      await page.locator('#campaign-print-format').selectOption(format);
      await page.locator('#campaign-print-save').click();
      await page.waitForFunction(() => !document.querySelector('#campaign-fields').disabled);
      const bytes = await fs.readFile(output);
      if (format === 'rulebook') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      else {
        const text = bytes.toString();
        assert.doesNotMatch(text, /PRIVATE-SOURCE-BEACON-773/);
        assert.match(text, /Taking a turn/);
        if (audience === 'player') assert.doesNotMatch(text, /PRIVATE-CHAPTER-STORM-447/);
        else assert.match(text, /PRIVATE-CHAPTER-STORM-447/);
      }
    }
    const exportedWindow = app.waitForEvent('window');
    await app.evaluate(async ({BrowserWindow}, file) => {
      const preview = new BrowserWindow({show: true, width: 1000, height: 1000, webPreferences: {sandbox: true, nodeIntegration: false, contextIsolation: true}});
      await preview.loadFile(file);
    }, path.join(artifacts, 'player-rulebook.html'));
    const exportedPage = await exportedWindow;
    await exportedPage.locator('h1').waitFor();
    assert.doesNotMatch(await exportedPage.locator('body').innerText(), /PRIVATE-SOURCE|PRIVATE-CHAPTER/);
    await exportedPage.screenshot({path: path.join(artifacts, 'exported-player-html.png'), fullPage: true});
    assert.deepEqual(errors, []);
    await app.close();
    app = await launch();
    page = await enter(app, false);
    await page.locator('[data-folder=campaign]').click();
    await page.locator('.studio-file-row').filter({hasText: 'Beacon Keepers'}).click();
    await tab(page, 'Context');
    assert.match(await page.locator('#campaign-body #campaign-context-files').textContent(), /beacon-keepers.md/);
    assert.equal(await page.locator('#campaign-body #campaign-game-type').inputValue(), 'custom');
    await tab(page, 'Rulebook');
    const titles = await page.locator('#game-rulebook-editor select option').allTextContents();
    assert.deepEqual(titles.slice(1), ['Storm secrets', 'Taking a turn', 'Beacon ritual']);
    await page.getByRole('button', {name: 'Next page', exact: true}).click();
    await page.locator('#game-rulebook-page').scrollIntoViewIfNeeded();
    await page.screenshot({path: path.join(artifacts, 'reopened-contents.png')});
    console.log('PASS: official custom Markdown/context containment, shared conversation, rulebook/pages, private PDF/HTML exports and reopen. Artifacts: ' + artifacts);
  } catch (error) {
    try { const page = await app.firstWindow(); await page.screenshot({path: path.join(artifacts, 'failure.png')}); console.error((await page.locator('body').innerText()).slice(-3500)); } catch {}
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
