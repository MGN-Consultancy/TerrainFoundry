// Rebuild each affected Deepstone model from its pinned raw sculpt. Never warp
// an already-cut connector mesh: socket geometry must remain canonical.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import Module from 'manifold-3d';
import { KIT } from '../../src/model.js';
import { connectAsset } from '../../src/openlock-build.js';
import { repairMeshData } from '../clean-mesh-data.mjs';
import { mapDeepstoneFloorY } from './deepstone-floor-datum.mjs';

const ROOT = path.resolve('.');
const packDir = path.join(ROOT, 'release/asset-packs/deepstone');
const indexPath = path.join(packDir, 'index.json');
const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
const oldBin = await fs.readFile(path.join(packDir, 'meshes.bin'));
const wasm = await Module();
wasm.setup();
const categories = new Map(KIT.map(piece => [piece.id, piece.category]));

function decode(part, offset, buffer) {
  const n = part.vertices * 3;
  const positions = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset + offset, n));
  const colors = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset + offset + n * 4, n));
  const indices = Array.from(new Uint32Array(buffer.buffer, buffer.byteOffset + offset + n * 8, part.indices));
  return { positions, colors, indices };
}
function encode(data) {
  const positions = Float32Array.from(data.positions);
  const colors = Float32Array.from(data.colors);
  const indices = Uint32Array.from(data.indices);
  const bytes = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(colors.buffer), Buffer.from(indices.buffer)]);
  return { bytes, vertices: positions.length / 3, indices: indices.length, length: bytes.length };
}
function geometry(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geo.setIndex(data.indices);
  geo.computeBoundingBox();
  return geo;
}
function bounds(data) {
  const geo = geometry(data), size = geo.boundingBox.getSize(new THREE.Vector3());
  geo.dispose();
  return { width: size.x, depth: size.z, height: size.y };
}

const pieces = [];
const fixed = new Set();
const stlFiles = new Set();
let offset = 0;
for (const [id, meta] of Object.entries(index)) {
  const rawStart = meta.offset;
  let raw = decode(meta.raw, rawStart, oldBin);
  let connected = decode(meta.connected, rawStart + meta.raw.length, oldBin);

  if (meta.openlock?.kind === 'floor' && categories.get(id) === 'Floors') {
    const perimeter = [];
    for (let i = 0; i < raw.positions.length; i += 3) {
      const x = raw.positions[i], y = raw.positions[i + 1], z = raw.positions[i + 2];
      if (Math.abs(Math.abs(x) - meta.openlock.width / 2) < 0.3 || Math.abs(Math.abs(z) - meta.openlock.depth / 2) < 0.3) perimeter.push(y);
    }
    perimeter.sort((a, b) => a - b);
    const q95 = perimeter[Math.floor((perimeter.length - 1) * 0.95)];
    if (q95 >= 11.8) {
      const shoulderSlope = id === 'dg-047' ? 0.15 : 0.1;
      for (let i = 1; i < raw.positions.length; i += 3) raw.positions[i] = mapDeepstoneFloorY(raw.positions[i], shoulderSlope);
      try { raw = repairMeshData(raw, wasm); }
      catch (error) { throw new Error(`Could not repair transformed raw sculpt ${id}: ${error.message}`, { cause: error }); }
      const geo = geometry(raw);
      try {
        connected = repairMeshData(connectAsset(wasm, geo, 'Floors', id, meta.openlock), wasm);
      } finally { geo.dispose(); }
      meta.openlock = { ...connected.openlock, revision: Math.max(4, connected.openlock.revision ?? 0) };
      meta.dimensionsMm = { ...(meta.dimensionsMm ?? {}), ...bounds(connected) };
      for (const f of meta.printFiles ?? []) stlFiles.add(JSON.stringify({ id, ...f }));
      fixed.add(id);
    }
  }

  const a = encode(raw), b = encode(connected);
  const bytes = Buffer.concat([a.bytes, b.bytes]);
  meta.offset = offset;
  meta.raw = { vertices: a.vertices, indices: a.indices, length: a.length };
  meta.connected = { vertices: b.vertices, indices: b.indices, length: b.length };
  meta.sha256 = createHash('sha256').update(bytes).digest('hex');
  offset += bytes.length;
  pieces.push(bytes);
}

