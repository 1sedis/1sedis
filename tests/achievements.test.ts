import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { createBattle, simulate } from '../src/game/battle';
import {
  battleSetup, checkAchievements, claimAchievement, claimableAchievements, collectTreasury, newGame, placeFromReserve, recordResult,
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
    const gold = s.gold;
    expect(claimAchievement(s, 'first_win')).toBe(50);
    expect(s.gold).toBe(gold + 50);
    expect(claimAchievement(s, 'first_win')).toBe(0);
  });

  it('counts treasury collections', () => {
    const s = newGame(0);
    s.treasury = 12000.7;
    collectTreasury(s);
    expect(s.stats.treasuryCollected).toBe(12000);
    expect(checkAchievements(s)).toContain('treasurer');
  });
});
