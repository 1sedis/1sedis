import { describe, expect, it } from 'vitest';
import { autoFormation } from '../src/game/autoformation';
import { createBattle, stepBattle, type BattleEvent } from '../src/game/battle';
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
