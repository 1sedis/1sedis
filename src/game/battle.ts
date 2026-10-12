import { HUNTERS, JUMPERS, KNIGHT_OFFSETS, PIECES, RANGED, levelMultiplier, lineDirections, moveOffsets, type PieceKind } from './pieces';
import { BOSSES, MAX_SUMMONS, WARN_TICKS, type BossId } from './bosses';
import type { Trait } from './elites';
import type { LegendId } from './roulette';
import type { NodeId } from './crownTree';
import { synergyBonus } from './synergies';
import { DARK_DRAIN, DARK_FLOOR, DARK_HEAL } from './distortions';
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
  /** Elite trait (enemies only). */
  trait?: Trait;
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
  /** Boss mechanic for the enemy boss piece, if any. */
  bossId?: BossId;
  /** Roulette buffs for the player's army. */
  allyKind?: Partial<Record<PieceKind, { atk: number; hp: number }>>;
  allyPawnShield?: number;
  allyCrit?: number;
  allyOpening?: number;
  legends?: LegendId[];
  /** Crown Tree doctrines that change the rules of battle. */
  perks?: NodeId[];
  /** Distortion "Пробуждение": enemies learn abilities this many levels earlier. */
  enemyAbilityShift?: number;
  /** Distortion "Король на поле": multipliers for the enemy king. */
  enemyKingHp?: number;
  enemyKingAtk?: number;
  /** Health and attack multipliers for every enemy piece (the finale's mirror copies the player's). */
  enemyHpMult?: number;
  enemyAtkMult?: number;
  /** Finale "Зеркало": the Hand keeps moving the player's strongest piece into the enemy lines. */
  handMeddle?: boolean;
  /** The player's own chess moves this battle (see playMove). */
  playerMoves?: number;
  /** Stop for the player's decisions (promotion, check, boss blows); off in simulations, which take the defaults. */
  decisions?: boolean;
  /** The special rule of an elite battle on the run map. */
  eliteRule?: EliteRule;
}

/**
 * Rules of elite battles: undying enemies rise again as shades, frenzied ones
 * strike faster, reinforcements keep arriving, darkness creeps over the board,
 * or the enemy is a mirror of the player's army (set up in state.ts).
 */
export type EliteRule = 'undying' | 'frenzy' | 'waves' | 'darkness' | 'mirror';

export const ELITE_RULES: Record<EliteRule, { name: string; text: string }> = {
  undying: { name: 'Бессмертные', text: 'первые три павших врага встают тенями с 40% здоровья' },
  frenzy: { name: 'Бешенство', text: 'враги бьют и ходят на треть быстрее' },
  waves: { name: 'Подкрепление', text: 'каждые 8 секунд к врагу подходит свежая фигура' },
  darkness: { name: 'Наступающая тьма', text: 'каждые 6 секунд тьма захватывает новые клетки вашей половины' },
  mirror: { name: 'Зеркало', text: 'против вас ваша же расстановка, только чёрная' },
};

/** A telegraphed boss blow: cells light up, then get hit. */
export interface BossWarning {
  at: number;
  cells: number[];
  damage: number;
  fromUid: number;
  /** Leave a rock on the first cell if it is free. */
  rock?: boolean;
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
  trait?: Trait;
  /** A furious elite has already announced its rage. */
  raged: boolean;
  /** A phoenix pawn has already come back once. */
  reborn: boolean;
  /** Has made its first move (for "Двойной шаг"). */
  moved: boolean;
  /** "Шах" can stun this king again from this tick. */
  checkReady: number;
  /** Came back from "Теневой резерв". */
  shade: boolean;
  /** "Призрачный": the tick it may blink again; traits on a timer count their uses here. */
  blinkReady: number;
  traitUses: number;
}

export interface BattleEvent {
  type: 'hit' | 'death' | 'promote' | 'heal' | 'save' | 'ability' | 'shieldBreak'
    | 'boss' | 'rage' | 'warn' | 'blast' | 'summon' | 'terrain'
    /** The Hand over the board moved a piece (from fromX/fromY to x/y). */
    | 'hand'
    /** The Hand turned the board over: every piece mirrored left to right. */
    | 'flip'
    /** The player's own move (fromX/fromY → x/y); label says which. */
    | 'order';
  /** Cells for 'warn', 'blast' and 'terrain' events (index y * 8 + x). */
  cells?: number[];
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
  /** Terrain per cell, index y * 8 + x (bosses can change it). */
  terrain: Terrain[];
  bossId?: BossId;
  bossUid?: number;
  /** 1 normal, 2 enraged (below half health). */
  bossPhase: 1 | 2;
  bossTimer: number;
  summons: number;
  warnings: BossWarning[];
  legends: ReadonlySet<LegendId>;
  /** Crown Tree doctrines (the player's side only). */
  perks: ReadonlySet<NodeId>;
  castled: boolean;
  /** Fallen pieces already returned by "Теневой резерв". */
  shadows: number;
  /** Which skill of a cycling boss comes next. */
  bossCycle: number;
  /** Finale: the Hand moves pieces from outside the board; ticks until it does. */
  handTimer: number;
  /** The player's moves left this battle. */
  movesLeft: number;
  /** Ask the player at decision points. */
  decisions: boolean;
  /** A decision waiting for the player; the battle is frozen until it is resolved. */
  decision: Decision | null;
  /** The first check of the battle was already offered; boss blows offered so far. */
  checkAsked: boolean;
  bossAsks: number;
  allyCrit: number;
  allyOpening: number;
  eliteRule?: EliteRule;
  /** Elite rule uses so far (shades risen, reinforcements sent). */
  eliteCount: number;
  /** Uids of the Black Queen's reflections: while one stands, she cannot be hurt. */
  reflections: number[];
}

