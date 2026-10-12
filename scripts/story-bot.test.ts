import { test } from 'vitest';
import { MOVES_PER_BATTLE, createBattle, legalMoves, playMove, resolveDecision, simulate, stepBattle, MAX_TICKS, type Battle } from '../src/game/battle';
import { bestFormation } from '../src/game/autoformation';
import { abyssId, FINALE_LEVELS } from '../src/game/levels';
import {
  BANNERS, EVENTS, availableNodes, buyItem, campRest, campTrain, canBuy, chooseEvent, enterNode, finishNode, shopItems,
  type RunNode,
} from '../src/game/run';
import { PIECES, RANGED, levelMultiplier, type PieceKind } from '../src/game/pieces';
import { NODES, nodeCost, nodeState } from '../src/game/crownTree';
import type { RelicId } from '../src/game/relics';
import {
  BUILDINGS, accrue, battleSetup, buildingCost, buyBuilding, buyNode, chooseRelic, collectTreasury, commandLimit,
  forgeMultiplier, gameNumber, incomePerMinute, isAbyssOpen, isUnlocked, newGame, prestige, armyCap, recordResult,
  recruit, recruitCost, relicOffer, spinCost, spinRoulette, upgradeCost, upgradePiece, type BuildingId, type GameState,
} from '../src/game/state';

/**
 * The whole story the way a sensible player plays it: games 1 to 3 in a row
 * with everything carried over (crowns spent in the Crown Tree, shards spun on
 * the roulette, relics picked by value), purchases chosen by power per gold
 * (so rooks and queens get bought), a few Abyss floors whenever a level does
 * not give in, and finally the three phases of the finale.
 *
 * Time model: battles at x2 speed plus 10 s of fiddling each, and waiting for
 * the treasury when nothing is affordable. Run: npm run bot:story
 */

/**
 * MOVES=1: the player spends their moves with a simple rule of thumb: at 3 s
 * and 12 s into the battle, the capture that hits the most valuable enemy
 * (the king first). Promotions take a queen.
 */
const USE_MOVES = !!process.env.MOVES;
const VALUE: Record<string, number> = { king: 100, queen: 9, archbishop: 8, chancellor: 8, rook: 5, bishop: 3, knight: 3, ghost: 4, pawn: 1 };

function playWithMoves(b: Battle): void {
  const moments = new Set([30, 120]);
  while (!b.result) {
    if (b.decision) resolveDecision(b);
    if (moments.has(b.tick) && b.movesLeft > 0) {
      const captures = b.units.filter((u) => u.side === 'ally' && u.hp > 0)
        .flatMap((u) => legalMoves(b, u.uid)).filter((m) => m.type === 'capture');
      const at = (x: number, y: number) => b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
      const best = captures.sort((p, q) => (VALUE[at(q.x, q.y)?.kind ?? 'pawn'] ?? 0) - (VALUE[at(p.x, p.y)?.kind ?? 'pawn'] ?? 0))[0];
      if (best) playMove(b, best.uid, best.x, best.y);
      else moments.add(b.tick + 10);
    }
    stepBattle(b);
  }
}

const RELIC_RANK: RelicId[] = [
  'sharpBlades', 'chainmail', 'royalHealer', 'secondLife', 'warCry', 'heavyShot', 'piercing', 'avengers', 'reserve',
  'queensGambit', 'bloodQueen', 'wideAura', 'phalanx', 'stunJump', 'earlyCrown', 'forcedMarch', 'plunder', 'fertile',
];

/** Doctrines a player would aim for first, cheapest available taken in this order. */
const TREE_PLAN = ['heritage', 'doubleStep', 'fork', 'heralds', 'hunger', 'banner', 'vault', 'castling', 'shadowReserve', 'twoQueens', 'luck', 'echo'];

/**
 * CHESS=1: a player who builds a chess set (at most 8 pawns, two of each
 * minor piece) instead of whatever is most efficient.
 */
const CHESS_CAP: Partial<Record<PieceKind, number>> = { pawn: 8, knight: 2, bishop: 2, rook: 2, archbishop: 1, chancellor: 1, ghost: 1 };
const capped = (s: GameState, k: PieceKind) => !!process.env.CHESS && s.army[k] >= (CHESS_CAP[k] ?? 99);

/** Rough fighting value of one piece: health times damage, both growing with level. */
function pieceValue(kind: PieceKind, level: number): number {
  const d = PIECES[kind];
  // Shooters deal their damage from safety behind the line: a player values them more.
  return d.hp * d.atk * levelMultiplier(level) ** 2 * (RANGED.has(kind) ? 2 : 1);
}

/** Value of the army that fits on the board for a level. */
function armyPower(s: GameState, limit: number): number {
  const values: number[] = [];
  for (const k of Object.keys(s.army) as PieceKind[]) {
    if (k === 'king') continue;
    for (let i = 0; i < s.army[k]; i++) values.push(pieceValue(k, s.levels[k]));
  }
  values.sort((a, b) => b - a);
  const fielded = values.slice(0, limit).reduce((a, b) => a + b, 0) + pieceValue('king', s.levels.king) * 0.5;
  return fielded * forgeMultiplier(s) ** 2;
}

