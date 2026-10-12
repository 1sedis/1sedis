import { describe, expect, it } from 'vitest';
import { exportSave, importSave, isCleared, newGame, parseSave, type GameState } from '../src/game/state';

describe('save codes', () => {
  it('round-trips a save', () => {
    const s = newGame(0);
    s.gold = 12345;
    s.cleared['1-1'] = true;
    s.relics = ['chainmail'];
    const back = importSave(exportSave(s))!;
    expect(back.gold).toBe(12345);
    expect(back.cleared['1-1']).toBe(true);
    expect(back.relics).toEqual(['chainmail']);
  });

  it('rejects broken codes', () => {
    expect(importSave('hello')).toBeNull();
    expect(importSave('PG2:@@@')).toBeNull();
    expect(importSave(exportSave(newGame(0)).slice(0, 20))).toBeNull();
  });
});

describe('old saves', () => {
  it('lose the treasury and relics that no longer exist', () => {
    const old = { ...newGame(0), treasury: 500, lastTick: 1, relics: ['fertile', 'chainmail'], buildings: { treasury: 3, hq: 1, forge: 2 } };
    const s = importSave(exportSave(old as never))!;
    expect('treasury' in s).toBe(false);
    expect(s.relics).toEqual(['chainmail']);
    expect(s.buildings).toEqual({ hq: 1, forge: 2 });
  });

  it('drop the star rating, the Abyss, shards and the treasury but keep cleared levels', () => {
    const fresh = newGame(0) as Partial<GameState> & Record<string, unknown>;
    delete fresh.cleared;
    const old = {
      ...fresh,
      crowns: 2,
      stars: { '1-1': 3, '1-2': 1, '1-3': 0 },
      starMilestones: 4,
      abyss: { floor: 12, best: 11, guardian: 'rook' },
      shards: 25,
      treasury: 300,
      lastTick: 5,
      stats: { ...newGame(0).stats, treasuryCollected: 900 },
    };
    const s = parseSave(JSON.stringify(old))!;
    expect(s.cleared).toEqual({ '1-1': true, '1-2': true });
    expect(isCleared(s, '1-1')).toBe(true);
    expect(isCleared(s, '1-3')).toBe(false);
    for (const key of ['stars', 'starMilestones', 'abyss', 'shards', 'treasury', 'lastTick']) expect(key in s, key).toBe(false);
    expect('treasuryCollected' in s.stats).toBe(false);
    // 25 shards: two crowns.
    expect(s.crowns).toBe(2 + 2);
    // A second load changes nothing.
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });

  it('refund shards spent on the old Altar as crowns', () => {
    const old = { ...newGame(0), crowns: 0, shards: 20, altar: { darkSteel: 2 } };
    // 20 shards + 5 + 8 spent on the Altar = 33 shards: three crowns.
    const s = parseSave(JSON.stringify(old))!;
    expect(s.crowns).toBe(3);
    expect('altar' in s).toBe(false);
  });
});
