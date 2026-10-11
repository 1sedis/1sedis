import { describe, expect, it } from 'vitest';
import { createBattle, simulate, stepBattle, type Placement } from '../src/game/battle';
import { RELIC_IDS, rollOffer } from '../src/game/relics';
import {
  battleSetup, chooseRelic, commandLimit, incomePerMinute, newGame, recordResult, relicOffer,
} from '../src/game/state';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

describe('relic picks', () => {
  it('a first boss clear grants a pick with a stable 1-of-3 offer', () => {
    const s = newGame(0);
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8']) s.stars[id] = 1;
    const b = createBattle(battleSetup(s, '1-9'));
    b.result = 'win';
    const out = recordResult(s, '1-9', b);
    expect(out.relicsEarned).toBeGreaterThanOrEqual(1);
    const offer = relicOffer(s)!;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    expect(relicOffer(s)).toEqual(offer);
    expect(chooseRelic(s, offer[1])).toBe(true);
    expect(s.relics).toEqual([offer[1]]);
  });

  it('every 12 stars grant a pick once', () => {
    const s = newGame(0);
    for (let i = 1; i <= 4; i++) s.stars[`1-${i}`] = 3;
    const b = createBattle(battleSetup(s, '1-5'));
    b.result = 'loss';
    expect(recordResult(s, '1-5', b).relicsEarned).toBe(1);
    expect(recordResult(s, '1-5', b).relicsEarned).toBe(0);
  });

  it('offers never include owned relics and run out cleanly', () => {
    expect(rollOffer(RELIC_IDS.slice(0, -2), 5)).toHaveLength(2);
    const s = newGame(0);
    s.relics = [...RELIC_IDS];
    s.relicPicks = 1;
    expect(relicOffer(s)).toBeNull();
    expect(s.relicPicks).toBe(0);
  });
});

describe('relic effects', () => {
  it('reserve and fertile lands change the economy', () => {
    const s = newGame(0);
    s.stars['1-1'] = 1;
    const limit = commandLimit(s, '1-2');
    const income = incomePerMinute(s);
    s.relics = ['reserve', 'fertile'];
    expect(commandLimit(s, '1-2')).toBe(limit + 1);
    expect(incomePerMinute(s)).toBeCloseTo(income * 1.35);
  });

  it('second life saves the king once', () => {
    const b = createBattle({
      allies: [p('king', 0, 7)],
      enemies: [p('king', 7, 0), p('queen', 0, 5, 12)],
      relics: ['secondLife'],
    });
    let saved = 0;
    while (!b.result) {
      stepBattle(b);
      saved += b.events.filter((e) => e.type === 'save').length;
    }
    expect(saved).toBe(1);
    expect(b.result).toBe('loss');
  });

  it('early coronation promotes pawns one row sooner', () => {
    const b = createBattle({ allies: [p('king', 7, 7), p('pawn', 0, 2)], enemies: [p('king', 7, 3)], relics: ['earlyCrown'] });
    let promotedAt: number | null = null;
    for (let i = 0; i < 40 && !b.result && promotedAt === null; i++) {
      stepBattle(b);
      promotedAt = b.events.find((e) => e.type === 'promote')?.y ?? null;
    }
    expect(promotedAt).toBe(1);
  });

  it('relics make the same battle easier', () => {
    const run = (relics: Parameters<typeof createBattle>[0]['relics']) => {
      const s = newGame(0);
      const b = createBattle({ ...battleSetup(s, '1-9'), relics, bossId: undefined });
      simulate(b);
      return b.units.filter((u) => u.side === 'enemy').reduce((sum, u) => sum + Math.max(0, u.hp), 0);
    };
    expect(run(['chainmail', 'sharpBlades', 'warCry', 'phalanx'])).toBeLessThan(run([]));
  });
});
