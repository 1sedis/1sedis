import { t } from '../i18n';
import { BOARD_SIZE, MOVES_PER_BATTLE, enemyDamageShare, type Battle, type BattleSetup, type Placement } from './battle';
import {
  CHAPTERS, UNLOCKED_BY, chapterOf, enemyPlacements, firstReward, getLevel, replayReward, isFinale, finalePhase,
} from './levels';
import type { Branch } from './abilities';
import { NODE_BY_ID, RESET_COST, nodeCost, nodeState, spentCrowns, type NodeId } from './crownTree';
import { bossFor } from './bosses';
import { withElites, type Trait } from './elites';
import { featureOpen } from './features';
import { levelTerrain, levelTerrainRows, parseTerrain, walkable, withDarkness, type Terrain } from './terrain';
import { AWAKENING_SHIFT, BLACK_KING_ATK, BLACK_KING_HP, distortionsFor, type DistortionId } from './distortions';
import { PIECES, PRESTIGE_PIECES, type PieceKind } from './pieces';
import { threatMods } from './ascension';
import { ARMIES, START_SQUARES, type ArmyId } from './armies';
import { ACHIEVEMENTS, getAchievement } from './achievements';
import {
  SPIN_COST, emptyRoulette, wheelExhausted, migrateRoulette, rouletteBonuses, runStartGifts, spinWheel, takeGift, BUFF_BY_ID,
  type BuffDef, type RouletteState,
} from './roulette';
import { RELICS, rollOffer, type RelicId } from './relics';
import {
  ELITE_GOLD, ELITE_LEVELS, RUN_GOLD, availableNodes, recruitLevel, crownsForRun, currentNode, endRun, loseNode, newRun, runLevelOpen,
  startChapter, winNode, activeBoons, wearBoons, chapterGold, type RunState,
} from './run';

/** Rows the player may deploy on (bottom three rows). */
export const PLAYER_ROWS = [5, 6, 7];

export type BuildingId = 'hq' | 'forge';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hq: { id: 'hq', name: t('Штаб'), description: t('+1 фигура в каждом бою'), baseCost: 400, growth: 3.5, maxLevel: 3 },
  forge: { id: 'forge', name: t('Кузница'), description: t('+6% к атаке и здоровью всей армии'), baseCost: 200, growth: 1.8, maxLevel: 25 },
};

export const BUILDING_ORDER: BuildingId[] = ['hq', 'forge'];

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
  /** Levels won in this game; unlocks pieces and opens the finale. */
  cleared: Record<string, boolean>;
  /** Last used formation, reused between battles. */
  formation: FormationSlot[];
  /** Chosen ability per piece type: 0 = the first, 1 = the alternative. */
  abilityBranch: Record<PieceKind, Branch>;
  relics: RelicId[];
  /** Relic choices earned but not made yet. */
  relicPicks: number;
  /** The current 1-of-3 offer, kept so reloading does not reroll it. */
  relicOffer: RelicId[] | null;
  /** Achievement ids unlocked, and those whose reward was taken. */
  achievements: string[];
  achievementsClaimed: string[];
  /** Tutorial tips already shown. */
  tutorial: string[];
  /** Permanent prestige currency. */
  crowns: number;
  /** Number of completed "new game" resets; raises enemy levels and rewards. */
  prestige: number;
  /** The highest threat level opened (a won game at the top level opens the next). */
  threatMax: number;
  /** Crown Tree nodes owned; they survive new games. */
  crownTree: NodeId[];
  /** The Crown Wheel: gifts bought with crowns, kept forever. */
  roulette: RouletteState;
  /** The finale: phases cleared (a checkpoint kept across games) and whether the Hand is beaten. */
  finale: { phase: number; beaten: boolean };
  /** The current run: the chapter map, the path taken and how it ended. */
  run: RunState;
  /** Starting armies opened so far (kept forever). */
  armies: ArmyId[];
  stats: {
    battles: number; wins: number; goldEarned: number;
    flawless: number; promotions: number; kills: number; crits: number; abilities: number;
    elites: number; events: number; cleanChapters: number; runs: number;
    /** The highest threat level a game was won at. */
    bestThreat?: number;
  };
}

function perKind(value: number): Record<PieceKind, number> {
  return { king: value, pawn: value, knight: value, bishop: value, rook: value, queen: value, archbishop: value, chancellor: value, ghost: value };
}

