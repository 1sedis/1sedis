import { describe, expect, it } from 'vitest';
import { createBattle, simulate, type Placement } from '../src/game/battle';
import { buildReport, square } from '../src/game/report';

const p = (kind: Placement['kind'], x: number, y: number, level = 1): Placement => ({ kind, x, y, level });

describe('battle report', () => {
  it('uses chess notation', () => {
    expect(square(0, 7)).toBe('a1');
    expect(square(7, 0)).toBe('h8');
    expect(square(4, 4)).toBe('e4');
  });

  it('names who killed the king and gives a concrete tip', () => {
    const b = createBattle({ allies: [p('king', 3, 7)], enemies: [p('king', 7, 0), p('queen', 3, 4, 12)] });
    simulate(b);
    const r = buildReport(b);
    expect(b.result).toBe('loss');
    expect(r.lossReason).toMatch(/ферзь с [a-h][1-8]/);
    expect(r.tips.length).toBeGreaterThan(0);
  });

  it('on a win lists the player pieces with an MVP and no loss reason', () => {
    const b = createBattle({ allies: [p('king', 3, 7), p('rook', 0, 7, 10), p('pawn', 7, 5)], enemies: [p('king', 0, 0)] });
    simulate(b);
    const r = buildReport(b);
    expect(b.result).toBe('win');
    expect(r.lossReason).toBeNull();
    expect(r.mvp?.kind).toBe('rook');
    expect(r.allies.reduce((sum, a) => sum + a.dealt, 0)).toBeGreaterThan(0);
  });

  it('damage dealt never exceeds the health that was there to take', () => {
    const b = createBattle({ allies: [p('king', 3, 7), p('queen', 3, 3, 20)], enemies: [p('king', 3, 0), p('pawn', 3, 1)] });
    simulate(b);
    const totalDealt = Object.values(b.report).filter((r) => r.side === 'ally').reduce((s, r) => s + r.dealt, 0);
    const totalTaken = Object.values(b.report).filter((r) => r.side === 'enemy').reduce((s, r) => s + r.taken, 0);
    expect(totalDealt).toBeCloseTo(totalTaken);
  });
});

describe('threat map', () => {
  it('marks an open file under an enemy rook and clears it behind a blocker', async () => {
    const { threatMap } = await import('../src/game/battle');
    const open = threatMap({ allies: [p('king', 0, 7)], enemies: [p('king', 7, 0), p('rook', 3, 0)] });
    expect(open[7 * 8 + 3]).toBe(1); // d1 is on the rook's file
    const blocked = threatMap({ allies: [p('king', 0, 7), p('pawn', 3, 5)], enemies: [p('king', 7, 0), p('rook', 3, 0)] });
    expect(blocked[7 * 8 + 3]).toBe(0); // the pawn on d3 shields d1
    expect(blocked[5 * 8 + 3]).toBe(1); // the pawn itself is under fire
  });
});