export interface UnitReport {
  uid: number;
  side: Side;
  kind: PieceKind;
  boss: boolean;
  promoted: boolean;
  trait?: Trait;
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

function makeUnit(
  uid: number, side: Side, p: Placement, hpMult: number, atkMult: number, pawnMoveMult = 1, abilities = false, abilityShift = 0,
): Unit {
  const boss = !!p.boss;
  const u: Unit = {
    uid, side, kind: p.kind, level: p.level, boss, promoted: false,
    x: p.x, y: p.y, hp: 0, maxHp: 0, atk: 0, attackCd: 0, moveCd: 0, wait: 0, flash: 0,
    hpMult: hpMult * (boss ? BOSS_HP : 1),
    atkMult: atkMult * (boss ? BOSS_ATK : 1),
    pawnMoveMult, buff: 1, struck: false,
    tier: abilities ? abilityTier(p.level + abilityShift) : 0, abilityTimer: 0, strikes: 0, shield: 0, maxShield: 0, rallyUntil: 0, rallyMult: 1,
    cursedUntil: 0, curseMult: 1, trait: p.trait, raged: false, reborn: false, moved: false, checkReady: 0, shade: false, blinkReady: 0, traitUses: 0,
  };
  applyStats(u, p.kind);
  u.hp = u.maxHp;
  if (u.trait === 'swift') {
    u.pawnMoveMult *= 0.5;
    u.moveCd = Math.max(1, Math.round(u.moveCd * 0.5));
    u.attackCd = Math.max(1, Math.round(u.attackCd * 0.8));
  }
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
    const syn = synergyBonus(kinds, p.kind, setup.perks?.includes('heralds') ? 1 : 0);
    const rk = setup.allyKind?.[p.kind] ?? { atk: 1, hp: 1 };
    units.push(makeUnit(uid++, 'ally', p, hp * kingHp * syn.hp * rk.hp, atk * syn.atk * rk.atk, march, true));
  }
  // Legendary "shadow double": a half-strength copy next to the player's queen.
  const queen = setup.legends?.includes('double') ? setup.allies.find((p) => p.kind === 'queen') : undefined;
  if (queen) {
    const taken = new Set(units.map((u) => `${u.x},${u.y}`));
    const terrain = parseTerrain(setup.terrain);
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
      .map(([dx, dy]) => [queen.x + dx, queen.y + dy])
      .find(([x, y]) => x >= 0 && x < BOARD_SIZE && y >= 5 && y < BOARD_SIZE && !taken.has(`${x},${y}`) && walkable(terrain[y * BOARD_SIZE + x]));
    if (spot) {
      const rk = setup.allyKind?.queen ?? { atk: 1, hp: 1 };
      units.push(makeUnit(uid++, 'ally', { ...queen, x: spot[0], y: spot[1] }, hp * 0.5 * rk.hp, atk * 0.5 * rk.atk, march, true));
    }
  }
  for (const p of setup.enemies) {
    const king = p.kind === 'king';
    const hpm = (king ? setup.enemyKingHp ?? 1 : 1) * (setup.enemyHpMult ?? 1);
    const atkm = (king ? setup.enemyKingAtk ?? 1 : 1) * (setup.enemyAtkMult ?? 1);
    units.push(makeUnit(uid++, 'enemy', p, hpm, atkm, 1, true, setup.enemyAbilityShift ?? 0));
  }
  const report: Record<number, UnitReport> = {};
  for (const u of units) {
    report[u.uid] = {
      uid: u.uid, side: u.side, kind: u.kind, boss: u.boss, promoted: false, trait: u.trait, startX: u.x, startY: u.y,
      dealt: 0, taken: 0, healed: 0, kills: 0,
    };
  }
  const b: Battle = { units, tick: 0, result: null, events: [], kingMinRatio: 1, allyLosses: 0, relics, kingSaved: false,
    allyStats: { promotions: 0, kills: 0, crits: 0, abilities: 0 }, report, branches: { ...setup.allyBranches }, terrain: [...parseTerrain(setup.terrain)],
    bossPhase: 1, bossTimer: 0, summons: 0, warnings: [],
    legends: new Set(setup.legends ?? []), perks: new Set(setup.perks ?? []), castled: false, shadows: 0,
    bossCycle: 0, handTimer: setup.handMeddle ? HAND_FIRST : 0,
    movesLeft: setup.playerMoves ?? 0, decisions: !!setup.decisions, decision: null, checkAsked: false, bossAsks: 0,
    allyCrit: setup.allyCrit ?? 0, allyOpening: setup.allyOpening ?? 1, eliteRule: setup.eliteRule, eliteCount: 0, reflections: [] };
  if (b.eliteRule === 'frenzy') {
    for (const u of units) {
      if (u.side !== 'enemy') continue;
      u.attackCd = Math.max(1, Math.round(u.attackCd * 0.67));
      if (u.moveCd) u.moveCd = Math.max(1, Math.round(u.moveCd * 0.67));
    }
  }
  // "Туман войны": the enemy is blind for the first 3 seconds.
  if (b.perks.has('fog')) for (const u of units) if (u.side === 'enemy') u.wait += 30;
  const boss = setup.bossId ? units.find((u) => u.side === 'enemy' && u.boss) : undefined;
  if (boss && setup.bossId) {
    b.bossId = setup.bossId;
    b.bossUid = boss.uid;
    b.bossTimer = Math.round(BOSSES[setup.bossId].cooldown * 0.6);
    // The fortress never moves: it is a building.
    if (setup.bossId === 'fortress') boss.moveCd = 0;
  }
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
  if (setup.allyPawnShield) {
    for (const u of units) {
      if (u.side === 'ally' && u.kind === 'pawn') u.shield = u.maxShield = Math.max(u.shield, u.maxHp * setup.allyPawnShield);
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
  return ((h >>> 0) % 1000) / 1000 < CRIT_CHANCE + (u.side === 'ally' ? b.allyCrit : 0);
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
  if (JUMPERS.has(kind)) {
    for (const [dx, dy] of KNIGHT_OFFSETS) add(unitAt(b, x + dx, y + dy));
  }
  // "Король-полководец": the player's king strikes two squares in every direction.
  const warlord = kind === 'king' && side === 'ally' && b.perks.has('warlord');
  const range = warlord ? 2 : PIECES[kind].range;
  for (const [dx, dy] of warlord ? lineDirections('queen') : lineDirections(kind)) {
    for (let step = 1; step <= range; step++) {
      const cx = x + dx * step;
      const cy = y + dy * step;
      if (!inside(cx, cy) || (isWall(b.terrain, cx, cy) && !((kind === 'rook' || kind === 'chancellor') && side === 'ally' && b.legends.has('ram')))) break;
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
    if (HUNTERS.has(u.kind) && RANGED.has(t.kind)) return 1;
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
  if (u.trait === 'furious' && u.hp < u.maxHp * 0.5) damage *= 1.5;
  if (u.side === 'ally' && b.tick <= 50) damage *= b.allyOpening;
  if (RANGED.has(u.kind) && b.terrain[u.y * BOARD_SIZE + u.x] === 'hill') damage *= HILL_BONUS;
  if (b.tick < u.rallyUntil) damage *= u.rallyMult;
  if (has(b, u.side, 'warCry') && b.tick <= 60) damage *= 1.35;
  // "Знаменосец": a banner next to you.
  if (alive(b, u.side).some((f) => f !== u && f.trait === 'banner' && chebyshev(f, u.x, u.y) === 1)) damage *= 1.25;
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
    case 'archbishop': {
      const near = friends.filter((f) => f !== u && chebyshev(u, f.x, f.y) <= 1 && f.hp < f.maxHp);
      if (!near.length) return false;
      abilityEvent(b, u);
      for (const f of near) {
        const amount = Math.min(f.maxHp - f.hp, f.maxHp * (strong ? 0.25 : 0.15));
        f.hp += amount;
        b.report[u.uid].healed += amount;
        b.events.push({ type: 'heal', uid: f.uid, side: f.side, x: f.x, y: f.y, amount, fromX: u.x, fromY: u.y, fromUid: u.uid, fromKind: u.kind });
      }
      break;
    }
    case 'chancellor':
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
  if (u.kind === 'bishop' || u.kind === 'archbishop') {
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
    if (target.kind === 'rook' || target.kind === 'chancellor') m *= target.tier === 2 ? 0.5 : 0.65;
    if (target.kind === 'ghost') m *= target.tier === 2 ? 0.55 : 0.7;
  }
  let aura = 1;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const f = unitAt(b, target.x + dx, target.y + dy);
      if (!f || f.side !== target.side || f.tier !== 2 || !alt(b, f)) continue;
      if (f.kind === 'king') aura = Math.min(aura, 0.85);
      if (f.kind === 'rook' || f.kind === 'chancellor') aura = Math.min(aura, 0.8);
    }
  }
  m *= aura;
  if (b.tick < target.cursedUntil) m *= target.curseMult;
  if (b.terrain[target.y * BOARD_SIZE + target.x] === 'forest') m *= FOREST_DEFENSE;
  if (target.uid === b.bossUid && b.bossId === 'fortress' && b.bossPhase === 2) m *= 0.6;
  if (target.uid === b.bossUid && b.bossId === 'captain' && shieldWall(b, target)) m *= 0.35;
  if (target.uid === b.bossUid && b.bossId === 'queen' && b.reflections.some((id) => b.units.some((u) => u.uid === id && u.hp > 0))) m = 0;
  return m;
}

/** "Стена щитов": two of the captain's pawns next to him take the blows for him. */
export function shieldWall(b: Battle, captain: Unit): boolean {
  return alive(b, captain.side).filter((p) => p.kind === 'pawn' && chebyshev(captain, p.x, p.y) === 1).length >= 2;
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
  // Ghost's strike from the shadows: the first blow of the battle hits much harder.
  if (u.kind === 'ghost' && u.tier > 0 && !alt(b, u) && !u.struck) {
    damage *= u.tier === 2 ? 4 : 2.5;
    abilityEvent(b, u);
  }
  const big = target.kind === 'king' || target.boss;
  if (u.kind === 'rook' && big && has(b, u.side, 'heavyShot')) damage *= 1.5;
  const crit = isCrit(b, u);
  if (crit) {
    damage *= CRIT_MULT;
    if (u.side === 'ally') b.allyStats.crits++;
  }
  const legend = u.side === 'ally' ? b.legends : NO_LEGENDS;
  if (u.kind === 'king' && legend.has('wrath')) damage *= 2;
  dealDamage(b, u, target, damage, crit);
  if (u.kind === 'king' && legend.has('wrath')) {
    for (const f of alive(b, target.side)) if (f !== target && chebyshev(u, f.x, f.y) <= 1) dealDamage(b, u, f, damage * 0.6, false);
  }
  if (u.kind === 'bishop' && legend.has('beam')) beamThrough(b, u, target, damage);
  if (u.kind === 'rook' && legend.has('ram')) ramThrough(b, u, target, damage * 0.7);
  if (charge && u.tier === 2 && target.hp > 0) target.wait += 15;
  if (u.kind === 'knight' && !u.struck && has(b, u.side, 'stunJump') && target.hp > 0) target.wait += 20;
  if (u.kind === 'bishop' && has(b, u.side, 'piercing')) pierce(b, u, target, damage * 0.6);
  u.struck = true;
  u.wait = u.attackCd;
  // Chain jump: a knight that just felled its target acts again at once.
  if (u.kind === 'knight' && legend.has('chain') && target.hp <= 0) {
    u.wait = 0;
    traitEvent(b, u, 'Цепной прыжок!');
  }
}

const NO_LEGENDS: ReadonlySet<LegendId> = new Set();

/** Legendary beam: the bishop's shot goes on along the diagonal through every enemy in range. */
function beamThrough(b: Battle, u: Unit, target: Unit, damage: number): void {
  const dx = Math.sign(target.x - u.x);
  const dy = Math.sign(target.y - u.y);
  if (!dx || !dy) return;
  const range = PIECES.bishop.range;
  for (let step = chebyshev(u, target.x, target.y) + 1; step <= range; step++) {
    const x = u.x + dx * step;
    const y = u.y + dy * step;
    if (!inside(x, y) || isWall(b.terrain, x, y)) return;
    const t = unitAt(b, x, y);
    if (t && t.side !== u.side) dealDamage(b, u, t, damage, false);
  }
}

/** Legendary ram: the rook's shot also hits the next enemy behind its target, through anything. */
function ramThrough(b: Battle, u: Unit, target: Unit, damage: number): void {
  const dx = Math.sign(target.x - u.x);
  const dy = Math.sign(target.y - u.y);
  for (let x = target.x + dx, y = target.y + dy; inside(x, y); x += dx, y += dy) {
    const t = unitAt(b, x, y);
    if (t && t.side !== u.side) {
      dealDamage(b, u, t, damage, false);
      return;
    }
  }
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

function dealDamage(b: Battle, u: Unit, target: Unit, raw: number, crit: boolean, reflected = false): void {
  let damage = raw * defense(b, target);
  const shot = RANGED.has(u.kind) && chebyshev(u, target.x, target.y) > 1;
  if (target.trait === 'armored' && shot) damage *= 0.6;
  // "Неуловимый": shooters barely touch the Black Rider; catch him in melee.
  if (target.uid === b.bossUid && b.bossId === 'rider' && shot) damage *= 0.4;
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
  if (u.trait === 'vampire' && u.hp > 0 && landed > 0) u.hp = Math.min(u.maxHp, u.hp + landed * 0.3);
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
    if (target.trait === 'explosive') explode(b, target);
    if (u.side === 'ally' && b.legends.has('bloodlust') && u.hp > 0) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3);
    if (target.side === 'ally' && target.kind === 'pawn' && b.perks.has('sacrifice')) {
      for (const f of alive(b, 'ally')) {
        if (chebyshev(target, f.x, f.y) === 1) f.shield = f.maxShield = Math.max(f.shield, f.maxHp * 0.25);
      }
    }
    if (target.side === 'ally' && target.kind === 'pawn' && b.legends.has('phoenix') && !target.reborn) rebirth(b, target);
    else if (target.side === 'ally' && target.kind !== 'king' && b.perks.has('shadowReserve') && b.shadows < 2 && !target.shade) {
      returnAsShade(b, target);
    } else if (target.side === 'enemy' && b.eliteRule === 'undying' && b.eliteCount < 3 && !target.shade && !target.boss && target.kind !== 'king') {
      riseAsShade(b, target);
    }
  } else if (target.trait === 'furious' && !target.raged && target.hp < target.maxHp * 0.5) {
    target.raged = true;
    traitEvent(b, target, 'Ярость!');
  }
  if (target.trait === 'blinker' && target.hp > 0 && b.tick >= target.blinkReady) blink(b, target);
  if (target.trait === 'thorns' && !reflected && !shot && u.hp > 0 && damage > 0) {
    dealDamage(b, target, u, damage * 0.3, false, true);
  }
}

/** "Теневой резерв": a fallen piece comes back in the rear with a third of its health. */
function returnAsShade(b: Battle, u: Unit): void {
  for (const y of [7, 6, 5]) {
    for (const x of [3, 4, 2, 5, 1, 6, 0, 7]) {
      if (!standable(b.terrain, x, y) || unitAt(b, x, y)) continue;
      b.shadows++;
      u.shade = true;
      u.x = x;
      u.y = y;
      u.hp = u.maxHp / 3;
      u.wait = 10;
      b.allyLosses = Math.max(0, b.allyLosses - 1);
      delete b.report[u.uid].killedBy;
      traitEvent(b, u, 'Тень!');
      return;
    }
  }
}

/** Elite "Бессмертные": a fallen enemy rises in the enemy's rear with 40% of its health. */
function riseAsShade(b: Battle, u: Unit): void {
  for (const y of [0, 1, 2]) {
    for (const x of [3, 4, 2, 5, 1, 6, 0, 7]) {
      if (!standable(b.terrain, x, y) || unitAt(b, x, y)) continue;
      b.eliteCount++;
      u.shade = true;
      u.x = x;
      u.y = y;
      u.hp = u.maxHp * 0.4;
      u.wait = 12;
      b.allyStats.kills = Math.max(0, b.allyStats.kills - 1);
      traitEvent(b, u, 'Встаёт!');
      return;
    }
  }
}

/** A phoenix pawn comes back once, in the rear, with half its health. */
function rebirth(b: Battle, u: Unit): void {
  for (const y of [7, 6, 5]) {
    for (const x of [3, 4, 2, 5, 1, 6, 0, 7]) {
      if (!standable(b.terrain, x, y) || unitAt(b, x, y)) continue;
      u.reborn = true;
      u.x = x;
      u.y = y;
      u.hp = u.maxHp * 0.5;
      u.wait = 10;
      b.allyLosses = Math.max(0, b.allyLosses - 1);
      delete b.report[u.uid].killedBy;
      traitEvent(b, u, 'Феникс!');
      return;
    }
  }
}

function traitEvent(b: Battle, u: Unit, label: string): void {
  b.events.push({ type: 'ability', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX: u.x, fromY: u.y, fromUid: u.uid, fromKind: u.kind, label });
}

/** An explosive elite blows up when it falls, hitting every enemy next to it. */
/** "Призрачный": vanish and reappear on a free square two steps away. */
function blink(b: Battle, u: Unit): void {
  const spots: [number, number][] = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = u.x + dx;
      const y = u.y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 2 && standable(b.terrain, x, y) && !unitAt(b, x, y)) spots.push([x, y]);
    }
  }
  if (!spots.length) return;
  const [x, y] = spots[roll(b, u.uid + 31, spots.length)];
  u.x = x;
  u.y = y;
  u.blinkReady = b.tick + 30;
  traitEvent(b, u, 'Скачок!');
}

