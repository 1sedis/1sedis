import { describe, expect, test } from 'vitest';
import { createBattle, simulate, stepBattle } from '../src/game/battle';
import { FINALE_LEVELS, chapterOf, finaleId, getLevel, isFinale, nextLevelId } from '../src/game/levels';
import {
  FINALE_CROWNS, battleSetup, finaleLevel, isCleared, isFinaleOpen, isLevelOpen, levelDistortions, newGame, parseSave,
  prestige, recordResult,
} from '../src/game/state';

function opened() {
  const s = newGame(0);
  s.abyss.best = 30;
  s.army = { ...s.army, pawn: 4, knight: 2, bishop: 2, rook: 1, queen: 1 };
  for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = 12;
  return s;
}

describe('finale', () => {
  test('three phases in a row', () => {
    expect(FINALE_LEVELS.map((l) => l.id)).toEqual(['final-1', 'final-2', 'final-3']);
    expect(isFinale('final-2')).toBe(true);
    expect(nextLevelId('final-1')).toBe('final-2');
    expect(nextLevelId('final-3')).toBeNull();
    expect(chapterOf('final-1').name).toBe('Край доски');
    expect(getLevel(finaleId(3)).boss).toBe('Рука над доской');
  });

  test('opens in game 3 after the Black Queen, or at Abyss floor 30, and stays open', () => {
    const s = newGame(0);
    expect(isFinaleOpen(s)).toBe(false);
    s.abyss.best = 30;
    expect(isFinaleOpen(s)).toBe(true);
    s.abyss.best = 10;
    s.prestige = 2;
    expect(isFinaleOpen(s)).toBe(false);
    s.stars['4-9'] = 1;
    expect(isFinaleOpen(s)).toBe(true);
    s.stars = {};
    s.prestige = 3;
    expect(isFinaleOpen(s)).toBe(true);
    expect(levelDistortions(s, 'final-1')).toEqual([]);
  });

  test('phases open one by one and stay won across new games', () => {
    const s = opened();
    expect(isLevelOpen(s, 'final-1')).toBe(true);
    expect(isLevelOpen(s, 'final-2')).toBe(false);
    s.finale.phase = 1;
    expect(isCleared(s, 'final-1')).toBe(true);
    expect(isLevelOpen(s, 'final-2')).toBe(true);
    s.stars['4-9'] = 1;
    prestige(s);
    expect(s.finale.phase).toBe(1);
    expect(parseSave(JSON.stringify({ version: 2 }))!.finale).toEqual({ phase: 0, beaten: false });
  });

  test('enemy levels follow the army', () => {
    const s = opened();
    expect(finaleLevel(s)).toBe(12);
    expect(battleSetup(s, 'final-1').enemies.every((e) => e.level === 15)).toBe(true);
    expect(battleSetup(s, 'final-1').enemies.filter((e) => e.trait).length).toBe(7);
  });

  test('the mirror: your army in black and the Black King on your side', () => {
    const s = opened();
    const setup = battleSetup(s, 'final-2');
    expect(setup.enemies.length).toBe(s.formation.length);
    for (const f of s.formation) expect(setup.enemies.some((e) => e.kind === f.kind && e.x === f.x && e.y === 7 - f.y)).toBe(true);
    expect(setup.allies.filter((a) => a.kind === 'king').length).toBe(2);
    expect(setup.handMeddle).toBe(true);
    const b = createBattle(setup);
    let moved = false;
    for (let i = 0; i < 200 && !b.result; i++) {
      stepBattle(b);
      if (b.events.some((e) => e.type === 'hand')) moved = true;
    }
    expect(moved).toBe(true);
  });

  test('the Hand never moves, uses its skills and turns the board over', () => {
    const s = opened();
    const b = createBattle(battleSetup(s, 'final-3'));
    const hand = b.units.find((u) => u.uid === b.bossUid)!;
    expect(b.bossId).toBe('hand');
    const labels = new Set<string>();
    let flipped = false;
    hand.hp = hand.maxHp * 0.51;
    // Keep both armies still: only the Hand acts.
    for (const u of b.units) if (u !== hand) u.wait = 1e6;
    for (let i = 0; i < 600 && !b.result; i++) {
      const x = hand.x;
      stepBattle(b);
      for (const e of b.events) {
        if (e.type === 'boss' && e.label) labels.add(e.label);
        if (e.type === 'flip') flipped = true;
      }
      if (!b.events.some((e) => e.type === 'flip') && hand.hp > 0) expect(hand.x).toBe(x);
      if (i === 5) hand.hp = hand.maxHp * 0.49;
    }
    expect(flipped).toBe(true);
    expect(labels.has('Ладонь')).toBe(true);
    expect(labels.has('Перестановка')).toBe(true);
  });

  test('beating the Hand ends the story once and pays crowns', () => {
    const s = opened();
    s.finale.phase = 2;
    const b = createBattle(battleSetup(s, 'final-3'));
    b.result = 'win';
    const crowns = s.crowns;
    expect(recordResult(s, 'final-3', b).ending).toBe(true);
    expect(s.finale.beaten).toBe(true);
    expect(s.crowns).toBe(crowns + FINALE_CROWNS);
    expect(recordResult(s, 'final-3', b).ending).toBe(false);
    expect(s.crowns).toBe(crowns + FINALE_CROWNS);
  });

  test('every phase finishes', () => {
    const s = opened();
    for (const id of ['final-1', 'final-2', 'final-3']) {
      const b = createBattle(battleSetup(s, id));
      expect(simulate(b)).toMatch(/win|loss/);
    }
  });
});
