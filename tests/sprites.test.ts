import { describe, expect, it } from 'vitest';
import { RELIC_IDS } from '../src/game/relics';
import { RELIC_ICON_MAPS } from '../src/ui/relicIcons';
import { SPRITE_MAPS, tierMap } from '../src/ui/sprites';

describe('sprites', () => {
  it('every piece map is 24x24 and uses known palette letters', () => {
    for (const [kind, rows] of Object.entries(SPRITE_MAPS)) {
      expect(rows, kind).toHaveLength(24);
      for (const row of rows) {
        expect(row, `${kind}: ${row}`).toHaveLength(24);
        expect(row).toMatch(/^[.ofhsdgwe]+$/);
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

describe('relic icons', () => {
  it('every relic has its own 12x12 icon', () => {
    const maps = Object.entries(RELIC_ICON_MAPS);
    expect(maps.map(([id]) => id).sort()).toEqual([...RELIC_IDS].sort());
    const seen = new Set<string>();
    for (const [id, icon] of maps) {
      expect(icon.map, id).toHaveLength(12);
      for (const row of icon.map) {
        expect(row, `${id}: ${row}`).toHaveLength(12);
        expect(row).toMatch(/^[.oabc]+$/);
      }
      seen.add(icon.map.join(''));
    }
    expect(seen.size).toBe(maps.length);
  });
});
