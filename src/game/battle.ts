import { KNIGHT_OFFSETS, PIECES, RANGED, levelMultiplier, lineDirections, moveOffsets, type PieceKind } from './pieces';
import { synergyBonus } from './synergies';
import { FOREST_DEFENSE, HILL_BONUS, parseTerrain, walkable, type Terrain } from './terrain';
import { abilityOf, abilityTier, type Branch } from './abilities';
import type { RelicId } from './relics';

export const BOARD_SIZE = 8;
/** A battle that drags on longer than this (90 s) counts as a loss. */
export const MAX_TICKS = 900;
/** Allies adjacent to their king hit this much harder. */
export const KING_AURA = 1.2;
const BOSS_HP = 3;
const BOSS_ATK = 1.5;
export const CRIT_CHANCE = 0.1;
export const CRIT_MULT = 1.75;
/** Royal healer: heal interval in ticks and share of max HP. */
const HEAL_EVERY = 30;
const HEAL_SHARE = 0.1;

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
  /** Extra health multiplier for the player's king. */
  allyKingHpMult?: number;
  /** Relics owned by the player; they only affect allies. */
  relics?: RelicId[];
  /** The player's chosen ability per piece type (enemies always use the first). */
  allyBranches?: Partial<Record<PieceKind, Branch>>;
  /** Terrain map rows (see terrain.ts); plain when omitted. */
  terrain?: string[];
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
  /** Multiplier on pawn move cooldown. */
  pawnMoveMult: number;
  /** Extra attack multiplier gained during the battle. */
  buff: number;
  /** Ability tier: 0 none, 1 learned, 2 empowered. */
  tier: 0 | 1 | 2;
  /** Ticks until the active ability is ready. */
  abilityTimer: number;
  strikes: number;
  /** Damage absorbed before HP (pawn shield). */
  shield: number;
  maxShield: number;
  /** Battle-cry buff: active until this tick, with this multiplier. */
  rallyUntil: number;
  rallyMult: number;
  /** Has struck at least once. */
  struck: boolean;
  /** Curse from an enemy bishop: extra damage taken until this tick. */
  cursedUntil: number;
  curseMult: number;
}

export interface BattleEvent {
  type: 'hit' | 'death' | 'promote' | 'heal' | 'save' | 'ability' | 'shieldBreak';
  /** Ability name for 'ability' events. */
  label?: string;
  uid: number;
  side: Side;
  x: number;
  y: number;
  amount: number;
  fromX: number;
  fromY: number;
  /** The acting unit (attacker or healer). */
  fromUid: number;
  fromKind?: PieceKind;
  crit?: boolean;
  /** The struck piece is a king or a boss. */
  big?: boolean;
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
  relics: ReadonlySet<RelicId>;
  /** "Second life" already used. */
  kingSaved: boolean;
  /** Player-side counters for achievements. */
  allyStats: { promotions: number; kills: number; crits: number; abilities: number };
  /** Per-piece record for the after-battle report; kept even after a piece dies. */
  report: Record<number, UnitReport>;
  /** The player's chosen abilities. */
  branches: Partial<Record<PieceKind, Branch>>;
  /** Terrain per cell, index y * 8 + x. */
  terrain: Terrain[];
}

export interface UnitReport {
  uid: number;
  side: Side;
  kind: PieceKind;
  boss: boolean;
  promoted: boolean;
  startX: number;
  startY: number;
  dealt: number;
  taken: number;
  healed: number;
  kills: number;
  /** Who finished this piece, and where the killer stood. */
  killedBy?: { uid: number; kind: PieceKind; x: number; y: number; atX: number; atY: number };
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
  u.moveCd = Math.round(def.moveCd * (kind === 'pawn' ? u.pawnMoveMult : 1));
}

function makeUnit(uid: number, side: Side, p: Placement, hpMult: number, atkMult: number, pawnMoveMult = 1, abilities = false): Unit {
  const boss = !!p.boss;
  const u: Unit = {
    uid, side, kind: p.kind, level: p.level, boss, promoted: false,
    x: p.x, y: p.y, hp: 0, maxHp: 0, atk: 0, attackCd: 0, moveCd: 0, wait: 0, flash: 0,
    hpMult: hpMult * (boss ? BOSS_HP : 1),
    atkMult: atkMult * (boss ? BOSS_ATK : 1),
    pawnMoveMult, buff: 1, struck: false,
    tier: abilities ? abilityTier(p.level) : 0, abilityTimer: 0, strikes: 0, shield: 0, maxShield: 0, rallyUntil: 0, rallyMult: 1,
    cursedUntil: 0, curseMult: 1,
  };
  applyStats(u, p.kind);
  u.hp = u.maxHp;
  // Stagger the first actions a little so mirrored armies do not act in lockstep.
  u.wait = uid % 3;
  return u;
}

