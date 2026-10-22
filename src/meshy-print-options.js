const DEFAULTS = Object.freeze({analyzeAfterGeneration: true, printerType: 'fdm', sizeMode: 'model', sizeMm: 100, targetPolycount: 100000});
const PRINTERS = new Set(['fdm', 'sla', 'full_color']);
const SIZES = new Set(['model', 'height', 'longest']);
const TASK_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function normalValue(value = {}) {
  return {
    analyzeAfterGeneration: typeof value.analyzeAfterGeneration === 'boolean' ? value.analyzeAfterGeneration : DEFAULTS.analyzeAfterGeneration,
    printerType: PRINTERS.has(value.printerType) ? value.printerType : DEFAULTS.printerType,
    sizeMode: SIZES.has(value.sizeMode) ? value.sizeMode : DEFAULTS.sizeMode,
    sizeMm: typeof value.sizeMm === 'number' && Number.isFinite(value.sizeMm) && value.sizeMm >= 1 && value.sizeMm <= 1000 ? value.sizeMm : DEFAULTS.sizeMm,
    targetPolycount: Number.isSafeInteger(value.targetPolycount) && value.targetPolycount >= 1000 && value.targetPolycount <= 250000 ? value.targetPolycount : DEFAULTS.targetPolycount,
  };
}

function printable(value) {
  try { return JSON.stringify(value, null, 2)?.slice(0, 8000) || 'Not reported'; }
  catch { return 'Report unavailable'; }
}

