import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/game/battle';
import { abyssId, abyssLevel, enemyPlacements } from '../src/game/levels';
import {
  battleSetup, canPrestige, crownsForPrestige, goldMultiplier, isLevelOpen, newGame, prestige, recordResult, totalStars,
} from '../src/game/state';

describe('abyss', () => {
  it('floors are deterministic, valid and grow harder', () => {
    expect(abyssLevel(7)).toEqual(abyssLevel(7));
    for (let f = 1; f <= 60; f++) {
      const lvl = abyssLevel(f);
      for (const row of lvl.rows) expect(row).toHaveLength(8);
      const enemies = enemyPlacements(lvl);
      expect(enemies.filter((e) => e.kind === 'king')).toHaveLength(1);
      expect(enemies.some((e) => e.boss)).toBe(f % 10 === 0);
    }
    expect(abyssLevel(30).level).toBeGreaterThan(abyssLevel(5).level);
    expect(enemyPlacements(abyssLevel(30)).length).toBeGreaterThan(enemyPlacements(abyssLevel(1)).length);
  });

  it('opens after 2-9, only on the current floor, and a win goes one floor deeper', () => {
    const s = newGame(0);
    expect(isLevelOpen(s, abyssId(1))).toBe(false);
    s.stars['2-9'] = 1;
    expect(isLevelOpen(s, abyssId(1))).toBe(true);
    expect(isLevelOpen(s, abyssId(2))).toBe(false);
    const b = createBattle(battleSetup(s, abyssId(1)));
    b.result = 'win';
    const out = recordResult(s, abyssId(1), b);
    expect(out.reward).toBeGreaterThan(0);
    expect(s.abyss).toEqual({ floor: 2, best: 1 });
    expect(isLevelOpen(s, abyssId(2))).toBe(true);
    expect(totalStars(s)).toBe(1); // abyss floors do not add campaign stars
  });

  it('every 10th floor grants a relic pick', () => {
    const s = newGame(0);
    s.stars['2-9'] = 1;
    s.abyss.floor = 10;
    const b = createBattle(battleSetup(s, abyssId(10)));
    b.result = 'win';
    expect(recordResult(s, abyssId(10), b).relicsEarned).toBe(1);
  });
});

describe('prestige', () => {
  it('needs the final boss, resets the run and keeps crowns, achievements and the abyss record', () => {
    const s = newGame(0);
    expect(canPrestige(s)).toBe(false);
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 3;
    s.gold = 99999;
    s.relics = ['chainmail'];
    s.abyss = { floor: 21, best: 20 };
    s.achievements = ['first_win'];
    const expected = crownsForPrestige(s);
    expect(expected).toBe(Math.floor(108 / 6) + 4 + 3);
    expect(prestige(s, 0)).toBe(expected);
    expect(s.crowns).toBe(expected);
    expect(s.prestige).toBe(1);
    expect(s.gold).toBe(newGame(0).gold);
    expect(s.relics).toEqual([]);
    expect(totalStars(s)).toBe(0);
    expect(s.abyss).toEqual({ floor: 1, best: 20 });
    expect(s.achievements).toEqual(['first_win']);
  });

  it('a new game makes enemies stronger and pays more', () => {
    const s = newGame(0);
    const before = battleSetup(s, '1-1').enemies[0].level;
    const finale = battleSetup(s, '4-1').enemies[0].level;
    s.prestige = 2;
    s.crowns = 10;
    // The bonus ramps by chapter: +0.5 per game in the fields, +2 per game in the throne hall.
    expect(battleSetup(s, '1-1').enemies[0].level).toBe(before + 1);
    expect(battleSetup(s, '4-1').enemies[0].level).toBe(finale + 4);
    // Crowns are spent in the Crown Tree now; only the new-game bonus raises gold.
    expect(goldMultiplier(s)).toBeCloseTo(2);
  });
});
