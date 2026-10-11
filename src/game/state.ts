import { BOARD_SIZE, enemyDamageShare, type Battle, type BattleSetup, type Placement } from './battle';
import {
  ABYSS_UNLOCK, ALL_LEVELS, UNLOCKED_BY, abyssFloor, abyssReward, chapterOf, enemyPlacements, firstReward, getLevel,
  isAbyss, levelIncome, levelIndex, replayReward,
} from './levels';
import type { Branch } from './abilities';
import { NODE_BY_ID, RESET_COST, nodeCost, nodeState, spentCrowns, type NodeId } from './crownTree';
import { bossFor } from './bosses';
import { withElites } from './elites';
import { levelTerrain, levelTerrainRows, walkable, withDarkness, type Terrain } from './terrain';
import { AWAKENING_SHIFT, BLACK_KING_ATK, BLACK_KING_HP, distortionFor, type DistortionId } from './distortions';
import { PIECES, PRESTIGE_PIECES, type PieceKind } from './pieces';
import { ACHIEVEMENTS, getAchievement } from './achievements';
import { shardsForFloor } from './altar';
import { SPIN_COST, altarRefund, emptyRoulette, rollBuff, rouletteBonuses, type BuffDef, type RouletteState } from './roulette';
import { RELICS, STARS_PER_RELIC, rollOffer, type RelicId } from './relics';

/** Rows the player may deploy on (bottom three rows). */
export const PLAYER_ROWS = [5, 6, 7];

export type BuildingId = 'treasury' | 'hq' | 'forge';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  treasury: { id: 'treasury', name: 'Казна', description: '+25% к доходу земель и +2 ч к запасу казны', baseCost: 150, growth: 2.1, maxLevel: 10 },
  hq: { id: 'hq', name: 'Штаб', description: '+1 фигура в каждом бою', baseCost: 400, growth: 3.5, maxLevel: 3 },
  forge: { id: 'forge', name: 'Кузница', description: '+6% к атаке и здоровью всей армии', baseCost: 200, growth: 1.8, maxLevel: 25 },
};

export const BUILDING_ORDER: BuildingId[] = ['treasury', 'hq', 'forge'];

const UPGRADE_BASE: Record<PieceKind, number> = {
  king: 60, pawn: 30, knight: 80, bishop: 110, rook: 160, queen: 400, archbishop: 300, chancellor: 340, ghost: 260,
};

export interface FormationSlot { kind: PieceKind; x: number; y: number }

export interface GameState {
  version: 2;
  gold: number;
  /** Owned pieces per kind. The king is always 1. */
  army: Record<PieceKind, number>;
  /** Upgrade level per kind (1 = base). */
  levels: Record<PieceKind, number>;
  buildings: Record<BuildingId, number>;
  /** Best stars earned per level id. */
  stars: Record<string, number>;
  /** Last used formation, reused between battles. */
  formation: FormationSlot[];
  /** Chosen ability per piece type: 0 = the first, 1 = the alternative. */
  abilityBranch: Record<PieceKind, Branch>;
  /** Uncollected treasury gold. */
  treasury: number;
  /** Wall-clock time of the last treasury accrual. */
  lastTick: number;
  relics: RelicId[];
  /** Relic choices earned but not made yet. */
  relicPicks: number;
  /** The current 1-of-3 offer, kept so reloading does not reroll it. */
  relicOffer: RelicId[] | null;
  /** Star milestones already turned into relic picks. */
  starMilestones: number;
  /** Achievement ids unlocked, and those whose reward was taken. */
  achievements: string[];
  achievementsClaimed: string[];
  /** Tutorial tips already shown. */
  tutorial: string[];
  /** Permanent prestige currency. */
  crowns: number;
  /** Number of completed "new game" resets; raises enemy levels and rewards. */
  prestige: number;
  /** Next abyss floor to fight and the deepest floor ever cleared. */
  /** `guardian`: the kind of the last Abyss guardian beaten (fights for you with "Страж на службе"). */
  abyss: { floor: number; best: number; guardian?: PieceKind };
  /** Crown Tree nodes owned; they survive new games. */
  crownTree: NodeId[];
  /** Abyss shards and Altar of the Abyss perk levels; both survive a new game. */
  shards: number;
  /** Roulette of the Abyss: buffs bought with shards, kept across new games. */
  roulette: RouletteState;
  stats: {
    battles: number; wins: number; goldEarned: number;
    flawless: number; promotions: number; kills: number; crits: number; abilities: number; treasuryCollected: number;
  };
}

