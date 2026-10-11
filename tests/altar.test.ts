import { describe, expect, it } from 'vitest';
import { ALTAR, shardsForFloor } from '../src/game/altar';
import { createBattle } from '../src/game/battle';
import { abyssId } from '../src/game/levels';
import { altarCost, battleSetup, buyAltar, newGame, prestige, recordResult } from '../src/game/state';

describe('abyss shards and altar', () => {
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

  it('perks cost shards, scale and stop at the max level', () => {
    const s = newGame(0);
    s.shards = 1e6;
    const first = altarCost(s, 'mantle');
    expect(buyAltar(s, 'mantle')).toBe(true);
    expect(altarCost(s, 'mantle')).toBeGreaterThan(first);
    for (let i = 0; i < 20; i++) buyAltar(s, 'mantle');
    expect(s.altar.mantle).toBe(ALTAR.mantle.maxLevel);
  });

  it('perks strengthen the army and the king', () => {
    const s = newGame(0);
    const base = battleSetup(s, '1-1');
    s.altar.darkSteel = 5;
    s.altar.deepHide = 5;
    s.altar.mantle = 2;
    const boosted = battleSetup(s, '1-1');
    expect(boosted.allyAtkMult!).toBeCloseTo(base.allyAtkMult! * 1.2);
    expect(boosted.allyHpMult!).toBeCloseTo(base.allyHpMult! * 1.2);
    const king = createBattle(boosted).units.find((u) => u.side === 'ally' && u.kind === 'king')!;
    const plainKing = createBattle(base).units.find((u) => u.side === 'ally' && u.kind === 'king')!;
    expect(king.maxHp).toBeGreaterThan(plainKing.maxHp * 1.6);
  });

  it('survive a new game, and veterans/echo shape the next run', () => {
    const s = newGame(0);
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
    s.shards = 42;
    s.altar.veterans = 2;
    s.altar.echo = 1;
    prestige(s, 0);
    expect(s.shards).toBe(42);
    expect(s.altar.veterans).toBe(2);
    expect(s.levels.pawn).toBe(3);
    expect(s.relicPicks).toBe(1);
  });
});
