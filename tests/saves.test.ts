import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportSave, hasSave, importSave, isCleared, lastLoadIssue, loadGame, newGame, parseSave, saveGame, type GameState } from '../src/game/state';

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

describe('save backup', () => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = ls;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('keeps the previous good save as a backup', () => {
    const a = newGame(0);
    a.gold = 111;
    saveGame(a);
    const b = newGame(0);
    b.gold = 222;
    saveGame(b);
    expect(JSON.parse(store.get('chess-autobattler-save-backup')!).gold).toBe(111);
    expect(loadGame(0).gold).toBe(222);
    expect(lastLoadIssue()).toBe('ok');
  });

  it('restores the backup when the main save is damaged and keeps the broken one aside', () => {
    const a = newGame(0);
    a.gold = 111;
    saveGame(a);
    saveGame(newGame(0));
    store.set('chess-autobattler-save', '{"version":2,"gold":');
    const s = loadGame(0);
    expect(s.gold).toBe(111);
    expect(lastLoadIssue()).toBe('restored');
    expect(store.get('chess-autobattler-save-broken')).toBe('{"version":2,"gold":');
    expect(hasSave()).toBe(true);
  });

  it('says the save is lost when nothing can be read', () => {
    store.set('chess-autobattler-save', 'garbage');
    expect(loadGame(0).gold).toBe(newGame(0).gold);
    expect(lastLoadIssue()).toBe('lost');
    expect(hasSave()).toBe(false);
  });

  it('never makes a broken save the backup', () => {
    store.set('chess-autobattler-save', 'garbage');
    saveGame(newGame(0));
    expect(store.has('chess-autobattler-save-backup')).toBe(false);
  });
});

describe('every old save shape loads', () => {
  const shapes: Record<string, Record<string, unknown>> = {
    'before runs (no run field)': { version: 2, gold: 50, army: { king: 1, pawn: 3 }, levels: {}, cleared: { '1-1': true } },
    'with stars and the Abyss': { version: 2, gold: 0, stars: { '1-1': 3, '1-2': 1 }, abyss: { depth: 4 }, shards: 12 },
    'with the treasury and old relics': { version: 2, buildings: { treasury: 3, forge: 2 }, relics: ['chainmail', 'gone-relic'] },
    'with too many pawns': { version: 2, army: { king: 1, pawn: 14 } },
    'mid-run': { version: 2, run: { chapter: 3, seed: 7, done: ['0-1'], at: null, bought: [], complete: false, over: null, wins: 4, elites: 1, bosses: 2 } },
    'after a lost run': { version: 2, run: { chapter: 2, seed: 3, done: [], at: null, bought: [], complete: false, over: { chapter: 2, wins: 3 }, wins: 3, elites: 0, bosses: 1 } },
  };
  for (const [name, data] of Object.entries(shapes)) {
    it(name, () => {
      const s = parseSave(JSON.stringify(data), 0);
      expect(s, name).not.toBeNull();
      expect(s!.army.king).toBe(1);
      expect(s!.run.chapter).toBeGreaterThanOrEqual(1);
      // A loaded old save survives a save-and-load round trip unchanged.
      expect(parseSave(JSON.stringify(s), 0)).toEqual(s);
    });
  }
  it('rejects saves of an unknown version', () => {
    expect(parseSave(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parseSave(JSON.stringify({ version: 3 }))).toBeNull();
  });
});