function perKind(value: number): Record<PieceKind, number> {
  return { king: value, pawn: value, knight: value, bishop: value, rook: value, queen: value, archbishop: value, chancellor: value, ghost: value };
}

export function newGame(now = Date.now()): GameState {
  return {
    version: 2,
    gold: 60,
    army: { ...perKind(0), king: 1, pawn: 3 },
    levels: perKind(1),
    abilityBranch: perKind(0) as Record<PieceKind, Branch>,
    buildings: { treasury: 0, hq: 0, forge: 0 },
    stars: {},
    formation: [
      { kind: 'king', x: 3, y: 7 },
      { kind: 'pawn', x: 2, y: 5 },
      { kind: 'pawn', x: 3, y: 5 },
      { kind: 'pawn', x: 4, y: 5 },
    ],
    treasury: 0,
    lastTick: now,
    relics: [],
    relicPicks: 0,
    relicOffer: null,
    starMilestones: 0,
    achievements: [],
    achievementsClaimed: [],
    tutorial: [],
    crowns: 0,
    prestige: 0,
    abyss: { floor: 1, best: 0 },
    crownTree: [],
    shards: 0,
    roulette: emptyRoulette(),
    stats: {
      battles: 0, wins: 0, goldEarned: 0,
      flawless: 0, promotions: 0, kills: 0, crits: 0, abilities: 0, treasuryCollected: 0,
    },
  };
}

// ---------- Progress ----------

export function isCleared(s: GameState, id: string): boolean {
  if (isAbyss(id)) return abyssFloor(id) < s.abyss.floor;
  return (s.stars[id] ?? 0) > 0;
}

export function isAbyssOpen(s: GameState): boolean {
  return isCleared(s, ABYSS_UNLOCK);
}

export function isLevelOpen(s: GameState, id: string): boolean {
  if (isAbyss(id)) return isAbyssOpen(s) && abyssFloor(id) === s.abyss.floor;
  const i = levelIndex(id);
  return i === 0 || (i > 0 && isCleared(s, ALL_LEVELS[i - 1].id));
}

/** First level not yet cleared (or the last level when everything is done). */
export function currentLevelId(s: GameState): string {
  return (ALL_LEVELS.find((l) => !isCleared(s, l.id)) ?? ALL_LEVELS[ALL_LEVELS.length - 1]).id;
}

export function totalStars(s: GameState): number {
  return Object.values(s.stars).reduce((a, b) => a + b, 0);
}

export function isUnlocked(s: GameState, kind: PieceKind): boolean {
  if (PRESTIGE_PIECES.includes(kind)) return s.crownTree.some((id) => NODE_BY_ID[id].piece === kind);
  const by = UNLOCKED_BY[kind];
  return by === null || isCleared(s, by);
}

// ---------- Crown Tree ----------

/** The current game number: 1 before any new game. */
export function gameNumber(s: GameState): number {
  return s.prestige + 1;
}

export function hasNode(s: GameState, id: NodeId): boolean {
  return s.crownTree.includes(id);
}

export function buyNode(s: GameState, id: NodeId): boolean {
  const node = NODE_BY_ID[id];
  if (nodeState(s.crownTree, gameNumber(s), node) !== 'available' || s.crowns < nodeCost(node)) return false;
  s.crowns -= nodeCost(node);
  s.crownTree.push(id);
  return true;
}

