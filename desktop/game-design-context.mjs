import {campaignContext,MAX_CONTEXT_BYTES,needsWorldContext} from './campaign-context.mjs';

const encodedSize = value => new TextEncoder().encode(JSON.stringify(value)).length;
function excerpt(value, depth = 0) {
  if (depth > 5) return '[further detail remains local]';
  if (typeof value === 'string') return value.length > 1000 ? value.slice(0,1000)+' [excerpt]' : value;
  if (Array.isArray(value)) return value.slice(0,8).map(item => excerpt(item,depth+1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(positions|indices|vertices|colors|image|portrait|cover|bytes|geometry|raw|sourceFiles|messages|chat)$/i.test(key)).slice(0,24).map(([key,item]) => [key,excerpt(item,depth+1)]));
}

export function gameDesignContext(raw,campaign,prompt,mode) {
  const activeSection = raw.view?.activeTab || 'Story';
  const base = campaignContext({...campaign,activeSection},prompt,mode,raw.inventory?.assets || [],raw.linkedProjects || []);
  const world = needsWorldContext(prompt,mode) || !!raw.view?.terrain;
  const design = !!raw.view?.designer || /\b(character|characters|scenery|asset|assets|model|mesh)\b/i.test(prompt);
  const selected = Array.isArray(campaign[raw.view?.selectedCollection])
    ? campaign[raw.view.selectedCollection].find(record => record.id === raw.view.selectedId) : null;
  const extras = {
    view: raw.view, selectedRecord: selected, assistant: raw.assistant, activeEditor: raw.activeEditor,
    designerAsset: design ? raw.designerAsset : undefined, designerLibrary: design ? raw.designerLibrary : undefined,
    artwork: /\b(art|image|cover|portrait|illustration)\b/i.test(prompt) ? raw.artwork : undefined, savedScenes: world ? raw.savedScenes : undefined,
    sharedGameStyle: raw.sharedGameStyle, workspace: raw.workspace,
    packDiscovery: raw.packDiscovery, agentMode: raw.agentMode
  };
  base.retrieval.additionalContext = 'Editor capabilities and selections are bounded excerpts. Geometry, images, complete conversations and unrelated project documents stay local. Missing fields must not be inferred. A field marked excerpt is incomplete: do not propose replacing that whole field; ask for a focused source edit instead.';
  // Selection/capability facts have priority over incidental history and catalogue rows.
  for (const [key,value] of Object.entries(extras)) {
    if (value === undefined || value === null) continue;
    const item = excerpt(value);
    while (encodedSize({...base,[key]:item}) > MAX_CONTEXT_BYTES && base.inventory.length) base.inventory.pop();
    while (encodedSize({...base,[key]:item}) > MAX_CONTEXT_BYTES && base.chat.length) base.chat.shift();
    if (encodedSize({...base,[key]:item}) <= MAX_CONTEXT_BYTES) base[key] = item;
    else { base.retrieval.omittedExtraFields ??= []; base.retrieval.omittedExtraFields.push(key); }
  }
  base.retrieval.recentMessagesIncluded = base.chat.length;
  base.retrieval.earlierMessagesOmitted = Math.max(0,campaign.chat.length-base.chat.length);
  const assets = base.inventory;
  base.inventory = {total:raw.inventory?.total || assets.length,shown:assets.length,assets};
  while (encodedSize(base)>MAX_CONTEXT_BYTES && base.notes.length) base.notes.pop();
  if (encodedSize(base)>MAX_CONTEXT_BYTES) throw Error('Campaign context exceeds its bounded request limit.');
  return base;
}