export function newGame(now = Date.now()): GameState {
  const s: GameState = {
    version: 2,
    gold: 60,
    army: { ...perKind(0), king: 1, pawn: 3 },
    levels: perKind(1),
    abilityBranch: perKind(0) as Record<PieceKind, Branch>,
    buildings: { hq: 0, forge: 0 },
    cleared: {},
    // The third pawn waits in the reserve: placing it is the first thing the game teaches.
    formation: [
      { kind: 'king', x: 3, y: 7 },
      { kind: 'pawn', x: 2, y: 5 },
      { kind: 'pawn', x: 4, y: 5 },
    ],
    relics: [],
    relicPicks: 0,
    relicOffer: null,
    achievements: [],
    achievementsClaimed: [],
    tutorial: [],
    crowns: 0,
    prestige: 0,
    threatMax: 0,
    crownTree: [],
    roulette: emptyRoulette(),
    finale: { phase: 0, beaten: false },
    run: newRun((now % 1_000_000_007) >>> 0),
    armies: ['guard'],
    stats: {
      battles: 0, wins: 0, goldEarned: 0,
      flawless: 0, promotions: 0, kills: 0, crits: 0, abilities: 0,
      elites: 0, events: 0, cleanChapters: 0, runs: 0,
    },
  };
  startChapter(s, 1);
  return s;
}

// ---------- Progress ----------

export function isCleared(s: GameState, id: string): boolean {
  if (isFinale(id)) return s.finale.beaten || finalePhase(id) <= s.finale.phase;
  return !!s.cleared[id];
}

/** The finale opens in game 3 after the Black Queen (and stays open after it). */
export const FINALE_GAME = 3;

export function isFinaleOpen(s: GameState): boolean {
  const game = gameNumber(s);
  return s.finale.beaten || s.finale.phase > 0 || game > FINALE_GAME
    || (game === FINALE_GAME && isCleared(s, PRESTIGE_UNLOCK));
}

export function isLevelOpen(s: GameState, id: string): boolean {
  if (isFinale(id)) return isFinaleOpen(s) && (s.finale.beaten || finalePhase(id) <= s.finale.phase + 1);
  // Campaign levels open through the run map: the battle node being fought or one that can be entered.
  return runLevelOpen(s.run, id);
}

/** The level ahead on the run map (the chapter boss when the next step is not a battle). */
export function currentLevelId(s: GameState): string {
  const next = availableNodes(s.run).find((n) => n.level);
  if (next?.level) return next.level;
  const chapter = CHAPTERS[s.run.chapter - 1];
  return chapter.levels[chapter.levels.length - 1].id;
}

export function isUnlocked(s: GameState, kind: PieceKind): boolean {
  // A starting army may bring a piece before its level opens it.
  if (kind !== 'king' && s.army[kind] > 0) return true;
  if (PRESTIGE_PIECES.includes(kind)) return s.crownTree.some((id) => NODE_BY_ID[id].piece === kind);
  const by = UNLOCKED_BY[kind];
  return by === null || isCleared(s, by);
}

