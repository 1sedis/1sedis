import { describe, expect, it } from 'vitest';
import { createBattle, simulate, stepBattle, type Placement } from '../src/game/battle';
import { RELIC_IDS, rollOffer } from '../src/game/relics';
import {
  battleSetup, chooseRelic, commandLimit, newGame, recordResult, relicOffer,
} from '../src/game/state';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

describe('relic picks', () => {
  it('a first boss clear grants a pick with a stable 1-of-3 offer', () => {
    const s = newGame(0);
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8']) s.cleared[id] = true;
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

  it('cleared levels alone grant no picks', () => {
    const s = newGame(0);
    for (let i = 1; i <= 4; i++) s.cleared[`1-${i}`] = true;
    const b = createBattle(battleSetup(s, '1-5'));
    b.result = 'loss';
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
  it('reserve adds a piece to every battle', () => {
    const s = newGame(0);
    const limit = commandLimit(s, '1-2');
    s.relics = ['reserve'];
    expect(commandLimit(s, '1-2')).toBe(limit + 1);
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

describe('build relics', () => {
  /** First hit a knight lands on an enemy rook, with and without a relic. */
  const firstHit = (relics: Parameters<typeof createBattle>[0]['relics'], target: Placement['kind'] = 'rook') => {
    const b = createBattle({ allies: [p('king', 0, 7), p('knight', 3, 4, 3)], enemies: [p('king', 7, 0), p(target, 4, 2, 3)], relics });
    for (let i = 0; i < 200 && !b.result; i++) {
      stepBattle(b);
      const hit = b.events.find((e) => e.type === 'hit' && e.side === 'enemy');
      if (hit) return hit.amount;
    }
    throw new Error('no hit');
  };

  it('the lance triples a knight’s first blow', () => {
    expect(firstHit(['lance']) / firstHit([])).toBeCloseTo(3, 1);
  });

  it('the bastion makes rooks tougher', () => {
    const b = createBattle({ allies: [p('king', 0, 7), p('rook', 3, 4)], enemies: [p('king', 7, 0), p('knight', 4, 2, 3)], relics: ['bastion'] });
    const plain = createBattle({ allies: [p('king', 0, 7), p('rook', 3, 4)], enemies: [p('king', 7, 0), p('knight', 4, 2, 3)] });
    const hitOn = (x: typeof b) => {
      for (let i = 0; i < 200; i++) {
        stepBattle(x);
        const hit = x.events.find((e) => e.type === 'hit' && e.side === 'ally');
        if (hit) return hit.amount;
      }
      throw new Error('no hit');
    };
    expect(hitOn(b) / hitOn(plain)).toBeCloseTo(0.7, 1);
  });

  it('iron king, lone wolf and pawn storm shape the setup', () => {
    const s = newGame(0);
    const base = battleSetup(s, '1-1');
    s.relics = ['ironKing', 'loneWolf', 'pawnStorm'];
    const setup = battleSetup(s, '1-1');
    const pawns = setup.allies.filter((a) => a.kind === 'pawn').length;
    expect(setup.allyKingHpMult! / base.allyKingHpMult!).toBeCloseTo(1.5);
    expect(setup.allyKind?.king?.atk).toBeCloseTo(1.4);
    expect(setup.allyAtkMult! / base.allyAtkMult!).toBeCloseTo(1.4); // a small army: the wolf bites
    expect(setup.allyKind?.pawn?.atk).toBeCloseTo((base.allyKind?.pawn?.atk ?? 1) * (1 + 0.05 * pawns));
  });

  it('piggy bank pays interest on a win', () => {
    const a = newGame(0);
    const b = newGame(0);
    a.gold = b.gold = 400;
    b.relics = ['piggyBank'];
    for (const s of [a, b]) {
      const battle = createBattle(battleSetup(s, '1-1'));
      battle.result = 'win';
      recordResult(s, '1-1', battle);
    }
    expect(b.gold).toBeGreaterThan(a.gold);
  });
});
