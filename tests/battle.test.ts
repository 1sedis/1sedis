import { describe, expect, it } from 'vitest';
import { createBattle, simulate, stepBattle, type Placement } from '../src/game/battle';
import { ALL_LEVELS, enemyPlacements } from '../src/game/levels';
import { battleSetup, newGame } from '../src/game/state';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

describe('battle rules', () => {
  it('the starting army wins the first level', () => {
    expect(simulate(createBattle(battleSetup(newGame(), '1-1')))).toBe('win');
  });

  it('losing the king loses the battle even with pieces left', () => {
    const b = createBattle({
      allies: [p('king', 0, 7), p('pawn', 7, 5)],
      enemies: [p('king', 7, 0), p('queen', 0, 5, 10)],
    });
    expect(simulate(b)).toBe('loss');
    expect(b.units.some((u) => u.side === 'ally' && u.kind === 'pawn' && u.hp > 0)).toBe(true);
  });

  it('killing the enemy king wins immediately', () => {
    const b = createBattle({
      allies: [p('king', 4, 7), p('rook', 0, 7, 20)],
      enemies: [p('king', 0, 0), p('pawn', 6, 0)],
    });
    expect(simulate(b)).toBe('win');
    expect(b.units.some((u) => u.side === 'enemy' && u.kind === 'pawn' && u.hp > 0)).toBe(true);
  });

  it('a pawn reaching the last row becomes a queen', () => {
    const b = createBattle({
      allies: [p('king', 7, 7), p('pawn', 0, 1)],
      enemies: [p('king', 7, 3)],
    });
    let promoted = false;
    for (let i = 0; i < 50 && !b.result; i++) {
      stepBattle(b);
      if (b.events.some((e) => e.type === 'promote')) promoted = true;
    }
    expect(promoted).toBe(true);
    expect(b.units.find((u) => u.side === 'ally' && u.promoted)?.kind).toBe('queen');
  });

  it('pieces on the line block ranged attacks', () => {
    const shotAtKing = (blocked: boolean) => {
      // The ally king stays put while unthreatened, so it blocks the file in front of the rook.
      const king = blocked ? p('king', 0, 6) : p('king', 7, 7);
      // The target is a pawn on the file: kings now step out of the line of fire.
      const b = createBattle({ allies: [king, p('rook', 0, 7)], enemies: [p('king', 7, 0), p('pawn', 0, 1)] });
      for (let i = 0; i < 5; i++) {
        stepBattle(b);
        if (b.events.some((e) => e.type === 'hit' && e.fromX === 0 && e.fromY === 7)) return true;
      }
      return false;
    };
    expect(shotAtKing(false)).toBe(true);
    expect(shotAtKing(true)).toBe(false);
  });

  it('is deterministic', () => {
    const run = () => {
      const b = createBattle(battleSetup(newGame(), '1-3'));
      simulate(b);
      return [b.tick, b.result, b.allyLosses];
    };
    expect(run()).toEqual(run());
  });
});

describe('levels', () => {
  it('every level has exactly one enemy king and fits the enemy rows', () => {
    for (const level of ALL_LEVELS) {
      expect(level.rows).toHaveLength(3);
      for (const row of level.rows) expect(row).toHaveLength(8);
      const enemies = enemyPlacements(level);
      expect(enemies.filter((e) => e.kind === 'king')).toHaveLength(1);
      if (level.boss) expect(enemies.some((e) => e.boss)).toBe(true);
    }
  });
});