export function createBattle(setup: BattleSetup): Battle {
  const relics = new Set(setup.relics ?? []);
  const hp = (setup.allyHpMult ?? 1) * (relics.has('chainmail') ? 1.15 : 1);
  const atk = (setup.allyAtkMult ?? 1) * (relics.has('sharpBlades') ? 1.12 : 1);
  const march = relics.has('forcedMarch') ? 0.6 : 1;
  let uid = 1;
  const units: Unit[] = [];
  const kinds = setup.allies.map((p) => p.kind);
  for (const p of setup.allies) {
    const kingHp = p.kind === 'king' ? setup.allyKingHpMult ?? 1 : 1;
    const syn = synergyBonus(kinds, p.kind);
    units.push(makeUnit(uid++, 'ally', p, hp * kingHp * syn.hp, atk * syn.atk, march, true));
  }
  for (const p of setup.enemies) units.push(makeUnit(uid++, 'enemy', p, 1, 1, 1, true));
  const report: Record<number, UnitReport> = {};
  for (const u of units) {
    report[u.uid] = {
      uid: u.uid, side: u.side, kind: u.kind, boss: u.boss, promoted: false, startX: u.x, startY: u.y,
      dealt: 0, taken: 0, healed: 0, kills: 0,
    };
  }
  const b: Battle = { units, tick: 0, result: null, events: [], kingMinRatio: 1, allyLosses: 0, relics, kingSaved: false,
    allyStats: { promotions: 0, kills: 0, crits: 0, abilities: 0 }, report, branches: { ...setup.allyBranches }, terrain: parseTerrain(setup.terrain) };
  for (const u of units) {
    resetAbilityTimer(b, u, 0.5);
    if (u.kind !== 'pawn' || u.tier === 0) continue;
    if (alt(b, u)) {
      // Charge: a faster pawn without a shield.
      u.pawnMoveMult *= 0.55;
      u.moveCd = Math.round(u.moveCd * 0.55);
    } else {
      u.shield = u.maxShield = u.maxHp * (u.tier === 2 ? 0.6 : 0.3);
    }
  }
  return b;
}

/** The unit uses its alternative ability (only the player's pieces can). */
function alt(b: Battle, u: Unit): boolean {
  return u.tier > 0 && u.side === 'ally' && b.branches[u.kind] === 1;
}

function ability(b: Battle, u: Unit) {
  return abilityOf(u.kind, alt(b, u) ? 1 : 0);
}

function has(b: Battle, side: Side, relic: RelicId): boolean {
  return side === 'ally' && b.relics.has(relic);
}

