import {mergeContext, rulebook} from '../desktop/game-design.mjs';

const element = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function contextEditor(container, {get, set, api, run}) {
  const section = element('section');
  section.className = 'game-context';
  section.append(element('h3', 'Your game context'));
  section.append(element('p', 'Upload your existing rules, campaign notes or world brief as Markdown (.md). The companion uses these sources and asks about missing details. Files stay private to this project and are excluded from player exports. Uploading the same filename replaces that source. Up to 16 files, 64 KiB each, 128 KiB combined.'));
  const upload = element('button', 'Upload Markdown context…');
  upload.type = 'button';
  upload.id = 'campaign-context-import';
  const list = element('div');
  list.id = 'campaign-context-files';
  const draw = () => {
    list.replaceChildren();
    for (const file of get()) {
      const details = element('details');
      details.append(element('summary', file.name));
      const source = element('pre', file.text);
      source.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:24rem;overflow:auto';
      const remove = element('button', 'Remove ' + file.name);
      remove.type = 'button';
      remove.onclick = run(async () => {
        await set(get().filter(x => x.name !== file.name));
        draw();
      });
      details.append(source, remove);
      list.append(details);
    }
    if (!get().length) list.append(element('p', 'No context files yet. You can also describe your game in conversation.'));
  };
  upload.onclick = run(async () => {
    const incoming = await api.campaignImportContext();
    if (!incoming) return;
    await set(mergeContext(get(), incoming));
    draw();
  });
  section.append(upload, list);
  container.append(section);
  draw();
}

export function gameTypeChoice(container, current = 'custom', onChange = () => {}) {
  let savedType = current;
  const label = element('label', 'What are you designing?');
  const select = element('select');
  select.id = 'campaign-game-type';
  for (const [value, title] of [['custom', 'Custom game'], ['dnd', 'DND campaign'], ['warhammer', 'Warhammer campaign']]) {
    const option = element('option', title);
    option.value = value;
    select.append(option);
  }
  select.value = current;
  const explanation = element('p');
  const show = () => {
    explanation.textContent = select.value === 'custom'
      ? 'Build an original game using your own rules, terms, player roles and resolution system. No established game rules are assumed.'
      : select.value === 'dnd'
        ? 'Include your rules edition, party size and level, encounter difficulty, scale and session scope in the brief or uploaded context.'
        : 'Specify the game system and edition, factions or player roles, force limits, battlefield scale and campaign progression. The companion will ask where these are missing.';
  };
  select.onchange = async () => {
    show();
    try { await onChange(select.value); savedType = select.value; }
    catch (error) { select.value = savedType; show(); explanation.textContent += ' ' + error.message; }
  };
  label.append(select);
  container.prepend(label, explanation);
  show();
  return select;
}

