import { KNIGHT_OFFSETS, PIECE_ORDER, PIECES, lineDirections, moveOffsets, starMultiplier, type PieceKind } from './pieces';
import { createRng } from './rng';
import { BOARD_SIZE, atkMultiplier, cooldownMultiplier, hpMultiplier, placedPieces, type GameState } from './state';

export type Side = 'ally' | 'enemy';

export interface Unit {
  uid: number;
  side: Side;
  kind: PieceKind;
  stars: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  attackCd: number;
  moveCd: number;
  /** Ticks until the unit may act again. */
  wait: number;
  /** Ticks left to show the "hit" flash. */
  flash: number;
}

export interface BattleEvent {
  type: 'hit' | 'death';
  uid: number;
  side: Side;
  x: number;
  y: number;
  amount: number;
  /** Attacker position, for drawing the strike. */
  fromX: number;
  fromY: number;
}

export interface Battle {
  wave: number;
  units: Unit[];
  tick: number;
  result: 'win' | 'loss' | null;
  /** Events produced by the latest tick. */
  events: BattleEvent[];
}

/** A battle that drags on longer than this (60 s) counts as a loss. */
export const MAX_TICKS = 600;

export function enemyStatMultiplier(wave: number): number {
  return 0.7 * 1.1 ** (wave - 1);
}

export function enemyCount(wave: number): number {
  return Math.min(16, 1 + Math.floor(wave * 0.35));
}

function makeUnit(uid: number, side: Side, kind: PieceKind, stars: number, x: number, y: number,
  hpMult: number, atkMult: number, cdMult: number): Unit {
  const def = PIECES[kind];
  const sm = starMultiplier(stars);
  const maxHp = Math.round(def.hp * sm * hpMult);
  return {
    uid, side, kind, stars, x, y,
    hp: maxHp,
    maxHp,
    atk: def.atk * sm * atkMult,
    attackCd: Math.max(3, Math.round(def.attackCd * cdMult)),
    moveCd: Math.max(3, Math.round(def.moveCd * cdMult)),
    wait: 0,
    flash: 0,
  };
}

export function createBattle(s: GameState): Battle {
  const units: Unit[] = [];
  let uid = 1;
  const hpM = hpMultiplier(s);
  const atkM = atkMultiplier(s);
  const cdM = cooldownMultiplier(s);
  for (const p of placedPieces(s)) {
    units.push(makeUnit(uid++, 'ally', p.kind, p.stars, p.pos!.x, p.pos!.y, hpM, atkM, cdM));
  }

  const wave = s.wave;
  const rng = createRng(wave * 7919);
  const mult = enemyStatMultiplier(wave);
  const available = PIECE_ORDER.filter((k) => PIECES[k].unlockWave + 2 <= wave);
  const cells: [number, number][] = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < BOARD_SIZE; x++) cells.push([x, y]);
  // Shuffle cells deterministically.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const count = enemyCount(wave);
  for (let i = 0; i < count; i++) {
    // Later waves favour stronger pieces.
    const idx = Math.min(available.length - 1, Math.floor(rng() ** 1.5 * available.length));
    const kind = available[available.length - 1 - idx] ?? 'pawn';
    const [x, y] = cells[i];
    units.push(makeUnit(uid++, 'enemy', kind, 1, x, y, mult, mult, 1));
  }
  return { wave, units, tick: 0, result: null, events: [] };
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function unitAt(b: Battle, x: number, y: number): Unit | undefined {
  return b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
}

/** Enemies this unit can hit from its current square. */
function targetsInReach(b: Battle, u: Unit): Unit[] {
  const result: Unit[] = [];
  const add = (x: number, y: number) => {
    const t = unitAt(b, x, y);
    if (t && t.side !== u.side && !result.includes(t)) result.push(t);
  };
  // Everyone can strike adjacent squares.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) add(u.x + dx, u.y + dy);
    }
  }
  if (u.kind === 'knight') {
    for (const [dx, dy] of KNIGHT_OFFSETS) add(u.x + dx, u.y + dy);
  }
  const range = PIECES[u.kind].range;
  for (const [dx, dy] of lineDirections(u.kind)) {
    for (let step = 1; step <= range; step++) {
      const x = u.x + dx * step;
      const y = u.y + dy * step;
      if (!inside(x, y)) break;
      const t = unitAt(b, x, y);
      if (t) {
        if (t.side !== u.side) add(x, y);
        break; // line of sight is blocked by any piece
      }
    }
  }
  return result;
}

function distanceToNearestEnemy(b: Battle, side: Side, x: number, y: number): number {
  let best = Infinity;
  for (const e of b.units) {
    if (e.hp <= 0 || e.side === side) continue;
    best = Math.min(best, Math.abs(e.x - x) + Math.abs(e.y - y));
  }
  return best;
}

function act(b: Battle, u: Unit): void {
  const targets = targetsInReach(b, u);
  if (targets.length > 0) {
    targets.sort((a, c) => a.hp - c.hp || a.uid - c.uid);
    const target = targets[0];
    target.hp -= u.atk;
    target.flash = 2;
    const base = { uid: target.uid, side: target.side, x: target.x, y: target.y, fromX: u.x, fromY: u.y };
    b.events.push({ ...base, type: 'hit', amount: u.atk });
    if (target.hp <= 0) b.events.push({ ...base, type: 'death', amount: 0 });
    u.wait = u.attackCd;
    return;
  }
  // Greedy step: take the move that brings us strictly closer to an enemy.
  const current = distanceToNearestEnemy(b, u.side, u.x, u.y);
  let best: [number, number] | null = null;
  let bestDist = current;
  for (const [dx, dy] of moveOffsets(u.kind)) {
    const x = u.x + dx;
    const y = u.y + dy;
    if (!inside(x, y) || unitAt(b, x, y)) continue;
    const d = distanceToNearestEnemy(b, u.side, x, y);
    if (d < bestDist) {
      bestDist = d;
      best = [x, y];
    }
  }
  if (best) {
    [u.x, u.y] = best;
    u.wait = u.moveCd;
  } else {
    u.wait = 2; // blocked: try again shortly
  }
}

/** Advance the battle by one tick (100 ms of game time). */
export function stepBattle(b: Battle): void {
  if (b.result) return;
  b.tick++;
  b.events = [];
  for (const u of b.units) {
    if (u.flash > 0) u.flash--;
    if (u.hp <= 0) continue;
    if (u.wait > 0) {
      u.wait--;
      continue;
    }
    act(b, u);
  }
  b.units = b.units.filter((u) => u.hp > 0 || u.flash > 0);
  const allies = b.units.some((u) => u.side === 'ally' && u.hp > 0);
  const enemies = b.units.some((u) => u.side === 'enemy' && u.hp > 0);
  if (!enemies && allies) b.result = 'win';
  else if (!allies || b.tick >= MAX_TICKS) b.result = 'loss';
}

/** Run a battle to completion (used by tests and balance checks). */
export function simulate(b: Battle): Battle['result'] {
  while (!b.result) stepBattle(b);
  return b.result;
}
