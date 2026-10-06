// Preserve the complete 0-8 mm OpenLOCK connector zone. Compress the old
// 8-12 mm carrier shoulder to a printable transition, then translate the
// sculpt above it. The slope is adjustable for topology-sensitive sculpts.
export function mapDeepstoneFloorY(y, shoulderSlope = 0.1) {
  if (y <= 8) return y;
  if (y < 12) return 8 + (y - 8) * shoulderSlope;
  return y - 4 + 4 * shoulderSlope;
}
