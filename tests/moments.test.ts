import { describe, expect, it } from 'vitest';
import { createBattle, moveMoment, type Placement } from '../src/game/battle';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });
const battle = (allies: Placement[], enemies: Placement[]) => createBattle({ allies, enemies, playerMoves: 2 });

describe('move moments', () => {
  it('a pawn one step from the last rank asks to be moved', () => {
    const b = battle([p('king', 3, 7), p('pawn', 1, 1)], [p('king', 7, 0)]);
    expect(moveMoment(b)).toMatchObject({ kind: 'promote', x: 1, y: 0 });
  });

  it('points at the most valuable capture', () => {
    const b = battle([p('king', 3, 7), p('rook', 0, 6)], [p('king', 7, 0), p('pawn', 1, 6), p('queen', 0, 2)]);
    expect(moveMoment(b)).toMatchObject({ kind: 'capture', target: 'queen', x: 0, y: 2 });
  });

  it('offers to pull a wounded piece out of a threatened cell', () => {
    const b = battle([p('king', 0, 7), p('knight', 4, 4)], [p('king', 7, 0), p('rook', 4, 0)]);
    const knight = b.units.find((u) => u.kind === 'knight')!;
    knight.hp = knight.maxHp * 0.2;
    const m = moveMoment(b);
    expect(m).toMatchObject({ kind: 'escape', uid: knight.uid });
    expect(m!.x).not.toBe(4);
  });

  it('stays quiet with no moves left or nothing to gain', () => {
    const b = battle([p('king', 3, 7), p('pawn', 3, 6)], [p('king', 3, 0)]);
    expect(moveMoment(b)).toBeNull();
    const c = battle([p('king', 3, 7), p('pawn', 1, 1)], [p('king', 7, 0)]);
    c.movesLeft = 0;
    expect(moveMoment(c)).toBeNull();
  });
});
