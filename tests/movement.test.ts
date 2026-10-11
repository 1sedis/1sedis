import { describe, expect, it } from 'vitest';
import { createBattle, simulate, type Placement } from '../src/game/battle';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

describe('movement', () => {
  // Reported case: a bishop on e4 under the enemy king on e8 stood still.
  it('a bishop on the same file as the king finds a way to attack', () => {
    const b = createBattle({ allies: [p('king', 3, 7), p('bishop', 4, 4, 5)], enemies: [p('king', 4, 0)] });
    expect(simulate(b)).toBe('win');
    expect(b.tick).toBeLessThan(200);
  });

  it('knights and rooks reach awkward targets too', () => {
    for (const kind of ['knight', 'rook', 'queen'] as const) {
      const b = createBattle({ allies: [p('king', 0, 7), p(kind, 7, 6, 5)], enemies: [p('king', 2, 0), p('pawn', 2, 1)] });
      expect(simulate(b), kind).toBe('win');
    }
  });
});
