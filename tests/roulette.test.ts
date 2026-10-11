import { describe, expect, it } from 'vitest';
import { shardsForFloor } from '../src/game/altar';
import { createBattle, stepBattle, type BattleEvent, type BattleSetup } from '../src/game/battle';
import { abyssId } from '../src/game/levels';
import {
  BUFFS, EPIC_PITY, LEGEND_PITY, SPIN_COST, altarRefund, emptyRoulette, rollBuff, rouletteBonuses,
} from '../src/game/roulette';
import { battleSetup, newGame, parseSave, prestige, recordResult, spinRoulette } from '../src/game/state';

/** Deterministic random numbers for tests. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('abyss shards', () => {
  it('floors pay shards, guardians pay a lot more', () => {
    expect(shardsForFloor(1)).toBe(1);
    expect(shardsForFloor(10)).toBeGreaterThan(shardsForFloor(9) * 3);
    const s = newGame(0);
    s.stars['2-9'] = 1;
    const b = createBattle(battleSetup(s, abyssId(1)));
    b.result = 'win';
    expect(recordResult(s, abyssId(1), b).shards).toBe(1);
    expect(s.shards).toBe(1);
  });
});

describe('roulette', () => {
  it('costs shards per spin and refuses when short', () => {
    const s = newGame(0);
    s.shards = SPIN_COST * 3;
    expect(spinRoulette(s, 1, seeded(1))).toHaveLength(1);
    expect(s.shards).toBe(SPIN_COST * 2);
    expect(spinRoulette(s, 10, seeded(2))).toBeNull();
    expect(s.shards).toBe(SPIN_COST * 2);
    expect(s.roulette.spins).toBe(1);
  });

  it('commons are frequent, legendaries rare, with pity guarantees', () => {
    const r = emptyRoulette();
    const rand = seeded(7);
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let worstEpicGap = 0;
    let gap = 0;
    for (let i = 0; i < 400; i++) {
      const b = rollBuff(r, rand);
      counts[b.rarity]++;
      gap = b.rarity === 'epic' || b.rarity === 'legendary' ? 0 : gap + 1;
      worstEpicGap = Math.max(worstEpicGap, gap);
    }
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.legendary);
    expect(worstEpicGap).toBeLessThan(EPIC_PITY);
    // At most 7 legendaries exist; the pity timer makes sure several drop in 400 spins.
    expect(counts.legendary).toBeGreaterThanOrEqual(Math.min(7, Math.floor(400 / LEGEND_PITY)) - 2);
    expect(counts.legendary).toBeLessThanOrEqual(7);
  });

  it('legendaries never repeat, and turn into epics once all are owned', () => {
    const r = emptyRoulette();
    const rand = seeded(3);
    for (let i = 0; i < 3000; i++) rollBuff(r, rand);
    for (const b of BUFFS.filter((x) => x.legend)) expect(r.owned[b.id], b.id).toBe(1);
  });

  it('bonuses reach the battle and survive a new game', () => {
    const s = newGame(0);
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
    s.roulette.owned = { c_atk: 5, r_hp_pawn: 2, e_shield: 1, l_wrath: 1 };
    const setup = battleSetup(s, '1-1');
    expect(setup.allyAtkMult).toBeCloseTo(battleSetup(newGame(0), '1-1').allyAtkMult! * 1.1);
    expect(setup.legends).toEqual(['wrath']);
    const pawn = createBattle(setup).units.find((u) => u.side === 'ally' && u.kind === 'pawn')!;
    expect(pawn.shield).toBeGreaterThan(0);
    expect(rouletteBonuses(s.roulette).kind.pawn?.hp).toBeCloseTo(1.16);
    prestige(s, 0);
    expect(s.roulette.owned.l_wrath).toBe(1);
  });

  it('old altar perks are refunded as shards, once', () => {
    const old = { ...newGame(0), shards: 3, altar: { darkSteel: 2, mantle: 1 } };
    const refund = altarRefund(old.altar);
    expect(refund).toBe(5 + 8 + 8);
    const loaded = parseSave(JSON.stringify(old))!;
    expect(loaded.shards).toBe(3 + refund);
    expect(parseSave(JSON.stringify(loaded))!.shards).toBe(3 + refund);
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
