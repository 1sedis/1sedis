import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle, type BattleEvent, type BattleSetup } from '../src/game/battle';

const base = (allyBranches: BattleSetup['allyBranches'] = {}): BattleSetup => ({
  allies: [
    { kind: 'king', x: 3, y: 7, level: 5 },
    { kind: 'pawn', x: 3, y: 5, level: 5 },
    { kind: 'rook', x: 0, y: 7, level: 5 },
  ],
  enemies: [
    { kind: 'king', x: 4, y: 0, level: 5 },
    { kind: 'rook', x: 0, y: 0, level: 5 },
  ],
  allyBranches,
});

describe('ability branches', () => {
  it('a charging pawn has no shield and moves faster', () => {
    const shield = createBattle(base()).units.find((u) => u.kind === 'pawn' && u.side === 'ally')!;
    const charge = createBattle(base({ pawn: 1 })).units.find((u) => u.kind === 'pawn' && u.side === 'ally')!;
    expect(shield.shield).toBeGreaterThan(0);
    expect(charge.shield).toBe(0);
    expect(charge.moveCd).toBeLessThan(shield.moveCd);
  });

  it('a fortress rook takes less damage in the same duel', () => {
    const hpAfter = (branch: 0 | 1) => {
      const b = createBattle(base({ rook: branch }));
      for (let i = 0; i < 60; i++) stepBattle(b);
      const r = b.units.find((u) => u.kind === 'rook' && u.side === 'ally')!;
      return r.hp / r.maxHp;
    };
    expect(hpAfter(1)).toBeGreaterThan(hpAfter(0));
  });

  it('enemies never use the alternative and labels name the chosen ability', () => {
    const all: BattleEvent[] = [];
    const r = createBattle({ ...base({ bishop: 1 }), allies: [...base().allies, { kind: 'bishop', x: 5, y: 6, level: 5 }],
      enemies: [...base().enemies, { kind: 'bishop', x: 2, y: 1, level: 5 }] });
    while (!r.result) { stepBattle(r); all.push(...r.events); }
    const labels = (side: string) => new Set(all.filter((e) => e.type === 'ability' && e.side === side && e.fromKind === 'bishop').map((e) => e.label));
    expect([...labels('enemy')].every((l) => l === 'Благословение')).toBe(true);
    expect([...labels('ally')].every((l) => l === 'Проклятье')).toBe(true);
  });
});

describe('synergies', () => {
  it('three pawns form a phalanx with more health', async () => {
    const { synergyBonus, synergyProgress } = await import('../src/game/synergies');
    expect(synergyBonus(['king', 'pawn', 'pawn'], 'pawn').hp).toBe(1);
    expect(synergyBonus(['king', 'pawn', 'pawn', 'pawn'], 'pawn').hp).toBeCloseTo(1.2);
    expect(synergyBonus(['king', 'pawn', 'pawn', 'pawn'], 'knight').hp).toBe(1);
    const full = synergyProgress(['pawn', 'knight', 'bishop', 'rook', 'queen']).find((p) => p.def.id === 'fullSet')!;
    expect(full.active).toBe(true);
    const b = createBattle({ ...base(), allies: [...base().allies, { kind: 'pawn', x: 2, y: 5, level: 5 }, { kind: 'pawn', x: 4, y: 5, level: 5 }] });
    const pawn = b.units.find((u) => u.kind === 'pawn' && u.side === 'ally')!;
    const lone = createBattle(base()).units.find((u) => u.kind === 'pawn' && u.side === 'ally')!;
    expect(pawn.maxHp).toBeGreaterThan(lone.maxHp);
  });
});
