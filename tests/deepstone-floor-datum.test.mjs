import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDeepstoneFloorY } from '../scripts/release/deepstone-floor-datum.mjs';

test('Deepstone floor correction preserves OpenLOCK connectors and sets the shared floor datum', () => {
  for (let y = 0; y <= 8; y += 0.25) assert.equal(mapDeepstoneFloorY(y), y);
  assert.equal(mapDeepstoneFloorY(12), 8.4);
  assert.equal(mapDeepstoneFloorY(20), 16.4);
  assert.equal(mapDeepstoneFloorY(12, 0.15), 8.6);
  for (let y = 0; y < 40; y += 0.01) assert.ok(mapDeepstoneFloorY(y + 0.01) > mapDeepstoneFloorY(y));
});