/** Give back every crown spent on the tree, minus the reset fee. */
export function resetTree(s: GameState): boolean {
  const refund = spentCrowns(s.crownTree);
  if (!refund || s.crowns + refund < RESET_COST) return false;
  s.crowns += refund - RESET_COST;
  s.crownTree = [];
  return true;
}

/** Bosses beaten in this game (for "Дань"). */
function bossesCleared(s: GameState): number {
  return ['1-9', '2-9', '3-9', '4-9'].filter((id) => isCleared(s, id)).length;
}

export function spinCost(s: GameState): number {
  return hasNode(s, 'luck') ? 4 : SPIN_COST;
}

function legendMult(s: GameState): number {
  return hasNode(s, 'echo') ? 2 : 1;
}

// ---------- Economy ----------

export function recruitCost(s: GameState, kind: PieceKind): number {
  return Math.round(PIECES[kind].cost * 1.2 ** s.army[kind]);
}

export function upgradeCost(s: GameState, kind: PieceKind): number {
  return Math.round(UPGRADE_BASE[kind] * 1.65 ** (s.levels[kind] - 1));
}

export function buildingCost(s: GameState, id: BuildingId): number {
  const def = BUILDINGS[id];
  return Math.round(def.baseCost * def.growth ** s.buildings[id]);
}

export function hasRelic(s: GameState, id: RelicId): boolean {
  return s.relics.includes(id);
}

export function commandLimit(s: GameState, levelId: string): number {
  return chapterOf(levelId).limit + s.buildings.hq + (hasRelic(s, 'reserve') ? 1 : 0) + (hasNode(s, 'banner') ? 1 : 0);
}

export function forgeMultiplier(s: GameState): number {
  return 1 + 0.06 * s.buildings.forge;
}

/** Gold from battles and the treasury: +50% per new game, plus roulette gold. */
export function goldMultiplier(s: GameState): number {
  return (1 + 0.5 * s.prestige) * rouletteBonuses(s.roulette).gold;
}

/** Spin the roulette `count` times. Null when there are not enough shards. */
export function spinRoulette(s: GameState, count = 1, rand: () => number = Math.random): BuffDef[] | null {
  const cost = spinCost(s) * count;
  if (s.shards < cost) return null;
  s.shards -= cost;
  return Array.from({ length: count }, () => rollBuff(s.roulette, rand, legendMult(s)));
}

/**
 * Enemy levels added by the current prestige. The campaign ramps up by chapter
 * (+0.5 per game in chapter 1 up to +2 in chapter 4) so a fresh army can still
 * win the first fields; the Abyss always gets the full +2.
 */
export function prestigeEnemyBonus(s: GameState, levelId?: string): number {
  if (!levelId || isAbyss(levelId)) return 2 * s.prestige;
  return Math.round(0.5 * chapterOf(levelId).id * s.prestige);
}

export function incomePerMinute(s: GameState): number {
  const base = ALL_LEVELS.filter((l) => isCleared(s, l.id)).reduce((sum, l) => sum + levelIncome(l.id), 0);
  const tribute = hasNode(s, 'tribute') ? 1 + 0.25 * bossesCleared(s) : 1;
  return base * (1 + 0.25 * s.buildings.treasury) * (hasRelic(s, 'fertile') ? 1.35 : 1) * tribute * goldMultiplier(s);
}

export function treasuryCapHours(s: GameState): number {
  return 6 + 2 * s.buildings.treasury;
}

export function treasuryCap(s: GameState): number {
  return incomePerMinute(s) * 60 * treasuryCapHours(s);
}

/** Accrue treasury income up to `now`. Returns the gold added. */
export function accrue(s: GameState, now = Date.now()): number {
  const dt = Math.max(0, now - s.lastTick);
  s.lastTick = now;
  const before = s.treasury;
  s.treasury = Math.min(treasuryCap(s), s.treasury + (incomePerMinute(s) * dt) / 60_000);
  return Math.max(0, s.treasury - before);
}