/** Every purchase on offer with its gain in power per gold (treasury upgrades by payback). */
function options(s: GameState, limit: number): { cost: number; score: number; buy: () => boolean }[] {
  const out: { cost: number; score: number; buy: () => boolean }[] = [];
  const base = armyPower(s, limit);
  const trial = (cost: number, change: (c: GameState) => void, buy: () => boolean) => {
    const c = structuredClone(s);
    change(c);
    out.push({ cost, score: (armyPower(c, limit + c.buildings.hq - s.buildings.hq) - base) / Math.max(1, cost), buy });
  };
  for (const k of Object.keys(PIECES) as PieceKind[]) {
    if (!isUnlocked(s, k)) continue;
    if (k === 'king' || s.army[k] > 0) trial(upgradeCost(s, k), (c) => { c.levels[k]++; }, () => upgradePiece(s, k));
    const total = (Object.keys(s.army) as PieceKind[]).filter((x) => x !== 'king').reduce((n, x) => n + s.army[x], 0);
    if (k !== 'king' && total < limit + 3 && !capped(s, k) && s.army[k] < armyCap(s, k)) {
      trial(recruitCost(s, k), (c) => { c.army[k]++; }, () => recruit(s, k));
    }
  }
  for (const id of ['forge', 'hq'] as BuildingId[]) {
    if (s.buildings[id] < BUILDINGS[id].maxLevel) trial(buildingCost(s, id), (c) => { c.buildings[id]++; }, () => buyBuilding(s, id));
  }
  // The treasury pays for itself: worth it when it returns its price within half an hour.
  if (s.buildings.treasury < BUILDINGS.treasury.maxLevel) {
    const cost = buildingCost(s, 'treasury');
    const gain = incomePerMinute(s) * 0.25 / (1 + 0.25 * s.buildings.treasury);
    if (gain * 30 > cost) out.push({ cost, score: Infinity, buy: () => buyBuilding(s, 'treasury') });
  }
  return out.filter((o) => o.score > 0).sort((a, b) => b.score - a.score);
}

