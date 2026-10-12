import { describe, expect, it } from 'vitest';
import { MOVES_PER_BATTLE, createBattle, playMove, stepBattle, type BattleEvent, type BattleSetup } from '../src/game/battle';
import { NODES, NODE_BY_ID, nodeState, type NodeId } from '../src/game/crownTree';
import { synergyProgress } from '../src/game/synergies';
import { buildMap } from '../src/game/run';
import {
  battleSetup, buyNode, commandLimit, isUnlocked, newGame, playerMoves, prestige, queenCap, recruit, resetTree, spinCost,
} from '../src/game/state';

const fresh = (games = 4, crowns = 50) => {
  const s = newGame(0);
  s.prestige = games - 1;
  s.crowns = crowns;
  return s;
};

const run = (setup: BattleSetup, ticks = 200) => {
  const b = createBattle(setup);
  const events: BattleEvent[] = [];
  for (let i = 0; i < ticks && !b.result; i++) {
    stepBattle(b);
    events.push(...b.events);
  }
  return { b, events };
};

describe('crown tree', () => {
  it('has three branches of four tiers with a pair on each tier', () => {
    for (const branch of ['gambit', 'court', 'shadow']) {
      for (let tier = 0; tier < 4; tier++) expect(NODES.filter((n) => n.branch === branch && n.tier === tier)).toHaveLength(2);
    }
  });

  it('buys in order, closes the twin and respects the game gate', () => {
    const s = fresh(1, 50);
    expect(buyNode(s, 'fork')).toBe(false); // tier II needs tier I first
    expect(buyNode(s, 'doubleStep')).toBe(true);
    expect(nodeState(s.crownTree, 1, NODE_BY_ID.castling)).toBe('rejected');
    expect(buyNode(s, 'castling')).toBe(false);
    expect(buyNode(s, 'fork')).toBe(true);
    expect(buyNode(s, 'earlyCrown')).toBe(false); // tier III opens in game 2
    expect(s.crowns).toBe(50 - 2 - 4);
  });

  it('a reset refunds everything but the fee', () => {
    const s = fresh(4, 21);
    for (const id of ['hunger', 'fog', 'echo', 'ghost'] as const) expect(buyNode(s, id)).toBe(true);
    expect(s.crowns).toBe(0);
    expect(resetTree(s)).toBe(true);
    expect(s.crownTree).toEqual([]);
    expect(s.crowns).toBe(21 - 1);
  });

  it('unlocks prestige pieces and court rules', () => {
    const s = fresh(4, 50);
    expect(isUnlocked(s, 'ghost')).toBe(false);
    for (const id of ['hunger', 'shadowReserve', 'lure', 'ghost', 'trophies', 'vault', 'banner', 'twoQueens', 'luck'] as const) buyNode(s, id);
    expect(isUnlocked(s, 'ghost')).toBe(true);
    expect(commandLimit(s, '1-1')).toBe(newGame(0) && commandLimit(newGame(0), '1-1') + 1);
    expect(queenCap(s)).toBe(2);
    expect(spinCost(s)).toBe(2); // hunger was taken, so luck is closed
    s.gold = 1e6;
    for (const k of ['1-1', '1-2', '1-9', '2-9', '3-9'] as const) s.stars[k] = 1;
    expect(recruit(s, 'ghost')).toBe(true);
  });

  it('survives a new game; heritage and vault shape the next run', () => {
    const s = fresh(2, 10);
    buyNode(s, 'trophies');
    buyNode(s, 'heritage');
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.stars[`${c}-${n}`] = 1;
    s.run.complete = true;
    prestige(s, 0);
    expect(s.crownTree).toEqual(['trophies', 'heritage']);
    expect(s.relics).toEqual(['spareBanner']);
  });

  it('heralds lower synergy needs', () => {
    const kinds = ['pawn', 'pawn'] as const;
    expect(synergyProgress([...kinds]).find((p) => p.def.id === 'phalanx')!.active).toBe(false);
    expect(synergyProgress([...kinds], 1).find((p) => p.def.id === 'phalanx')!.active).toBe(true);
  });
});