/** Local controls only. Callers own persistence, job state and provider requests. */
export function createMeshyPrintOptions({value, onChange, scope = 'default', canUse = () => true, onAnalyze, onRepair, onResume} = {}) {
  const element = node('details', undefined, 'meshy-print-options');
  element.append(node('summary', 'Advanced Meshy options'));
  const content = node('div');
  content.style.cssText = 'display:grid;gap:.65rem;min-width:0;padding:.65rem 0;overflow-wrap:anywhere';
  element.append(content);
  content.append(node('p', scope === 'asset' ? 'Settings for this working asset. Originals remain available.' : 'Defaults for future scenery and character models. Individual assets can override these settings.'));

  function label(text, input) {
    const item = node('label');
    item.style.cssText = 'display:grid;gap:.25rem;min-width:0';
    item.append(node('span', text), input);
    return item;
  }
  function select(name, choices) {
    const input = node('select');
    input.name = name;
    input.setAttribute('aria-label', name === 'printerType' ? 'Meshy printer type' : 'Meshy print size');
    for (const [key, text] of choices) input.append(new Option(text, key));
    return input;
  }
  const printer = select('printerType', [['fdm', 'FDM · 1.0 mm walls'], ['sla', 'SLA · 0.8 mm walls'], ['full_color', 'Full color · 2.0 mm walls']]);
  const sizeMode = select('sizeMode', [['model', 'Use configured model dimensions'], ['height', 'Custom print height'], ['longest', 'Custom longest side']]);
  const size = node('input');
  size.type = 'number'; size.name = 'sizeMm'; size.min = '1'; size.max = '1000'; size.step = 'any'; size.required = true;
  size.setAttribute('aria-label', 'Meshy print size in millimeters');
  const sizeLabel = label('Print size in millimeters (1–1000)', size);
  const automatic = node('input'); automatic.type = 'checkbox'; automatic.name = 'analyzeAfterGeneration';
  const triangles = node('input'); triangles.type = 'number'; triangles.name = 'targetPolycount'; triangles.min = '1000'; triangles.max = '250000'; triangles.step = '1'; triangles.required = true; triangles.setAttribute('aria-label', 'Meshy remesh triangle target');
  const automaticLabel = node('label'); automaticLabel.append(automatic, document.createTextNode(' Analyze after generation · free'));
  content.append(label('Printer', printer), label('Intended print size', sizeMode), sizeLabel, label('Meshy remesh triangle target (1,000–250,000)', triangles), node('p', 'Meshy treats this as an approximate triangle target for new generations. More triangles can preserve detail but increase processing and preview cost. Local geometry limits still apply.'), automaticLabel);
  content.append(node('p', 'Meshy sets the minimum wall thickness for each printer; it is not a custom thickness setting. Use the size you plan to print. Analyze is free. Repair uses Meshy credits and requires a separate action.'));
  content.append(node('p', 'Meshy rounds the size used for its printability check to the nearest millimeter; this does not rescale your local model. Meshy repair output does not preserve textures. The original remains available for appearance work.'));
  content.append(node('p', 'For OpenLOCK, use model dimensions; scaling a print changes connector fit. Change module sizes locally instead.'));
  content.append(node('p', 'Meshy thickens walls only when more than 5% of the surface is too thin. A repair keeps the original model scale. Review the result in your slicer: a successful task does not guarantee a printable model or OpenLOCK fit.'));

  const actions = node('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem';
  const message = node('p', '', 'meshy-print-options-status'); message.setAttribute('role', 'status');
  const creditConsent = node('input'); creditConsent.type = 'checkbox'; creditConsent.name = 'confirmMeshyRepairCredits';
  const consentLabel = node('label'); consentLabel.append(creditConsent, document.createTextNode(' Allow this repair to use Meshy credits'));
  if (onRepair) content.append(consentLabel);
  const savedTaskId = node('input'); savedTaskId.type = 'text'; savedTaskId.name = 'savedMeshyTaskId'; savedTaskId.maxLength = 100; savedTaskId.autocomplete = 'off'; savedTaskId.spellcheck = false; savedTaskId.setAttribute('autocapitalize', 'none'); savedTaskId.setAttribute('aria-label', 'Saved Meshy task ID'); savedTaskId.pattern = '[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}';
  const savedTaskLabel = label('Saved Meshy task ID', savedTaskId);
  savedTaskLabel.append(node('small', 'Find this exact submission in your Meshy task history. Paste its task ID (UUID), not an API key. Resume checks the existing task without submitting another job.'));
  content.append(savedTaskLabel);
  const actionButtons = [];
  let busy = false, needsTaskId = false;

  function getValue() {
    if (sizeMode.value !== 'model' && (!size.checkValidity() || !Number.isFinite(Number(size.value)))) throw Error('Choose a print size from 1 to 1000 millimeters.');
    if (!triangles.checkValidity() || !Number.isSafeInteger(Number(triangles.value))) throw Error('Choose a Meshy triangle target from 1000 to 250000.');
    return {analyzeAfterGeneration: automatic.checked, printerType: printer.value, sizeMode: sizeMode.value, sizeMm: sizeMode.value === 'model' ? normalValue({sizeMm: Number(size.value)}).sizeMm : Number(size.value), targetPolycount: Number(triangles.value)};
  }
  function available() { try { return canUse() === true; } catch { return false; } }
  function update() {
    sizeLabel.hidden = sizeMode.value === 'model';
    sizeLabel.style.display = sizeMode.value === 'model' ? 'none' : 'grid';
    for (const input of [printer, sizeMode, size, triangles, automatic, creditConsent]) input.disabled = busy;
    size.disabled = busy || sizeMode.value === 'model';
    size.required = sizeMode.value !== 'model';
    savedTaskLabel.hidden = !needsTaskId; savedTaskLabel.style.display = needsTaskId ? 'grid' : 'none'; savedTaskId.required = needsTaskId; savedTaskId.disabled = busy || !needsTaskId || !available();
    for (const {button, paid, resume} of actionButtons) button.disabled = busy || !available() || (paid && !creditConsent.checked) || (resume && needsTaskId && !TASK_ID.test(savedTaskId.value.trim()));
  }
  function changed() {
    creditConsent.checked = false;
    update();
    try {
      const next = getValue(); message.textContent = '';
      Promise.resolve(onChange?.(next)).catch(error => { message.textContent = error.message || String(error); });
    } catch (error) { message.textContent = error.message; }
  }
  for (const input of [printer, sizeMode, size, triangles, automatic]) input.addEventListener('change', changed);
  creditConsent.addEventListener('change', update);
  savedTaskId.addEventListener('input', update);
  function addAction(text, callback, paid = false, resume = false) {
    if (!callback) return;
    const button = node('button', text); button.type = 'button';
    button.onclick = async () => {
      if (busy || !available() || (paid && !creditConsent.checked)) return;
      if (resume && needsTaskId && !TASK_ID.test(savedTaskId.value.trim())) return;
      try {
        const settings = resume ? undefined : getValue();
        creditConsent.checked = false; setBusy(true); message.textContent = '';
        if (resume) {
          if (needsTaskId) await callback({taskId: savedTaskId.value.trim()});
          else await callback();
        } else await callback(paid ? {settings, confirmCredits: true} : settings);
      } catch (error) { message.textContent = error.message || String(error); }
      finally { setBusy(false); }
    };
    actionButtons.push({button, paid, resume}); actions.append(button);
  }
  addAction('Check printability · free', onAnalyze);
  addAction('Repair printability · Meshy credits', onRepair, true);
  addAction('Resume saved printability task', onResume, false, true);
  if (actionButtons.length) content.append(actions);
  content.append(message);
  const report = node('section'); report.setAttribute('aria-label', 'Meshy printability report'); report.style.minWidth = '0'; content.append(report);

  function setValue(next) {
    const normalized = normalValue(next);
    automatic.checked = normalized.analyzeAfterGeneration; printer.value = normalized.printerType; sizeMode.value = normalized.sizeMode; size.value = String(normalized.sizeMm);
    triangles.value = String(normalized.targetPolycount);
    creditConsent.checked = false; message.textContent = ''; update();
  }
  function setBusy(next) { busy = !!next; update(); }
  function setReport(next) {
    needsTaskId = next?.needsTaskId === true;
    if (!needsTaskId) savedTaskId.value = '';
    update();
    report.replaceChildren();
    if (!next) { report.append(node('p', 'No printability check yet. Wall thickness has not been reported.')); return; }
    const title = next.operation === 'repair' ? 'Repair' : 'Analysis';
    const progress = typeof next.progress === 'number' && Number.isFinite(next.progress) ? ' · ' + Math.max(0, Math.min(100, next.progress)) + '%' : '';
    report.append(node('p', title + ': ' + String(next.status || 'Unknown').slice(0, 100) + progress));
    if (next.message) report.append(node('p', String(next.message).slice(0, 8000)));
    const thin = next.thinWalls;
    const missing = thin === undefined || thin === null || (typeof thin === 'object' && !Object.keys(thin).length);
    report.append(node('p', missing ? 'Wall thickness was not reported. Thin-wall status is unknown.' : 'Thin-wall result reported by Meshy. Review the details at the print size below.'));
    if (!missing) {
      if (thin && typeof thin === 'object') {
        report.append(node('p', 'Provider thin-wall status: ' + String(thin.status || 'unknown').slice(0, 100) + '.'));
        if (typeof thin.thin_area_ratio === 'number' && Number.isFinite(thin.thin_area_ratio) && thin.thin_area_ratio >= 0 && thin.thin_area_ratio <= 1) report.append(node('p', 'Thin surface area: ' + (thin.thin_area_ratio * 100).toFixed(2) + '%.'));
        else report.append(node('p', 'Thin surface percentage was not reported.'));
        report.append(node('p', 'Meshy uses a 5% thin-surface threshold. A healthy provider result can still include thin walls; it does not guarantee printability.'));
      }
      const data = node('pre', printable(thin)); data.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%'; report.append(data);
    }
    if (next.intendedPrint) {
      const settings = next.intendedPrint;
      if (typeof settings === 'object') {
        const mm = value => typeof value === 'number' && Number.isFinite(value) ? String(value) + ' mm' : 'not reported';
        report.append(node('p', 'Checked print: ' + String(settings.printer_type || 'printer not reported').slice(0, 100) + ' · height ' + mm(settings.height_mm) + ' · longest side ' + mm(settings.longest_side_mm) + ' · minimum wall ' + mm(settings.wall_thickness_mm)));
      }
      const data = node('pre', printable(settings)); data.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%'; report.append(node('p', 'Intended print settings:'), data);
    }
  }
  setValue(value); setReport(null);
  return {element, getValue, setValue, setReport, setBusy};
}
