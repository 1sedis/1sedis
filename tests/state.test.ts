import { describe, expect, it } from 'vitest';
import { createBattle, simulate } from '../src/game/battle';
import { firstReward, replayReward } from '../src/game/levels';
import {
  accrue, battleSetup, collectTreasury, fieldedCount, incomePerMinute, isLevelOpen, isUnlocked, moveSlot, newGame,
  placeFromReserve, recordResult, recruit, recruitCost, removeSlot, sanitizeFormation, slotAt, treasuryCap,
  upgradePiece, PAWN_CAP, parseSave,
} from '../src/game/state';

describe('army', () => {
  it('recruiting spends gold and raises the price', () => {
    const s = newGame(0);
    s.gold = 1000;
    const cost = recruitCost(s, 'pawn');
    expect(recruit(s, 'pawn')).toBe(true);
    expect(s.gold).toBe(1000 - cost);
    expect(s.army.pawn).toBe(4);
    expect(recruitCost(s, 'pawn')).toBeGreaterThan(cost);
  });

  it('locked pieces and the king cannot be recruited, the queen only once', () => {
    const s = newGame(0);
    s.gold = 1e9;
    expect(recruit(s, 'knight')).toBe(false);
    expect(recruit(s, 'king')).toBe(false);
    s.stars['3-9'] = 1;
    expect(isUnlocked(s, 'queen')).toBe(true);
    expect(recruit(s, 'queen')).toBe(true);
    expect(recruit(s, 'queen')).toBe(false);
  });

  it('upgrades raise the piece level', () => {
    const s = newGame(0);
    s.gold = 1000;
    expect(upgradePiece(s, 'pawn')).toBe(true);
    expect(s.levels.pawn).toBe(2);
  });
});

describe('formation', () => {
  it('respects the reserve and the command limit', () => {
    const s = newGame(0);
    expect(placeFromReserve(s, 'pawn', 3, 5, 4)).toBeNull(); // the reserve pawn goes in
    expect(placeFromReserve(s, 'pawn', 0, 5, 4)).not.toBeNull(); // all 3 pawns placed now
    s.army.pawn = 6;
    expect(placeFromReserve(s, 'pawn', 0, 5, 4)).toBeNull();
    expect(placeFromReserve(s, 'pawn', 1, 5, 4)).not.toBeNull(); // limit 4 reached
    expect(placeFromReserve(s, 'pawn', 1, 2, 10)).not.toBeNull(); // enemy rows
    expect(fieldedCount(s)).toBe(4);
  });

  it('moves with swapping and never removes the king', () => {
    const s = newGame(0);
    expect(moveSlot(s, 3, 7, 2, 5)).toBe(true);
    expect(slotAt(s, 2, 5)?.kind).toBe('king');
    expect(slotAt(s, 3, 7)?.kind).toBe('pawn');
    expect(removeSlot(s, 2, 5)).toBe(false);
    expect(removeSlot(s, 3, 7)).toBe(true);
  });

  it('sanitize drops extra pieces and restores the king', () => {
    const s = newGame(0);
    s.formation = s.formation.filter((f) => f.kind !== 'king');
    s.army.pawn = 2;
    sanitizeFormation(s, 4);
    expect(s.formation.filter((f) => f.kind === 'pawn')).toHaveLength(2);
    expect(s.formation.some((f) => f.kind === 'king')).toBe(true);
  });
});

describe('progress', () => {
  it('levels open one after another and pay less on replays', () => {
    const s = newGame(0);
    expect(isLevelOpen(s, '1-1')).toBe(true);
    expect(isLevelOpen(s, '1-2')).toBe(false);
    placeFromReserve(s, 'pawn', 3, 5, 4);
    const b = createBattle(battleSetup(s, '1-1'));
    simulate(b);
    const first = recordResult(s, '1-1', b);
    expect(first.win).toBe(true);
    expect(first.firstClear).toBe(true);
    expect(first.reward).toBeGreaterThanOrEqual(firstReward('1-1'));
    expect(isLevelOpen(s, '1-2')).toBe(true);
    const again = recordResult(s, '1-1', b);
    expect(again.firstClear).toBe(false);
    expect(again.reward).toBe(replayReward('1-1'));
  });

  it('a loss gives no stars or gold', () => {
    const s = newGame(0);
    const b = createBattle(battleSetup(s, '1-1'));
    b.result = 'loss';
    const out = recordResult(s, '1-1', b);
    expect(out).toMatchObject({ win: false, stars: 0, reward: 0 });
    expect(isLevelOpen(s, '1-2')).toBe(false);
  });

  it('knights unlock after level 1-2', () => {
    const s = newGame(0);
    expect(isUnlocked(s, 'knight')).toBe(false);
    s.stars['1-2'] = 1;
    expect(isUnlocked(s, 'knight')).toBe(true);
  });
});

describe('treasury', () => {
  it('earns per cleared level, is capped and can be collected', () => {
    const s = newGame(0);
    expect(accrue(s, 60_000)).toBe(0);
    s.stars['1-1'] = 1;
    const rate = incomePerMinute(s);
    expect(accrue(s, 120_000)).toBeCloseTo(rate);
    accrue(s, 1e12);
    expect(s.treasury).toBeCloseTo(treasuryCap(s));
    const gold = s.gold;
    const got = collectTreasury(s);
    expect(s.gold).toBe(gold + got);
    expect(s.treasury).toBeLessThan(1);
  });
});

describe('pawn cap', () => {
  it('holds at most eight pawns and pays back extras from old saves', () => {
    const s = newGame(0);
    s.gold = 1e9;
    while (recruit(s, 'pawn'));
    expect(s.army.pawn).toBe(PAWN_CAP);
    const old = parseSave(JSON.stringify({ ...newGame(0), army: { ...newGame(0).army, pawn: 11 }, gold: 0 }))!;
    expect(old.army.pawn).toBe(PAWN_CAP);
    expect(old.gold).toBeGreaterThan(0);
  });
});
