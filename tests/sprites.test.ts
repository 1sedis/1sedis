import { describe, expect, it } from 'vitest';
import { SPRITE_MAPS } from '../src/ui/sprites';

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