export function collectTreasury(s: GameState): number {
  const amount = Math.floor(s.treasury);
  s.gold += amount;
  s.treasury -= amount;
  s.stats.goldEarned += amount;
  s.stats.treasuryCollected += amount;
  return amount;
}

/** True when the player can afford at least one recruit, upgrade or building. */
export function canAffordUpgrade(s: GameState): boolean {
  const kinds = Object.keys(PIECES) as PieceKind[];
  for (const kind of kinds) {
    if (!isUnlocked(s, kind)) continue;
    if (s.gold >= upgradeCost(s, kind)) return true;
    const canRecruit = kind !== 'king' && !(kind === 'queen' && s.army.queen >= 1);
    if (canRecruit && s.gold >= recruitCost(s, kind)) return true;
  }
  return (Object.keys(BUILDINGS) as BuildingId[])
    .some((id) => s.buildings[id] < BUILDINGS[id].maxLevel && s.gold >= buildingCost(s, id));
}

// ---------- Purchases (return true on success) ----------

export function queenCap(s: GameState): number {
  return hasNode(s, 'twoQueens') ? 2 : 1;
}

export function recruit(s: GameState, kind: PieceKind): boolean {
  if (kind === 'king' || !isUnlocked(s, kind)) return false;
  if (kind === 'queen' && s.army.queen >= queenCap(s)) return false;
  const cost = recruitCost(s, kind);
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.army[kind]++;
  return true;
}

export function upgradePiece(s: GameState, kind: PieceKind): boolean {
  if (!isUnlocked(s, kind)) return false;
  const cost = upgradeCost(s, kind);
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.levels[kind]++;
  return true;
}

export function buyBuilding(s: GameState, id: BuildingId): boolean {
  const cost = buildingCost(s, id);
  if (s.buildings[id] >= BUILDINGS[id].maxLevel || s.gold < cost) return false;
  s.gold -= cost;
  s.buildings[id]++;
  return true;
}

// ---------- Formation ----------

/** A cell of the player's three rows; with a level, also free of rock and water. */
export function isPlayerCell(x: number, y: number, levelId?: string): boolean {
  if (x < 0 || x >= BOARD_SIZE || !PLAYER_ROWS.includes(y)) return false;
  return !levelId || walkable(levelTerrain(levelId)[y * BOARD_SIZE + x]);
}

export function slotAt(s: GameState, x: number, y: number): FormationSlot | undefined {
  return s.formation.find((f) => f.x === x && f.y === y);
}

export function placedCount(s: GameState, kind: PieceKind): number {
  return s.formation.filter((f) => f.kind === kind).length;
}

/** Pieces in the formation that count against the command limit. */
export function fieldedCount(s: GameState): number {
  return s.formation.filter((f) => f.kind !== 'king').length;
}

export function available(s: GameState, kind: PieceKind): number {
  return s.army[kind] - placedCount(s, kind);
}

/** Place a piece from the reserve. Returns an error message or null. */
export function placeFromReserve(s: GameState, kind: PieceKind, x: number, y: number, limit: number, levelId?: string): string | null {
  if (!isPlayerCell(x, y)) return 'Ставить можно только в три нижних ряда';
  if (!isPlayerCell(x, y, levelId)) return 'Сюда нельзя: камень или вода';
  if (available(s, kind) <= 0) return 'Таких фигур больше нет в резерве';
  const occupant = slotAt(s, x, y);
  if (occupant?.kind === 'king') return 'Здесь стоит король';
  if (!occupant && kind !== 'king' && fieldedCount(s) >= limit) return `Лимит фигур в этом бою: ${limit}`;
  if (occupant) s.formation = s.formation.filter((f) => f !== occupant);
  s.formation.push({ kind, x, y });
  return null;
}

