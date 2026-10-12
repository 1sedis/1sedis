import { describe, expect, it } from 'vitest';
import { createBattle, MAX_TICKS, OVERTIME_AT, stepBattle } from '../src/game/battle';

describe('sudden death', () => {
  it('a stalemate behind a rock wall still ends by the pieces, not the clock', () => {
    const rows = ['........', '........', '........', '########', '........', '........', '........', '........'];
    const b = createBattle({
      allies: [{ kind: 'king', x: 3, y: 7, level: 1 }],
      enemies: [{ kind: 'king', x: 3, y: 0, level: 1 }],
      terrain: rows,
    });
    let overtime = false;
    while (!b.result && b.tick < MAX_TICKS) {
      stepBattle(b);
      if (b.events.some((e) => e.type === 'overtime')) overtime = true;
    }
    expect(overtime).toBe(true);
    expect(b.result).toBeTruthy();
    expect(b.tick).toBeGreaterThan(OVERTIME_AT);
    expect(b.tick).toBeLessThan(MAX_TICKS);
  });
});