/** Deterministic pseudo-random crit roll, so battles stay reproducible. */
function isCrit(b: Battle, u: Unit): boolean {
  const h = Math.imul(b.tick + 1, 73856093) ^ Math.imul(u.uid, 19349663) ^ Math.imul(u.x * 8 + u.y + 1, 83492791);
  return ((h >>> 0) % 1000) / 1000 < CRIT_CHANCE;
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

/** A piece may stand on this cell (inside the board and not rock or water). */
function standable(t: Terrain[], x: number, y: number): boolean {
  return inside(x, y) && walkable(t[y * BOARD_SIZE + x]);
}

/** Rock stops shots along a line. */
function isWall(t: Terrain[], x: number, y: number): boolean {
  return t[y * BOARD_SIZE + x] === 'rock';
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
      if (!inside(cx, cy) || isWall(b.terrain, cx, cy)) break;
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
  const radius = has(b, u.side, 'wideAura') ? 2 : 1;
  return Math.max(Math.abs(king.x - u.x), Math.abs(king.y - u.y)) <= radius ? KING_AURA : 1;
}

function pickTarget(u: Unit, targets: Unit[]): Unit {
  const priority = (t: Unit) => {
    if (t.kind === 'king') return 0;
    if (u.kind === 'knight' && RANGED.has(t.kind)) return 1;
    return 2;
  };
  return [...targets].sort((a, c) => priority(a) - priority(c) || a.hp - c.hp || a.uid - c.uid)[0];
}

function resetAbilityTimer(b: Battle, u: Unit, share = 1): void {
  u.abilityTimer = Math.round(ability(b, u).cooldown * share);
}

/** Attack power of a unit right now, with aura, buffs and battle cry. */
function baseDamage(b: Battle, u: Unit): number {
  let damage = u.atk * auraBonus(b, u) * u.buff;
  if (RANGED.has(u.kind) && b.terrain[u.y * BOARD_SIZE + u.x] === 'hill') damage *= HILL_BONUS;
  if (b.tick < u.rallyUntil) damage *= u.rallyMult;
  if (has(b, u.side, 'warCry') && b.tick <= 60) damage *= 1.35;
  return damage;
}

function chebyshev(a: { x: number; y: number }, x: number, y: number): number {
  return Math.max(Math.abs(a.x - x), Math.abs(a.y - y));
}

function abilityEvent(b: Battle, u: Unit): void {
  if (u.side === 'ally') b.allyStats.abilities++;
  b.events.push({
    type: 'ability', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0,
    fromX: u.x, fromY: u.y, fromUid: u.uid, fromKind: u.kind, label: ability(b, u).name,
  });
}

/** Cast the unit's active ability if it is ready and useful. Returns true when cast. */
function tryCast(b: Battle, u: Unit): boolean {
  if (u.tier === 0 || u.abilityTimer > 0 || ability(b, u).cooldown === 0) return false;
  const strong = u.tier === 2;
  const friends = alive(b, u.side);
  const foes = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
  if (alt(b, u)) {
    if (!castAlt(b, u, strong, friends)) return false;
    resetAbilityTimer(b, u);
    u.wait = u.attackCd;
    return true;
  }
  switch (u.kind) {
    case 'king': {
      const targets = friends.filter((f) => f !== u && (strong || chebyshev(u, f.x, f.y) <= 2));
      if (!targets.length) return false;
      abilityEvent(b, u);
      for (const f of targets) {
        f.rallyUntil = b.tick + 30;
        f.rallyMult = strong ? 1.4 : 1.25;
      }
      break;
    }
    case 'bishop': {
      const wounded = friends
        .filter((f) => chebyshev(u, f.x, f.y) <= 3 && f.hp < f.maxHp * 0.9)
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (!wounded) return false;
      abilityEvent(b, u);
      const amount = Math.min(wounded.maxHp - wounded.hp, wounded.maxHp * (strong ? 0.35 : 0.2));
      wounded.hp += amount;
      b.report[u.uid].healed += amount;
      b.events.push({ type: 'heal', uid: wounded.uid, side: wounded.side, x: wounded.x, y: wounded.y, amount, fromX: u.x, fromY: u.y, fromUid: u.uid, fromKind: u.kind });
      break;
    }
    case 'rook': {
      // The file or rank with the most enemies, shooting through everything.
      let line: Unit[] = [];
      for (const [dx, dy] of lineDirections('rook')) {
        const hits = foes.filter((f) => {
          const ox = f.x - u.x;
          const oy = f.y - u.y;
          return (dx ? Math.sign(ox) === dx && oy === 0 : Math.sign(oy) === dy && ox === 0);
        });
        if (hits.length > line.length) line = hits;
      }
      if (!line.length) return false;
      abilityEvent(b, u);
      const damage = baseDamage(b, u) * (strong ? 1.3 : 0.8);
      for (const f of line) dealDamage(b, u, f, damage, false);
      break;
    }
    case 'queen': {
      const near = foes.filter((f) => chebyshev(u, f.x, f.y) <= 2);
      if (!near.length) return false;
      abilityEvent(b, u);
      const damage = baseDamage(b, u) * (strong ? 1 : 0.6);
      for (const f of near) dealDamage(b, u, f, damage, false);
      break;
    }
    default:
      return false;
  }
  resetAbilityTimer(b, u);
  u.wait = u.attackCd;
  return true;
}

/** Active alternative abilities: the bishop's curse and the queen's tide. */
function castAlt(b: Battle, u: Unit, strong: boolean, friends: Unit[]): boolean {
  if (u.kind === 'bishop') {
    const targets = reachFrom(b, u.side, u.kind, u.x, u.y).filter((t) => b.tick >= t.cursedUntil);
    if (!targets.length) return false;
    const target = [...targets].sort((a, c) => Number(c.kind === 'king') - Number(a.kind === 'king') || c.hp - a.hp)[0];
    abilityEvent(b, u);
    target.cursedUntil = b.tick + (strong ? 60 : 40);
    target.curseMult = strong ? 1.5 : 1.3;
    return true;
  }
  if (u.kind === 'queen') {
    const near = friends.filter((f) => chebyshev(u, f.x, f.y) <= 2 && f.shield < f.maxHp * 0.05);
    if (!near.length) return false;
    abilityEvent(b, u);
    for (const f of near) {
      f.shield = f.maxShield = Math.max(f.shield, f.maxHp * (strong ? 0.3 : 0.15));
    }
    return true;
  }
  return false;
}

/** Damage taken multiplier from passive abilities and curses. */
function defense(b: Battle, target: Unit): number {
  let m = 1;
  if (alt(b, target)) {
    if (target.kind === 'king') m *= target.tier === 2 ? 0.5 : 0.7;
    if (target.kind === 'rook') m *= target.tier === 2 ? 0.5 : 0.65;
  }
  let aura = 1;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const f = unitAt(b, target.x + dx, target.y + dy);
      if (!f || f.side !== target.side || f.tier !== 2 || !alt(b, f)) continue;
      if (f.kind === 'king') aura = Math.min(aura, 0.85);
      if (f.kind === 'rook') aura = Math.min(aura, 0.8);
    }
  }
  m *= aura;
  if (b.tick < target.cursedUntil) m *= target.curseMult;
  if (b.terrain[target.y * BOARD_SIZE + target.x] === 'forest') m *= FOREST_DEFENSE;
  return m;
}

