import { describe, expect, it } from 'vitest';
import { arrangeEnemies, FORMATION_IDS } from '../src/game/formations';
import { ALL_LEVELS, enemyPlacements } from '../src/game/levels';
import { levelTerrain, walkable } from '../src/game/terrain';
import { levelFormation, newGame } from '../src/game/state';

describe('living enemies', () => {
  it('every level and seed gives a legal layout: on walkable cells, no overlaps, the king kept', () => {
    for (const level of ALL_LEVELS) {
      const drawn = enemyPlacements(level);
      const terrain = levelTerrain(level.id);
      for (let seed = 0; seed < 12; seed++) {
        const { pieces } = arrangeEnemies(drawn, terrain, `${seed}:${level.id}`);
        const cells = new Set(pieces.map((p) => `${p.x},${p.y}`));
        expect(cells.size, level.id).toBe(pieces.length);
        for (const p of pieces) {
          expect(walkable(terrain[p.y * 8 + p.x]), `${level.id} ${p.kind} ${p.x},${p.y}`).toBe(true);
          expect(p.y, level.id).toBeLessThan(4);
        }
        expect(pieces.filter((p) => p.kind === 'king').length).toBe(drawn.filter((p) => p.kind === 'king').length);
        expect(pieces.length).toBeGreaterThanOrEqual(drawn.length);
      }
    }
  });

  it('is the same within a run and differs between runs', () => {
    const a = newGame(0);
    const b = newGame(0);
    b.run.seed = a.run.seed + 1;
    const layouts = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      a.run.seed = seed;
      layouts.add(levelFormation(a, '2-4').formation);
      expect(levelFormation(a, '2-4')).toEqual(levelFormation(a, '2-4'));
    }
    expect(layouts.size).toBeGreaterThan(4);
    expect(FORMATION_IDS.length).toBe(8);
  });

  it('keeps the teaching battles and the bosses as drawn', () => {
    const s = newGame(0);
    for (const id of ['1-1', '1-2', '1-3', '1-9', '2-9']) {
      expect(levelFormation(s, id).formation, id).toBe('classic');
    }
  });
});
