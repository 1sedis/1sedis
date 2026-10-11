import { describe, expect, it } from 'vitest';
import { adviseUpgrade } from '../src/game/advice';
import { autoFormation } from '../src/game/autoformation';
import { createBattle, enemyDamageShare, simulate } from '../src/game/battle';
import { replayReward } from '../src/game/levels';
import { CONSOLATION_SHARE, battleSetup, commandLimit, newGame, recordResult, type GameState } from '../src/game/state';

function army(level: number): GameState {
  const s = newGame(0);
  for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
  s.army = { king: 1, pawn: 6, knight: 2, bishop: 2, rook: 2, queen: 1 };
  for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = level;
  return s;
}

describe('consolation gold', () => {
  it('a lost battle pays in proportion to the damage done', () => {
    const s = army(4);
    autoFormation(s, commandLimit(s, '2-9'));
    const b = createBattle(battleSetup(s, '2-9'));
    expect(simulate(b)).not.toBe('win');
    const share = enemyDamageShare(b);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
    const gold = s.gold;
    const out = recordResult(s, '2-9', b);
    expect(out.win).toBe(false);
    expect(out.reward).toBe(Math.round(replayReward('2-9') * CONSOLATION_SHARE * share));
    expect(s.gold).toBe(gold + out.reward);
    expect(out.reward).toBeLessThan(replayReward('2-9'));
  });
});

describe('upgrade advice', () => {
  it('suggests an upgrade of a fielded piece', () => {
    const s = army(4);
    autoFormation(s, commandLimit(s, '2-5'));
    const a = adviseUpgrade(s, '2-5')!;
    expect(a).not.toBeNull();
    expect(s.formation.some((f) => f.kind === a.kind)).toBe(true);
    expect(a.level).toBe(s.levels[a.kind] + 1);
  });

  it('a winning suggestion really wins', () => {
    for (let level = 2; level < 12; level++) {
      const s = army(level);
      autoFormation(s, commandLimit(s, '2-5'));
      if (simulate(createBattle(battleSetup(s, '2-5'))) === 'win') break;
      const a = adviseUpgrade(s, '2-5')!;
      if (!a.wins) continue;
      s.levels[a.kind]++;
      expect(simulate(createBattle(battleSetup(s, '2-5')))).toBe('win');
      return;
    }
  });
});
