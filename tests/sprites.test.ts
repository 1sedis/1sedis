import { describe, expect, it } from 'vitest';
import { SPRITE_MAPS, tierMap } from '../src/ui/sprites';

describe('sprites', () => {
  it('every piece map is 16x16 and uses known palette letters', () => {
    for (const [kind, rows] of Object.entries(SPRITE_MAPS)) {
      expect(rows, kind).toHaveLength(16);
      for (const row of rows) {
        expect(row, `${kind}: ${row}`).toHaveLength(16);
        expect(row).toMatch(/^[.ofhsgwe]+$/);
      }
    }
  });
});

describe('sprite tiers', () => {
  it('higher tiers add band pixels without changing the silhouette', () => {
    for (const kind of Object.keys(SPRITE_MAPS) as (keyof typeof SPRITE_MAPS)[]) {
      const base = tierMap(kind, 0);
      const t1 = tierMap(kind, 1);
      const t2 = tierMap(kind, 2);
      const count = (m: string[]) => m.join('').split('b').length - 1;
      expect(count(base), kind).toBe(0);
      expect(count(t1), kind).toBeGreaterThan(0);
      expect(count(t2), kind).toBeGreaterThan(count(t1));
      const shape = (m: string[]) => m.map((r) => r.replace(/[^.]/g, '#')).join('');
      expect(shape(t2)).toBe(shape(base));
    }
  });
});