/** Move a placed piece to another player cell, swapping with any occupant. */
export function moveSlot(s: GameState, fromX: number, fromY: number, x: number, y: number, levelId?: string): boolean {
  const slot = slotAt(s, fromX, fromY);
  if (!slot || !isPlayerCell(x, y, levelId)) return false;
  const occupant = slotAt(s, x, y);
  if (occupant) {
    occupant.x = fromX;
    occupant.y = fromY;
  }
  slot.x = x;
  slot.y = y;
  return true;
}

/** Return a placed piece to the reserve. The king cannot be removed. */
export function removeSlot(s: GameState, x: number, y: number): boolean {
  const slot = slotAt(s, x, y);
  if (!slot || slot.kind === 'king') return false;
  s.formation = s.formation.filter((f) => f !== slot);
  return true;
}

export function clearFormation(s: GameState): void {
  s.formation = s.formation.filter((f) => f.kind === 'king');
}

/** Drop pieces the army no longer has or the limit does not allow, and make sure the king is placed. */
export function sanitizeFormation(s: GameState, limit: number, levelId?: string): void {
  const counts = perKind(0);
  let fielded = 0;
  s.formation = s.formation.filter((f) => {
    if (!isPlayerCell(f.x, f.y, levelId) || counts[f.kind] >= s.army[f.kind]) return false;
    if (f.kind !== 'king') {
      if (fielded >= limit) return false;
      fielded++;
    }
    counts[f.kind]++;
    return true;
  });
  if (!s.formation.some((f) => f.kind === 'king')) {
    const spots = [[3, 7], [4, 7], [2, 7], [5, 7], [3, 6], [4, 6]];
    const free = spots.find(([x, y]) => !slotAt(s, x, y) && isPlayerCell(x, y, levelId)) ?? [0, 7];
    s.formation.push({ kind: 'king', x: free[0], y: free[1] });
  }
}

/** Crown Tree nodes the battle engine needs to know about. */
const BATTLE_PERKS: ReadonlySet<NodeId> = new Set<NodeId>([
  'doubleStep', 'castling', 'fork', 'check', 'earlyCrown', 'sacrifice', 'heralds', 'warlord', 'shadowReserve', 'fog',
]);

/** The distortion bending this level's rules (campaign levels only). */
export function levelDistortion(s: GameState, levelId: string): DistortionId | null {
  return isAbyss(levelId) ? null : distortionFor(gameNumber(s));
}

/** Terrain rows of a level as this game sees it. */
export function terrainRowsFor(s: GameState, levelId: string): string[] | undefined {
  const rows = levelTerrainRows(levelId);
  return levelDistortion(s, levelId) === 'darkness' ? withDarkness(levelId, rows) : rows;
}

export function terrainFor(s: GameState, levelId: string): Terrain[] {
  return levelTerrain(levelId, levelDistortion(s, levelId) === 'darkness');
}

