/** Shards for clearing an abyss floor: a few per floor, a big pile for every guardian. */
export function shardsForFloor(floor: number): number {
  const base = 1 + Math.floor(floor / 10);
  return floor % 10 === 0 ? base + 5 * (floor / 10) : base;
}
