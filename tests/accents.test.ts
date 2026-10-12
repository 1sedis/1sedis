import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../src/game/battle';
import { accentFor } from '../src/ui/accents';

const ev = (e: Partial<BattleEvent>): BattleEvent =>
  ({ type: 'hit', uid: 1, side: 'enemy', x: 0, y: 0, amount: 1, fromX: 0, fromY: 0, fromUid: 2, ...e }) as BattleEvent;

describe('battle accents', () => {
  it('plain hits pass without a beat', () => {
    expect(accentFor([ev({}), ev({ type: 'heal' })], undefined, 1)).toEqual({ stop: 0, punch: 0 });
  });

  it('crits, deaths and promotions hold the clock; the fall of a king holds it longest and punches', () => {
    expect(accentFor([ev({ crit: true })], undefined, 1).stop).toBe(50);
    expect(accentFor([ev({ type: 'death' })], undefined, 1).stop).toBe(70);
    expect(accentFor([ev({ type: 'promote' })], undefined, 1).stop).toBe(90);
    expect(accentFor([ev({ crit: true }), ev({ type: 'death', big: true })], undefined, 1)).toEqual({ stop: 220, punch: 2 });
  });

  it('the boss striking the army punches the board', () => {
    expect(accentFor([ev({ side: 'ally', fromUid: 9 })], 9, 1).punch).toBe(1);
    expect(accentFor([ev({ side: 'enemy', fromUid: 9 })], 9, 1).punch).toBe(0);
  });

  it('×2 halves the freeze, ×4 drops it', () => {
    expect(accentFor([ev({ type: 'death', big: true })], undefined, 2).stop).toBe(110);
    expect(accentFor([ev({ type: 'death', big: true })], undefined, 4)).toEqual({ stop: 0, punch: 2 });
  });
});
