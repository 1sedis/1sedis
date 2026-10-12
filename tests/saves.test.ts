import { describe, expect, it } from 'vitest';
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

describe('old saves', () => {
  it('lose the treasury and relics that no longer exist', () => {
    const old = { ...newGame(0), treasury: 500, lastTick: 1, relics: ['fertile', 'chainmail'], buildings: { treasury: 3, hq: 1, forge: 2 } };
    const s = importSave(exportSave(old as never))!;
    expect('treasury' in s).toBe(false);
    expect(s.relics).toEqual(['chainmail']);
    expect(s.buildings).toEqual({ hq: 1, forge: 2 });
  });
});