if (!fixed.size) throw new Error('No Deepstone floor meshes matched the 12 mm perimeter datum');
const newBin = Buffer.concat(pieces);
await fs.writeFile(path.join(packDir, 'meshes.bin'), newBin);
await fs.writeFile(indexPath, JSON.stringify(index));

// Apply the identical monotone map to the full-detail print source. The pin
// cavity area stays unchanged, and paired removable inserts share the mapping.
const changedPrints = [];
for (const serialized of stlFiles) {
  const { id, ...f } = JSON.parse(serialized);
  const shoulderSlope = id === 'dg-047' ? 0.15 : 0.1;
  const filePath = path.join(ROOT, 'release/asset-packs', f.pack, 'print', f.file);
  const stl = await fs.readFile(filePath);
  if (stl.length < 84 || stl.length !== 84 + stl.readUInt32LE(80) * 50) throw new Error(`Invalid binary STL: ${f.file}`);
  for (let at = 84; at < stl.length; at += 50) {
    for (let v = 0; v < 3; v++) {
      const yAt = at + 16 + v * 12;
      stl.writeFloatLE(mapDeepstoneFloorY(stl.readFloatLE(yAt), shoulderSlope), yAt);
    }
    const a = [0, 1, 2].map(k => stl.readFloatLE(at + 12 + k * 4));
    const b = [0, 1, 2].map(k => stl.readFloatLE(at + 24 + k * 4));
    const c = [0, 1, 2].map(k => stl.readFloatLE(at + 36 + k * 4));
    const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal) || 1;
    normal.forEach((x, k) => stl.writeFloatLE(x / length, at + k * 4));
  }
  await fs.writeFile(filePath, stl);
  f.sha256 = createHash('sha256').update(stl).digest('hex');
  f.size = stl.length;
  changedPrints.push({ file: f.file, f });
}

for (const [id, meta] of Object.entries(index)) {
  if (!fixed.has(id)) continue;
  const start = meta.offset;
  meta.sha256 = createHash('sha256').update(newBin.subarray(start, start + meta.raw.length + meta.connected.length)).digest('hex');
  for (const { file, f } of changedPrints) {
    for (const print of meta.printFiles ?? []) if (print.file === file && print.pack === f.pack) Object.assign(print, f);
  }
}
await fs.writeFile(indexPath, JSON.stringify(index));

for (const file of ['src/generated/builtin-index.json', 'desktop/builtin-index.json']) {
  const p = path.join(ROOT, file), all = JSON.parse(await fs.readFile(p, 'utf8'));
  // Repacking changes downstream offsets even for untouched meshes.
  for (const [id, asset] of Object.entries(index)) all[id] = { ...asset, pack: 'deepstone' };
  await fs.writeFile(p, JSON.stringify(all));
}

for (let i = 1; i <= 5; i++) {
  const review = path.join(ROOT, `release/asset-packs/deepstone-print-0${i}/PRINT-REVIEW.md`);
  let source = await fs.readFile(review, 'utf8');
  source = source.replace('Dry floor joining surfaces: 12 mm above the underside.', 'Dry floor joining surfaces now meet the shared 8 mm OpenLOCK datum with a 0.4 mm transition (0.6 mm on the pit trap tile).')
    .replace('Water joining surfaces: 10 mm, with 12 mm banks.', 'Water channels and banks use the same corrected floor carrier datum.')
    .replace('The doorway floor is 12.01 mm to avoid coincident Boolean surfaces and is within this tolerance.', 'The doorway floor uses the corrected 8 mm carrier datum with a 0.4 mm transition.')
    .replace('Nominal matching tolerance: 0.025 mm.', 'Nominal carrier transition: 0.4 mm above the 8 mm connector datum.')
    .replace('Raised stair and ledge landings: 37.4 mm, a 25.4 mm rise.', 'Raised stair and ledge landing pieces retain their separate 25.4 mm raised datum.')
    .replace('seam heights and nominal connector interference are checked separately.', 'the corrected floor carrier height and unchanged connector geometry are checked separately.');
  await fs.writeFile(review, source);
}

console.log(`Rebuilt ${fixed.size} Deepstone floor assets from raw sculpts with untouched canonical socket regions; updated ${changedPrints.length} full-detail files.`);
console.log([...fixed].join(', '));
