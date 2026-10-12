import { describe, expect, test } from 'vitest';
import { BLACK_KING_HP, DISTORTION_ORDER, distortionsFor } from '../src/game/distortions';
import { withElites } from '../src/game/elites';
import { ALL_LEVELS, enemyPlacements, getLevel } from '../src/game/levels';
import { levelTerrain, walkable, withDarkness } from '../src/game/terrain';
import { createBattle, stepBattle } from '../src/game/battle';
import { battleSetup, levelDistortions, newGame, terrainFor } from '../src/game/state';
import { CHRONICLE, LORE, chronicleAt } from '../src/game/story';

describe('distortions', () => {
  test('they pile up through games 2 and 3, then take turns', () => {
    expect(distortionsFor(1, 4)).toEqual([]);
    expect(distortionsFor(2, 1)).toEqual(['awakening']);
    expect(distortionsFor(2, 3)).toEqual(['awakening', 'darkness']);
    expect(distortionsFor(3, 2)).toEqual(['awakening', 'darkness', 'guard']);
    expect(distortionsFor(3, 4)).toEqual(DISTORTION_ORDER);
    expect([4, 5, 6, 7, 8].map((g) => distortionsFor(g, 1)[0])).toEqual([...DISTORTION_ORDER, DISTORTION_ORDER[0]]);
  });

  test('never in the finale', () => {
    const s = newGame(0);
    s.prestige = 2;
    expect(levelDistortions(s, '1-1')).toContain('darkness');
    expect(levelDistortions(s, 'final-1')).toEqual([]);
  });

  test('the chronicle is told over games 2 and 3 and every chapter has a moment', () => {
    expect(CHRONICLE.map((b) => b.lore)).toEqual(LORE.map((_, i) => i));
    expect(chronicleAt(2, 'start')).toBe(0);
    expect(chronicleAt(2, '3-1')).toBe(1);
    expect(chronicleAt(3, 'start')).toBe(2);
    expect(chronicleAt(3, '3-1')).toBe(3);
    expect(chronicleAt(7, 'start')).toBe(5);
    expect(chronicleAt(1, 'start')).toBeNull();
  });

  test('darkness adds two mirrored pairs on plain cells only', () => {
    for (const l of ALL_LEVELS) {
      const plain = levelTerrain(l.id);
      const dark = levelTerrain(l.id, true);
      const cells = dark.map((t, i) => (t === 'dark' ? i : -1)).filter((i) => i >= 0);
      expect(cells.length).toBe(4);
      for (const i of cells) {
        expect(plain[i]).toBe('plain');
        const x = i % 8, y = Math.floor(i / 8);
        expect(dark[y * 8 + 7 - x]).toBe('dark');
        expect(y >= 3 && y <= 5).toBe(true);
      }
      expect(dark.filter((t) => !walkable(t)).length).toBe(plain.filter((t) => !walkable(t)).length);
    }
    expect(withDarkness('1-1', undefined).join('')).toContain('x');
  });

  test('dark cells drain allies but never kill, and heal enemies', () => {
    const rows = ['........', '........', '........', '........', '........', 'x......x', '........', '........'];
    const b = createBattle({
      allies: [{ kind: 'king', x: 0, y: 5, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 5, level: 1 }],
      terrain: rows,
    });
    const king = b.units.find((u) => u.side === 'ally')!;
    const foe = b.units.find((u) => u.side === 'enemy')!;
    foe.hp = foe.maxHp / 2;
    king.wait = foe.wait = 1e6;
    for (let i = 0; i < 400; i++) stepBattle(b);
    expect(king.hp).toBeGreaterThan(0);
    expect(king.hp).toBeLessThan(king.maxHp * 0.1);
    expect(foe.hp).toBe(foe.maxHp);
  });

  test('black guard puts elites into chapter 1, even among pawns', () => {
    const plain = withElites('1-3', enemyPlacements(getLevel('1-3')));
    const guard = withElites('1-3', enemyPlacements(getLevel('1-3')), true);
    expect(plain.some((p) => p.trait)).toBe(false);
    expect(guard.filter((p) => p.trait).length).toBe(1);
    expect(withElites('4-7', enemyPlacements(getLevel('4-7')), true).filter((p) => p.trait).length).toBe(4);
  });

  test('awakening and the black king reach the battle setup', () => {
    const s = newGame(0);
    s.prestige = 1;
    expect(battleSetup(s, '1-1').enemyAbilityShift).toBe(3);
    s.prestige = 2;
    const setup = battleSetup(s, '3-1');
    expect(setup.enemyKingHp).toBe(BLACK_KING_HP);
    const b = createBattle(setup);
    const king = b.units.find((u) => u.side === 'enemy' && u.kind === 'king' && !u.boss)!;
    const plain = createBattle({ ...setup, enemyKingHp: 1 }).units.find((u) => u.side === 'enemy' && u.kind === 'king')!;
    expect(Math.abs(king.maxHp - plain.maxHp * BLACK_KING_HP)).toBeLessThanOrEqual(1);
    s.prestige = 1;
    expect(terrainFor(s, '1-1').includes('dark')).toBe(false);
    expect(terrainFor(s, '3-1').includes('dark')).toBe(true);
  });
});
