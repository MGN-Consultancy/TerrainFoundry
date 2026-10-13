// Deliberately visits tracked paths only, never the local collection.
import {execFileSync} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const paths = execFileSync('git', ['ls-files', '-z'], {cwd: root, maxBuffer: 16 * 1024 * 1024}).toString('utf8').split('\0').filter(Boolean);
const groups = new Map();
const largest = [];
let missing = 0;
for (const relative of paths) {
  const stat = await lstat(join(root, relative)).catch(error => {
    if (error.code === 'ENOENT') { missing++; return null; }
    throw error;
  });
  if (!stat || !stat.isFile()) continue;
  const group = relative.includes('/') ? relative.split('/')[0] : '(root)';
  const row = groups.get(group) || {folder: group, files: 0, bytes: 0};
  row.files++; row.bytes += stat.size; groups.set(group, row);
  largest.push({path: relative, bytes: stat.size});
}
const rows = [...groups.values()].sort((a,b) => b.bytes-a.bytes);
console.log(JSON.stringify({scope: 'Current tracked files only; no history or ignored folders scanned', trackedPaths: paths.length, missing, totalBytes: rows.reduce((sum,r) => sum+r.bytes,0), folders: rows, largest: largest.sort((a,b) => b.bytes-a.bytes).slice(0,15)}, null, 2));
