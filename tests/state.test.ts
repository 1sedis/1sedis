import { describe, expect, it } from 'vitest';
import {
  BASE_SLOTS, applyDefeat, buyPiece, buyUpgrade, crownsForWave, grantVictory, maxSlots,
  movePiece, newGame, pieceCost, placedPieces, prestige,
} from '../src/game/state';

describe('economy', () => {
  it('buying a piece spends gold and raises the next price', () => {
    const s = newGame();
    s.gold = 100;
    const first = pieceCost(s, 'pawn');
    expect(buyPiece(s, 'pawn')).toBe(true);
    expect(s.gold).toBe(100 - first);
    expect(pieceCost(s, 'pawn')).toBeGreaterThan(first);
  });

  it('refuses locked pieces and purchases without gold', () => {
    const s = newGame();
    s.gold = 1e9;
    expect(buyPiece(s, 'queen')).toBe(false);
    s.gold = 0;
    expect(buyPiece(s, 'pawn')).toBe(false);
  });

  it('merges three identical pieces into one with an extra star', () => {
    const s = newGame();
    s.gold = 1000;
    buyPiece(s, 'pawn');
    buyPiece(s, 'pawn');
    expect(s.pieces).toHaveLength(1);
    expect(s.pieces[0].stars).toBe(2);
    expect(s.pieces[0].pos).not.toBeNull();
  });

  it('upgrades respect max level', () => {
    const s = newGame();
    s.gold = 1e12;
    for (let i = 0; i < 20; i++) buyUpgrade(s, 'slots');
    expect(maxSlots(s)).toBe(BASE_SLOTS + 13);
  });
});

describe('formation', () => {
  it('limits placed pieces to the slot count and swaps occupants', () => {
    const s = newGame();
    s.gold = 1e6;
    buyPiece(s, 'knight'); // locked at wave 1
    s.wave = 5;
    buyPiece(s, 'knight');
    buyPiece(s, 'bishop');
    buyPiece(s, 'pawn'); // fourth piece: no slot left
    expect(placedPieces(s)).toHaveLength(BASE_SLOTS);
    const benched = s.pieces.find((p) => p.pos === null)!;
    expect(movePiece(s, benched.id, { x: 0, y: 7 })).toBe(false);
    const placed = placedPieces(s)[0];
    const target = { ...placed.pos! };
    expect(movePiece(s, benched.id, target)).toBe(true);
    expect(placed.pos).toBeNull();
    expect(movePiece(s, placed.id, { x: 0, y: 0 })).toBe(false);
  });
});

describe('progress', () => {
  it('victory pays out and advances, defeat steps back', () => {
    const s = newGame();
    const reward = grantVictory(s);
    expect(reward).toBeGreaterThan(0);
    expect(s.wave).toBe(2);
    expect(s.bestWave).toBe(1);
    applyDefeat(s);
    applyDefeat(s);
    expect(s.wave).toBe(1);
  });

  it('prestige resets the run and grants crowns', () => {
    const s = newGame();
    s.bestWave = 20;
    s.gold = 5000;
    const gain = crownsForWave(20);
    expect(gain).toBeGreaterThan(0);
    expect(prestige(s)).toBe(true);
    expect(s.crowns).toBe(gain);
    expect(s.gold).toBe(newGame().gold);
    expect(s.stats.prestiges).toBe(1);
  });

  it('prestige is unavailable before the threshold', () => {
    const s = newGame();
    s.bestWave = 10;
    expect(prestige(s)).toBe(false);
  });
});
