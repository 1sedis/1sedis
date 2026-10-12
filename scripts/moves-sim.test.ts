import { test } from 'vitest';
import { createBattle, enemyDamageShare, legalMoves, playMove, resolveDecision, simulate, stepBattle, type Battle, type PlayerMove } from '../src/game/battle';
import { bestFormation } from '../src/game/autoformation';
import { ALL_LEVELS } from '../src/game/levels';
import { battleSetup, commandLimit, newGame } from '../src/game/state';
import type { PieceKind } from '../src/game/pieces';

/**
 * How much the player's two moves are worth: the same army and formation on
 * every campaign level, slightly under-levelled, fought without moves and with
 * a few simple ways of spending them. Run: npx vitest run scripts/moves-sim.test.ts --silent=false
 */
const VALUE: Record<string, number> = { king: 100, queen: 9, archbishop: 8, chancellor: 8, rook: 5, bishop: 3, knight: 3, ghost: 4, pawn: 1 };
type Policy = (b: Battle) => PlayerMove | undefined;
const at = (b: Battle, x: number, y: number) => b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
const allMoves = (b: Battle) => b.units.filter((u) => u.side === 'ally' && u.hp > 0).flatMap((u) => legalMoves(b, u.uid));

const policies: Record<string, { ticks: number[]; pick: Policy }> = {
  'взятие ценного': { ticks: [30, 120], pick: (b) => allMoves(b).filter((m) => m.type === 'capture')
    .sort((p, q) => VALUE[at(b, q.x, q.y)!.kind] - VALUE[at(b, p.x, p.y)!.kind])[0] },
  'взятие короля позже': { ticks: [150, 250], pick: (b) => allMoves(b).filter((m) => m.type === 'capture')
    .sort((p, q) => VALUE[at(b, q.x, q.y)!.kind] - VALUE[at(b, p.x, p.y)!.kind])[0] },
  'добивание': { ticks: [60, 90, 120, 150, 180, 210, 240], pick: (b) => allMoves(b).filter((m) => m.type === 'capture')
    .sort((p, q) => at(b, p.x, p.y)!.hp - at(b, q.x, q.y)!.hp)[0] },
};

let played = 0;

function play(b: Battle, policy?: { ticks: number[]; pick: Policy }): Battle {
  if (!policy) {
    simulate(b);
    return b;
  }
  // Spend a move at the given moments, or as soon after as there is something worth doing.
  let next = 0;
  while (!b.result) {
    if (b.decision) resolveDecision(b);
    if (b.movesLeft > 0 && next < policy.ticks.length && b.tick >= policy.ticks[next]) {
      const m = policy.pick(b);
      if (m && playMove(b, m.uid, m.x, m.y)) {
        next++;
        played++;
      }
    }
    stepBattle(b);
  }
  return b;
}

test('moves sim', () => {
  const rows: Record<string, { wins: number; share: number }> = { 'без ходов': { wins: 0, share: 0 } };
  for (const name of Object.keys(policies)) rows[name] = { wins: 0, share: 0 };
  for (const level of ALL_LEVELS) {
    const s = newGame(0);
    for (let c = 1; c <= 4; c++) for (let n = 1; n <= 9; n++) s.cleared[`${c}-${n}`] = true;
    s.army = { ...s.army, pawn: 8, knight: 2, bishop: 2, rook: 2, queen: 1 };
    for (const k of Object.keys(s.levels) as PieceKind[]) s.levels[k] = Math.max(1, level.level - 1);
    bestFormation(s, level.id, commandLimit(s, level.id));
    const setup = { ...battleSetup(s, level.id), playerMoves: 2 };
    const base = play(createBattle(setup));
    rows['без ходов'].wins += Number(base.result === 'win');
    rows['без ходов'].share += enemyDamageShare(base);
    for (const [name, p] of Object.entries(policies)) {
      const b = play(createBattle(setup), p);
      rows[name].wins += Number(b.result === 'win');
      rows[name].share += enemyDamageShare(b);
    }
  }
  console.log(`ходов сделано: ${played}`);
  console.log(Object.entries(rows).map(([n, r]) => `${n}: побед ${r.wins}/${ALL_LEVELS.length}, урон врагу ${(r.share / ALL_LEVELS.length * 100).toFixed(0)}%`).join('\n'));
}, 600_000);
