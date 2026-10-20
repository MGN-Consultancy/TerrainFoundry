'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const PROFILE_CACHES = ['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'ShaderCache', 'DawnWebGPUCache', 'DawnGraphiteCache'];
let pending = Promise.resolve();

function samePath(a, b) {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// Check every ancestor: a safe-looking child can still traverse a junction.
async function verifyDirectory(directory) {
  const root = path.parse(directory).root;
  let current = root;
  for (const component of directory.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe cache directory');
    if (!samePath(await fs.realpath(current), current)) throw new Error('Redirected cache directory');
  }
}

function absoluteDirectory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('Cache paths must be absolute');
  const resolved = path.resolve(value);
  if (samePath(resolved, path.parse(resolved).root)) throw new Error('Filesystem roots are not cache directories');
  return resolved;
}

async function runCleanup(options) {
  const { userData, cacheDirectory, libraryCacheDirectory } = options;
  const profile = absoluteDirectory(userData);
  await verifyDirectory(profile);
  const roots = PROFILE_CACHES.map(name => path.join(profile, name));
  for (const supplied of [cacheDirectory, libraryCacheDirectory]) {
    if (supplied == null || supplied === '') continue;
    const candidate = absoluteDirectory(supplied);
    if (path.basename(candidate).toLowerCase() !== 'cache' || contains(candidate, profile)) {
      throw new Error('Only a separate named Cache directory is disposable');
    }
    roots.push(candidate);
  }
  const limit = (value, fallback, maximum) => Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : fallback;
  const maxFiles = limit(options.maxFiles, 10000, 10000);
  const maxDepth = limit(options.maxDepth, 12, 12);
  const maxDurationMs = limit(options.maxDurationMs, 2000, 10000);
  const deadline = performance.now() + maxDurationMs;
  const result = { removedBytes: 0, removedFiles: 0, skipped: 0, partial: false };
  let visitedFiles = 0;
  let visitedEntries = 0;
  const visitedRoots = [];
  const exhausted = () => visitedFiles >= maxFiles || visitedEntries >= maxFiles * 2 + 128 || performance.now() >= deadline;

  async function walk(directory, root, depth) {
    if (exhausted()) { result.partial = true; return; }
    let handle;
    try {
      await verifyDirectory(directory);
      handle = await fs.opendir(directory);
      for await (const entry of handle) {
        if (exhausted()) { result.partial = true; break; }
        visitedEntries++;
        if (visitedEntries % 64 === 0) await new Promise(resolve => setImmediate(resolve));
        const filename = path.join(directory, entry.name);
        if (!contains(root, filename)) { result.skipped++; result.partial = true; continue; }
        try {
          const before = await fs.lstat(filename);
          if (before.isSymbolicLink()) { result.skipped++; result.partial = true; continue; }
          if (before.isDirectory()) {
            if (depth >= maxDepth) { result.skipped++; result.partial = true; }
            else await walk(filename, root, depth + 1);
          } else if (before.isFile()) {
            visitedFiles++;
            // Recheck the parent and file immediately before unlink. Never use recursive rm.
            await verifyDirectory(directory);
            const current = await fs.lstat(filename);
            if (!current.isFile() || current.isSymbolicLink() || current.ino !== before.ino || current.dev !== before.dev) {
              result.skipped++; result.partial = true; continue;
            }
            await fs.unlink(filename);
            result.removedFiles++;
            result.removedBytes += current.size;
          } else { result.skipped++; result.partial = true; }
        } catch (error) {
          if (error.code !== 'ENOENT') { result.skipped++; result.partial = true; }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') { result.skipped++; result.partial = true; }
    }
  }

  for (const root of roots) {
    if (visitedRoots.some(parent => contains(parent, root))) continue;
    if (exhausted()) { result.partial = true; break; }
    // Keep roots and directories in place; Electron may have open handles.
    await walk(root, root, 0);
    visitedRoots.push(root);
  }
  return result;
}

function clearDisposableCaches(options = {}) {
  // Startup, manual cleanup and shutdown must never race each other.
  const request = { ...options };
  const operation = pending.then(() => runCleanup(request));
  pending = operation.catch(() => {});
  return operation;
}

module.exports = { clearDisposableCaches };