function strike(b: Battle, u: Unit, target: Unit): void {
  let damage = baseDamage(b, u);
  u.strikes++;
  const charge = u.kind === 'knight' && u.tier > 0 && !alt(b, u) && u.strikes % 3 === 0;
  if (charge) {
    damage *= 2;
    abilityEvent(b, u);
  }
  if (alt(b, u)) {
    if (u.kind === 'knight' && (target.kind === 'king' || RANGED.has(target.kind))) damage *= u.tier === 2 ? 1.8 : 1.4;
    if (u.kind === 'pawn' && !u.struck) {
      damage *= u.tier === 2 ? 3 : 2;
      abilityEvent(b, u);
    }
  }
  const big = target.kind === 'king' || target.boss;
  if (u.kind === 'rook' && big && has(b, u.side, 'heavyShot')) damage *= 1.5;
  const crit = isCrit(b, u);
  if (crit) {
    damage *= CRIT_MULT;
    if (u.side === 'ally') b.allyStats.crits++;
  }
  dealDamage(b, u, target, damage, crit);
  if (charge && u.tier === 2 && target.hp > 0) target.wait += 15;
  if (u.kind === 'knight' && !u.struck && has(b, u.side, 'stunJump') && target.hp > 0) target.wait += 20;
  if (u.kind === 'bishop' && has(b, u.side, 'piercing')) pierce(b, u, target, damage * 0.6);
  u.struck = true;
  u.wait = u.attackCd;
}

/** Hit the next piece behind the target on the same diagonal. */
function pierce(b: Battle, u: Unit, target: Unit, damage: number): void {
  const dx = Math.sign(target.x - u.x);
  const dy = Math.sign(target.y - u.y);
  if (Math.abs(target.x - u.x) !== Math.abs(target.y - u.y) || !dx) return;
  for (let step = 1; step <= 3; step++) {
    const px = target.x + dx * step;
    const py = target.y + dy * step;
    if (!inside(px, py) || isWall(b.terrain, px, py)) return;
    const t = unitAt(b, px, py);
    if (t) {
      if (t.side !== u.side) dealDamage(b, u, t, damage, false);
      return;
    }
  }
}

