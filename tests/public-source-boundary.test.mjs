import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const checker = path.join(repository, 'scripts/release/check-public-source.mjs');
test('repository ignores working collections and generated outputs', () => {
  const names=['work/fixture.bin','premium-assets/packs/fixture.glb','deliverables/fixture.stl',
    'release/publish/fixture.bin','test-results/fixture.png','dist/fixture.js','node_modules/fixture.js',
    '.tools/fixture.bin','site/dungeon-range/meshes.bin','result.json','scripts/__pycache__/fixture.pyc'];
  const ignored=execFileSync('git',['check-ignore','--no-index','--stdin'],{cwd:repository,input:names.join('\n')+'\n',encoding:'utf8'}).trim().split(/\r?\n/);
  assert.deepEqual(ignored,names);
});
test('public audit excludes ignored collections and rejects forced tracked working data and real key headers', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'terrain-source-boundary-'));
  try {
    execFileSync('git', ['init', '--quiet', root]);
    for (const name of ['LICENSE-SCOPE.md', 'third-party/openlock/NOTICE.md',
      'third-party/openlock/CLIP-NOTICE.md', 'third-party/openlock/CLIP-LICENSE.txt',
      'third-party/openlock/MGN-COMMERCIAL-LICENSE.txt', 'third-party/openlock/official/provenance.json',
      'third-party/openlock/OpenLOCK_Clip_v5.4.stl']) {
      const target = path.join(root, name);
      await fs.mkdir(path.dirname(target), {recursive: true});
      await fs.copyFile(path.join(repository, name), target);
    }
    await fs.writeFile(path.join(root, '.gitignore'), '/work/\n/premium-assets/\n');
    const header = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
    for (const name of ['work', 'premium-assets']) {
      await fs.mkdir(path.join(root, name));
      await fs.writeFile(path.join(root, name, 'fixture.json'), header);
    }
    const audit = () => spawnSync(process.execPath, [checker, root], {encoding: 'utf8'});
    assert.equal(audit().status, 0, 'ignored working collection must not be inspected');
    execFileSync('git', ['add', '-f', 'work/fixture.json'], {cwd: root});
    let result = audit();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Working data tracked as source/);
    execFileSync('git', ['rm', '--cached', '-f', 'work/fixture.json'], {cwd: root});
    await fs.writeFile(path.join(root, 'unsafe.json'), header);
    result = audit();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsafe.json/);
    await fs.writeFile(path.join(root, 'unsafe.json'), 'assertion about BEGIN PRIVATE KEY');
    assert.equal(audit().status, 0, 'ordinary test assertions must not be reported as keys');
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
});