/** Give a fresh run the pieces, gold and formation of a starting army. */
export function applyArmy(s: GameState, id: ArmyId): void {
  const def = ARMIES[id];
  s.run.army = id;
  if (id === 'guard') return; // the new-game default: three pawns, one waiting in the reserve
  for (const k of Object.keys(s.army) as PieceKind[]) if (k !== 'king') s.army[k] = def.pieces[k] ?? 0;
  s.gold = def.gold;
  s.formation = [{ kind: 'king', x: 3, y: 7 }];
  let i = 0;
  for (const [kind, n] of Object.entries(def.pieces) as [PieceKind, number][]) {
    for (let c = 0; c < n && i < START_SQUARES.length; c++, i++) s.formation.push({ kind, x: START_SQUARES[i][0], y: START_SQUARES[i][1] });
  }
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

function legendMult(s: GameState): number {
  return hasNode(s, 'echo') ? 2 : 1;
}

// ---------- Economy ----------

export function recruitCost(s: GameState, kind: PieceKind): number {
  return Math.round(PIECES[kind].cost * 1.2 ** s.army[kind]);
}

/** Upgrades grow gently: a run has only its own gold, and several piece types to raise. */
export const UPGRADE_GROWTH = 1.45;

/** Training a kind costs more the more pieces of it there are: a big squad is a big drill. */
export const SQUAD_COST = 0.15;

export function upgradeCost(s: GameState, kind: PieceKind): number {
  const squad = 1 + SQUAD_COST * Math.max(0, (kind === 'king' ? 1 : s.army[kind]) - 1);
  return Math.round(UPGRADE_BASE[kind] * UPGRADE_GROWTH ** (s.levels[kind] - 1) * squad);
}

/** Enemies of later chapters gain levels faster than the level table alone says. */
export const CHAPTER_ENEMY_LEVELS = [0, 0, 1, 2, 2];

export function buildingCost(s: GameState, id: BuildingId): number {
  const def = BUILDINGS[id];
  return Math.round(def.baseCost * def.growth ** s.buildings[id]);
}

export function hasRelic(s: GameState, id: RelicId): boolean {
  return s.relics.includes(id);
}

export function commandLimit(s: GameState, levelId: string): number {
  return chapterOf(levelId).limit + s.buildings.hq + (hasRelic(s, 'reserve') ? 1 : 0) + (hasNode(s, 'banner') ? 1 : 0)
    + (isFinale(levelId) ? 0 : threatMods(s.run.threat ?? 0).limit);
}

export function forgeMultiplier(s: GameState): number {
  return 1 + 0.06 * s.buildings.forge;
}

/** Gold from battles: +50% per new game, plus roulette gold. */
export function goldMultiplier(s: GameState): number {
  return (1 + 0.5 * s.prestige) * rouletteBonuses(s.roulette).gold;
}

/** Crowns the next spin costs (a free spin from "Голод" or "Трофеи" costs none). */
export function spinCost(s: GameState): number {
  return s.roulette.free > 0 ? 0 : SPIN_COST;
}

/**
 * Spin the Crown Wheel: pay, land on a rarity and get gifts to choose from
 * (three, or four with "Удача"). A waiting offer is returned again for free.
 * Null when there are not enough crowns.
 */
export function spinRoulette(s: GameState, rand: () => number = Math.random): BuffDef[] | null {
  if (s.roulette.offer) return s.roulette.offer.map((id) => BUFF_BY_ID[id]);
  const cost = spinCost(s);
  if (s.crowns < cost || wheelExhausted(s.roulette)) return null;
  if (cost === 0) s.roulette.free--;
  else s.crowns -= cost;
  return spinWheel(s.roulette, rand, legendMult(s), hasNode(s, 'luck') ? 4 : 3);
}

/** Take one gift of the waiting offer. */
export function chooseGift(s: GameState, id: string): BuffDef | null {
  return takeGift(s.roulette, id);
}

/**
 * Enemy levels added by the current prestige. The campaign ramps up by chapter
 * (+0.5 per game in the first two chapters, +1 from chapter 3 on: the distortions already make the later chapters harder) so a fresh army can still
 * win the first fields; without a level the full +2 is returned.
 */
export function prestigeEnemyBonus(s: GameState, levelId?: string): number {
  if (!levelId) return 2 * s.prestige;
  return Math.round((chapterOf(levelId).id <= 2 ? 0.5 : 1) * s.prestige);
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

/** The player's own moves per battle ("Темп" in the Crown Tree adds one). */
export function playerMoves(s: GameState, levelId?: string): number {
  // The very first battle is about placing pieces; moves come with the second.
  if (!featureOpen(s, 'moves')) return 0;
  // "Лишний ход" of the Crown Wheel: more moves against elites and bosses.
  const big = !!levelId && (isEliteBattle(s, levelId) || !!getLevel(levelId).boss);
  return MOVES_PER_BATTLE + (hasNode(s, 'castling') ? 1 : 0) + (big ? rouletteBonuses(s.roulette).bigMoves : 0);
}

/** At most 8 pawns, as on a chessboard: one upgrade must not lift an endless swarm. */
export const PAWN_CAP = 8;

/** How many pieces of a kind the army may hold. */
export function armyCap(s: GameState, kind: PieceKind): number {
  if (kind === 'king') return 1;
  if (kind === 'queen') return queenCap(s);
  if (kind === 'pawn') return PAWN_CAP;
  return Infinity;
}

export function recruit(s: GameState, kind: PieceKind): boolean {
  if (kind === 'king' || !isUnlocked(s, kind)) return false;
  if (s.army[kind] >= armyCap(s, kind)) return false;
  const cost = recruitCost(s, kind);
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.levels[kind] = recruitLevel(s, kind);
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
  if (!isPlayerCell(x, y)) return t('Ставить можно только в три нижних ряда');
  if (!isPlayerCell(x, y, levelId)) return t('Сюда нельзя: камень или вода');
  if (available(s, kind) <= 0) return t('Таких фигур больше нет в резерве');
  const occupant = slotAt(s, x, y);
  if (occupant?.kind === 'king') return t('Здесь стоит король');
  if (!occupant && kind !== 'king' && fieldedCount(s) >= limit) return t('Лимит фигур в этом бою: {limit}', { limit });
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
export function levelDistortions(s: GameState, levelId: string): DistortionId[] {
  return isFinale(levelId) ? [] : distortionsFor(gameNumber(s), chapterOf(levelId).id);
}

function hasDistortion(s: GameState, levelId: string, id: DistortionId): boolean {
  return levelDistortions(s, levelId).includes(id);
}

/** Terrain rows of a level as this game sees it. */
export function terrainRowsFor(s: GameState, levelId: string): string[] | undefined {
  if (isFinale(levelId)) return finalePhase(levelId) === 2 ? undefined : withDarkness(levelId, undefined);
  const rows = levelTerrainRows(levelId);
  return hasDistortion(s, levelId, 'darkness') ? withDarkness(levelId, rows) : rows;
}

export function terrainFor(s: GameState, levelId: string): Terrain[] {
  if (isFinale(levelId)) return parseTerrain(terrainRowsFor(s, levelId));
  return levelTerrain(levelId, hasDistortion(s, levelId, 'darkness'));
}

/**
 * Enemy level in the finale: the Hand knows your strength. The mean level of
 * the whole army (the king aside), counting every copy. Cheap filler cannot
 * drag it down: every copy of a kind shares its level, and a new kind joins
 * trained (see `recruitLevel`).
 */
export function finaleLevel(s: GameState): number {
  const levels = (Object.keys(s.army) as PieceKind[])
    .filter((k) => k !== 'king')
    .flatMap((k) => new Array<number>(s.army[k]).fill(s.levels[k]));
  return levels.length ? Math.round(levels.reduce((a, c) => a + c, 0) / levels.length) : 1;
}

/** Traits of the Black King's full army in "Последняя партия". */
const FINALE_TRAITS: Partial<Record<PieceKind, Trait>> = { knight: 'swift', bishop: 'vampire', rook: 'armored', queen: 'furious' };

/** Extra health of the Hand on top of the boss multiplier. */
const HAND_HP = 18;
const HAND_ATK = 2;

function finaleSetup(s: GameState, levelId: string, base: BattleSetup): BattleSetup {
  const phase = finalePhase(levelId);
  const lv = finaleLevel(s);
  const placements = enemyPlacements(getLevel(levelId));
  if (phase === 1) {
    return {
      ...base,
      enemies: placements.map((p) => ({ ...p, level: lv + 2, trait: FINALE_TRAITS[p.kind] })),
      enemyAbilityShift: AWAKENING_SHIFT, enemyKingHp: BLACK_KING_HP, enemyKingAtk: BLACK_KING_ATK,
    };
  }
  if (phase === 2) {
    // The board turned over: your own army in black, a little stronger. The Black King joins you.
    const enemies = s.formation.map((f) => ({
      kind: f.kind, x: f.x, y: BOARD_SIZE - 1 - f.y, level: s.levels[f.kind] + 1, boss: f.kind === 'king',
    }));
    const taken = new Set(base.allies.map((a) => `${a.x},${a.y}`));
    const king = base.allies.find((a) => a.kind === 'king') ?? { x: 3, y: 7 };
    const spots: [number, number][] = [];
    for (let y = 5; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) if (!taken.has(`${x},${y}`)) spots.push([x, y]);
    spots.sort((a, c) => Math.max(Math.abs(a[0] - king.x), Math.abs(a[1] - king.y)) - Math.max(Math.abs(c[0] - king.x), Math.abs(c[1] - king.y)));
    const allies = [...base.allies];
    if (spots[0]) allies.push({ kind: 'king', x: spots[0][0], y: spots[0][1], level: lv, boss: true });
    // The shadows copy your forge and roulette strength too.
    return { ...base, allies, enemies, handMeddle: true, enemyHpMult: base.allyHpMult, enemyAtkMult: base.allyAtkMult };
  }
  return {
    ...base,
    enemies: placements.map((p) => ({ ...p, level: p.boss ? lv + 3 : lv + 2 })),
    enemyKingHp: HAND_HP,
    enemyKingAtk: HAND_ATK,
  };
}

/** Is this level fought at an elite node of the run map (stronger enemies, a relic for the win)? */
export function isEliteBattle(s: GameState, levelId: string): boolean {
  const node = currentNode(s.run);
  return !isFinale(levelId) && node?.kind === 'elite' && node.level === levelId;
}

export function battleSetup(s: GameState, levelId: string): BattleSetup {
  if (isFinale(levelId)) return finaleSetup(s, levelId, plainSetup(s, levelId));
  return plainSetup(s, levelId);
}

/** Chapter bosses are tougher than the base giant. */
export const CHAPTER_BOSS_HP = 1.2;

/** Gold a won battle of the run pays: like a first clear, elites and bosses more. */
export function battleGold(s: GameState, levelId: string, elite: boolean): number {
  const boss = !!getLevel(levelId).boss;
  let reward = firstReward(levelId) * RUN_GOLD * (elite ? ELITE_GOLD : 1);
  if ((elite || boss) && hasNode(s, 'tribute')) reward *= 2;
  if (elite || boss) reward *= rouletteBonuses(s.roulette).loot;
  if (hasRelic(s, 'plunder')) reward *= 1.3;
  reward *= threatMods(s.run.threat ?? 0).gold;
  return Math.round(reward * goldMultiplier(s));
}

/** The level of the enemies of a run battle (as plainSetup builds them), for previews. */
export function enemyLevel(s: GameState, levelId: string, elite: boolean): number {
  const tm = threatMods(s.run.threat ?? 0);
  return getLevel(levelId).level + prestigeEnemyBonus(s, levelId) + tm.enemyLevels
    + (CHAPTER_ENEMY_LEVELS[chapterOf(levelId).id] ?? 0) + (elite ? ELITE_LEVELS + tm.eliteLevels : 0);
}

function plainSetup(s: GameState, levelId: string): BattleSetup {
  const allies: Placement[] = s.formation.map((f) => ({ ...f, level: s.levels[f.kind] }));
  const m = forgeMultiplier(s);
  const rb = rouletteBonuses(s.roulette);
  const army = ARMIES[s.run.army ?? 'guard'];
  const bonus = prestigeEnemyBonus(s, levelId);
  const distortions = levelDistortions(s, levelId);
  const elite = isEliteBattle(s, levelId);
  const rule = elite ? currentNode(s.run)?.rule : undefined;
  const campaignLevel = !isFinale(levelId);
  const tm = threatMods(campaignLevel ? s.run.threat ?? 0 : 0);
  const eliteUp = elite ? ELITE_LEVELS + tm.eliteLevels : 0;
  let enemies = withElites(levelId, enemyPlacements(getLevel(levelId)), distortions.includes('guard') || elite)
    .map((p) => ({ ...p, level: p.level + bonus + tm.enemyLevels + eliteUp + (campaignLevel ? CHAPTER_ENEMY_LEVELS[chapterOf(levelId).id] ?? 0 : 0) }));
  if (rule === 'mirror') {
    // "Зеркало": your own formation in black, at this battle's level.
    const lv = getLevel(levelId).level + bonus + tm.enemyLevels + eliteUp + (CHAPTER_ENEMY_LEVELS[chapterOf(levelId).id] ?? 0);
    enemies = s.formation.map((f) => ({ kind: f.kind, x: f.x, y: BOARD_SIZE - 1 - f.y, level: lv }));
  }
  // Every elite battle has a champion: its strongest piece, bigger and far tougher.
  if (elite) {
    const pick = enemies.filter((p) => p.kind !== 'king' && !p.boss)
      .sort((a, b) => PIECES[b.kind].cost - PIECES[a.kind].cost || a.y - b.y || a.x - b.x)[0];
    if (pick) {
      pick.champion = true;
      pick.trait ??= 'furious';
    }
  }
  if (!isFinale(levelId)) {
    const terrain = levelTerrain(levelId);
    const free = (x: number, y: number) => walkable(terrain[y * BOARD_SIZE + x])
      && !allies.some((a) => a.x === x && a.y === y) && !enemies.some((e) => e.x === x && e.y === y);
    // "Переманивание": in an elite battle one enemy piece changes sides and takes the mirrored square.
    if (elite && rule !== 'mirror' && hasNode(s, 'lure')) {
      const pool = enemies.filter((p) => p.kind !== 'king' && !p.boss);
      const pick = pool[levelId.length % Math.max(1, pool.length)];
      if (pick && free(pick.x, BOARD_SIZE - 1 - pick.y)) {
        enemies = enemies.filter((p) => p !== pick);
        allies.push({ kind: pick.kind, x: pick.x, y: BOARD_SIZE - 1 - pick.y, level: pick.level, trait: pick.trait });
      }
    }
    // "Страж на службе": the last boss beaten in this run fights for you.
    if (hasNode(s, 'guardian') && s.run.guardian) {
      const spot = [[3, 6], [4, 6], [2, 6], [5, 6], [3, 5], [4, 5], [1, 6], [6, 6]].find(([x, y]) => free(x, y));
      const level = Math.max(1, (enemies.find((p) => p.kind !== 'king')?.level ?? 1) - 1);
      if (spot) allies.push({ kind: s.run.guardian, x: spot[0], y: spot[1], level, boss: true });
    }
  }
  // Relics that shape the build.
  const relicKind: Partial<Record<PieceKind, { atk: number; hp: number }>> = {};
  const pawns = allies.filter((a) => a.kind === 'pawn').length;
  if (hasRelic(s, 'pawnStorm') && pawns) relicKind.pawn = { atk: 1 + 0.06 * pawns, hp: 1 };
  if (hasRelic(s, 'ironKing')) relicKind.king = { atk: 1.4, hp: 1 };
  const lone = hasRelic(s, 'loneWolf') && allies.filter((a) => a.kind !== 'king').length <= 3 ? 1.4 : 1;
  // Event blessings and curses.
  const campaign = !isFinale(levelId);
  const boons = campaign ? activeBoons(s.run, !!getLevel(levelId).boss) : [];
  const boon = (key: 'atk' | 'hp' | 'foe') => boons.reduce((v, x) => v * (x[key] ?? 1), 1);
  return {
    allies, enemies,
    allyHpMult: m * rb.hp * lone * boon('hp'),
    allyAtkMult: m * rb.atk * lone * boon('atk'),
    allyKingHpMult: rb.kingHp * (army.kingHp ?? 1) * (hasRelic(s, 'ironKing') ? 1.5 : 1),
    allyKind: mergeKind(mergeKind(rb.kind, army.kind), relicKind),
    enemyHpMult: boon('foe'),
    allyPawnShield: rb.pawnShield + (army.pawnShield ?? 0),
    allyCrit: rb.crit,
    allyOpening: rb.opening,
    legends: rb.legends,
    relics: [...s.relics],
    allyBranches: { ...s.abilityBranch },
    terrain: terrainRowsFor(s, levelId),
    bossId: bossFor(levelId),
    perks: [...s.crownTree.filter((id) => BATTLE_PERKS.has(id)), ...(army.warlord ? ['warlord' as NodeId] : [])],
    enemyAbilityShift: distortions.includes('awakening') ? AWAKENING_SHIFT : 0,
    enemyKingHp: (distortions.includes('blackKing') ? BLACK_KING_HP : 1) * tm.enemyKingHp,
    enemyKingAtk: distortions.includes('blackKing') ? BLACK_KING_ATK : 1,
    eliteRule: rule,
    // Chapter bosses are a fifth tougher than the base giant (the finale keeps its own balance).
    bossHpMult: campaignLevel ? CHAPTER_BOSS_HP * tm.bossHp : 1,
    championHpMult: tm.championHp,
    bossRageAt: tm.rageAt,
  };
}

/** Multiply two per-kind bonus tables together. */
function mergeKind(
  a: Partial<Record<PieceKind, { atk: number; hp: number }>>, b: Partial<Record<PieceKind, { atk: number; hp: number }>> = {},
): Partial<Record<PieceKind, { atk: number; hp: number }>> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [PieceKind, { atk: number; hp: number }][]) {
    const cur = out[k] ?? { atk: 1, hp: 1 };
    out[k] = { atk: cur.atk * v.atk, hp: cur.hp * v.hp };
  }
  return out;
}

// ---------- Results ----------

export interface BattleOutcome {
  win: boolean;
  firstClear: boolean;
  reward: number;
  /** Relic picks earned by this battle. */
  relicsEarned: number;
  /** Share of enemy health removed (1 on a win). */
  damageShare: number;
  /** "Трофеи": the boss gave a free spin of the Crown Wheel. */
  trophy?: boolean;
  /** The Hand fell for the first time: roll the credits. */
  ending?: boolean;
  /** Run map: a spare banner burned for this loss (fight again), or the run is over. */
  spared?: boolean;
  runOver?: boolean;
  /** The win finished the chapter (or the whole story of this game). */
  chapterDone?: boolean;
  elite?: boolean;
}

/** A lost battle still pays: up to half of a replay reward, in proportion to the damage done. */
export const CONSOLATION_SHARE = 0.5;

export function recordResult(s: GameState, levelId: string, b: Battle): BattleOutcome {
  const level = getLevel(levelId);
  const win = b.result === 'win';
  const damageShare = enemyDamageShare(b);
  if (isFinale(levelId)) return recordFinale(s, levelId, b, damageShare);
  const firstClear = win && !s.cleared[levelId];
  // A battle started straight from a level (not through the map) still enters its node.
  if (!s.run.at) {
    const node = availableNodes(s.run).find((n) => n.level === levelId);
    if (node) s.run.at = node.id;
  }
  const elite = isEliteBattle(s, levelId);
  let reward = 0;
  if (win) {
    reward = battleGold(s, levelId, elite);
  } else {
    reward = Math.round(replayReward(levelId) * CONSOLATION_SHARE * damageShare * goldMultiplier(s));
  }
  if (win) s.cleared[levelId] = true;
  // A relic for every boss and every elite.
  const relicsEarned = win && (elite || (firstClear && level.boss)) ? 1 : 0;
  s.relicPicks += relicsEarned;
  s.gold += reward;
  countBattle(s, b, win, reward);
  // "Трофеи": every boss beaten gives a free spin of the Crown Wheel.
  const trophy = win && !!level.boss && hasNode(s, 'trophies');
  if (trophy) s.roulette.free++;
  if (win && level.boss) s.run.guardian = enemyPlacements(level).find((p) => p.boss)?.kind;
  // The run map: a win moves on, a loss costs a banner.
  const atNode = currentNode(s.run)?.level === levelId;
  if (atNode) wearBoons(s.run, !!level.boss);
  // "Копилка": a tenth of the gold you hold, up to half a battle's pay.
  if (win && hasRelic(s, 'piggyBank')) {
    const interest = Math.min(Math.round(s.gold * 0.1), Math.round(chapterGold(s.run.chapter) * 0.5));
    s.gold += interest;
    reward += interest;
  }
  let spared = false;
  let runOver = false;
  let chapterDone = false;
  if (atNode) s.run.chapterLosses = (s.run.chapterLosses ?? 0) + b.allyLosses;
  if (atNode && win) {
    chapterDone = !!level.boss;
    // "Ни шагу назад": a whole chapter without losing a single piece.
    if (chapterDone && !s.run.chapterLosses) s.stats.cleanChapters++;
    winNode(s);
  } else if (atNode) {
    spared = loseNode(s, levelId) === 'spared';
    runOver = !spared;
  }
  return {
    win, firstClear, reward, relicsEarned, damageShare, trophy,
    spared, runOver, chapterDone, elite,
  };
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

/** Crowns for beating the Hand the first time. */
export const FINALE_CROWNS = 10;

/** The finale: a won phase is a checkpoint; beating the Hand ends the story (once) and pays crowns. */
function recordFinale(
  s: GameState, levelId: string, b: Battle, damageShare: number,
): BattleOutcome {
  const phase = finalePhase(levelId);
  const win = b.result === 'win';
  const firstClear = win && !s.finale.beaten && phase > s.finale.phase;
  let ending = false;
  if (win) {
    s.finale.phase = Math.max(s.finale.phase, phase);
    if (phase === 3 && !s.finale.beaten) {
      s.finale.beaten = true;
      s.crowns += FINALE_CROWNS;
      ending = true;
    }
  }
  countBattle(s, b, win, 0);
  return { win, firstClear, reward: 0, relicsEarned: 0, damageShare, ending };
}

// ---------- Prestige ----------

export const PRESTIGE_UNLOCK = '4-9';

/** A won run (the fourth boss fell) can be closed for the next game at any time. */
export function canPrestige(s: GameState): boolean {
  return s.run.complete && !s.run.over;
}

/** Crowns for closing the won run now. */
export function crownsForPrestige(s: GameState): number {
  return crownsForRun(s, true);
}

/** Close a won run by choice and start the next, harder game. Returns crowns gained. */
export function prestige(s: GameState, now = Date.now()): number {
  if (!canPrestige(s)) return 0;
  const over = endRun(s, true, PRESTIGE_UNLOCK);
  startNextRun(s, now);
  return over.crowns;
}

/**
 * Start the next run from 1-1 with a new army. After a won run the next game
 * begins (stronger enemies, a new distortion); after a lost one the same game
 * is played again. Crowns, the Crown Tree, the roulette, achievements, stats,
 * tips and the finale's progress carry over.
 */
export function startNextRun(s: GameState, now = Date.now(), army: ArmyId = s.run.army ?? 'guard', threat = s.run.threat ?? 0): void {
  const won = s.run.over?.won ?? false;
  const fresh = newGame(now);
  fresh.armies = s.armies;
  applyArmy(fresh, s.armies.includes(army) ? army : 'guard');
  fresh.crowns = s.crowns;
  fresh.prestige = s.prestige + (won ? 1 : 0);
  fresh.threatMax = s.threatMax;
  fresh.achievements = s.achievements;
  fresh.achievementsClaimed = s.achievementsClaimed;
  fresh.tutorial = s.tutorial;
  fresh.abilityBranch = s.abilityBranch;
  fresh.stats = s.stats;
  fresh.roulette = s.roulette;
  fresh.finale = s.finale;
  fresh.crownTree = s.crownTree;
  if (s.crownTree.includes('heritage')) fresh.relics.push('spareBanner');
  if (s.crownTree.includes('vault')) fresh.relicPicks += 1;
  // Gifts of the Crown Wheel shape the start of every run.
  const gifts = runStartGifts(s.roulette);
  fresh.gold += gifts.gold;
  fresh.army.pawn = Math.min(PAWN_CAP, fresh.army.pawn + gifts.pawns);
  fresh.army.knight += gifts.knights;
  fresh.buildings.forge += gifts.forge;
  fresh.relicPicks += gifts.relicPicks;
  // "Голод": the first spin after every run is free.
  if (s.crownTree.includes('hunger')) fresh.roulette.free = Math.max(fresh.roulette.free, 1);
  fresh.run.seed = (s.run.seed * 13 + 7 + s.stats.runs) >>> 0;
  startChapter(fresh, 1);
  fresh.run.threat = Math.max(0, Math.min(threat, fresh.threatMax));
  Object.assign(s, fresh);
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

/** Crowns an achievement pays: one, or two for the hardest. */
export function claimAchievement(s: GameState, id: string): number {
  const def = getAchievement(id);
  if (!def || !s.achievements.includes(id) || s.achievementsClaimed.includes(id)) return 0;
  s.achievementsClaimed.push(id);
  // Crowns, not gold: gold belongs to the run, and a big reward would decide it.
  const crowns = def.crowns;
  s.crowns += crowns;
  return crowns;
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

/** Merge saved data over a fresh game so new fields get defaults. Null when the data is not a save. */
function pawnRefund(count: number): number {
  let gold = 0;
  for (let n = PAWN_CAP; n < count; n++) gold += Math.round(PIECES.pawn.cost * 1.2 ** n);
  return gold;
}

/** Fields of older saves that the game no longer keeps; parseSave reads them once and drops them. */
interface LegacySave {
  /** Before `cleared`: a star rating per level (any value above 0 = cleared). */
  stars?: Record<string, number>;
  starMilestones?: number;
  /** The closed Abyss and its shards (shards become crowns). */
  abyss?: unknown;
  shards?: number;
  /** The old Altar: shards spent on it are refunded first. */
  altar?: Record<string, number>;
  /** The removed treasury. */
  treasury?: number;
  lastTick?: number;
}

/** Keys of older saves to drop after migration. */
const LEGACY_KEYS = ['stars', 'starMilestones', 'abyss', 'shards', 'altar', 'treasury', 'lastTick'] as const;

export function parseSave(raw: string, now = Date.now()): GameState | null {
  try {
    const data = JSON.parse(raw) as Partial<GameState> & LegacySave;
    if (!data || data.version !== 2) return null;
    const state = newGame(now);
    const merged = {
      ...state,
      ...data,
      army: { ...state.army, ...data.army, king: 1, pawn: Math.min(PAWN_CAP, data.army?.pawn ?? state.army.pawn) },
      // Pawns above the cap (older saves) are paid back.
      gold: (data.gold ?? state.gold) + pawnRefund(data.army?.pawn ?? 0),
      levels: { ...state.levels, ...data.levels },
      abilityBranch: { ...state.abilityBranch, ...data.abilityBranch },
      buildings: { ...state.buildings, ...data.buildings },
      stats: { ...state.stats, ...data.stats },
      // Older saves kept a star rating per level: any star means the level is cleared.
      cleared: { ...legacyCleared(data.stars), ...data.cleared },
      finale: { ...state.finale, ...data.finale },
      run: data.run ? { ...state.run, ...data.run } : state.run,
      armies: data.armies?.length ? [...data.armies] : state.armies,
      crownTree: [...(data.crownTree ?? [])],
      roulette: { ...state.roulette, ...data.roulette, owned: { ...data.roulette?.owned } },
    } as GameState;
    for (const key of LEGACY_KEYS) delete (merged as unknown as Record<string, unknown>)[key];
    // The treasury is gone (a run earns gold on its map only).
    delete (merged.buildings as Record<string, number>).treasury;
    delete (merged.stats as Record<string, number>).treasuryCollected;
    if (merged.run.over) delete (merged.run.over as { abyss?: number }).abyss;
    if (!data.run) migrateToRun(merged);
    // Relics that no longer exist are dropped.
    merged.relics = merged.relics.filter((id) => RELICS[id]);
    // A save from before the Crown Wheel (no `free` field): old roulette buffs become crowns, legendaries stay.
    if (!data.roulette || data.roulette.free === undefined) {
      const { roulette, crowns } = migrateRoulette(data.roulette);
      merged.roulette = roulette;
      merged.crowns += crowns;
    }
    // Starting armies came later: open the ones whose bosses this save has beaten.
    const opened: [string, ArmyId][] = [['boss_1', 'cavalry'], ['boss_2', 'archers'], ['boss_3', 'fortress']];
    for (const [ach, id] of opened) if (merged.achievements.includes(ach) && !merged.armies.includes(id)) merged.armies.push(id);
    if (merged.prestige > 0 && !merged.armies.includes('warrior')) merged.armies.push('warrior');
    // The Abyss and the Altar are gone: their shards (plus every shard spent on the Altar) become crowns.
    merged.crowns += Math.floor(((data.shards ?? 0) + altarRefund(data.altar)) / 10);
    return merged;
  } catch {
    return null;
  }
}

/** Shards the old Altar perks cost, refunded when the Altar became the roulette. */
function altarRefund(altar: Partial<Record<string, number>> | undefined): number {
  if (!altar) return 0;
  const defs: Record<string, [number, number]> = {
    darkSteel: [5, 1.5], deepHide: [5, 1.5], mantle: [8, 1.7], voidGold: [6, 1.6], veterans: [25, 2.2], echo: [30, 2.5],
  };
  let total = 0;
  for (const [id, lvl] of Object.entries(altar)) {
    const d = defs[id];
    if (!d || !lvl) continue;
    for (let i = 0; i < lvl; i++) total += Math.round(d[0] * d[1] ** i);
  }
  return total;
}

/** Cleared levels of a save from before `cleared` (a star rating per level). */
function legacyCleared(stars: Record<string, number> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [id, n] of Object.entries(stars ?? {})) if (n > 0) out[id] = true;
  return out;
}

/** A save from before the run map: the run starts at the first chapter whose boss still stands. */
function migrateToRun(s: GameState): void {
  const chapter = CHAPTERS.find((c) => !isCleared(s, c.levels[c.levels.length - 1].id));
  startChapter(s, chapter?.id ?? CHAPTERS.length);
  if (!chapter) s.run.complete = true;
}

export function loadGame(now = Date.now()): GameState {
  let state = newGame(now);
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = parseSave(raw, now) ?? state;
  } catch {
    // Storage unavailable: keep the new game.
  }
  return state;
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