function dealDamage(b: Battle, u: Unit, target: Unit, raw: number, crit: boolean): void {
  let damage = raw * defense(b, target);
  if (target.kind === 'pawn' && has(b, target.side, 'phalanx')) {
    const buddy = [-1, 1].some((dx) => unitAt(b, target.x + dx, target.y)?.kind === 'pawn'
      && unitAt(b, target.x + dx, target.y)?.side === target.side);
    if (buddy) damage *= 0.7;
  }
  let shieldBroke = false;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, damage);
    target.shield -= absorbed;
    damage -= absorbed;
    shieldBroke = target.shield <= 0;
  }
  // Count only damage that lands on remaining health, so overkill does not inflate the report.
  const landed = Math.min(damage, Math.max(0, target.hp));
  b.report[u.uid].dealt += landed;
  b.report[target.uid].taken += landed;
  target.hp -= damage;
  target.flash = 2;
  const big = target.kind === 'king' || target.boss;
  const base = { uid: target.uid, side: target.side, x: target.x, y: target.y, fromX: u.x, fromY: u.y, fromUid: u.uid, fromKind: u.kind, big };
  b.events.push({ ...base, type: 'hit', amount: damage, crit });
  if (shieldBroke) b.events.push({ ...base, type: 'shieldBreak', amount: 0 });
  if (u.kind === 'queen' && has(b, u.side, 'bloodQueen')) u.hp = Math.min(u.maxHp, u.hp + damage * 0.25);
  if (target.hp <= 0 && target.kind === 'king' && has(b, target.side, 'secondLife') && !b.kingSaved) {
    b.kingSaved = true;
    target.hp = target.maxHp * 0.3;
    b.events.push({ ...base, type: 'save', amount: target.hp });
  }
  if (target.side === 'ally' && target.kind === 'king') {
    b.kingMinRatio = Math.min(b.kingMinRatio, Math.max(0, target.hp) / target.maxHp);
  }
  if (target.hp <= 0) {
    b.events.push({ ...base, type: 'death', amount: 0 });
    b.report[u.uid].kills++;
    b.report[target.uid].killedBy = { uid: u.uid, kind: u.kind, x: u.x, y: u.y, atX: target.x, atY: target.y };
    if (target.side === 'ally' && target.kind !== 'king') b.allyLosses++;
    if (target.side === 'enemy') b.allyStats.kills++;
    if (has(b, target.side, 'avengers')) {
      for (const f of alive(b, target.side)) {
        if (Math.max(Math.abs(f.x - target.x), Math.abs(f.y - target.y)) <= 1) f.buff *= 1.15;
      }
    }
  }
}

function royalHeal(b: Battle): void {
  const king = alive(b, 'ally').find((u) => u.kind === 'king');
  if (!king) return;
  for (const f of alive(b, 'ally')) {
    if (f === king || f.hp >= f.maxHp) continue;
    if (Math.max(Math.abs(f.x - king.x), Math.abs(f.y - king.y)) > 1) continue;
    const amount = Math.min(f.maxHp - f.hp, f.maxHp * HEAL_SHARE);
    f.hp += amount;
    b.report[king.uid].healed += amount;
    b.events.push({ type: 'heal', uid: f.uid, side: 'ally', x: f.x, y: f.y, amount, fromX: king.x, fromY: king.y, fromUid: king.uid });
  }
}

type Grid = (Unit | undefined)[];

/** Occupancy grid of living units, optionally leaving one unit out. */
function buildGrid(b: Battle, except?: Unit): Grid {
  const grid: Grid = new Array(BOARD_SIZE * BOARD_SIZE);
  for (const u of b.units) if (u.hp > 0 && u !== except) grid[u.y * BOARD_SIZE + u.x] = u;
  return grid;
}

/** Same rules as reachFrom, but against a prepared grid (used by path search). */
function reachesGoal(grid: Grid, terrain: Terrain[], side: Side, kind: PieceKind, x: number, y: number, goal: Set<Unit>): boolean {
  const hit = (cx: number, cy: number) => {
    if (!inside(cx, cy)) return false;
    const t = grid[cy * BOARD_SIZE + cx];
    return !!t && t.side !== side && goal.has(t);
  };
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && hit(x + dx, y + dy)) return true;
  if (kind === 'knight' && KNIGHT_OFFSETS.some(([dx, dy]) => hit(x + dx, y + dy))) return true;
  const range = PIECES[kind].range;
  for (const [dx, dy] of lineDirections(kind)) {
    for (let step = 1; step <= range; step++) {
      const cx = x + dx * step;
      const cy = y + dy * step;
      if (!inside(cx, cy) || isWall(terrain, cx, cy)) break;
      if (grid[cy * BOARD_SIZE + cx]) {
        if (hit(cx, cy)) return true;
        break;
      }
    }
  }
  return false;
}

