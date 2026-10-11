import { describe, expect, it } from 'vitest';
import { offlineDescent, OFFLINE_FLOOR_CAP } from '../src/game/offline';
import { exportSave, importSave, newGame } from '../src/game/state';

describe('save codes', () => {
  it('round-trips a save', () => {
    const s = newGame(0);
    s.gold = 12345;
    s.stars['1-1'] = 3;
    s.relics = ['chainmail'];
    const back = importSave(exportSave(s))!;
    expect(back.gold).toBe(12345);
    expect(back.stars['1-1']).toBe(3);
    expect(back.relics).toEqual(['chainmail']);
  });

  it('rejects broken codes', () => {
    expect(importSave('hello')).toBeNull();
    expect(importSave('PG2:@@@')).toBeNull();
    expect(importSave(exportSave(newGame(0)).slice(0, 20))).toBeNull();
  });
});

describe('offline abyss descent', () => {
  const strong = () => {
    const s = newGame(0);
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
    s.army = { king: 1, pawn: 6, knight: 2, bishop: 2, rook: 2, queen: 1 };
    for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = 20;
    s.abyss = { floor: 3, best: 2 };
    return s;
  };

  it('clears one floor per 10 minutes, up to the cap, and pays', () => {
    const s = strong();
    const formation = JSON.stringify(s.formation);
    const d = offlineDescent(s, 35 * 60_000);
    expect(d.floors).toBe(3);
    expect(s.abyss.floor).toBe(6);
    expect(d.gold).toBeGreaterThan(0);
    expect(d.shards).toBeGreaterThan(0);
    expect(JSON.stringify(s.formation)).toBe(formation);
    expect(offlineDescent(strong(), 24 * 3600_000).floors).toBe(OFFLINE_FLOOR_CAP);
  });

  it('does nothing for players who never entered the abyss', () => {
    const s = strong();
    s.abyss = { floor: 1, best: 0 };
    expect(offlineDescent(s, 3600_000).floors).toBe(0);
  });
});
