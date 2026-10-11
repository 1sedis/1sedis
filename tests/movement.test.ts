import { describe, expect, it } from 'vitest';
import { createBattle, simulate, stepBattle as simulateTick, type Placement } from '../src/game/battle';

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

describe('king', () => {
  it('steps away when a piece can hit it', () => {
    // An enemy rook aims down the king's file; the king should leave it.
    const b = createBattle({ allies: [p('king', 3, 7), p('pawn', 7, 5)], enemies: [p('king', 7, 0), p('rook', 3, 1)] });
    const king = b.units.find((u) => u.side === 'ally' && u.kind === 'king')!;
    for (let i = 0; i < 20 && !b.result; i++) {
      simulateTick(b);
    }
    expect(king.x).not.toBe(3);
  });

  it('stays in formation when nothing threatens it', () => {
    const b = createBattle({ allies: [p('king', 3, 7), p('pawn', 3, 6)], enemies: [p('king', 4, 0)] });
    const king = b.units.find((u) => u.side === 'ally' && u.kind === 'king')!;
    for (let i = 0; i < 10; i++) simulateTick(b);
    expect([king.x, king.y]).toEqual([3, 7]);
  });

  it('still loses to a much stronger army instead of running forever', () => {
    const b = createBattle({
      allies: [p('king', 3, 7), p('rook', 0, 7, 10), p('queen', 7, 7, 10)],
      enemies: [p('king', 4, 0), p('pawn', 3, 2)],
    });
    expect(simulate(b)).toBe('win');
  });
});
