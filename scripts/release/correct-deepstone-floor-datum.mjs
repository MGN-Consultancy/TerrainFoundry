// Correct the released Deepstone floor carrier from a 12 mm perimeter to
// the shared 8 mm OpenLOCK floor datum. A 0.05 mm feather preserves a strictly
// increasing vertical map, so no triangles collapse and the connector zone
// (0-8 mm) remains byte-for-byte unchanged in height.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mapDeepstoneFloorY } from './deepstone-floor-datum.mjs';

const ROOT = path.resolve('.');
const packDir = path.join(ROOT, 'release/asset-packs/deepstone');
const indexPath = path.join(packDir, 'index.json');
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
const binPath = path.join(packDir, 'meshes.bin');
const bin = await fs.readFile(binPath);
const fixed = new Set();

// Correct all ordinary floor pieces, including the narrow doorway and column
// tile. Raised steps and ledges use a separate, intentional landing datum.
for (const [id, m] of Object.entries(index)) {
  if (m.openlock?.kind !== 'floor' || ['dg-036', 'dg-037'].includes(id)) continue;
  const n = m.connected.vertices;
  const start = m.offset + m.raw.length;
  const width = m.openlock.width, depth = m.openlock.depth;
  const edge = [];
  for (let i = 0; i < n; i++) {
    const x = bin.readFloatLE(start + i * 12);
    const y = bin.readFloatLE(start + i * 12 + 4);
    const z = bin.readFloatLE(start + i * 12 + 8);
    if (Math.abs(Math.abs(x) - width / 2) < 0.3 || Math.abs(Math.abs(z) - depth / 2) < 0.3) edge.push(y);
  }
  edge.sort((a, b) => a - b);
  const q95 = edge[Math.floor((edge.length - 1) * 0.95)];
  if (q95 < 11.8) continue;
  for (const part of [m.raw, m.connected]) {
    const off = m.offset + (part === m.connected ? m.raw.length : 0);
    for (let i = 0; i < part.vertices; i++) {
      const at = off + i * 12 + 4;
      bin.writeFloatLE(mapDeepstoneFloorY(bin.readFloatLE(at)), at);
    }
  }
  const oldHeight = m.dimensionsMm?.height;
  if (Number.isFinite(oldHeight)) m.dimensionsMm.height = oldHeight - 3.95;
  m.openlock.revision = Math.max(4, m.openlock.revision ?? 0);
  fixed.add(id);
}

// Keep the bundled print note aligned with the corrected release geometry.
for (let i = 1; i <= 5; i++) {
  const review = path.join(ROOT, `release/asset-packs/deepstone-print-0${i}/PRINT-REVIEW.md`);
  const source = await fs.readFile(review, 'utf8');
  const updated = source
    .replace('Dry floor joining surfaces: 12 mm above the underside.', 'Dry floor joining surfaces now meet the shared 8 mm OpenLOCK floor datum (a maximum 0.05 mm surface feather remains above the datum).')
    .replace('Water joining surfaces: 10 mm, with 12 mm banks.', 'Water channels and banks use the same corrected floor carrier datum.')
    .replace('The doorway floor is 12.01 mm to avoid coincident Boolean surfaces and is within this tolerance.', 'The doorway floor uses the corrected 8 mm carrier datum.')
    .replace('Nominal matching tolerance: 0.025 mm.', 'Nominal carrier feather: 0.05 mm above the 8 mm connector datum.')
    .replace('Raised stair and ledge landings: 37.4 mm, a 25.4 mm rise.', 'Raised stair and ledge landing pieces retain their separate 25.4 mm raised datum.')
    .replace('seam heights and nominal connector interference are checked separately.', 'the corrected 8 mm floor carrier height and connector geometry are checked separately.');
  if (updated !== source) await fs.writeFile(review, updated);
}

if (!fixed.size) throw new Error('No Deepstone floor meshes matched the 12 mm perimeter datum');

// Apply the same vertical map to each full-detail STL. Binary STL stores an
// independent copy per triangle, so identical source points remain identical.
const stlChanges = [];
for (const [id, m] of Object.entries(index)) {
  if (!fixed.has(id)) continue;
  for (const file of m.printFiles ?? []) {
    const filePath = path.join(ROOT, 'release/asset-packs', file.pack, 'print', file.file);
    const stl = await fs.readFile(filePath);
    if (stl.length < 84 || stl.length !== 84 + stl.readUInt32LE(80) * 50) throw new Error(`Invalid binary STL: ${file.file}`);
    for (let at = 84; at < stl.length; at += 50) {
      for (let v = 0; v < 3; v++) {
        const yAt = at + 12 + v * 12 + 4;
      stl.writeFloatLE(mapDeepstoneFloorY(stl.readFloatLE(yAt)), yAt);
      }
      // Recalculate the stored facet normal after deforming vertex heights.
      const a = [0, 1, 2].map(k => stl.readFloatLE(at + 12 + k * 4));
      const b = [0, 1, 2].map(k => stl.readFloatLE(at + 24 + k * 4));
      const c = [0, 1, 2].map(k => stl.readFloatLE(at + 36 + k * 4));
      const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...normal) || 1;
      normal.forEach((x, k) => stl.writeFloatLE(x / length, at + k * 4));
    }
    await fs.writeFile(filePath, stl);
    file.sha256 = createHash('sha256').update(stl).digest('hex');
    file.size = stl.length;
    stlChanges.push(file.file);
  }
}

await fs.writeFile(binPath, bin);
for (const m of Object.values(index)) {
  if (!fixed.has(Object.keys(index).find(id => index[id] === m))) continue;
  const start = m.offset, length = m.raw.length + m.connected.length;
  m.sha256 = createHash('sha256').update(bin.subarray(start, start + length)).digest('hex');
}
await fs.writeFile(indexPath, JSON.stringify(index));

// Refresh the two built-in lookup tables from the corrected public pack index.
for (const f of ['src/generated/builtin-index.json', 'desktop/builtin-index.json']) {
  const p = path.join(ROOT, f);
  const all = JSON.parse(await fs.readFile(p, 'utf8'));
  for (const id of fixed) all[id] = { ...index[id], pack: 'deepstone' };
  await fs.writeFile(p, JSON.stringify(all));
}

console.log(`Corrected ${fixed.size} Deepstone floor carriers to the shared 8 mm datum; updated ${stlChanges.length} print meshes.`);
console.log([...fixed].join(', '));