/**
 * Breadth-first search over the piece's own moves for the nearest free cell
 * from which it can hit one of `goal`. Returns the first step of that path.
 */
function pathStep(b: Battle, u: Unit, goal: Unit[]): [number, number] | null {
  if (goal.length === 0) return null;
  const grid = buildGrid(b, u);
  const goalSet = new Set(goal);
  const start = u.y * BOARD_SIZE + u.x;
  const prev = new Int16Array(BOARD_SIZE * BOARD_SIZE).fill(-1);
  prev[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % BOARD_SIZE;
    const cy = Math.floor(cur / BOARD_SIZE);
    for (const [dx, dy] of moveOffsets(u.kind)) {
      const x = cx + dx;
      const y = cy + dy;
      if (!standable(b.terrain, x, y)) continue;
      const n = y * BOARD_SIZE + x;
      if (grid[n] || prev[n] !== -1) continue;
      prev[n] = cur;
      if (reachesGoal(grid, b.terrain, u.side, u.kind, x, y, goalSet)) {
        let step = n;
        while (prev[step] !== start) step = prev[step];
        return [step % BOARD_SIZE, Math.floor(step / BOARD_SIZE)];
      }
      queue.push(n);
    }
  }
  return null;
}

/** Score of standing on a cell: 0 if something is in reach, else distance to the goal. */
function cellScore(b: Battle, u: Unit, x: number, y: number, goal: Unit[]): number {
  if (reachFrom(b, u.side, u.kind, x, y).length > 0) return 0;
  let best = Infinity;
  for (const g of goal) best = Math.min(best, manhattan(g, x, y));
  return best;
}

function greedyStep(b: Battle, u: Unit, goal: Unit[]): [number, number] | null {
  let best: [number, number] | null = null;
  let bestScore = cellScore(b, u, u.x, u.y, goal);
  for (const [dx, dy] of moveOffsets(u.kind)) {
    const x = u.x + dx;
    const y = u.y + dy;
    if (!standable(b.terrain, x, y) || unitAt(b, x, y)) continue;
    const score = cellScore(b, u, x, y, goal);
    if (score < bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  return best;
}

/** Can enemy `e` hit the cell (x, y) from where it stands now? */
function threatens(grid: Grid, terrain: Terrain[], e: Unit, x: number, y: number): boolean {
  const dx = x - e.x;
  const dy = y - e.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return true;
  if (e.kind === 'knight' && ((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1))) return true;
  const range = PIECES[e.kind].range;
  if (!range) return false;
  const straight = dx === 0 || dy === 0;
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const fits = e.kind === 'rook' ? straight : e.kind === 'bishop' ? diagonal : straight || diagonal;
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  if (!fits || dist > range) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (let i = 1; i < dist; i++) {
    const cx = e.x + sx * i;
    const cy = e.y + sy * i;
    if (grid[cy * BOARD_SIZE + cx] || isWall(terrain, cx, cy)) return false;
  }
  return true;
}

/** How dangerous a cell is for a king: threats weigh most, nearby enemies a little, friends reduce it. */
function kingDanger(grid: Grid, terrain: Terrain[], king: Unit, foes: Unit[], x: number, y: number): number {
  let danger = 0;
  for (const e of foes) {
    if (threatens(grid, terrain, e, x, y)) danger += 10;
    danger += 3 / Math.max(1, chebyshev(e, x, y));
  }
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const f = inside(x + ox, y + oy) ? grid[(y + oy) * BOARD_SIZE + x + ox] : undefined;
      if (f && f.side === king.side && (ox || oy)) danger -= 1.5;
    }
  }
  return danger;
}

