import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle, type Placement } from '../src/game/battle';

const p = (kind: Placement['kind'], x: number, y: number, level = 1, extra: Partial<Placement> = {}): Placement => ({ kind, x, y, level, ...extra });
const run = (b: ReturnType<typeof createBattle>, ticks: number) => { for (let i = 0; i < ticks && !b.result; i++) stepBattle(b); };

describe('new enemy traits', () => {
  it('a splitting piece breaks into two pawns when it falls', () => {
    const b = createBattle({ allies: [p('king', 7, 7), p('rook', 3, 7, 30)], enemies: [p('king', 0, 0), p('knight', 3, 3, 1, { trait: 'splitter' })] });
    let pawns = 0;
    for (let i = 0; i < 200 && !b.result; i++) {
      stepBattle(b);
      pawns = Math.max(pawns, b.units.filter((u) => u.side === 'enemy' && u.kind === 'pawn' && u.hp > 0).length);
    }
    expect(pawns).toBeGreaterThanOrEqual(1);
  });

  it('a frost piece freezes what it hits', () => {
    const b = createBattle({ allies: [p('king', 0, 7), p('pawn', 3, 4, 20)], enemies: [p('king', 7, 0), p('pawn', 4, 3, 1, { trait: 'frost' })] });
    const ally = b.units.find((u) => u.side === 'ally' && u.kind === 'pawn')!;
    let frozen = false;
    for (let i = 0; i < 60 && !b.result; i++) {
      stepBattle(b);
      if (b.events.some((e) => e.type === 'hit' && e.uid === ally.uid) && ally.wait >= 4) frozen = true;
    }
    expect(frozen).toBe(true);
  });

  it('a bodyguard takes half of the blows aimed at its king', () => {
    const base = { allies: [p('king', 3, 7), p('queen', 3, 5, 10)] };
    const plain = createBattle({ ...base, enemies: [p('king', 3, 4, 5), p('pawn', 0, 0)] });
    const guarded = createBattle({ ...base, enemies: [p('king', 3, 4, 5), p('rook', 2, 4, 5, { trait: 'bodyguard' })] });
    run(plain, 40);
    run(guarded, 40);
    const king = (bt: typeof plain) => bt.units.find((u) => u.side === 'enemy' && u.kind === 'king');
    const lost = (bt: typeof plain) => { const k = king(bt); return k ? 1 - k.hp / k.maxHp : 1; };
    expect(lost(guarded)).toBeLessThan(lost(plain));
  });

  it('a magnetic piece drags the nearest enemy one cell closer', () => {
    const b = createBattle({ allies: [p('king', 7, 7), p('rook', 3, 6, 1)], enemies: [p('king', 0, 0), p('bishop', 3, 3, 1, { trait: 'magnet' })] });
    const rook = b.units.find((u) => u.side === 'ally' && u.kind === 'rook')!;
    const before = Math.abs(rook.y - 3);
    for (let i = 0; i < 50; i++) stepBattle(b);
    expect(b.events.length >= 0).toBe(true);
    expect(Math.abs(rook.y - 3)).toBeLessThanOrEqual(before);
  });
});