/** Traits on a timer: healers, summoners, shield-bearers. */
function traitTick(b: Battle): void {
  for (const u of b.units) {
    if (u.hp <= 0 || !u.trait) continue;
    const near = () => alive(b, u.side).filter((f) => f !== u && chebyshev(f, u.x, u.y) === 1);
    if (u.trait === 'healer' && b.tick % 30 === 0) {
      let healed = false;
      for (const f of near()) {
        if (f.hp >= f.maxHp) continue;
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.12);
        healed = true;
      }
      if (healed) traitEvent(b, u, 'Лечит!');
    }
    if (u.trait === 'warder' && b.tick % 40 === 0) {
      const list = near();
      for (const f of list) f.shield = f.maxShield = Math.max(f.shield, f.maxHp * 0.15);
      if (list.length) traitEvent(b, u, 'Щиты!');
    }
    if (u.trait === 'summoner' && b.tick % 60 === 0 && u.traitUses < 2 && summon(b, u, 'pawn', true)) {
      u.traitUses++;
      traitEvent(b, u, 'Ко мне!');
    }
  }
}

function explode(b: Battle, u: Unit): void {
  const cells: number[] = [];
  const victims: Unit[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = u.x + dx;
      const y = u.y + dy;
      if (!inside(x, y) || (!dx && !dy)) continue;
      cells.push(y * BOARD_SIZE + x);
      const t = unitAt(b, x, y);
      if (t && t.side !== u.side) victims.push(t);
    }
  }
  traitEvent(b, u, 'Взрыв!');
  b.events.push({ type: 'blast', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX: u.x, fromY: u.y, fromUid: u.uid, cells });
  for (const t of victims) dealDamage(b, u, t, u.atk * 1.5, false, true);
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