export function battleSetup(s: GameState, levelId: string): BattleSetup {
  const allies: Placement[] = s.formation.map((f) => ({ ...f, level: s.levels[f.kind] }));
  const m = forgeMultiplier(s);
  const rb = rouletteBonuses(s.roulette);
  const bonus = prestigeEnemyBonus(s, levelId);
  const distortion = levelDistortion(s, levelId);
  let enemies = withElites(levelId, enemyPlacements(getLevel(levelId)), distortion === 'guard')
    .map((p) => ({ ...p, level: p.level + bonus }));
  if (isAbyss(levelId)) {
    const terrain = levelTerrain(levelId);
    const free = (x: number, y: number) => walkable(terrain[y * BOARD_SIZE + x])
      && !allies.some((a) => a.x === x && a.y === y) && !enemies.some((e) => e.x === x && e.y === y);
    // "Переманивание": one enemy piece changes sides and takes the mirrored square.
    if (hasNode(s, 'lure')) {
      const pool = enemies.filter((p) => p.kind !== 'king' && !p.boss);
      const pick = pool[abyssFloor(levelId) % Math.max(1, pool.length)];
      if (pick && free(pick.x, BOARD_SIZE - 1 - pick.y)) {
        enemies = enemies.filter((p) => p !== pick);
        allies.push({ kind: pick.kind, x: pick.x, y: BOARD_SIZE - 1 - pick.y, level: pick.level, trait: pick.trait });
      }
    }
    // "Страж на службе": the last beaten guardian fights for you.
    if (hasNode(s, 'guardian') && s.abyss.guardian) {
      const spot = [[3, 6], [4, 6], [2, 6], [5, 6], [3, 5], [4, 5], [1, 6], [6, 6]].find(([x, y]) => free(x, y));
      const level = enemies.find((p) => p.kind !== 'king')?.level ?? enemies[0]?.level ?? 1;
      if (spot) allies.push({ kind: s.abyss.guardian, x: spot[0], y: spot[1], level, boss: true });
    }
  }
  return {
    allies, enemies,
    allyHpMult: m * rb.hp,
    allyAtkMult: m * rb.atk,
    allyKingHpMult: rb.kingHp,
    allyKind: rb.kind,
    allyPawnShield: rb.pawnShield,
    allyCrit: rb.crit,
    allyOpening: rb.opening,
    legends: rb.legends,
    relics: [...s.relics],
    allyBranches: { ...s.abilityBranch },
    terrain: terrainRowsFor(s, levelId),
    bossId: bossFor(levelId),
    perks: s.crownTree.filter((id) => BATTLE_PERKS.has(id)),
    enemyAbilityShift: distortion === 'awakening' ? AWAKENING_SHIFT : 0,
    enemyKingHp: distortion === 'blackKing' ? BLACK_KING_HP : 1,
    enemyKingAtk: distortion === 'blackKing' ? BLACK_KING_ATK : 1,
  };
}

// ---------- Results ----------

export interface BattleOutcome {
  win: boolean;
  stars: number;
  /** Stars above the previous best. */
  newStars: number;
  firstClear: boolean;
  reward: number;
  conditions: { win: boolean; king: boolean; losses: boolean };
  /** Relic picks earned by this battle. */
  relicsEarned: number;
  /** Abyss shards earned by this battle. */
  shards: number;
  /** Share of enemy health removed (1 on a win). */
  damageShare: number;
  /** A free roulette buff from "Трофеи" on a first clear. */
  trophy?: BuffDef;
}

/** A lost battle still pays: up to half of a replay reward, in proportion to the damage done. */
export const CONSOLATION_SHARE = 0.5;

export function recordResult(s: GameState, levelId: string, b: Battle): BattleOutcome {
  const level = getLevel(levelId);
  const win = b.result === 'win';
  const conditions = {
    win,
    king: win && b.kingMinRatio >= 0.5,
    losses: win && b.allyLosses <= level.maxLosses,
  };
  const stars = win ? 1 + Number(conditions.king) + Number(conditions.losses) : 0;
  const damageShare = enemyDamageShare(b);
  if (isAbyss(levelId)) return recordAbyss(s, levelId, b, stars, conditions, damageShare);
  const prev = s.stars[levelId] ?? 0;
  const firstClear = win && prev === 0;
  const newStars = Math.max(0, stars - prev);
  let reward = 0;
  if (win) {
    reward = firstClear ? firstReward(levelId) : replayReward(levelId);
    // Bonus for every extra star earned for the first time.
    reward += Math.max(0, newStars - (firstClear ? 1 : 0)) * Math.round(firstReward(levelId) * 0.25);
    if (hasRelic(s, 'plunder')) reward *= 1.3;
    reward = Math.round(reward * goldMultiplier(s));
  } else {
    reward = Math.round(replayReward(levelId) * CONSOLATION_SHARE * damageShare * goldMultiplier(s));
  }
  s.stars[levelId] = Math.max(prev, stars);
  let relicsEarned = firstClear && level.boss ? 1 : 0;
  const milestones = Math.floor(totalStars(s) / STARS_PER_RELIC);
  relicsEarned += Math.max(0, milestones - s.starMilestones);
  s.starMilestones = Math.max(s.starMilestones, milestones);
  s.relicPicks += relicsEarned;
  s.gold += reward;
  countBattle(s, b, win, reward);
  const trophy = firstClear && hasNode(s, 'trophies') ? rollBuff(s.roulette, Math.random, legendMult(s)) : undefined;
  return { win, stars, newStars, firstClear, reward, conditions, relicsEarned, shards: 0, damageShare, trophy };
}

