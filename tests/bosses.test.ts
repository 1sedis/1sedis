import { describe, expect, it } from 'vitest';
import { autoFormation } from '../src/game/autoformation';
import { createBattle, shieldWall, stepBattle, type BattleEvent, type Placement } from '../src/game/battle';
import { buildMap } from '../src/game/run';
import { bossFor } from '../src/game/bosses';
import { battleSetup, commandLimit, newGame } from '../src/game/state';

function fight(id: string, level: number) {
  const s = newGame(0);
  for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
  s.army = { ...s.army, king: 1, pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 };
  for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = level;
  autoFormation(s, commandLimit(s, id), undefined, id);
  const b = createBattle(battleSetup(s, id));
  const events: BattleEvent[] = [];
  while (!b.result) {
    stepBattle(b);
    events.push(...b.events);
  }
  return { b, events, has: (t: BattleEvent['type']) => events.some((e) => e.type === t) };
}

describe('bosses', () => {
  it('boss levels have a mechanic', () => {
    expect(bossFor('1-9')).toBe('captain');
    expect(bossFor('4-9')).toBe('queen');
    expect(bossFor('abyss-20')).toBe('guardian');
    expect(bossFor('abyss-21')).toBeUndefined();
    expect(bossFor('1-8')).toBeUndefined();
  });

  it('the captain calls reinforcements and enrages', () => {
    const { has, events } = fight('1-9', 4);
    expect(has('summon')).toBe(true);
    expect(events.filter((e) => e.type === 'summon').length).toBeLessThanOrEqual(4);
    expect(has('rage')).toBe(true);
  });

  it('the rider jumps next to its target', () => {
    const { events } = fight('2-9', 8);
    const jump = events.findIndex((e) => e.type === 'boss' && e.label === 'Прыжок смерти');
    expect(jump).toBeGreaterThan(-1);
  });

  it('the fortress warns before rockfall and leaves rocks', () => {
    const { events, b } = fight('3-9', 13);
    const w = events.find((e) => e.type === 'warn');
    expect(w?.cells?.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'blast')).toBe(true);
    if (events.some((e) => e.type === 'terrain')) expect(b.terrain.includes('rock')).toBe(true);
  });

  it('the black queen strikes a whole file after a warning', () => {
    const { events } = fight('4-9', 15);
    const w = events.find((e) => e.type === 'warn');
    expect(w?.cells).toHaveLength(8);
    expect(new Set(w!.cells!.map((c) => c % 8)).size).toBe(1);
  });
});

describe('boss passives and phases', () => {
  const p = (kind: Placement['kind'], x: number, y: number, level = 5, boss = false): Placement => ({ kind, x, y, level, boss });

  it('the captain hides behind a wall of shields', () => {
    const b = createBattle({ allies: [p('king', 3, 7)], enemies: [p('king', 7, 0), p('pawn', 3, 2, 5, true), p('pawn', 2, 2), p('pawn', 4, 2)], bossId: 'captain' });
    const boss = b.units.find((u) => u.boss)!;
    expect(shieldWall(b, boss)).toBe(true);
    b.units = b.units.filter((u) => !(u.kind === 'pawn' && !u.boss && u.x === 4));
    expect(shieldWall(b, boss)).toBe(false);
  });

  it('the fortress never moves; the queen is untouchable behind her reflections', () => {
    const f = createBattle({ allies: [p('king', 3, 7)], enemies: [p('king', 7, 0), p('rook', 3, 1, 5, true)], bossId: 'fortress' });
    expect(f.units.find((u) => u.boss)!.moveCd).toBe(0);
    const q = createBattle({ allies: [p('king', 3, 7), p('rook', 0, 7, 30)], enemies: [p('king', 7, 0), p('queen', 0, 1, 5, true)], bossId: 'queen' });
    const queen = q.units.find((u) => u.boss)!;
    queen.hp = queen.maxHp * 0.49; // rage at once
    for (let i = 0; i < 3; i++) stepBattle(q);
    expect(q.reflections.length).toBe(2);
    const before = queen.hp;
    for (let i = 0; i < 40; i++) stepBattle(q);
    if (q.reflections.some((id) => q.units.some((u) => u.uid === id && u.hp > 0))) expect(queen.hp).toBe(before);
  });
});

describe('elite rules', () => {
  const p = (kind: Placement['kind'], x: number, y: number, level = 3): Placement => ({ kind, x, y, level });

  it('frenzy speeds up the enemy, waves bring reinforcements, the undying rise', () => {
    const base = createBattle({ allies: [p('king', 3, 7)], enemies: [p('king', 3, 0), p('knight', 2, 1)] });
    const fast = createBattle({ allies: [p('king', 3, 7)], enemies: [p('king', 3, 0), p('knight', 2, 1)], eliteRule: 'frenzy' });
    expect(fast.units[2].attackCd).toBeLessThan(base.units[2].attackCd);
    const waves = createBattle({ allies: [p('king', 3, 7), p('rook', 0, 7, 1)], enemies: [p('king', 7, 0)], eliteRule: 'waves' });
    for (let i = 0; i < 170 && !waves.result; i++) stepBattle(waves);
    expect(waves.eliteCount).toBeGreaterThanOrEqual(1);
    const undying = createBattle({ allies: [p('king', 3, 7), p('queen', 2, 5, 30)], enemies: [p('king', 7, 0), p('pawn', 2, 3, 1)], eliteRule: 'undying' });
    for (let i = 0; i < 300 && !undying.result && undying.eliteCount === 0; i++) stepBattle(undying);
    expect(undying.eliteCount).toBe(1);
  });

  it('the run map gives elites a rule, and the mirror copies your formation', () => {
    const s = newGame(0);
    s.run.chapter = 2;
    for (let seed = 1; seed < 300; seed++) {
      const map = buildMap(2, seed);
      const elite = map.nodes.find((n) => n.kind === 'elite' && n.rule === 'mirror' && n.row === 2);
      if (!elite) continue;
      expect(map.nodes.filter((n) => n.kind === 'elite').every((n) => n.rule)).toBe(true);
      s.run.seed = seed;
      s.run.done = [map.nodes.find((n) => n.row === 0)!.id, map.nodes.find((n) => n.next.includes(elite.id) && n.row === 1)!.id];
      s.run.at = elite.id;
      s.formation = [{ kind: 'king', x: 3, y: 7 }, { kind: 'pawn', x: 1, y: 5 }];
      const setup = battleSetup(s, elite.level!);
      expect(setup.eliteRule).toBe('mirror');
      expect(setup.enemies.map((e) => [e.kind, e.x, e.y])).toEqual([['king', 3, 0], ['pawn', 1, 2]]);
      return;
    }
    throw new Error('no mirror elite found');
  });
});
