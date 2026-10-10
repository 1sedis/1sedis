import { describe, expect, it } from 'vitest';
import { MAX_TICKS, createBattle, simulate } from '../src/game/battle';
import { newGame } from '../src/game/state';

describe('battle', () => {
  it('the starting pawn beats wave 1', () => {
    expect(simulate(createBattle(newGame()))).toBe('win');
  });

  it('is deterministic for the same state', () => {
    const s = newGame();
    s.wave = 6;
    const a = createBattle(s);
    const b = createBattle(s);
    simulate(a);
    simulate(b);
    expect(a.tick).toBe(b.tick);
    expect(a.result).toBe(b.result);
  });

  it('a lone pawn loses to a late wave within the time limit', () => {
    const s = newGame();
    s.wave = 30;
    const b = createBattle(s);
    expect(simulate(b)).toBe('loss');
    expect(b.tick).toBeLessThanOrEqual(MAX_TICKS);
  });

  it('an empty army loses immediately', () => {
    const s = newGame();
    s.pieces = [];
    const b = createBattle(s);
    expect(simulate(b)).toBe('loss');
    expect(b.tick).toBe(1);
  });
});