function countBattle(s: GameState, b: Battle, win: boolean, reward: number): void {
  s.stats.battles++;
  if (win) s.stats.wins++;
  if (win && b.allyLosses === 0) s.stats.flawless++;
  s.stats.promotions += b.allyStats.promotions;
  s.stats.kills += b.allyStats.kills;
  s.stats.crits += b.allyStats.crits;
  s.stats.abilities += b.allyStats.abilities;
  s.stats.goldEarned += reward;
}

/** Abyss floors: no stars are stored; a win pays and opens the next floor, every 10th floor grants a relic. */
function recordAbyss(
  s: GameState, levelId: string, b: Battle, stars: number, conditions: BattleOutcome['conditions'], damageShare: number,
): BattleOutcome {
  const floor = abyssFloor(levelId);
  const win = b.result === 'win';
  let reward = 0;
  let relicsEarned = 0;
  let shards = 0;
  if (win) {
    shards = shardsForFloor(floor) + (hasNode(s, 'hunger') ? 1 : 0);
    s.shards += shards;
    if (floor % 10 === 0) s.abyss.guardian = enemyPlacements(getLevel(levelId)).find((p) => p.boss)?.kind ?? s.abyss.guardian;
    reward = abyssReward(floor) * (hasRelic(s, 'plunder') ? 1.3 : 1);
    reward = Math.round(reward * goldMultiplier(s));
    s.abyss.floor = floor + 1;
    s.abyss.best = Math.max(s.abyss.best, floor);
    if (floor % 10 === 0) relicsEarned = 1;
    s.relicPicks += relicsEarned;
    s.gold += reward;
  } else {
    reward = Math.round(abyssReward(floor) * CONSOLATION_SHARE * damageShare * goldMultiplier(s));
    s.gold += reward;
  }
  countBattle(s, b, win, reward);
  return { win, stars, newStars: 0, firstClear: win, reward, conditions, relicsEarned, shards, damageShare };
}

// ---------- Prestige ----------

export const PRESTIGE_UNLOCK = '4-9';

export function canPrestige(s: GameState): boolean {
  return isCleared(s, PRESTIGE_UNLOCK);
}

/** Crowns a new game would grant now: stars, abyss depth and a bonus for finishing. */
export function crownsForPrestige(s: GameState): number {
  return Math.floor(totalStars(s) / 6) + Math.floor(s.abyss.best / 5) + 3;
}

/** Start a new, harder game keeping crowns, achievements, stats, tips and the abyss record. Returns crowns gained. */
export function prestige(s: GameState, now = Date.now()): number {
  if (!canPrestige(s)) return 0;
  const gained = crownsForPrestige(s);
  const fresh = newGame(now);
  fresh.crowns = s.crowns + gained;
  fresh.prestige = s.prestige + 1;
  fresh.achievements = s.achievements;
  fresh.achievementsClaimed = s.achievementsClaimed;
  fresh.tutorial = s.tutorial;
  fresh.abilityBranch = s.abilityBranch;
  fresh.stats = s.stats;
  fresh.abyss = { floor: 1, best: s.abyss.best };
  fresh.shards = s.shards;
  fresh.roulette = s.roulette;
  fresh.crownTree = s.crownTree;
  fresh.abyss.guardian = s.abyss.guardian;
  if (s.crownTree.includes('heritage')) {
    fresh.gold = 1500;
    fresh.buildings.treasury = 3;
  }
  if (s.crownTree.includes('vault')) fresh.relicPicks += 1;
  Object.assign(s, fresh);
  return gained;
}

