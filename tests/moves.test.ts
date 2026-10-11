import { describe, expect, test } from 'vitest';
import {
  CAPTURE_ROYAL, CAPTURE_STUN, MOVES_PER_BATTLE, createBattle, legalMoves, playMove, resolveDecision, simulate, stepBattle, type BattleSetup,
} from '../src/game/battle';

const base = (extra: Partial<BattleSetup> = {}): BattleSetup => ({
  allies: [{ kind: 'king', x: 4, y: 7, level: 1 }],
  enemies: [{ kind: 'king', x: 4, y: 0, level: 1 }],
  playerMoves: MOVES_PER_BATTLE,
  ...extra,
});
const ally = (b: ReturnType<typeof createBattle>, kind: string) => b.units.find((u) => u.side === 'ally' && u.kind === kind)!;
const cells = (moves: { x: number; y: number }[]) => moves.map((m) => `${m.x},${m.y}`).sort();

describe('player moves', () => {
  test('a knight jumps in an L, over pieces', () => {
    const b = createBattle(base({ allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'knight', x: 1, y: 7, level: 1 }] }));
    expect(cells(legalMoves(b, ally(b, 'knight').uid))).toEqual(['0,5', '2,5', '3,6']);
  });

  test('a rook slides until blocked and may capture the first enemy', () => {
    const b = createBattle(base({
      allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'rook', x: 0, y: 7, level: 1 }],
      enemies: [{ kind: 'king', x: 4, y: 0, level: 1 }, { kind: 'pawn', x: 0, y: 3, level: 1 }],
      terrain: ['........', '........', '........', '........', '........', '........', '........', '..#.....'],
    }));
    const moves = legalMoves(b, ally(b, 'rook').uid);
    expect(moves.filter((m) => m.type === 'capture').map((m) => `${m.x},${m.y}`)).toEqual(['0,3']);
    // Up the file to the pawn, right only to the rock.
    expect(cells(moves.filter((m) => m.type === 'move'))).toEqual(['0,4', '0,5', '0,6', '1,7']);
  });

  test('two moves per battle, then no more', () => {
    const b = createBattle(base({ allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'knight', x: 1, y: 7, level: 1 }] }));
    const n = ally(b, 'knight');
    expect(playMove(b, n.uid, 2, 5)).toBe(true);
    expect(playMove(b, n.uid, 3, 3)).toBe(true);
    expect(b.movesLeft).toBe(0);
    expect(playMove(b, n.uid, 4, 5)).toBe(false);
    expect([n.x, n.y]).toEqual([3, 3]);
  });

  test('a capture takes a piece off the board and the capturer takes its square', () => {
    const b = createBattle(base({
      allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'bishop', x: 0, y: 7, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 3, y: 4, level: 9 }],
    }));
    const bishop = ally(b, 'bishop');
    const rook = b.units.find((u) => u.kind === 'rook')!;
    expect(playMove(b, bishop.uid, 3, 4)).toBe(true);
    expect(rook.hp).toBeLessThanOrEqual(0);
    expect([bishop.x, bishop.y]).toEqual([3, 4]);
  });

  test('a king only reels: a fifth of its health and a stun, the capturer stops before it', () => {
    const b = createBattle(base({
      allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'rook', x: 7, y: 7, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 1, level: 9 }],
    }));
    const rook = ally(b, 'rook');
    const king = b.units.find((u) => u.side === 'enemy')!;
    expect(playMove(b, rook.uid, 7, 1)).toBe(true);
    expect(king.hp).toBeCloseTo(king.maxHp * (1 - CAPTURE_ROYAL), 0);
    expect(king.wait).toBeGreaterThanOrEqual(CAPTURE_STUN);
    expect([rook.x, rook.y]).toEqual([7, 2]);
  });

  test('castling swaps the king and the nearest rook, once', () => {
    const b = createBattle(base({ allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'rook', x: 7, y: 7, level: 1 }] }));
    const king = ally(b, 'king');
    expect(legalMoves(b, king.uid).some((m) => m.type === 'castle')).toBe(true);
    expect(playMove(b, king.uid, 7, 7)).toBe(true);
    expect([king.x, ally(b, 'rook').x]).toEqual([7, 4]);
    expect(legalMoves(b, king.uid).some((m) => m.type === 'castle')).toBe(false);
  });
});

describe('decisions', () => {
  const promoting = (decisions: boolean) => createBattle(base({
    allies: [{ kind: 'king', x: 0, y: 7, level: 1 }, { kind: 'pawn', x: 6, y: 1, level: 1 }],
    enemies: [{ kind: 'king', x: 1, y: 0, level: 1 }],
    decisions,
  }));

  test('a pawn reaching the last rank becomes a queen without asking', () => {
    const b = promoting(true);
    for (let i = 0; i < 60; i++) {
      stepBattle(b);
      expect(b.decision).toBeNull();
    }
    expect(ally(b, 'queen')).toBeTruthy();
  });

  test('the first check offers a way out; castling is one of them', () => {
    const b = createBattle(base({
      allies: [{ kind: 'king', x: 4, y: 7, level: 1 }, { kind: 'rook', x: 0, y: 7, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 4, y: 2, level: 1 }],
      decisions: true,
    }));
    for (let i = 0; i < 40 && !b.decision; i++) stepBattle(b);
    expect(b.decision?.kind).toBe('check');
    expect(b.decision?.options).toContain('castle');
    resolveDecision(b, 'castle');
    expect(ally(b, 'king').x).toBe(0);
    for (let i = 0; i < 100; i++) {
      stepBattle(b);
      expect(b.decision?.kind).not.toBe('check');
    }
  });

  test('simulations never stop for decisions', () => {
    const b = promoting(true);
    expect(simulate(b)).toMatch(/win|loss/);
  });
});
