import { describe, expect, it } from 'vitest';
import { abilityTier } from '../src/game/abilities';
import { createBattle, stepBattle, type Battle, type Placement } from '../src/game/battle';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

function run(b: Battle, ticks: number) {
  const events = [];
  for (let i = 0; i < ticks && !b.result; i++) {
    stepBattle(b);
    events.push(...b.events);
  }
  return events;
}

describe('abilities', () => {
  it('unlock at level 5 and empower at level 10', () => {
    expect([1, 4, 5, 9, 10, 20].map(abilityTier)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('pawns start with a shield that absorbs damage first', () => {
    const b = createBattle({ allies: [p('king', 0, 7), p('pawn', 4, 5, 10)], enemies: [p('king', 7, 0), p('pawn', 4, 4)] });
    const pawn = b.units.find((u) => u.side === 'ally' && u.kind === 'pawn')!;
    expect(pawn.shield).toBeCloseTo(pawn.maxHp * 0.6);
    run(b, 30);
    expect(pawn.hp).toBe(pawn.maxHp);
    expect(pawn.shield).toBeLessThan(pawn.maxShield);
  });

  it('enemies of level 5+ use abilities too, weaker ones do not', () => {
    const b = createBattle({ allies: [p('king', 0, 7)], enemies: [p('king', 7, 0, 4), p('pawn', 4, 4, 10)] });
    const [king, pawn] = b.units.filter((u) => u.side === 'enemy');
    expect(king.tier).toBe(0);
    expect(pawn.tier).toBe(2);
    expect(pawn.shield).toBeGreaterThan(0);
  });

  it('a rook volley hits every enemy on its line, through blockers', () => {
    const b = createBattle({
      allies: [p('king', 7, 7), p('rook', 0, 7, 5)],
      enemies: [p('king', 7, 0), p('pawn', 0, 2), p('pawn', 0, 1)],
    });
    const back = b.units.find((u) => u.side === 'enemy' && u.y === 1)!;
    b.units.find((u) => u.kind === 'rook')!.abilityTimer = 0;
    const events = run(b, 3);
    expect(events.some((e) => e.type === 'ability' && e.label === 'Залп')).toBe(true);
    // The back pawn is hidden behind the front one, yet the volley reaches it.
    expect(events.some((e) => e.type === 'hit' && e.uid === back.uid && e.fromKind === 'rook')).toBe(true);
  });

  it('a bishop heals a wounded ally nearby', () => {
    const b = createBattle({ allies: [p('king', 0, 7), p('bishop', 2, 7, 5), p('rook', 3, 6)], enemies: [p('king', 7, 0)] });
    const rook = b.units.find((u) => u.kind === 'rook')!;
    rook.hp = rook.maxHp * 0.3;
    b.units.find((u) => u.kind === 'bishop')!.abilityTimer = 0;
    const events = run(b, 3);
    expect(events.some((e) => e.type === 'heal' && e.uid === rook.uid)).toBe(true);
  });

  it('the king rally raises allied damage for a while', () => {
    const b = createBattle({ allies: [p('king', 3, 7, 5), p('pawn', 4, 6)], enemies: [p('king', 7, 0)] });
    b.units.find((u) => u.kind === 'king' && u.side === 'ally')!.abilityTimer = 0;
    run(b, 3);
    const pawn = b.units.find((u) => u.kind === 'pawn')!;
    expect(pawn.rallyMult).toBeCloseTo(1.25);
    expect(pawn.rallyUntil).toBeGreaterThan(b.tick);
  });
});
