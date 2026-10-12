import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { createBattle, simulate } from '../src/game/battle';
import {
  battleSetup, checkAchievements, claimAchievement, claimableAchievements, newGame, placeFromReserve, recordResult,
} from '../src/game/state';

describe('achievements', () => {
  it('ids are unique and goals positive', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.goal).toBeGreaterThan(0);
  });

  it('a first win unlocks "first blood" once and pays on claim', () => {
    const s = newGame(0);
    expect(checkAchievements(s)).toEqual([]);
    placeFromReserve(s, 'pawn', 3, 5, 4);
    const b = createBattle(battleSetup(s, '1-1'));
    simulate(b);
    recordResult(s, '1-1', b);
    expect(s.stats.kills).toBeGreaterThan(0);
    const fresh = checkAchievements(s);
    expect(fresh).toContain('first_win');
    expect(checkAchievements(s)).toEqual([]);
    expect(claimableAchievements(s)).toBe(fresh.length);
    const crowns = s.crowns;
    // Rewards are crowns now: gold belongs to the run.
    expect(claimAchievement(s, 'first_win')).toBe(1);
    expect(s.crowns).toBe(crowns + 1);
    expect(claimAchievement(s, 'first_win')).toBe(0);
  });

  it('counts runs', () => {
    const s = newGame(0);
    s.stats.runs = 5;
    expect(checkAchievements(s)).toContain('runs_5');
  });
});