// ---------- Relics ----------

/** The relic choice on offer, or null when there is nothing to pick. */
export function relicOffer(s: GameState): RelicId[] | null {
  if (s.relicPicks <= 0) return null;
  if (!s.relicOffer || s.relicOffer.some((id) => !RELICS[id] || s.relics.includes(id))) {
    const offer = rollOffer(s.relics, s.relics.length * 977 + s.stats.battles * 31 + 7);
    if (offer.length === 0) {
      s.relicPicks = 0; // every relic is owned
      return null;
    }
    s.relicOffer = offer;
  }
  return s.relicOffer;
}

export function chooseRelic(s: GameState, id: RelicId): boolean {
  const offer = relicOffer(s);
  if (!offer?.includes(id)) return false;
  s.relics.push(id);
  s.relicPicks--;
  s.relicOffer = null;
  return true;
}

// ---------- Achievements ----------

/** Unlock every achievement whose goal is reached. Returns the new ones. */
export function checkAchievements(s: GameState): string[] {
  const fresh = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.progress(s) >= a.goal).map((a) => a.id);
  s.achievements.push(...fresh);
  return fresh;
}

export function claimAchievement(s: GameState, id: string): number {
  const def = getAchievement(id);
  if (!def || !s.achievements.includes(id) || s.achievementsClaimed.includes(id)) return 0;
  s.achievementsClaimed.push(id);
  s.gold += def.reward;
  s.stats.goldEarned += def.reward;
  return def.reward;
}

export function claimableAchievements(s: GameState): number {
  return s.achievements.filter((id) => !s.achievementsClaimed.includes(id)).length;
}

// ---------- Persistence ----------

const SAVE_KEY = 'chess-autobattler-save';

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Storage may be unavailable (private mode); the game still works.
  }
}

/** Load the save (or a new game) and accrue offline treasury income. */
/** Merge saved data over a fresh game so new fields get defaults. Null when the data is not a save. */
export function parseSave(raw: string, now = Date.now()): GameState | null {
  try {
    const data = JSON.parse(raw) as Partial<GameState>;
    if (!data || data.version !== 2) return null;
    const state = newGame(now);
    return {
      ...state,
      ...data,
      army: { ...state.army, ...data.army, king: 1 },
      levels: { ...state.levels, ...data.levels },
      abilityBranch: { ...state.abilityBranch, ...data.abilityBranch },
      buildings: { ...state.buildings, ...data.buildings },
      stats: { ...state.stats, ...data.stats },
      abyss: { ...state.abyss, ...data.abyss },
      crownTree: [...(data.crownTree ?? [])],
      roulette: { ...state.roulette, ...data.roulette, owned: { ...data.roulette?.owned } },
      // The old Altar became the roulette: give back every shard spent on it.
      shards: (data.shards ?? 0) + altarRefund((data as { altar?: Record<string, number> }).altar),
      altar: undefined,
    } as GameState;
  } catch {
    return null;
  }
}

export function loadGame(now = Date.now()): { state: GameState; offlineGold: number; offlineMs: number } {
  let state = newGame(now);
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = parseSave(raw, now) ?? state;
  } catch {
    // Storage unavailable: keep the new game.
  }
  const offlineMs = Math.max(0, now - state.lastTick);
  const offlineGold = accrue(state, now);
  return { state, offlineGold, offlineMs };
}

const CODE_PREFIX = 'PG2:';

/** A save as a copyable text code. */
export function exportSave(s: GameState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return CODE_PREFIX + btoa(bin);
}

/** Parse a code made by exportSave. Null when the code is broken. */
export function importSave(code: string, now = Date.now()): GameState | null {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(CODE_PREFIX)) return null;
  try {
    const bin = atob(text.slice(CODE_PREFIX.length));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return parseSave(json, now);
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw !== null && (JSON.parse(raw) as { version?: number }).version === 2;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
