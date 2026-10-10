import { MAX_STARS, PIECE_ORDER, PIECES, type PieceKind } from './pieces';

export const BOARD_SIZE = 8;
/** Rows the player may deploy on (bottom two rows). */
export const PLAYER_ROWS = [6, 7];

export type UpgradeId = 'atk' | 'hp' | 'speed' | 'slots' | 'gold';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  atk: { id: 'atk', name: 'Острые клинки', description: '×1.1 к атаке', baseCost: 30, growth: 1.45, maxLevel: Infinity },
  hp: { id: 'hp', name: 'Закалённые доспехи', description: '×1.1 к здоровью', baseCost: 30, growth: 1.45, maxLevel: Infinity },
  speed: { id: 'speed', name: 'Строевая подготовка', description: '−4% к перезарядке', baseCost: 80, growth: 1.9, maxLevel: 10 },
  slots: { id: 'slots', name: 'Расширение лагеря', description: '+1 место на доске', baseCost: 40, growth: 2, maxLevel: 13 },
  gold: { id: 'gold', name: 'Трофеи', description: '+15% к награде', baseCost: 50, growth: 1.7, maxLevel: Infinity },
};

export const UPGRADE_ORDER: UpgradeId[] = ['atk', 'hp', 'speed', 'slots', 'gold'];

export const BASE_SLOTS = 3;
export const PRESTIGE_MIN_WAVE = 15;

export interface Position { x: number; y: number }

export interface OwnedPiece {
  id: number;
  kind: PieceKind;
  stars: number;
  /** Position on the board, or null if the piece sits on the bench. */
  pos: Position | null;
}

export interface GameState {
  version: 1;
  gold: number;
  crowns: number;
  /** Next wave to fight. */
  wave: number;
  /** Highest wave cleared in the current run. */
  bestWave: number;
  pieces: OwnedPiece[];
  bought: Record<PieceKind, number>;
  upgrades: Record<UpgradeId, number>;
  nextId: number;
  stats: { totalGold: number; battlesWon: number; prestiges: number; allTimeBestWave: number };
}

function emptyBought(): Record<PieceKind, number> {
  return { pawn: 0, knight: 0, bishop: 0, rook: 0, queen: 0 };
}

function emptyUpgrades(): Record<UpgradeId, number> {
  return { atk: 0, hp: 0, speed: 0, slots: 0, gold: 0 };
}

export function newGame(): GameState {
  return {
    version: 1,
    gold: 10,
    crowns: 0,
    wave: 1,
    bestWave: 0,
    pieces: [{ id: 1, kind: 'pawn', stars: 1, pos: { x: 3, y: 7 } }],
    bought: emptyBought(),
    upgrades: emptyUpgrades(),
    nextId: 2,
    stats: { totalGold: 0, battlesWon: 0, prestiges: 0, allTimeBestWave: 0 },
  };
}

// ---------- Multipliers ----------

export function crownMultiplier(s: GameState): number {
  return 1 + 0.05 * s.crowns;
}

export function atkMultiplier(s: GameState): number {
  return 1.1 ** s.upgrades.atk * crownMultiplier(s);
}

export function hpMultiplier(s: GameState): number {
  return 1.1 ** s.upgrades.hp * crownMultiplier(s);
}

export function cooldownMultiplier(s: GameState): number {
  return 1 - 0.04 * s.upgrades.speed;
}

export function goldMultiplier(s: GameState): number {
  return (1 + 0.15 * s.upgrades.gold) * crownMultiplier(s);
}

export function maxSlots(s: GameState): number {
  return BASE_SLOTS + s.upgrades.slots;
}

// ---------- Economy ----------

export function pieceCost(s: GameState, kind: PieceKind): number {
  return Math.round(PIECES[kind].cost * 1.12 ** s.bought[kind]);
}

export function isUnlocked(s: GameState, kind: PieceKind): boolean {
  return Math.max(s.wave, s.bestWave + 1) >= PIECES[kind].unlockWave;
}

export function upgradeCost(s: GameState, id: UpgradeId): number {
  const def = UPGRADES[id];
  return Math.round(def.baseCost * def.growth ** s.upgrades[id]);
}

export function waveReward(s: GameState, wave: number): number {
  return Math.round(15 * 1.17 ** (wave - 1) * goldMultiplier(s));
}

export function crownsForWave(bestWave: number): number {
  if (bestWave < PRESTIGE_MIN_WAVE) return 0;
  return Math.floor((bestWave - 10) ** 1.4 / 2);
}

export function placedPieces(s: GameState): OwnedPiece[] {
  return s.pieces.filter((p) => p.pos !== null);
}

