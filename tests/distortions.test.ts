import { describe, expect, test } from 'vitest';
import { DISTORTION_ORDER, distortionFor } from '../src/game/distortions';
import { withElites } from '../src/game/elites';
import { ALL_LEVELS, enemyPlacements, getLevel } from '../src/game/levels';
import { levelTerrain, walkable, withDarkness } from '../src/game/terrain';
import { createBattle, stepBattle } from '../src/game/battle';
import { battleSetup, levelDistortion, newGame, terrainFor } from '../src/game/state';

describe('distortions', () => {
  test('game 1 has none, games 2-5 bring each one, then they cycle', () => {
    expect(distortionFor(1)).toBeNull();
    expect([2, 3, 4, 5].map(distortionFor)).toEqual(DISTORTION_ORDER);
    expect(distortionFor(6)).toBe(DISTORTION_ORDER[0]);
  });

  test('never in the abyss', () => {
    const s = newGame(0);
    s.prestige = 2;
    expect(levelDistortion(s, '1-1')).toBe('darkness');
    expect(levelDistortion(s, 'abyss-5')).toBeNull();
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
    s.prestige = 4;
    const setup = battleSetup(s, '1-1');
    expect(setup.enemyKingHp).toBe(2);
    const b = createBattle(setup);
    const king = b.units.find((u) => u.side === 'enemy' && u.kind === 'king')!;
    const plain = createBattle({ ...setup, enemyKingHp: 1 }).units.find((u) => u.side === 'enemy' && u.kind === 'king')!;
    expect(king.maxHp).toBeCloseTo(plain.maxHp * 2, 0);
    s.prestige = 2;
    expect(terrainFor(s, '1-1').includes('dark')).toBe(true);
  });
});
