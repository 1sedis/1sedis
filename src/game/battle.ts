import { KNIGHT_OFFSETS, PIECES, RANGED, levelMultiplier, lineDirections, moveOffsets, type PieceKind } from './pieces';

export const BOARD_SIZE = 8;
/** A battle that drags on longer than this (90 s) counts as a loss. */
export const MAX_TICKS = 900;
/** Allies adjacent to their king hit this much harder. */
export const KING_AURA = 1.2;
const BOSS_HP = 3;
const BOSS_ATK = 1.5;

export type Side = 'ally' | 'enemy';

export interface Placement {
  kind: PieceKind;
  x: number;
  y: number;
  level: number;
  boss?: boolean;
}

export interface BattleSetup {
  allies: Placement[];
  enemies: Placement[];
  /** Extra multipliers for the player's army (buildings etc.). */
  allyHpMult?: number;
  allyAtkMult?: number;
}

export interface Unit {
  uid: number;
  side: Side;
  kind: PieceKind;
  level: number;
  boss: boolean;
  promoted: boolean;
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
  hpMult: number;
  atkMult: number;
}

export interface BattleEvent {
  type: 'hit' | 'death' | 'promote';
  uid: number;
  side: Side;
  x: number;
  y: number;
  amount: number;
  fromX: number;
  fromY: number;
}

export interface Battle {
  units: Unit[];
  tick: number;
  result: 'win' | 'loss' | null;
  events: BattleEvent[];
  /** Lowest HP fraction the player's king reached. */
  kingMinRatio: number;
  /** Player pieces lost (the king excluded). */
  allyLosses: number;
}

function applyStats(u: Unit, kind: PieceKind): void {
  const def = PIECES[kind];
  const lm = levelMultiplier(u.level);
  const ratio = u.maxHp > 0 ? u.hp / u.maxHp : 1;
  u.kind = kind;
  u.maxHp = Math.round(def.hp * lm * u.hpMult);
  u.hp = u.maxHp * ratio;
  u.atk = def.atk * lm * u.atkMult;
  u.attackCd = def.attackCd;
  u.moveCd = def.moveCd;
}

function makeUnit(uid: number, side: Side, p: Placement, hpMult: number, atkMult: number): Unit {
  const boss = !!p.boss;
  const u: Unit = {
    uid, side, kind: p.kind, level: p.level, boss, promoted: false,
    x: p.x, y: p.y, hp: 0, maxHp: 0, atk: 0, attackCd: 0, moveCd: 0, wait: 0, flash: 0,
    hpMult: hpMult * (boss ? BOSS_HP : 1),
    atkMult: atkMult * (boss ? BOSS_ATK : 1),
  };
  applyStats(u, p.kind);
  u.hp = u.maxHp;
  // Stagger the first actions a little so mirrored armies do not act in lockstep.
  u.wait = uid % 3;
  return u;
}

export function createBattle(setup: BattleSetup): Battle {
  let uid = 1;
  const units: Unit[] = [];
  for (const p of setup.allies) units.push(makeUnit(uid++, 'ally', p, setup.allyHpMult ?? 1, setup.allyAtkMult ?? 1));
  for (const p of setup.enemies) units.push(makeUnit(uid++, 'enemy', p, 1, 1));
  return { units, tick: 0, result: null, events: [], kingMinRatio: 1, allyLosses: 0 };
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function unitAt(b: Battle, x: number, y: number): Unit | undefined {
  return b.units.find((u) => u.hp > 0 && u.x === x && u.y === y);
}

function alive(b: Battle, side: Side): Unit[] {
  return b.units.filter((u) => u.hp > 0 && u.side === side);
}

function forward(side: Side): number {
  return side === 'ally' ? -1 : 1;
}

/** Enemies a unit of `kind` standing on (x, y) could hit right now. */
function reachFrom(b: Battle, side: Side, kind: PieceKind, x: number, y: number): Unit[] {
  const result: Unit[] = [];
  const add = (t: Unit | undefined) => {
    if (t && t.side !== side && !result.includes(t)) result.push(t);
  };
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx || dy) add(unitAt(b, x + dx, y + dy));
    }
  }
  if (kind === 'knight') {
    for (const [dx, dy] of KNIGHT_OFFSETS) add(unitAt(b, x + dx, y + dy));
  }
  const range = PIECES[kind].range;
  for (const [dx, dy] of lineDirections(kind)) {
    for (let step = 1; step <= range; step++) {
      const cx = x + dx * step;
      const cy = y + dy * step;
      if (!inside(cx, cy)) break;
      const t = unitAt(b, cx, cy);
      if (t) {
        add(t); // own pieces are ignored by add(), but still block the line
        break;
      }
    }
  }
  return result;
}