export function benchPieces(s: GameState): OwnedPiece[] {
  return s.pieces.filter((p) => p.pos === null);
}

export function pieceAt(s: GameState, x: number, y: number): OwnedPiece | undefined {
  return s.pieces.find((p) => p.pos && p.pos.x === x && p.pos.y === y);
}

export function isPlayerCell(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && PLAYER_ROWS.includes(y);
}

// ---------- Actions (return true on success) ----------

export function buyPiece(s: GameState, kind: PieceKind): boolean {
  const cost = pieceCost(s, kind);
  if (!isUnlocked(s, kind) || s.gold < cost) return false;
  s.gold -= cost;
  s.bought[kind]++;
  const piece: OwnedPiece = { id: s.nextId++, kind, stars: 1, pos: null };
  s.pieces.push(piece);
  autoPlace(s, piece);
  mergePieces(s);
  return true;
}

/** Put a bench piece onto a free deploy cell if a slot is available. */
function autoPlace(s: GameState, piece: OwnedPiece): void {
  if (placedPieces(s).length >= maxSlots(s)) return;
  // Fill the front row from the centre outwards, then the back row.
  const cols = [3, 4, 2, 5, 1, 6, 0, 7];
  for (const y of PLAYER_ROWS) {
    for (const x of cols) {
      if (!pieceAt(s, x, y)) {
        piece.pos = { x, y };
        return;
      }
    }
  }
}

/** Merge every triple of identical pieces into one with an extra star. */
export function mergePieces(s: GameState): void {
  let merged = true;
  while (merged) {
    merged = false;
    for (const kind of PIECE_ORDER) {
      for (let stars = 1; stars < MAX_STARS; stars++) {
        const group = s.pieces.filter((p) => p.kind === kind && p.stars === stars);
        if (group.length < 3) continue;
        // Keep a placed piece if there is one, so the formation survives.
        group.sort((a, b) => Number(b.pos !== null) - Number(a.pos !== null));
        const [keep, ...rest] = group.slice(0, 3);
        keep.stars++;
        const removed = new Set(rest.map((p) => p.id));
        s.pieces = s.pieces.filter((p) => !removed.has(p.id));
        merged = true;
      }
    }
  }
}

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(s, id);
  if (s.upgrades[id] >= UPGRADES[id].maxLevel || s.gold < cost) return false;
  s.gold -= cost;
  s.upgrades[id]++;
  return true;
}

/** Move a piece to a cell (swapping with an occupant) or to the bench (null). */
export function movePiece(s: GameState, id: number, to: Position | null): boolean {
  const piece = s.pieces.find((p) => p.id === id);
  if (!piece) return false;
  if (to === null) {
    piece.pos = null;
    return true;
  }
  if (!isPlayerCell(to.x, to.y)) return false;
  const occupant = pieceAt(s, to.x, to.y);
  if (occupant === piece) return true;
  if (occupant) {
    occupant.pos = piece.pos;
  } else if (piece.pos === null && placedPieces(s).length >= maxSlots(s)) {
    return false;
  }
  piece.pos = { ...to };
  return true;
}

export function canPrestige(s: GameState): boolean {
  return crownsForWave(s.bestWave) > 0;
}

export function prestige(s: GameState): boolean {
  const gained = crownsForWave(s.bestWave);
  if (gained <= 0) return false;
  const fresh = newGame();
  fresh.crowns = s.crowns + gained;
  fresh.stats = { ...s.stats, prestiges: s.stats.prestiges + 1 };
  Object.assign(s, fresh);
  return true;
}

export function grantVictory(s: GameState): number {
  const reward = waveReward(s, s.wave);
  s.gold += reward;
  s.stats.totalGold += reward;
  s.stats.battlesWon++;
  s.bestWave = Math.max(s.bestWave, s.wave);
  s.stats.allTimeBestWave = Math.max(s.stats.allTimeBestWave, s.wave);
  s.wave++;
  return reward;
}

/** On defeat, step back one wave so idle play keeps farming gold. */
export function applyDefeat(s: GameState): void {
  s.wave = Math.max(1, s.wave - 1);
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

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<GameState>;
      if (data.version === 1) {
        const base = newGame();
        return {
          ...base,
          ...data,
          bought: { ...base.bought, ...data.bought },
          upgrades: { ...base.upgrades, ...data.upgrades },
          stats: { ...base.stats, ...data.stats },
        } as GameState;
      }
    }
  } catch {
    // Corrupt save: fall through to a new game.
  }
  return newGame();
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