/** When threatened, the king steps to a clearly safer neighbouring square. */
function kingEscape(b: Battle, king: Unit): [number, number] | null {
  // A king left without an army stands its ground instead of running until the clock ends.
  if (alive(b, king.side).length === 1) return null;
  const foes = alive(b, king.side === 'ally' ? 'enemy' : 'ally');
  const grid = buildGrid(b, king);
  const underThreat = foes.some((e) => threatens(grid, b.terrain, e, king.x, king.y) || chebyshev(e, king.x, king.y) <= 2);
  if (!underThreat) return null;
  let best: [number, number] | null = null;
  let bestDanger = kingDanger(grid, b.terrain, king, foes, king.x, king.y) - 2; // only move for a real gain
  for (const [dx, dy] of moveOffsets('king')) {
    const x = king.x + dx;
    const y = king.y + dy;
    if (!standable(b.terrain, x, y) || grid[y * BOARD_SIZE + x]) continue;
    const d = kingDanger(grid, b.terrain, king, foes, x, y);
    if (d < bestDanger) {
      bestDanger = d;
      best = [x, y];
    }
  }
  return best;
}

function moveUnit(b: Battle, u: Unit): void {
  if (u.moveCd === 0) {
    u.wait = 3;
    return;
  }
  if (u.kind === 'king') {
    // Kings never advance; they only step away from danger.
    u.wait = 3;
    return;
  }
  if (u.kind === 'pawn') {
    const ny = u.y + forward(u.side);
    let nx = u.x;
    if (inside(u.x, ny) && !walkable(b.terrain[ny * BOARD_SIZE + u.x])) {
      // Rock or water ahead: step around it diagonally, towards the centre first.
      const sides = u.x < BOARD_SIZE / 2 ? [1, -1] : [-1, 1];
      nx = sides.map((d) => u.x + d).find((x) => standable(b.terrain, x, ny) && !unitAt(b, x, ny)) ?? u.x;
    }
    if (standable(b.terrain, nx, ny) && !unitAt(b, nx, ny)) {
      u.x = nx;
      u.y = ny;
      u.wait = u.moveCd;
      const early = has(b, u.side, 'earlyCrown') ? 1 : 0;
      const promotes = u.side === 'ally' ? u.y <= early : u.y >= BOARD_SIZE - 1;
      if (promotes) {
        if (has(b, u.side, 'queensGambit')) u.atkMult *= 1.5;
        applyStats(u, 'queen');
        b.report[u.uid].promoted = true;
        b.report[u.uid].kind = 'queen';
        resetAbilityTimer(b, u, 0.5);
        u.promoted = true;
        if (u.side === 'ally') b.allyStats.promotions++;
        b.events.push({ type: 'promote', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX: u.x, fromY: u.y, fromUid: u.uid });
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
  // Prefer a real path to an attacking square; fall back to a greedy step
  // when every route is blocked for now.
  const best = pathStep(b, u, goal) ?? (goal !== enemies ? pathStep(b, u, enemies) : null) ?? greedyStep(b, u, goal);
  if (best) {
    [u.x, u.y] = best;
    u.wait = u.moveCd;
  } else {
    u.wait = 3;
  }
}

function act(b: Battle, u: Unit): void {
  if (u.kind === 'king') {
    const escape = kingEscape(b, u);
    if (escape) {
      [u.x, u.y] = escape;
      u.wait = u.moveCd;
      return;
    }
  }
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
    if (u.abilityTimer > 0) u.abilityTimer--;
    if (u.wait > 0) {
      u.wait--;
      continue;
    }
    if (!tryCast(b, u)) act(b, u);
    if (sideDefeated(b, 'ally') || sideDefeated(b, 'enemy')) break;
  }
  if (b.relics.has('royalHealer') && b.tick % HEAL_EVERY === 0) royalHeal(b);
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

/**
 * How many enemy pieces could hit each cell right at the start, given the
 * current placements (lines are blocked by any piece). Index: y * 8 + x.
 */
export function threatMap(setup: BattleSetup): number[] {
  const b = createBattle(setup);
  const grid = buildGrid(b);
  const counts = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  for (const e of b.units) {
    if (e.side !== 'enemy') continue;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if ((x !== e.x || y !== e.y) && threatens(grid, b.terrain, e, x, y)) counts[y * BOARD_SIZE + x]++;
      }
    }
  }
  return counts;
}

/** Share of the enemy army's total health removed, 0..1 (a won battle is 1). */
export function enemyDamageShare(b: Battle): number {
  if (b.result === 'win') return 1;
  let max = 0;
  let lost = 0;
  for (const u of b.units) {
    if (u.side !== 'enemy') continue;
    max += u.maxHp;
    lost += u.maxHp - Math.max(0, Math.min(u.maxHp, u.hp));
  }
  return max > 0 ? lost / max : 0;
}
