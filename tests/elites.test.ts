import { describe, expect, it } from 'vitest';
import { createBattle, stepBattle, type BattleSetup, type Placement } from '../src/game/battle';
import { withElites, type Trait } from '../src/game/elites';
import { ALL_LEVELS, enemyPlacements, getLevel } from '../src/game/levels';
import { battleSetup, newGame } from '../src/game/state';

const king = (side: 'a' | 'e'): Placement => ({ kind: 'king', x: 7, y: side === 'a' ? 7 : 0, level: 1 });

function duel(trait: Trait | undefined, attacker: Placement, defender: Placement, ticks = 60) {
  const setup: BattleSetup = { allies: [king('a'), attacker], enemies: [king('e'), { ...defender, trait }] };
  const b = createBattle(setup);
  for (let i = 0; i < ticks && !b.result; i++) stepBattle(b);
  const ally = b.units.find((u) => u.side === 'ally' && u.kind === attacker.kind);
  const enemy = b.units.find((u) => u.side === 'enemy' && u.kind === defender.kind);
  return { b, ally, enemy, allyLoss: ally ? ally.maxHp - ally.hp : Infinity, enemyLoss: enemy ? enemy.maxHp - enemy.hp : Infinity };
}

describe('elite assignment', () => {
  it('chapter 1 has no elites, later chapters do, and never on kings, bosses or pawns', () => {
    for (const l of ALL_LEVELS) {
      const elites = withElites(l.id, enemyPlacements(getLevel(l.id))).filter((p) => p.trait);
      if (l.id.startsWith('1-')) expect(elites, l.id).toHaveLength(0);
      for (const e of elites) {
        expect(e.kind).not.toBe('king');
        expect(e.kind).not.toBe('pawn');
        expect(e.boss).toBeFalsy();
      }
    }
    expect(withElites('4-7', enemyPlacements(getLevel('4-7'))).filter((p) => p.trait).length).toBe(3);
  });

  it('is deterministic and reaches the battle', () => {
    const a = battleSetup(newGame(0), '3-4').enemies.map((p) => p.trait ?? '-').join();
    const b = battleSetup(newGame(0), '3-4').enemies.map((p) => p.trait ?? '-').join();
    expect(a).toBe(b);
    expect(a).not.toBe(battleSetup(newGame(0), '3-4').enemies.map(() => '-').join());
  });
});

describe('elite traits', () => {
  it('armor softens shots', () => {
    const firstShot = (trait?: Trait) => {
      const b = createBattle({ allies: [king('a'), { kind: 'rook', x: 0, y: 7, level: 3 }], enemies: [king('e'), { kind: 'rook', x: 0, y: 0, level: 3, trait }] });
      const target = b.units.find((u) => u.kind === 'rook' && u.side === 'enemy')!;
      for (let i = 0; i < 200 && !b.result; i++) {
        stepBattle(b);
        const hit = b.events.find((e) => e.type === 'hit' && e.uid === target.uid && e.fromKind === 'rook' && Math.abs(e.y - e.fromY) > 1);
        if (hit) return hit.amount / (hit.crit ? 1.75 : 1);
      }
      return NaN;
    };
    expect(firstShot('armored')).toBeCloseTo(firstShot() * 0.6, 1);
  });

  it('thorns hurt melee attackers', () => {
    const knight: Placement = { kind: 'knight', x: 3, y: 4, level: 3 };
    const foe: Placement = { kind: 'rook', x: 3, y: 3, level: 1 };
    expect(duel('thorns', knight, foe, 25).allyLoss).toBeGreaterThan(duel(undefined, knight, foe, 25).allyLoss);
  });

  it('swift elites act faster', () => {
    const b = createBattle({ allies: [king('a')], enemies: [king('e'), { kind: 'knight', x: 1, y: 0, level: 1, trait: 'swift' }, { kind: 'knight', x: 2, y: 0, level: 1 }] });
    const [fast, slow] = b.units.filter((u) => u.kind === 'knight');
    expect(fast.moveCd).toBeLessThan(slow.moveCd);
    expect(fast.attackCd).toBeLessThan(slow.attackCd);
  });

  it('an explosive elite blasts its neighbours when it dies', () => {
    const b = createBattle({
      allies: [king('a'), { kind: 'rook', x: 3, y: 4, level: 10 }, { kind: 'pawn', x: 2, y: 4, level: 1 }],
      enemies: [king('e'), { kind: 'bishop', x: 3, y: 3, level: 1, trait: 'explosive' }],
    });
    const events: string[] = [];
    for (let i = 0; i < 60 && !b.result; i++) { stepBattle(b); b.events.forEach((e) => events.push(e.type + (e.label ?? ''))); }
    expect(events).toContain('abilityВзрыв!');
    expect(events).toContain('blast');
  });

  it('a vampire heals from its hits', () => {
    const b = createBattle({
      allies: [king('a'), { kind: 'pawn', x: 3, y: 4, level: 3 }],
      enemies: [king('e'), { kind: 'knight', x: 3, y: 3, level: 3, trait: 'vampire' }],
    });
    const knight = b.units.find((u) => u.kind === 'knight')!;
    knight.hp = knight.maxHp * 0.5;
    const start = knight.hp;
    let healed = false;
    for (let i = 0; i < 40 && !b.result; i++) {
      const before = knight.hp;
      stepBattle(b);
      if (knight.hp > before) healed = true;
    }
    expect(healed || knight.hp > start).toBe(true);
  });
});