export function renderRulebook(container, {campaign, persist, run, api}) {
  let page = 0;
  const chapters = campaign.rulebook.chapters;
  container.append(element('h3', 'Rulebook'));
  container.append(element('p', 'Build a cover, contents and chapters. Preview pages follow chapter order; long chapters may span multiple pages in the PDF. Only chapters marked player-visible enter player exports.'));
  const cover = element('button', 'Upload cover art…');
  cover.type = 'button';
  cover.onclick = run(async () => {
    const image = await api.campaignImportImage();
    if (image) { campaign.cover = image; await persist(); draw(); }
  });
  const viewer = element('article');
  viewer.id = 'game-rulebook-page';
  viewer.className = 'game-rulebook-page';
  const navigation = element('nav');
  const previous = element('button', 'Previous page');
  const next = element('button', 'Next page');
  previous.type = next.type = 'button';
  const count = element('span');
  count.setAttribute('aria-live', 'polite');
  navigation.append(previous, count, next);
  const form = element('form');
  form.id = 'game-rulebook-editor';
  const choose = element('select');
  choose.setAttribute('aria-label', 'Edit chapter');
  const title = element('input');
  title.placeholder = 'Chapter title'; title.required = true; title.maxLength = 160;
  title.setAttribute('aria-label', 'Chapter title');
  const body = element('textarea');
  body.rows = 12; body.maxLength = 20000;
  body.setAttribute('aria-label', 'Chapter text');
  const visible = element('input'); visible.type = 'checkbox';
  const visibility = element('label', 'Player-visible chapter'); visibility.append(visible);
  const save = element('button', 'Save chapter');
  const remove = element('button', 'Delete chapter'); remove.type = 'button';
  const up = element('button', 'Move chapter earlier'); up.type = 'button';
  const down = element('button', 'Move chapter later'); down.type = 'button';
  form.append(choose, title, body, visibility, save, up, down, remove);
  container.append(cover, viewer, navigation, form);
  const selected = () => chapters.find(x => x.id === choose.value);
  function edit() {
    const chapter = selected();
    title.value = chapter?.title || ''; body.value = chapter?.body || ''; visible.checked = chapter?.visible || false;
    remove.disabled = up.disabled = down.disabled = !chapter;
  }
  function draw() {
    const previousChoice = choose.value;
    choose.replaceChildren(new Option('New chapter', ''));
    chapters.forEach(chapter => choose.append(new Option(chapter.title, chapter.id)));
    choose.value = chapters.some(x => x.id === previousChoice) ? previousChoice : '';
    page = Math.min(page, chapters.length + 1);
    count.textContent = ` Page ${page + 1} of ${chapters.length + 2} `;
    previous.disabled = page === 0; next.disabled = page === chapters.length + 1;
    viewer.replaceChildren();
    if (page === 0) {
      viewer.append(element('h1', campaign.name));
      if (campaign.cover) { const image = element('img'); image.src = campaign.cover; image.alt = 'Rulebook cover'; viewer.append(image); }
    } else if (page === 1) {
      viewer.append(element('h2', 'Contents'));
      const contents = element('ol');
      chapters.forEach((chapter, index) => {
        const row = element('li'); const link = element('button', chapter.title); link.type = 'button';
        link.onclick = () => { page = index + 2; draw(); };
        row.append(link); contents.append(row);
      });
      viewer.append(contents);
    } else {
      const chapter = chapters[page - 2];
      const text = element('p', chapter.body); text.style.whiteSpace = 'pre-wrap';
      viewer.append(element('h2', chapter.title), text);
    }
    edit();
  }
  choose.onchange = edit;
  previous.onclick = () => { page--; draw(); };
  next.onclick = () => { page++; draw(); };
  form.onsubmit = run(async () => {
    const chapter = {id: choose.value || crypto.randomUUID(), title: title.value, body: body.value, visible: visible.checked};
    const candidate = chapters.filter(x => x.id !== chapter.id);
    const index = chapters.findIndex(x => x.id === chapter.id);
    candidate.splice(index < 0 ? candidate.length : index, 0, chapter);
    rulebook({chapters: candidate});
    const before = [...chapters]; chapters.splice(0, chapters.length, ...candidate);
    try { await persist(); } catch (error) { chapters.splice(0, chapters.length, ...before); throw error; }
    draw(); choose.value = chapter.id; edit();
  });
  const reorder = direction => run(async () => {
    const index = chapters.findIndex(x => x.id === choose.value), target = index + direction;
    if (index < 0 || target < 0 || target >= chapters.length) return;
    [chapters[index], chapters[target]] = [chapters[target], chapters[index]];
    try { await persist(); } catch (error) { [chapters[index], chapters[target]] = [chapters[target], chapters[index]]; throw error; }
    draw();
  });
  up.onclick = reorder(-1); down.onclick = reorder(1);
  remove.onclick = run(async () => {
    const index = chapters.findIndex(x => x.id === choose.value);
    if (index < 0) return;
    const removed = chapters.splice(index, 1)[0];
    try { await persist(); } catch (error) { chapters.splice(index, 0, removed); throw error; }
    draw();
  });
  draw();
}
