// Check the complete installed catalogue from metadata; never read working meshes.
export function verifyCollection(release, expected) {
  const packs = new Map();
  for (const pack of release.assets) {
    if (packs.has(pack.id)) throw Error('Duplicate scenery pack: ' + pack.id);
    packs.set(pack.id, pack);
  }
  for (const [id, entry] of Object.entries(expected)) {
    if (!packs.get(entry.pack)?.index?.[id]) throw Error('Missing catalogue piece: ' + id);
  }
  const prints = new Set();
  let pieces = 0;
  for (const pack of packs.values()) for (const [id, entry] of Object.entries(pack.index)) {
    pieces++;
    let total = 0;
    for (const part of [entry.raw, entry.connected]) {
      if (!part || ![part.length, part.vertices, part.indices].every(n => Number.isSafeInteger(n) && n >= 0) ||
        part.length !== part.vertices * 24 + part.indices * 4) throw Error('Invalid mesh range: ' + id);
      total += part.length;
    }
    const file = pack.files[entry.file || 'meshes.bin'];
    const offset = entry.file ? 0 : entry.offset;
    if (!file || !Number.isSafeInteger(offset) || offset < 0 || offset + total > file.size) throw Error('Missing or truncated mesh: ' + id);
    if (entry.file && (file.size !== total || file.sha256 !== entry.sha256)) throw Error('Model hash or size differs from index: ' + id);
    for (const source of entry.printFiles || []) {
      const target = packs.get(source.pack)?.files?.['print/' + source.file];
      if (!target || target.size !== source.size || target.sha256 !== source.sha256) throw Error('Missing or mismatched full-detail print file: ' + id);
      prints.add(source.pack + '/' + source.file);
    }
  }
  if (!pieces || !Object.keys(expected).length) throw Error('Empty scenery collection');
  return {requiredPieces: Object.keys(expected).length, shippedPieces: pieces, packs: packs.size, printFiles: prints.size};
}