describe('doctrines in battle', () => {
  it('double step moves a pawn two squares on its first move', () => {
    const setup = (perks?: BattleSetup['perks']): BattleSetup => ({
      allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'pawn', x: 0, y: 6, level: 1 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }],
      perks,
    });
    const first = (perks?: BattleSetup['perks']) => {
      const b = createBattle(setup(perks));
      const pawn = b.units.find((u) => u.kind === 'pawn')!;
      while (pawn.y === 6) stepBattle(b);
      return pawn.y;
    };
    expect(first()).toBe(5);
    expect(first(['doubleStep'])).toBe(4);
  });

  it('"Темп" gives a third move, "Шах" stuns a captured king longer', () => {
    const s = fresh(2, 5);
    expect(playerMoves(s)).toBe(MOVES_PER_BATTLE);
    expect(buyNode(s, 'castling')).toBe(true);
    expect(playerMoves(s)).toBe(MOVES_PER_BATTLE + 1);
    const setup = {
      allies: [{ kind: 'king' as const, x: 0, y: 7, level: 1 }, { kind: 'rook' as const, x: 4, y: 6, level: 1 }],
      enemies: [{ kind: 'king' as const, x: 4, y: 0, level: 9 }],
      playerMoves: 1,
    };
    const stun = (perks: NodeId[]) => {
      const b = createBattle({ ...setup, perks });
      const rook = b.units.find((u) => u.kind === 'rook')!;
      playMove(b, rook.uid, 4, 0);
      return b.units.find((u) => u.side === 'enemy')!.wait;
    };
    expect(stun(['check'])).toBeGreaterThanOrEqual(stun([]) * 3);
  });

  it('fog keeps the enemy from striking first', () => {
    const b = createBattle({
      allies: [{ kind: 'king', x: 7, y: 7, level: 1 }], enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'rook', x: 0, y: 0, level: 1 }],
      perks: ['fog'],
    });
    expect(b.units.filter((u) => u.side === 'enemy').every((u) => u.wait >= 30)).toBe(true);
  });

  it('the archbishop strikes with a knight jump', () => {
    const { events } = run({
      allies: [{ kind: 'king', x: 7, y: 7, level: 1 }, { kind: 'archbishop', x: 3, y: 5, level: 3 }],
      enemies: [{ kind: 'king', x: 7, y: 0, level: 1 }, { kind: 'pawn', x: 4, y: 3, level: 1 }],
    }, 30);
    expect(events.some((e) => e.type === 'hit' && e.fromKind === 'archbishop' && e.side === 'enemy')).toBe(true);
  });

  it('the lured enemy joins you in elite battles, the beaten boss serves till the end of the run', () => {
    const s = fresh(4, 50);
    for (const id of ['hunger', 'fog', 'lure', 'guardian'] as const) expect(buyNode(s, id)).toBe(true);
    s.run.guardian = 'rook';
    const plain = battleSetup(s, '1-1');
    expect(plain.allies.some((a) => a.kind === 'rook' && a.boss)).toBe(true);
    s.run.chapter = 2;
    for (let seed = 1; seed < 300; seed++) {
      const map = buildMap(2, seed);
      const elite = map.nodes.find((n) => n.kind === 'elite' && n.row === 2 && n.rule !== 'mirror');
      const r1 = elite && map.nodes.find((n) => n.row === 1 && n.next.includes(elite.id));
      if (!elite || !r1) continue;
      s.run.seed = seed;
      s.run.done = [map.nodes.find((n) => n.row === 0)!.id, r1.id];
      s.run.at = elite.id;
      const setup = battleSetup(s, elite.level!);
      expect(setup.allies.filter((a) => a.kind !== 'king' && !a.boss).length).toBeGreaterThanOrEqual(1);
      return;
    }
    throw new Error('no elite');
  });
});
