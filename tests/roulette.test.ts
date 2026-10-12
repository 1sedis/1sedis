import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle, type BattleEvent, type BattleSetup } from '../src/game/battle';
import {
  BUFFS, EPIC_PITY, LEGEND_PITY, SPIN_COST, emptyRoulette, rank, rouletteBonuses, spinWheel, takeGift,
} from '../src/game/roulette';
import { battleSetup, chooseGift, newGame, parseSave, playerMoves, prestige, spinRoulette, startNextRun } from '../src/game/state';

/** Deterministic random numbers for tests. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('crown wheel', () => {
  it('costs crowns, offers three gifts of one rarity and keeps the offer until a pick', () => {
    const s = newGame(0);
    s.crowns = SPIN_COST + 1;
    const offer = spinRoulette(s, seeded(1))!;
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((b) => b.rarity)).size).toBe(1);
    expect(s.crowns).toBe(1);
    // A reload shows the same offer, at no cost.
    expect(spinRoulette(s, seeded(9))!.map((b) => b.id)).toEqual(offer.map((b) => b.id));
    expect(chooseGift(s, offer[1].id)?.id).toBe(offer[1].id);
    expect(rank(s.roulette, offer[1].id)).toBe(1);
    expect(spinRoulette(s, seeded(2))).toBeNull(); // one crown is not enough
  });

  it('commons are frequent, legendaries rare, with pity guarantees; ranks cap at III', () => {
    const r = emptyRoulette();
    const rand = seeded(7);
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let worstEpicGap = 0;
    let gap = 0;
    for (let i = 0; i < 50; i++) {
      const offer = spinWheel(r, rand);
      const rarity = offer[0].rarity;
      counts[rarity]++;
      gap = rarity === 'epic' || rarity === 'legendary' ? 0 : gap + 1;
      worstEpicGap = Math.max(worstEpicGap, gap);
      takeGift(r, offer[0].id);
    }
    expect(counts.common).toBeGreaterThan(counts.legendary);
    expect(worstEpicGap).toBeLessThan(EPIC_PITY);
    expect(counts.legendary).toBeGreaterThanOrEqual(Math.floor(50 / LEGEND_PITY) - 1);
    for (const b of BUFFS) expect(rank(r, b.id)).toBeLessThanOrEqual(b.max);
  });

  it('gifts are felt: pieces at the start of a run, extra moves against bosses, battle bonuses', () => {
    const s = newGame(0);
    s.stats.wins = 5;
    s.roulette.owned = { c_steel: 2, r_knight: 1, c_levy: 1, c_purse: 2, e_tempo: 1, r_shield: 1, l_wrath: 1 };
    const setup = battleSetup(s, '1-1');
    expect(setup.allyAtkMult).toBeCloseTo(battleSetup(newGame(0), '1-1').allyAtkMult! * 1.16);
    expect(setup.legends).toEqual(['wrath']);
    expect(playerMoves(s, '1-9')).toBe(playerMoves(s, '1-1') + 1);
    s.run.over = { won: false, chapter: 1, at: '1-1', wins: 0, elites: 0, bosses: 0, crowns: 0 };
    startNextRun(s, 0);
    expect(s.army.knight).toBe(1);
    expect(s.army.pawn).toBe(newGame(0).army.pawn + 1);
    expect(s.gold).toBe(newGame(0).gold + 120);
    const pawn = createBattle(battleSetup(s, '1-1')).units.find((u) => u.side === 'ally' && u.kind === 'pawn');
    if (pawn) expect(pawn.shield).toBeGreaterThan(0);
    expect(rouletteBonuses(s.roulette).pawnShield).toBeCloseTo(0.15);
    s.run.complete = true;
    prestige(s, 0);
    expect(s.roulette.owned.l_wrath).toBe(1);
  });

  it('old saves: shards and small buffs become crowns, legendaries stay', () => {
    const old = { ...newGame(0), crowns: 1, shards: 35, roulette: { owned: { c_atk: 8, l_chain: 1 }, spins: 9, sinceEpic: 0, sinceLegend: 0 } };
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.roulette.owned).toEqual({ l_chain: 1 });
    expect(loaded.crowns).toBe(1 + 2 + 3);
    expect('shards' in loaded).toBe(false);
    expect(parseSave(JSON.stringify(loaded))!.crowns).toBe(loaded.crowns);
  });
});

describe('legendary buffs', () => {
  const run = (setup: BattleSetup, ticks = 300) => {
    const b = createBattle(setup);
    const events: BattleEvent[] = [];
    for (let i = 0; i < ticks && !b.result; i++) {
      stepBattle(b);
      events.push(...b.events);
    }
    return { b, events };
  };

  it('a phoenix pawn comes back once', () => {
    const setup: BattleSetup = {
      allies: [{ kind: 'king', x: 7, y: 7, level: 5 }, { kind: 'pawn', x: 3, y: 5, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 3, y: 1, level: 8 }],
      legends: ['phoenix'],
    };
    const { events } = run(setup);
    expect(events.filter((e) => e.label === 'Феникс!')).toHaveLength(1);
  });

  it('the shadow double joins the queen', () => {
    const allies = [{ kind: 'king' as const, x: 3, y: 7, level: 3 }, { kind: 'queen' as const, x: 4, y: 6, level: 3 }];
    const plain = createBattle({ allies, enemies: [{ kind: 'king', x: 3, y: 0, level: 1 }] });
    const doubled = createBattle({ allies, enemies: [{ kind: 'king', x: 3, y: 0, level: 1 }], legends: ['double'] });
    const queens = doubled.units.filter((u) => u.side === 'ally' && u.kind === 'queen');
    expect(queens).toHaveLength(2);
    expect(Math.abs(queens[1].maxHp - queens[0].maxHp * 0.5)).toBeLessThanOrEqual(1);
    expect(plain.units.filter((u) => u.kind === 'queen')).toHaveLength(1);
  });

  it('the beam hits every enemy on the diagonal', () => {
    const setup = (legends?: BattleSetup['legends']): BattleSetup => ({
      allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'bishop', x: 0, y: 6, level: 3 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'pawn', x: 1, y: 5, level: 1 }, { kind: 'pawn', x: 2, y: 4, level: 1 }],
      legends,
    });
    const hitsOnBack = (legends?: BattleSetup['legends']) => run(setup(legends), 15).events
      .filter((e) => e.type === 'hit' && e.x === 2 && e.y === 4 && e.fromKind === 'bishop').length;
    expect(hitsOnBack(['beam'])).toBeGreaterThan(hitsOnBack());
  });
});
