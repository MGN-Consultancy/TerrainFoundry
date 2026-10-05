// Preserve the OpenLOCK connector zone and lower the 12 mm floor carrier to
// the shared 8 mm datum with a 0.05 mm printable feather.
export function mapDeepstoneFloorY(y) {
  if (y <= 8) return y;
  if (y < 12) return 8 + (y - 8) * 0.0125;
  return y - 3.95;
}
