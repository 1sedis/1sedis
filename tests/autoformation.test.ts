import { describe, expect, it } from 'vitest';
import { autoFormation, bestFormation } from '../src/game/autoformation';
import { createBattle, simulate } from '../src/game/battle';
import { battleSetup, commandLimit, newGame, type GameState } from '../src/game/state';

function army(level: number): GameState {
  const s = newGame(0);
  for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.cleared[`${c}-${n}`] = true;
  s.army = { ...s.army, king: 1, pawn: 6, knight: 2, bishop: 2, rook: 2, queen: 1 };
  for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = level;
  return s;
}
const wins = (s: GameState, id: string) => simulate(createBattle(battleSetup(s, id))) === 'win';

describe('auto formation', () => {
  it('always places the king and respects the limit and the army', () => {
    const s = army(5);
    autoFormation(s, 6, { kingX: 5, pawnRow: 6, knights: 'center' });
    expect(s.formation.filter((f) => f.kind === 'king')).toEqual([{ kind: 'king', x: 5, y: 7 }]);
    expect(s.formation.filter((f) => f.kind !== 'king')).toHaveLength(6);
    const cells = new Set(s.formation.map((f) => `${f.x},${f.y}`));
    expect(cells.size).toBe(s.formation.length);
  });

  it('the best formation wins at a lower level than the plain default', () => {
    for (const id of ['2-5', '3-5']) {
      let plain = 1;
      while (plain < 30) { const s = army(plain); autoFormation(s, commandLimit(s, id)); if (wins(s, id)) break; plain++; }
      let smart = 1;
      while (smart < 30) { const s = army(smart); bestFormation(s, id, commandLimit(s, id)); if (wins(s, id)) break; smart++; }
      expect(smart, id).toBeLessThanOrEqual(plain);
    }
  });
});
