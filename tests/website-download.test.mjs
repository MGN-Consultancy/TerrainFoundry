import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('Windows download selects the newest published launcher installer directly', async () => {
  const source = await readFile(new URL('../site/release.js', import.meta.url), 'utf8');
  const elements = new Map([
    ['#download-link', { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } }],
    ['#release-status', { textContent: '' }]
  ]);
  const releases = [
    { tag_name: 'v1.16.1-client-47-1', published_at: '2026-10-07T12:28:38Z', assets: [{ name: 'client.bin', browser_download_url: 'https://github.com/MGN-Consultancy/TerrainFoundry/releases/download/client/client.bin', size: 123 }] },
    { tag_name: 'v1.16.0-launcher-45-1', published_at: '2026-10-07T10:13:05Z', assets: [{ name: 'TerrainFoundryLauncher-1.16.1-win-x64.msi', browser_download_url: 'https://github.com/MGN-Consultancy/TerrainFoundry/releases/download/launcher/TerrainFoundryLauncher-1.16.1-win-x64.msi', size: 1048576 }] }
  ];
  const context = {
    document: { querySelector: selector => elements.get(selector) },
    fetch: async () => ({ ok: true, json: async () => releases }),
    URL,
    Date
  };

  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));

  const link = elements.get('#download-link');
  assert.equal(link.href, releases[1].assets[0].browser_download_url);
  assert.equal(link.attributes.download, releases[1].assets[0].name);
  assert.equal(link.attributes['aria-disabled'], undefined);
  assert.match(elements.get('#release-status').textContent, /v1\.16\.0-launcher/);
});

test('Windows download is disabled when no published installer is available', async () => {
  const source = await readFile(new URL('../site/release.js', import.meta.url), 'utf8');
  const elements = new Map([
    ['#download-link', { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; } }],
    ['#release-status', { textContent: '' }]
  ]);
  const context = {
    document: { querySelector: selector => elements.get(selector) },
    fetch: async () => ({ ok: true, json: async () => [] }),
    URL,
    Date
  };

  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(elements.get('#download-link').attributes['aria-disabled'], 'true');
  assert.match(elements.get('#release-status').textContent, /temporarily unavailable/);
});
