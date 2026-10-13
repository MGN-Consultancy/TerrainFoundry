import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,verify} from 'node:crypto';
import {verifyCollection} from './collection-coverage.mjs';

export function uploadRecords(release, legacy, product, tag, component) {
  if (release.schema !== 2 || legacy.schema !== 1 || release.repository !== product.repository || legacy.repository !== product.repository) {
    throw Error('Update channel schema or repository mismatch');
  }
  if (!['full','migration','client','content','launcher'].includes(component)) throw Error('Unknown release component');
  const prefix = `https://github.com/${product.repository}/releases/download/`;
  const current = prefix + tag + '/';
  const records = new Map([['channel.json', null], ['component-channel.json', null]]);
  function include(file) {
    if (!file || typeof file.url !== 'string' || !file.url.startsWith(prefix)) throw Error('Invalid release artifact URL');
    if (!file.url.startsWith(current)) return; // Retain immutable references to older releases.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file.name) || file.url !== current + encodeURIComponent(file.name)) throw Error('Unsafe release artifact name');
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 1) throw Error('Invalid release artifact hash or size');
    const previous = records.get(file.name);
    if (records.has(file.name) && (!previous || previous.sha256 !== file.sha256 || previous.size !== file.size)) throw Error('Conflicting release artifact');
    records.set(file.name, file);
  }
  include(release.launcher);
  include(legacy.launcher);
  for (const file of Object.values(release.client.files)) include(file);
  for (const pack of release.assets) for (const file of Object.values(pack.files)) include(file);
  if (['full','migration','launcher'].includes(component)) {
    const name = `TerrainFoundryLauncher-${product.launcherVersion}-win-x64.msi`;
    if (!/^TerrainFoundryLauncher-\d+\.\d+\.\d+-win-x64\.msi$/.test(name)) throw Error('Invalid installer version');
    if (!records.has('TerrainFoundryLauncher.exe')) throw Error('Current launcher artifact is missing');
    records.set(name, null);
  }
  if (records.size > 1000) throw Error('GitHub release asset limit exceeded');
  return records;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const product = JSON.parse(await fs.readFile('release-config/product.json', 'utf8'));
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== product.repository) throw Error('Workflow repository differs from configured update repository');
  const publicKey = await fs.readFile('release-config/update-public.pem');
  async function channel(name) {
    const envelope = JSON.parse(await fs.readFile('release/publish/' + name, 'utf8'));
    const payload = Buffer.from(envelope.payload, 'base64');
    if (!verify('RSA-SHA256', payload, publicKey, Buffer.from(envelope.signature, 'base64'))) throw Error('Invalid channel signature: ' + name);
    return JSON.parse(payload.toString('utf8'));
  }
  const release = await channel('component-channel.json'), legacy = await channel('channel.json');
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  if (release.version !== pkg.version || legacy.version !== pkg.version) throw Error('Channel version differs from current package');
  verifyCollection(release, JSON.parse(await fs.readFile('desktop/builtin-index.json', 'utf8')));
  const tag = process.env.TERRAIN_RELEASE_TAG || 'v' + pkg.version;
  const records = uploadRecords(release, legacy, product, tag, process.env.TERRAIN_COMPONENT || 'full');
  for (const [name, declared] of records) {
    const file = path.join('release/publish', name), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size >= 2 * 1024 ** 3) throw Error('Missing, linked, empty or oversized release file: ' + name);
    if (declared) {
      const digest = createHash('sha256');
      for await (const block of createReadStream(file)) digest.update(block);
      if (stat.size !== declared.size || digest.digest('hex') !== declared.sha256) throw Error('Artifact differs from signed channel: ' + name);
    }
  }
  // No output until every file passes: callers cannot accidentally publish a partial list.
  console.log([...records.keys()].map(name => path.resolve('release/publish', name)).join('\n'));
}
