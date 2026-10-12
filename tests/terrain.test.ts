import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle, threatMap, type BattleSetup } from '../src/game/battle';
import { ALL_LEVELS, enemyPlacements, getLevel } from '../src/game/levels';
import { levelTerrain, levelTerrainRows, walkable } from '../src/game/terrain';
import { isPlayerCell } from '../src/game/state';

const plain = ['........', '........', '........', '........', '........', '........', '........', '........'];
const withRow = (y: number, row: string) => plain.map((r, i) => (i === y ? row : r));

describe('terrain maps', () => {
  it('are 8x8 and never put an enemy on rock or water', () => {
    const ids = ALL_LEVELS.map((l) => l.id);
    for (const id of ids) {
      const rows = levelTerrainRows(id);
      if (!rows) continue;
      expect(rows, id).toHaveLength(8);
      for (const r of rows) expect(r, id).toHaveLength(8);
      const t = levelTerrain(id);
      for (const p of enemyPlacements(getLevel(id))) expect(walkable(t[p.y * 8 + p.x]), `${id} ${p.x},${p.y}`).toBe(true);
    }
  });

  it('player cannot deploy on rock or water', () => {
    expect(isPlayerCell(0, 5)).toBe(true);
    // 1-9 has forest on row 5 (walkable); 3-2 has no blocked player cells; build a check from the map itself
    for (const l of ALL_LEVELS) {
      const t = levelTerrain(l.id);
      for (let x = 0; x < 8; x++) for (const y of [5, 6, 7]) expect(isPlayerCell(x, y, l.id)).toBe(walkable(t[y * 8 + x]));
    }
  });
});

describe('terrain rules', () => {
  const rookDuel = (terrain?: string[]): BattleSetup => ({
    allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'pawn', x: 0, y: 7, level: 1 }],
    enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 0, y: 0, level: 1 }],
    terrain,
  });

  it('rock blocks a rook line, water does not', () => {
    const open = threatMap(rookDuel());
    const rock = threatMap(rookDuel(withRow(3, '#.......')));
    const water = threatMap(rookDuel(withRow(3, '~.......')));
    expect(open[6 * 8 + 0]).toBeGreaterThan(0);
    expect(rock[6 * 8 + 0]).toBe(0);
    expect(water[6 * 8 + 0]).toBeGreaterThan(0);
  });

  it('forest reduces damage taken, hills raise a shooter’s damage', () => {
    const duel = (terrain?: string[]) => {
      const b = createBattle({
        allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'pawn', x: 0, y: 5, level: 1 }],
        enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 0, y: 1, level: 1 }],
        terrain,
      });
      for (let i = 0; i < 40; i++) stepBattle(b);
      const pawn = b.units.find((u) => u.side === 'ally' && u.kind === 'pawn');
      return pawn ? pawn.maxHp - pawn.hp : Infinity;
    };
    const base = duel();
    expect(duel(withRow(5, 'f.......'))).toBeLessThan(base);
    expect(duel(withRow(1, '^.......'))).toBeGreaterThan(base);
  });

  it('a pawn never enters water and steps around it', () => {
    const terrain = withRow(4, '~.......');
    const b = createBattle({
      allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'pawn', x: 0, y: 5, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'pawn', x: 7, y: 1, level: 1 }],
      terrain,
    });
    let moved = false;
    for (let i = 0; i < 60; i++) {
      stepBattle(b);
      const pawn = b.units.find((u) => u.side === 'ally' && u.kind === 'pawn');
      if (!pawn) break;
      expect(pawn.x === 0 && pawn.y === 4).toBe(false);
      if (pawn.x === 1 && pawn.y <= 4) moved = true;
    }
    expect(moved).toBe(true);
  });
});