function manhattan(a: { x: number; y: number }, x: number, y: number): number {
  return Math.abs(a.x - x) + Math.abs(a.y - y);
}

function auraBonus(b: Battle, u: Unit): number {
  if (u.kind === 'king') return 1;
  const king = alive(b, u.side).find((k) => k.kind === 'king');
  if (!king) return 1;
  return Math.max(Math.abs(king.x - u.x), Math.abs(king.y - u.y)) <= 1 ? KING_AURA : 1;
}

function pickTarget(u: Unit, targets: Unit[]): Unit {
  const priority = (t: Unit) => {
    if (t.kind === 'king') return 0;
    if (u.kind === 'knight' && RANGED.has(t.kind)) return 1;
    return 2;
  };
  return [...targets].sort((a, c) => priority(a) - priority(c) || a.hp - c.hp || a.uid - c.uid)[0];
}

function strike(b: Battle, u: Unit, target: Unit): void {
  const damage = u.atk * auraBonus(b, u);
  target.hp -= damage;
  target.flash = 2;
  const base = { uid: target.uid, side: target.side, x: target.x, y: target.y, fromX: u.x, fromY: u.y };
  b.events.push({ ...base, type: 'hit', amount: damage });
  if (target.side === 'ally' && target.kind === 'king') {
    b.kingMinRatio = Math.min(b.kingMinRatio, Math.max(0, target.hp) / target.maxHp);
  }
  if (target.hp <= 0) {
    b.events.push({ ...base, type: 'death', amount: 0 });
    if (target.side === 'ally' && target.kind !== 'king') b.allyLosses++;
  }
  u.wait = u.attackCd;
}

/** Score of standing on a cell: 0 if something is in reach, else distance to the goal. */
function cellScore(b: Battle, u: Unit, x: number, y: number, goal: Unit[]): number {
  if (reachFrom(b, u.side, u.kind, x, y).length > 0) return 0;
  let best = Infinity;
  for (const g of goal) best = Math.min(best, manhattan(g, x, y));
  return best;
}

function moveUnit(b: Battle, u: Unit): void {
  if (u.kind === 'king' || u.moveCd === 0) {
    u.wait = 3;
    return;
  }
  if (u.kind === 'pawn') {
    const ny = u.y + forward(u.side);
    if (inside(u.x, ny) && !unitAt(b, u.x, ny)) {
      u.y = ny;
      u.wait = u.moveCd;
      const lastRow = u.side === 'ally' ? 0 : BOARD_SIZE - 1;
      if (u.y === lastRow) {
        applyStats(u, 'queen');
        u.promoted = true;
        b.events.push({ type: 'promote', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX: u.x, fromY: u.y });
      }
    } else {
      u.wait = 3; // hold the line
    }
    return;
  }
  const enemies = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
  // Knights hunt shooters and the king first.
  let goal = enemies;
  if (u.kind === 'knight') {
    const prey = enemies.filter((e) => e.kind === 'king' || RANGED.has(e.kind));
    if (prey.length) goal = prey;
  }
  const current = cellScore(b, u, u.x, u.y, goal);
  let best: [number, number] | null = null;
  let bestScore = current;
  for (const [dx, dy] of moveOffsets(u.kind)) {
    const x = u.x + dx;
    const y = u.y + dy;
    if (!inside(x, y) || unitAt(b, x, y)) continue;
    const score = cellScore(b, u, x, y, goal);
    if (score < bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  if (best) {
    [u.x, u.y] = best;
    u.wait = u.moveCd;
  } else {
    u.wait = 3;
  }
}

function act(b: Battle, u: Unit): void {
  const targets = reachFrom(b, u.side, u.kind, u.x, u.y);
  if (targets.length > 0) strike(b, u, pickTarget(u, targets));
  else moveUnit(b, u);
}

function sideDefeated(b: Battle, side: Side): boolean {
  const units = b.units.filter((u) => u.side === side);
  const living = units.filter((u) => u.hp > 0);
  if (living.length === 0) return true;
  const hadKing = units.some((u) => u.kind === 'king');
  return hadKing && !living.some((u) => u.kind === 'king');
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
    if (sideDefeated(b, 'ally') || sideDefeated(b, 'enemy')) break;
  }
  b.units = b.units.filter((u) => u.hp > 0 || u.flash > 0);
  if (sideDefeated(b, 'ally')) b.result = 'loss';
  else if (sideDefeated(b, 'enemy')) b.result = 'win';
  else if (b.tick >= MAX_TICKS) b.result = 'loss';
}

/** Run a battle to completion (used by tests and balance checks). */
export function simulate(b: Battle): Battle['result'] {
  while (!b.result) stepBattle(b);
  return b.result;
}