test('story bot', () => {
  const s = newGame(0);
  let rngSeed = 12345;
  const rand = () => ((rngSeed = (rngSeed * 1103515245 + 12345) >>> 0) / 4294967296);
  let t = 0;
  const log: string[] = [];
  let timeouts = 0;
  let abyssDips = 0;

  const fight = (id: string): boolean => {
    bestFormation(s, id, commandLimit(s, id));
    const b = createBattle({ ...battleSetup(s, id), playerMoves: USE_MOVES ? MOVES_PER_BATTLE : 0 });
    if (USE_MOVES) playWithMoves(b);
    else simulate(b);
    if (b.tick >= MAX_TICKS) timeouts++;
    const out = recordResult(s, id, b);
    t += (b.tick * 0.1) / 2 + 10;
    return out.win;
  };

  const tend = (limit: number) => {
    accrue(s, t * 1000);
    collectTreasury(s);
    for (let offer = relicOffer(s); offer; offer = relicOffer(s)) {
      chooseRelic(s, [...offer].sort((a, b) => RELIC_RANK.indexOf(a) - RELIC_RANK.indexOf(b))[0]);
    }
    for (const id of TREE_PLAN) {
      const node = NODES.find((n) => n.id === id)!;
      if (nodeState(s.crownTree, gameNumber(s), node) === 'available' && s.crowns >= nodeCost(node)) buyNode(s, id as never);
    }
    while (s.shards >= spinCost(s)) spinRoulette(s, 1, rand);
    for (let i = 0; i < 300; i++) {
      const o = options(s, limit)[0];
      if (!o || s.gold < o.cost || !o.buy()) break;
    }
  };

  /** Wait for the next purchase when nothing is affordable. */
  const wait = (limit: number) => {
    const next = options(s, limit).sort((a, b) => a.cost - b.cost)[0];
    if (!next || s.gold >= next.cost) return;
    accrue(s, t * 1000);
    const need = next.cost - s.gold - s.treasury;
    if (need > 0) t += (need / Math.max(0.01, incomePerMinute(s))) * 60;
  };

  const clear = (id: string, label: string) => {
    const start = t;
    let attempts = 0;
    const limit = commandLimit(s, id);
    const onMap = !!s.run.at;
    for (;;) {
      tend(limit);
      attempts++;
      if (fight(id)) break;
      // On the run map a loss may have used the last banner: the chapter started over.
      if (onMap && !s.run.at) break;
      // Stuck (down to the last banner on the map): a few Abyss floors for gold and shards, then back.
      if ((onMap ? s.run.banners === 1 : attempts % 3 === 0) && isAbyssOpen(s)) {
        for (let i = 0; i < 5; i++) {
          abyssDips++;
          tend(commandLimit(s, abyssId(s.abyss.floor)));
          if (!fight(abyssId(s.abyss.floor))) break;
        }
      }
      // WAIT=1: a player who waits for the treasury between attempts.
      if (!onMap || process.env.WAIT) wait(limit);
      if (attempts > 400) break;
    }
    return { minutes: (t - start) / 60, attempts, label };
  };

  /** The value of the army for choosing a piece to train at a camp. */
  const bestKind = (): PieceKind => (Object.keys(s.army) as PieceKind[])
    .filter((k) => s.army[k] > 0 && k !== 'king')
    .sort((a, b) => pieceValue(b, s.levels[b]) * s.army[b] - pieceValue(a, s.levels[a]) * s.army[a])[0] ?? 'king';

  /** Choose the next node: rest when banners are low, elites when strong, plain battles otherwise. */
  const pick = (nodes: RunNode[]): RunNode => {
    const rank = (n: RunNode) => {
      if (n.kind === 'camp') return s.run.banners < BANNERS ? 0 : 3;
      if (n.kind === 'elite') return s.run.banners >= 2 ? 1 : 6;
      if (n.kind === 'shop') return s.gold > 400 ? 2 : 5;
      if (n.kind === 'event') return 4;
      return 3;
    };
    return [...nodes].sort((a, b) => rank(a) - rank(b))[0];
  };

  /** Play the run map of this game to the end. */
  const playRun = (chapters: Record<number, number>, hard: string[]) => {
    for (let guard = 0; !s.run.complete && guard < 2000; guard++) {
      const chapter = s.run.chapter;
      const restarts = s.run.restarts;
      const start = t;
      const node = s.run.at ? availableNodes(s.run)[0] : pick(availableNodes(s.run));
      enterNode(s, node.id);
      t += 5;
      if (node.level) {
        const r = clear(node.level, node.level);
        if (r.attempts > 3) hard.push(`${node.level}${node.kind === 'elite' ? '!' : ''}:${r.attempts}`);
      } else if (node.kind === 'camp') {
        if (!campRest(s)) campTrain(s, bestKind());
      } else if (node.kind === 'event') {
        const choices = EVENTS[node.event!].choices;
        // A careful player: takes the choice without a gamble on banners or pawns when one exists.
        const order = node.event === 'dice' || node.event === 'crown' ? [1, 0] : [0, 1];
        if (!order.some((i) => chooseEvent(s, i)) && choices.length) finishNode(s);
      } else if (node.kind === 'shop') {
        const items = shopItems(s, node).sort((a, b) => (a.relic ? RELIC_RANK.indexOf(a.relic) : 99) - (b.relic ? RELIC_RANK.indexOf(b.relic) : 99));
        for (const item of items) if (!canBuy(s, node, item) && (item.relic || (item.id === 'banner' && s.run.banners < 2))) buyItem(s, node, item);
        finishNode(s);
      }
      chapters[chapter] = (chapters[chapter] ?? 0) + (t - start) / 60;
      if (s.run.restarts > restarts) hard.push(`рестарт гл.${chapter} на ${node.level}${node.kind === 'elite' ? '!' : ''}`);
    }
  };

  for (let game = 1; game <= 3; game++) {
    const start = t;
    const chapters: Record<number, number> = {};
    const hard: string[] = [];
    const restartsBefore = s.run.restarts;
    playRun(chapters, hard);
    hard.push(`всего рестартов: ${s.run.restarts - restartsBefore}`);
    const chText = Object.entries(chapters).map(([c, m]) => `ch${c} ${m.toFixed(0)}м`).join(' · ');
    log.push(`Партия ${game}: ${((t - start) / 3600).toFixed(1)} ч (${chText}) · трудные: ${hard.join(' ') || '—'}`);
    log.push(`  армия ${JSON.stringify(Object.fromEntries(Object.entries(s.army).filter(([, n]) => n > 0)))}`
      + ` · уровни ${JSON.stringify(Object.fromEntries(Object.entries(s.levels).filter(([k]) => s.army[k as PieceKind] > 0)))}`
      + ` · кузница ${s.buildings.forge} · реликвий ${s.relics.length} · Бездна ${s.abyss.best}`);
    if (game < 3) {
      const crowns = prestige(s, t * 1000);
      log.push(`  → новая партия: +${crowns} ♛, древо: ${s.crownTree.join(', ') || '—'}`);
    }
  }
  const finaleStart = t;
  const phases = FINALE_LEVELS.map((l) => clear(l.id, l.name));
  log.push(`Финал: ${((t - finaleStart) / 60).toFixed(0)} мин · ${phases.map((p) => `${p.label} ${p.attempts} поп.`).join(', ')}`);
  log.push(`ИТОГО до конца истории: ${(t / 3600).toFixed(1)} ч · таймаутов ${timeouts} · заходов в Бездну ${abyssDips}`);
  log.push(`древо: ${s.crownTree.join(', ')} · рулетка: ${Object.keys(s.roulette.owned).length} баффов`);
  console.log(log.join('\n'));
}, 1_800_000);
