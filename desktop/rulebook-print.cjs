const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

async function rulebookHTML(value, {audience = 'dm'} = {}) {
  if (!['dm', 'player'].includes(audience)) throw Error('Choose a rulebook audience.');
  const {validateCampaign, playerCampaign} = await import('./campaign-schema.mjs');
  const campaign = audience === 'player' ? playerCampaign(value) : validateCampaign(value);
  const chapters = campaign.rulebook.chapters;
  const contents = chapters.map((chapter, index) => `<li><a href="#chapter-${index}">${escape(chapter.title)}</a></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(campaign.name)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12pt Georgia,serif;line-height:1.5;color:#171717;margin:auto;max-width:180mm;padding:8mm}a{color:inherit}.cover,.contents,.chapter{break-before:page}.cover{min-height:245mm;display:flex;flex-direction:column;justify-content:center;text-align:center}.cover h1{font-size:32pt;overflow-wrap:anywhere}.cover img{max-width:100%;max-height:180mm;object-fit:contain}h2{break-after:avoid;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}li{margin-bottom:8pt}@media print{body{max-width:none;padding:0}.cover{break-before:auto}}</style></head><body>
<section class="cover"><h1>${escape(campaign.name)}</h1>${campaign.cover ? `<img src="${campaign.cover}" alt="Rulebook cover">` : ''}</section>
<nav class="contents" aria-label="Contents"><h2>Contents</h2><ol>${contents}</ol></nav>
${chapters.map((chapter, index) => `<section class="chapter" id="chapter-${index}"><h2>${escape(chapter.title)}</h2><p>${escape(chapter.body)}</p></section>`).join('')}
</body></html>`;
}
module.exports = {rulebookHTML};