/** "Тьма на доске": once a second dark cells drain the player's pieces and heal enemies. */
function darkTick(b: Battle): void {
  for (const u of b.units) {
    if (u.hp <= 0 || b.terrain[u.y * BOARD_SIZE + u.x] !== 'dark') continue;
    const base = { uid: u.uid, side: u.side, x: u.x, y: u.y, fromX: u.x, fromY: u.y, fromUid: u.uid };
    if (u.side === 'ally') {
      const amount = Math.min(u.maxHp * DARK_DRAIN, Math.max(0, u.hp - DARK_FLOOR));
      if (amount <= 0) continue;
      u.hp -= amount;
      u.flash = 2;
      b.report[u.uid].taken += amount;
      if (u.kind === 'king') b.kingMinRatio = Math.min(b.kingMinRatio, u.hp / u.maxHp);
      b.events.push({ ...base, type: 'hit', amount, crit: false });
    } else if (u.hp < u.maxHp) {
      const amount = Math.min(u.maxHp - u.hp, u.maxHp * DARK_HEAL);
      u.hp += amount;
      b.report[u.uid].healed += amount;
      b.events.push({ ...base, type: 'heal', amount });
    }
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
  if (JUMPERS.has(kind) && KNIGHT_OFFSETS.some(([dx, dy]) => hit(x + dx, y + dy))) return true;
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
  if (JUMPERS.has(e.kind) && ((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1))) return true;
  const range = PIECES[e.kind].range;
  if (!range) return false;
  const straight = dx === 0 || dy === 0;
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const dirs = lineDirections(e.kind);
  const fits = dirs.length === 4 && dirs[0][0] * dirs[0][1] === 0 ? straight : dirs.length === 4 ? diagonal : straight || diagonal;
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
function kingDanger(grid: Grid, terrain: Terrain[], king: Unit, foes: Unit[], x: number, y: number, warned?: Set<number>): number {
  let danger = warned?.has(y * BOARD_SIZE + x) ? 25 : 0;
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

/** Can an enemy hit the king right now (or is it standing in a boss blast)? */
function kingThreatened(b: Battle, king: Unit): boolean {
  const grid = buildGrid(b, king);
  const foes = alive(b, king.side === 'ally' ? 'enemy' : 'ally');
  const blast = b.warnings.some((w) => w.cells.includes(king.y * BOARD_SIZE + king.x));
  return blast || foes.some((e) => threatens(grid, b.terrain, e, king.x, king.y));
}

/** When threatened, the king steps to a clearly safer neighbouring square. */
function kingEscape(b: Battle, king: Unit): [number, number] | null {
  // Boss blows only hit the player's side; the king sees the red cells coming.
  const warned = king.side === 'ally' ? new Set(b.warnings.flatMap((w) => w.cells)) : undefined;
  const inBlast = !!warned?.has(king.y * BOARD_SIZE + king.x);
  // A king left without an army stands its ground instead of running until the clock ends.
  if (alive(b, king.side).length === 1 && !inBlast) return null;
  const foes = alive(b, king.side === 'ally' ? 'enemy' : 'ally');
  const grid = buildGrid(b, king);
  const underThreat = inBlast
    || foes.some((e) => threatens(grid, b.terrain, e, king.x, king.y) || chebyshev(e, king.x, king.y) <= 2);
  if (!underThreat) return null;
  let best: [number, number] | null = null;
  let bestDanger = kingDanger(grid, b.terrain, king, foes, king.x, king.y, warned) - 2; // only move for a real gain
  for (const [dx, dy] of moveOffsets('king')) {
    const x = king.x + dx;
    const y = king.y + dy;
    if (!standable(b.terrain, x, y) || grid[y * BOARD_SIZE + x]) continue;
    const d = kingDanger(grid, b.terrain, king, foes, x, y, warned);
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
    // Kings never advance; they only step away from danger. In a duel of lone kings they meet,
    // and a warlord king leads the charge.
    const duel = alive(b, u.side).length === 1 && alive(b, u.side === 'ally' ? 'enemy' : 'ally').length === 1;
    const warlord = u.side === 'ally' && b.perks.has('warlord');
    const step = duel || warlord ? pathStep(b, u, alive(b, u.side === 'ally' ? 'enemy' : 'ally')) : null;
    if (step) {
      [u.x, u.y] = step;
      u.wait = u.moveCd;
    } else u.wait = 3;
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
      // "Двойной шаг": the first move goes two squares if the way is clear.
      const ny2 = ny + forward(u.side);
      if (u.side === 'ally' && !u.moved && nx === u.x && b.perks.has('doubleStep') && standable(b.terrain, nx, ny2) && !unitAt(b, nx, ny2)) {
        u.y = ny2;
      } else u.y = ny;
      u.x = nx;
      u.moved = true;
      u.wait = u.moveCd;
      const early = (has(b, u.side, 'earlyCrown') ? 1 : 0) + (u.side === 'ally' && b.perks.has('earlyCrown') ? 2 : 0);
      const promotes = u.side === 'ally' ? u.y <= early : u.y >= BOARD_SIZE - 1;
      if (promotes) {
        promote(b, u, 'queen');
      }
    } else {
      u.wait = 3; // hold the line
    }
    return;
  }
  const enemies = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
  // Knights hunt shooters and the king first.
  let goal = enemies;
  if (HUNTERS.has(u.kind)) {
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

function promote(b: Battle, u: Unit, kind: PieceKind): void {
  if (has(b, u.side, 'queensGambit')) u.atkMult *= 1.5;
  applyStats(u, kind);
  b.report[u.uid].promoted = true;
  b.report[u.uid].kind = kind;
  resetAbilityTimer(b, u, 0.5);
  u.promoted = true;
  if (u.side === 'ally') b.allyStats.promotions++;
  b.events.push({ type: 'promote', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX: u.x, fromY: u.y, fromUid: u.uid });
}

function act(b: Battle, u: Unit): void {
  // The Hand never moves: it strikes whoever comes close and works through its skills.
  if (u.uid === b.bossUid && b.bossId === 'hand') {
    const near = reachFrom(b, u.side, u.kind, u.x, u.y);
    if (near.length) strike(b, u, pickTarget(u, near));
    else u.wait = 3;
    return;
  }
  const warlord = u.kind === 'king' && u.side === 'ally' && b.perks.has('warlord');
  if (u.kind === 'king' && !warlord) {
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
  if (b.result || b.decision) return;
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
  if (b.tick % 10 === 0 && b.terrain.includes('dark')) darkTick(b);
  if (!sideDefeated(b, 'ally') && !sideDefeated(b, 'enemy')) {
    bossTick(b);
    eliteTick(b);
    if (b.tick % 10 === 0) traitTick(b);
  }
  if (b.decisions && !b.checkAsked && !b.decision) offerCheck(b);
  if (b.handTimer > 0 && --b.handTimer === 0 && !sideDefeated(b, 'ally') && !sideDefeated(b, 'enemy')) {
    meddle(b);
    b.handTimer = HAND_EVERY;
  }
  b.units = b.units.filter((u) => u.hp > 0 || u.flash > 0);
  if (sideDefeated(b, 'ally')) b.result = 'loss';
  else if (sideDefeated(b, 'enemy')) b.result = 'win';
  else if (b.tick >= MAX_TICKS) b.result = 'loss';
}

// ---------- Elite rules ----------

function eliteTick(b: Battle): void {
  if (!b.eliteRule) return;
  const src = alive(b, 'enemy').find((u) => u.kind === 'king') ?? alive(b, 'enemy')[0];
  if (!src) return;
  if (b.eliteRule === 'waves' && b.tick % 80 === 0 && b.eliteCount < 5) {
    // Reinforcements: pawns, and every third one a knight.
    if (summon(b, src, b.eliteCount % 3 === 2 ? 'knight' : 'pawn', true)) {
      b.eliteCount++;
      traitEvent(b, src, 'Подкрепление!');
    }
  }
  if (b.eliteRule === 'darkness' && b.tick % 60 === 0 && b.eliteCount < 8) {
    b.eliteCount++;
    spreadDark(b, src, 2);
  }
}

// ---------- Bosses ----------

/** Finale "Зеркало": first move of the Hand and the pause between moves (ticks). */
const HAND_FIRST = 60;
const HAND_EVERY = 90;

/** A deterministic pseudo-random number for boss choices. */
function roll(b: Battle, salt: number, n: number): number {
  let h = Math.imul(b.tick ^ Math.imul(salt, 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % Math.max(1, n);
}

function freeCells(b: Battle, rows: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const y of rows) for (let x = 0; x < BOARD_SIZE; x++) if (standable(b.terrain, x, y) && !unitAt(b, x, y)) out.push([x, y]);
  return out;
}

/** The Hand lifts a piece and puts it down elsewhere. */
function handMove(b: Battle, u: Unit, x: number, y: number, by: Unit | undefined): void {
  const from = { fromX: u.x, fromY: u.y };
  u.x = x;
  u.y = y;
  u.wait = Math.max(u.wait, 6);
  b.events.push({ type: 'hand', uid: u.uid, side: u.side, x, y, amount: 0, ...from, fromUid: by?.uid ?? u.uid });
}

/** "Зеркало": the Hand drops the player's strongest piece into the enemy lines. */
function meddle(b: Battle): void {
  const piece = alive(b, 'ally').filter((u) => u.kind !== 'king' && !u.boss).sort((a, c) => c.atk - a.atk || a.uid - c.uid)[0];
  const cells = freeCells(b, [2, 3]);
  if (!piece || !cells.length) return;
  const [x, y] = cells[roll(b, piece.uid, cells.length)];
  handMove(b, piece, x, y, undefined);
}

/** Turn dark a few plain cells of the middle and the player's rows. */
function spreadDark(b: Battle, boss: Unit, count: number): void {
  const plain: number[] = [];
  for (let i = 3 * BOARD_SIZE; i < BOARD_SIZE * BOARD_SIZE; i++) if (b.terrain[i] === 'plain') plain.push(i);
  const cells: number[] = [];
  for (let n = 0; n < count && plain.length; n++) cells.push(...plain.splice(roll(b, n + 7, plain.length), 1));
  for (const i of cells) b.terrain[i] = 'dark';
  if (cells.length) {
    b.events.push({ type: 'terrain', uid: boss.uid, side: boss.side, x: boss.x, y: boss.y, amount: 0, fromX: boss.x, fromY: boss.y, fromUid: boss.uid, cells });
  }
}

const TRAIT_POOL: Trait[] = ['armored', 'furious', 'vampire', 'thorns', 'swift'];

/** One distortion of the Black King; returns its name. */
function distort(b: Battle, boss: Unit, which: number): string {
  switch (which % 4) {
    case 0:
      spreadDark(b, boss, 2);
      return 'Тьма';
    case 1:
      for (const u of alive(b, boss.side)) if (u.tier > 0) u.abilityTimer = 0;
      return 'Пробуждение';
    case 2: {
      const plain = alive(b, boss.side).filter((u) => !u.trait && !u.boss && u.kind !== 'king');
      const u = plain[roll(b, 3, plain.length)];
      if (u) {
        u.trait = TRAIT_POOL[roll(b, 5, TRAIT_POOL.length)];
        b.report[u.uid].trait = u.trait;
        if (u.trait === 'swift') {
          u.moveCd = Math.max(1, Math.round(u.moveCd * 0.5));
          u.attackCd = Math.max(1, Math.round(u.attackCd * 0.8));
        }
      }
      return 'Чёрная гвардия';
    }
    default: {
      const amount = Math.min(boss.maxHp - boss.hp, boss.maxHp * 0.12);
      boss.hp += amount;
      b.events.push({ type: 'heal', uid: boss.uid, side: boss.side, x: boss.x, y: boss.y, amount, fromX: boss.x, fromY: boss.y, fromUid: boss.uid });
      return 'Королевская кровь';
    }
  }
}

/** "Переворот доски": every piece and every cell is mirrored left to right. */
function flipBoard(b: Battle, boss: Unit): void {
  for (const u of b.units) u.x = BOARD_SIZE - 1 - u.x;
  const t = [...b.terrain];
  for (let i = 0; i < t.length; i++) b.terrain[i] = t[Math.floor(i / BOARD_SIZE) * BOARD_SIZE + BOARD_SIZE - 1 - (i % BOARD_SIZE)];
  b.warnings = [];
  b.events.push({ type: 'flip', uid: boss.uid, side: boss.side, x: boss.x, y: boss.y, amount: 0, fromX: boss.x, fromY: boss.y, fromUid: boss.uid });
}

function bossTick(b: Battle): void {
  resolveWarnings(b);
  if (!b.bossId) return;
  const boss = b.units.find((u) => u.uid === b.bossUid && u.hp > 0);
  if (!boss) {
    b.warnings = [];
    return;
  }
  const def = BOSSES[b.bossId];
  if (b.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) {
    b.bossPhase = 2;
    enrage(b, boss);
    b.bossTimer = Math.min(b.bossTimer, 20);
  }
  if (--b.bossTimer > 0) return;
  b.bossTimer = castBoss(b, boss) ? (b.bossPhase === 2 ? def.rageCooldown : def.cooldown) : 10;
}

function bossEvent(b: Battle, boss: Unit, type: 'boss' | 'rage', label: string): void {
  b.events.push({ type, uid: boss.uid, side: boss.side, x: boss.x, y: boss.y, amount: 0, fromX: boss.x, fromY: boss.y, fromUid: boss.uid, fromKind: boss.kind, label });
}

function enrage(b: Battle, boss: Unit): void {
  const def = BOSSES[b.bossId!];
  bossEvent(b, boss, 'rage', def.rage);
  switch (b.bossId) {
    case 'captain':
      for (const p of alive(b, boss.side)) {
        if (p.kind === 'pawn') p.shield = p.maxShield = Math.max(p.shield, p.maxHp * 0.3);
      }
      break;
    case 'rider':
      // "Табун": two black knights ride in.
      summon(b, boss, 'knight', true);
      summon(b, boss, 'knight', true);
      boss.atkMult *= 1.2;
      applyStats(boss, boss.kind);
      break;
    case 'guardian':
      boss.atkMult *= 1.3;
      applyStats(boss, boss.kind);
      break;
    case 'queen': {
      // "Отражения": two copies of the queen; while one stands, she cannot be hurt.
      for (let i = 0; i < 2; i++) {
        const r = summon(b, boss, 'queen', true, 0.3, 0.5);
        if (r) {
          r.shade = true;
          b.reflections.push(r.uid);
        }
      }
      break;
    }
    case 'blackKing':
      for (let i = 0; i < 4; i++) distort(b, boss, i);
      boss.atkMult *= 1.3;
      applyStats(boss, boss.kind);
      break;
    case 'hand':
      flipBoard(b, boss);
      spreadDark(b, boss, 3);
      boss.atkMult *= 1.3;
      applyStats(boss, boss.kind);
      break;
    default:
      break;
  }
}

/**
 * Put a fresh piece (a pawn by default) on a free cell of the enemy's back rows,
 * close to the summoner. `free` summons do not count against the boss limit.
 */
function summon(b: Battle, boss: Unit, kind: PieceKind = 'pawn', free = false, hpMult = 1, atkMult = 1): Unit | null {
  const cells: [number, number][] = [];
  for (const y of [1, 2]) for (let x = 0; x < BOARD_SIZE; x++) if (standable(b.terrain, x, y) && !unitAt(b, x, y)) cells.push([x, y]);
  if (!cells.length) return null;
  cells.sort((a, c) => chebyshev(boss, a[0], a[1]) - chebyshev(boss, c[0], c[1]) || a[0] - c[0]);
  const [x, y] = cells[0];
  const uid = Math.max(...b.units.map((u) => u.uid), ...Object.keys(b.report).map(Number)) + 1;
  const u = makeUnit(uid, boss.side, { kind, x, y, level: boss.level }, hpMult, atkMult, 1, true);
  u.wait = 10;
  b.units.push(u);
  b.report[uid] = { uid, side: u.side, kind, boss: false, promoted: false, startX: x, startY: y, dealt: 0, taken: 0, healed: 0, kills: 0 };
  if (!free) b.summons++;
  b.events.push({ type: 'summon', uid, side: u.side, x, y, amount: 0, fromX: boss.x, fromY: boss.y, fromUid: boss.uid, fromKind: kind });
  return u;
}

function warn(b: Battle, boss: Unit, cells: number[], damage: number, rock = false): void {
  b.warnings.push({ at: b.tick + WARN_TICKS, cells, damage, fromUid: boss.uid, rock });
  const hit = new Set(cells);
  if (b.decisions && !b.decision && b.bossAsks < MAX_BOSS_ASKS && alive(b, 'ally').some((u) => hit.has(u.y * BOARD_SIZE + u.x))) {
    b.bossAsks++;
    ask(b, { kind: 'boss', uid: boss.uid, options: ['scatter', 'brace', 'none'], fallback: 'none', cells });
  }
  b.events.push({ type: 'warn', uid: boss.uid, side: boss.side, x: boss.x, y: boss.y, amount: WARN_TICKS, fromX: boss.x, fromY: boss.y, fromUid: boss.uid, cells });
}

function castBoss(b: Battle, boss: Unit): boolean {
  const def = BOSSES[b.bossId!];
  const foes = alive(b, 'ally');
  if (!foes.length) return false;
  const damage = baseDamage(b, boss);
  const idx = (x: number, y: number) => y * BOARD_SIZE + x;
  switch (b.bossId) {
    case 'captain': {
      if (b.summons >= MAX_SUMMONS || !summon(b, boss)) return false;
      break;
    }
    case 'rider': {
      const priority = (t: Unit) => (RANGED.has(t.kind) ? 0 : t.kind === 'king' ? 1 : 2);
      const targets = [...foes].sort((a, c) => priority(a) - priority(c) || a.hp - c.hp || a.uid - c.uid);
      for (const t of targets) {
        const spot = moveOffsets('king').map(([dx, dy]) => [t.x + dx, t.y + dy] as const)
          .find(([x, y]) => standable(b.terrain, x, y) && !unitAt(b, x, y));
        if (!spot) continue;
        bossEvent(b, boss, 'boss', def.skill);
        boss.x = spot[0];
        boss.y = spot[1];
        dealDamage(b, boss, t, damage * 1.5, false);
        if (t.hp > 0) t.wait += 10;
        boss.wait = boss.attackCd;
        return true;
      }
      return false;
    }
    case 'fortress': {
      // Enraged, every other cast is "Залп": the whole row with most of your pieces.
      if (b.bossPhase === 2 && b.bossCycle++ % 2 === 0) {
        const perRow = new Array(BOARD_SIZE).fill(0);
        for (const f of foes) if (f.y >= 3) perRow[f.y]++;
        const row = perRow.indexOf(Math.max(...perRow));
        warn(b, boss, Array.from({ length: BOARD_SIZE }, (_, x) => idx(x, row)), damage * 1.3);
        bossEvent(b, boss, 'boss', 'Залп');
        return true;
      }
      const target = [...foes].sort((a, c) => c.hp - a.hp || a.uid - c.uid)[0];
      const cells = [idx(target.x, target.y)];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) {
        const x = target.x + dx;
        const y = target.y + dy;
        if (inside(x, y) && y >= 3 && cells.length < 3) cells.push(idx(x, y));
      }
      warn(b, boss, cells, damage * 1.4, true);
      break;
    }
    case 'queen': {
      const perFile = new Array(BOARD_SIZE).fill(0);
      for (const f of foes) perFile[f.x]++;
      const file = perFile.indexOf(Math.max(...perFile));
      warn(b, boss, Array.from({ length: BOARD_SIZE }, (_, y) => idx(file, y)), damage);
      break;
    }
    case 'guardian': {
      const crowd = (u: Unit) => foes.filter((f) => chebyshev(u, f.x, f.y) <= 1).length;
      const centre = [...foes].sort((a, c) => crowd(c) - crowd(a) || a.uid - c.uid)[0];
      const cells: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(centre.x + dx, centre.y + dy)) cells.push(idx(centre.x + dx, centre.y + dy));
      warn(b, boss, cells, damage * 1.2);
      break;
    }
    case 'blackKing': {
      bossEvent(b, boss, 'boss', distort(b, boss, b.bossCycle++));
      return true;
    }
    case 'hand': {
      const step = b.bossCycle++ % 4;
      if (step === 0) {
        // "Ладонь": a 3×3 slam on the thickest crowd.
        const crowd = (u: Unit) => foes.filter((f) => chebyshev(u, f.x, f.y) <= 1).length;
        const centre = [...foes].sort((a, c) => crowd(c) - crowd(a) || a.uid - c.uid)[0];
        const cells: number[] = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(centre.x + dx, centre.y + dy)) cells.push(idx(centre.x + dx, centre.y + dy));
        warn(b, boss, cells, damage * 2);
        bossEvent(b, boss, 'boss', 'Ладонь');
      } else if (step === 1) {
        // "Щелчок": the strongest piece is flicked hard.
        const t = foes.filter((f) => f.kind !== 'king').sort((a, c) => c.atk - a.atk || a.uid - c.uid)[0] ?? foes[0];
        // Hard enough to break the strongest piece: most of its health, whatever the levels.
        warn(b, boss, [idx(t.x, t.y)], Math.max(damage * 2.5, t.maxHp * 0.7));
        bossEvent(b, boss, 'boss', 'Щелчок');
      } else if (step === 2) {
        // "Перестановка": up to three pieces are put down somewhere else.
        const pieces = foes.filter((f) => f.kind !== 'king');
        for (let n = 0; n < 3 && pieces.length; n++) {
          const u = pieces.splice(roll(b, n + 11, pieces.length), 1)[0];
          const cells = freeCells(b, [3, 4, 5, 6, 7]);
          if (!cells.length) break;
          const [x, y] = cells[roll(b, u.uid, cells.length)];
          handMove(b, u, x, y, boss);
        }
        bossEvent(b, boss, 'boss', 'Перестановка');
      } else {
        if (b.summons < 8) summon(b, boss);
        if (b.summons < 8) summon(b, boss);
        bossEvent(b, boss, 'boss', 'Тени партий');
      }
      return true;
    }
    default:
      return false;
  }
  bossEvent(b, boss, 'boss', def.skill);
  return true;
}

function resolveWarnings(b: Battle): void {
  const due = b.warnings.filter((w) => w.at <= b.tick);
  if (!due.length) return;
  b.warnings = b.warnings.filter((w) => w.at > b.tick);
  for (const w of due) {
    const src = b.units.find((u) => u.uid === w.fromUid && u.hp > 0);
    if (!src) continue;
    b.events.push({ type: 'blast', uid: src.uid, side: src.side, x: src.x, y: src.y, amount: 0, fromX: src.x, fromY: src.y, fromUid: src.uid, cells: w.cells });
    for (const i of w.cells) {
      const t = unitAt(b, i % BOARD_SIZE, Math.floor(i / BOARD_SIZE));
      if (t && t.side !== src.side) dealDamage(b, src, t, w.damage, false);
    }
    if (w.rock) {
      const i = w.cells.find((c) => {
        const y = Math.floor(c / BOARD_SIZE);
        return y >= 3 && y <= 6 && walkable(b.terrain[c]) && !unitAt(b, c % BOARD_SIZE, y);
      });
      if (i !== undefined) {
        b.terrain[i] = 'rock';
        const x = i % BOARD_SIZE;
        const y = Math.floor(i / BOARD_SIZE);
        b.events.push({ type: 'terrain', uid: src.uid, side: src.side, x, y, amount: 0, fromX: src.x, fromY: src.y, fromUid: src.uid, cells: [i] });
      }
    }
  }
}

/** Run a battle to completion (used by tests and balance checks). */
export function simulate(b: Battle): Battle['result'] {
  while (!b.result) {
    if (b.decision) resolveDecision(b);
    stepBattle(b);
  }
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

// ---------- The player's moves and decisions ----------

/** Player moves per battle. */
export const MOVES_PER_BATTLE = 2;
/** A capture takes an ordinary piece off the board; a king or boss loses this share of its health and is stunned (ticks). */
export const CAPTURE_ROYAL = 0.2;
export const CAPTURE_STUN = 20;
const MAX_BOSS_ASKS = 4;

export type DecisionKind = 'check' | 'boss';

/** A question the battle stops for. */
export interface Decision {
  kind: DecisionKind;
  uid: number;
  options: string[];
  /** What happens when the player does not answer. */
  fallback: string;
  /** Cells of a boss blow. */
  cells?: number[];
}

export interface PlayerMove {
  uid: number;
  x: number;
  y: number;
  type: 'move' | 'capture' | 'castle';
}

function ask(b: Battle, d: Decision): void {
  b.decision = d;
}

/** The first time an enemy can strike the player's king, offer a way out. */
function offerCheck(b: Battle): void {
  const king = alive(b, 'ally').find((u) => u.kind === 'king' && !u.boss);
  if (!king || !kingThreatened(b, king)) return;
  b.checkAsked = true;
  const options = ['escape', 'block'];
  if (castleRook(b, king)) options.push('castle');
  options.push('none');
  ask(b, { kind: 'check', uid: king.uid, options, fallback: 'none' });
}

function castleRook(b: Battle, king: Unit): Unit | undefined {
  if (b.castled) return undefined;
  return alive(b, king.side).filter((f) => f.kind === 'rook' || f.kind === 'chancellor')
    .sort((a, c) => chebyshev(king, a.x, a.y) - chebyshev(king, c.x, c.y) || a.uid - c.uid)[0];
}

function orderEvent(b: Battle, u: Unit, fromX: number, fromY: number, label: string): void {
  b.events.push({ type: 'order', uid: u.uid, side: u.side, x: u.x, y: u.y, amount: 0, fromX, fromY, fromUid: u.uid, fromKind: u.kind, label });
}

/** Answer the pending decision (an unknown answer counts as the fallback). */
export function resolveDecision(b: Battle, answer?: string): void {
  const d = b.decision;
  if (!d) return;
  b.decision = null;
  const choice = answer && d.options.includes(answer) ? answer : d.fallback;
  const u = b.units.find((x) => x.uid === d.uid && x.hp > 0);
  if (d.kind === 'check' && u) {
    const fromX = u.x;
    const fromY = u.y;
    if (choice === 'escape') {
      const spot = kingEscape(b, u);
      if (spot) {
        [u.x, u.y] = spot;
        orderEvent(b, u, fromX, fromY, 'Отступление');
      }
    } else if (choice === 'block') {
      // The nearest piece steps between the king and the closest attacker.
      const foes = alive(b, 'enemy').filter((e) => threatens(buildGrid(b), b.terrain, e, u.x, u.y));
      const foe = foes.sort((a, c) => chebyshev(u, a.x, a.y) - chebyshev(u, c.x, c.y))[0];
      if (foe) {
        const sx = Math.sign(foe.x - u.x);
        const sy = Math.sign(foe.y - u.y);
        const cell: [number, number] = [u.x + sx, u.y + sy];
        const guard = alive(b, 'ally').filter((f) => f !== u && !f.boss)
          .sort((a, c) => chebyshev(a, cell[0], cell[1]) - chebyshev(c, cell[0], cell[1]) || a.uid - c.uid)[0];
        if (guard && standable(b.terrain, cell[0], cell[1]) && !unitAt(b, cell[0], cell[1])) {
          const gx = guard.x;
          const gy = guard.y;
          [guard.x, guard.y] = cell;
          guard.wait = Math.max(guard.wait, 4);
          orderEvent(b, guard, gx, gy, 'Заслон');
        }
      }
    } else if (choice === 'castle') {
      const rook = castleRook(b, u);
      if (rook) castle(b, u, rook);
    }
    return;
  }
  if (d.kind === 'boss' && d.cells) {
    const hit = new Set(d.cells);
    const inside = alive(b, 'ally').filter((f) => hit.has(f.y * BOARD_SIZE + f.x));
    for (const f of inside) {
      if (choice === 'scatter') {
        const spot = moveOffsets('king').map(([dx, dy]) => [f.x + dx, f.y + dy] as const)
          .find(([x, y]) => standable(b.terrain, x, y) && !unitAt(b, x, y) && !hit.has(y * BOARD_SIZE + x));
        if (spot) {
          const fx = f.x;
          const fy = f.y;
          [f.x, f.y] = spot;
          orderEvent(b, f, fx, fy, '');
        }
      } else if (choice === 'brace') {
        f.shield = f.maxShield = Math.max(f.shield, f.maxHp * 0.4);
      }
    }
  }
}

function castle(b: Battle, king: Unit, rook: Unit): void {
  b.castled = true;
  const kx = king.x;
  const ky = king.y;
  [king.x, king.y, rook.x, rook.y] = [rook.x, rook.y, king.x, king.y];
  king.wait = Math.max(king.wait, 4);
  orderEvent(b, king, kx, ky, 'Рокировка!');
}

/** Where a piece of the player may go right now: real chess moves, blocked by pieces, rock and water. */
export function legalMoves(b: Battle, uid: number): PlayerMove[] {
  const u = b.units.find((x) => x.uid === uid && x.hp > 0 && x.side === 'ally');
  if (!u || u.kind === 'king' && u.boss) return [];
  const out: PlayerMove[] = [];
  const at = (x: number, y: number) => {
    if (!inside(x, y) || !standable(b.terrain, x, y)) return 'wall' as const;
    const o = unitAt(b, x, y);
    if (!o) return 'empty' as const;
    return o.side === u.side ? 'friend' as const : 'foe' as const;
  };
  if (u.kind === 'pawn') {
    const f = forward(u.side);
    if (at(u.x, u.y + f) === 'empty') {
      out.push({ uid, x: u.x, y: u.y + f, type: 'move' });
      if (!u.moved && at(u.x, u.y + 2 * f) === 'empty') out.push({ uid, x: u.x, y: u.y + 2 * f, type: 'move' });
    }
    for (const dx of [-1, 1]) if (at(u.x + dx, u.y + f) === 'foe') out.push({ uid, x: u.x + dx, y: u.y + f, type: 'capture' });
    return out;
  }
  const slides = u.kind === 'king' ? [] : lineDirections(u.kind);
  for (const [dx, dy] of slides) {
    for (let x = u.x + dx, y = u.y + dy; ; x += dx, y += dy) {
      const c = at(x, y);
      if (c === 'empty') out.push({ uid, x, y, type: 'move' });
      else {
        if (c === 'foe') out.push({ uid, x, y, type: 'capture' });
        break;
      }
    }
  }
  const sliding = new Set(slides.map(([dx, dy]) => `${dx},${dy}`));
  for (const [dx, dy] of moveOffsets(u.kind)) {
    if (sliding.has(`${dx},${dy}`)) continue;
    const c = at(u.x + dx, u.y + dy);
    if (c === 'empty') out.push({ uid, x: u.x + dx, y: u.y + dy, type: 'move' });
    else if (c === 'foe') out.push({ uid, x: u.x + dx, y: u.y + dy, type: 'capture' });
  }
  if (u.kind === 'king') {
    const rook = castleRook(b, u);
    if (rook) out.push({ uid, x: rook.x, y: rook.y, type: 'castle' });
  }
  return out;
}

/**
 * Make one of the player's moves. A move to an empty square relocates the
 * piece; a capture strikes the enemy hard and stuns it, taking its square if
 * it falls (a slider that leaves it alive stops right before it).
 */
export function playMove(b: Battle, uid: number, x: number, y: number): boolean {
  if (b.result || b.decision || b.movesLeft <= 0) return false;
  const m = legalMoves(b, uid).find((mv) => mv.x === x && mv.y === y);
  if (!m) return false;
  const u = b.units.find((v) => v.uid === uid)!;
  const fromX = u.x;
  const fromY = u.y;
  b.movesLeft--;
  u.moved = true;
  if (m.type === 'castle') {
    castle(b, u, unitAt(b, x, y)!);
    return true;
  }
  if (m.type === 'move') {
    u.x = x;
    u.y = y;
    u.wait = Math.max(u.wait, 4);
    orderEvent(b, u, fromX, fromY, 'Ход');
    const early = (has(b, u.side, 'earlyCrown') ? 1 : 0) + (b.perks.has('earlyCrown') ? 2 : 0);
    if (u.kind === 'pawn' && u.y <= early) promote(b, u, 'queen');
    return true;
  }
  const target = unitAt(b, x, y)!;
  // As in chess, a capture takes an ordinary piece off the board; kings and bosses only reel.
  const royal = target.kind === 'king' || target.boss;
  const damage = royal ? target.maxHp * CAPTURE_ROYAL : target.hp + target.shield + 1;
  orderEvent(b, u, fromX, fromY, 'Взятие!');
  dealDamage(b, u, target, damage, false);
  // "Вилка": a jumping capture also lands on a second enemy within the jump.
  if (JUMPERS.has(u.kind) && b.perks.has('fork')) {
    const second = moveOffsets('knight').map(([dx, dy]) => unitAt(b, x + dx, y + dy))
      .find((t) => t && t !== target && t.side !== u.side);
    if (second) dealDamage(b, u, second, damage * 0.6, false);
  }
  if (target.hp > 0) {
    // "Шах": a captured king is stunned three times as long.
    const stun = target.kind === 'king' && b.perks.has('check') ? CAPTURE_STUN * 3 : CAPTURE_STUN;
    target.wait = Math.max(target.wait, stun);
    if (stun > CAPTURE_STUN) traitEvent(b, target, 'Шах!');
    if (!JUMPERS.has(u.kind) && u.kind !== 'pawn') {
      const dx = Math.sign(x - fromX);
      const dy = Math.sign(y - fromY);
      [u.x, u.y] = [x - dx, y - dy];
    }
  } else {
    u.x = x;
    u.y = y;
  }
  u.wait = Math.max(u.wait, u.attackCd);
  return true;
}
