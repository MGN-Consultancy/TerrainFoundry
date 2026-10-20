import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { clearDisposableCaches } = require('../desktop/disposable-cache.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-cache-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const userData = path.join(root, 'profile');
  await fs.mkdir(userData);
  const write = async (name, data = 'retained') => {
    const destination = path.join(root, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data);
    return destination;
  };
  return { root, userData, write };
}

test('clears only explicit disposable roots and preserves protected data', async t => {
  const { root, userData, write } = await fixture(t);
  const protectedNames = ['profile/Session Storage/key', 'profile/Local Storage/key', 'profile/IndexedDB/key',
    'profile/Cookies', 'profile/credentials.json', 'profile/projects/game.md', 'profile/models/paid.glb',
    'profile/premium-assets/pack.zip', 'library/Scenery/model.stl', 'library/Characters/piece.glb'];
  for (const name of protectedNames) await write(name);
  await write('profile/Cache/Cache_Data/data', '1234');
  await write('profile/Code Cache/js/data', '123');
  await write('profile/GPUCache/data', '12');
  await write('disk/Cache/Chromium/Cache/data', '1');
  await write('library/Cache/preview', '12345');
  const options = { userData, cacheDirectory: path.join(root, 'disk/Cache'), libraryCacheDirectory: path.join(root, 'library/Cache') };
  const result = await clearDisposableCaches(options);
  assert.deepEqual(result, { removedBytes: 15, removedFiles: 5, skipped: 0, partial: false });
  for (const name of protectedNames) assert.equal(await fs.readFile(path.join(root, name), 'utf8'), 'retained');
  assert.deepEqual(await clearDisposableCaches(options), { removedBytes: 0, removedFiles: 0, skipped: 0, partial: false });
});

test('refuses broad, relative, missing and redirected profile paths', async t => {
  const { root, userData, write } = await fixture(t);
  await write('profile/Cache/keep');
  await assert.rejects(clearDisposableCaches({ userData, cacheDirectory: userData }));
  await assert.rejects(clearDisposableCaches({ userData, libraryCacheDirectory: root }));
  await assert.rejects(clearDisposableCaches({ userData: 'relative' }));
  await assert.rejects(clearDisposableCaches({ userData: path.join(root, 'missing') }));
  const link = path.join(root, 'profile-link');
  await fs.symlink(userData, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(clearDisposableCaches({ userData: link }));
  assert.equal(await fs.readFile(path.join(userData, 'Cache/keep'), 'utf8'), 'retained');
});

test('skips linked roots, children and ancestors without touching outside files', async t => {
  const { root, userData, write } = await fixture(t);
  const outside = await write('outside/precious.glb');
  await fs.mkdir(path.join(userData, 'Cache'));
  await fs.symlink(path.join(root, 'outside'), path.join(userData, 'Cache/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(path.join(root, 'outside'), path.join(userData, 'GPUCache'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(path.join(root, 'outside'), path.join(root, 'redirected'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await clearDisposableCaches({ userData, cacheDirectory: path.join(root, 'redirected/Cache') });
  assert.equal(result.removedFiles, 0);
  assert.equal(result.skipped, 3);
  assert.equal(result.partial, true);
  assert.equal(await fs.readFile(outside, 'utf8'), 'retained');
});

test('bounds file count, depth and time and serializes concurrent cleanup', async t => {
  const { userData, write } = await fixture(t);
  for (let i = 0; i < 5; i++) await write(`profile/Cache/file${i}`);
  const bounded = await clearDisposableCaches({ userData, maxFiles: 2 });
  assert.equal(bounded.removedFiles, 2);
  assert.equal(bounded.partial, true);
  await write('profile/Cache/deep/nested/file');
  const shallow = await clearDisposableCaches({ userData, maxDepth: 0 });
  assert.equal(shallow.partial, true);
  assert.equal(shallow.skipped, 1);
  const timed = await clearDisposableCaches({ userData, maxDurationMs: 0 });
  assert.equal(timed.removedFiles, 0);
  assert.equal(timed.partial, true);
  const results = await Promise.all([clearDisposableCaches({ userData }), clearDisposableCaches({ userData })]);
  assert.equal(results.reduce((sum, result) => sum + result.removedFiles, 0), 1);
  assert.equal(results[1].removedFiles, 0);
});

test('locked files are counted and retained, then a retry succeeds', async t => {
  const { userData, write } = await fixture(t);
  const locked = await write('profile/Cache/locked');
  const original = fs.unlink;
  const mocked = t.mock.method(fs, 'unlink', async filename => {
    if (filename === locked) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
    return original(filename);
  });
  const result = await clearDisposableCaches({ userData });
  assert.deepEqual(result, { removedBytes: 0, removedFiles: 0, skipped: 1, partial: true });
  assert.equal(await fs.readFile(locked, 'utf8'), 'retained');
  mocked.mock.restore();
  assert.equal((await clearDisposableCaches({ userData })).removedFiles, 1);
});
