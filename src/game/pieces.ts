import { t } from '../i18n';

export type PieceKind = 'king' | 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen'
  // Prestige pieces from the Crown Tree.
  | 'archbishop' | 'chancellor' | 'ghost';

export interface PieceDef {
  kind: PieceKind;
  name: string;
  role: string;
  hp: number;
  atk: number;
  /** Ticks between attacks. */
  attackCd: number;
  /** Ticks between moves (0 = never moves). */
  moveCd: number;
  /** Max distance for line attacks (0 = melee only). */
  range: number;
  /** Base recruitment cost (0 = cannot be recruited). */
  cost: number;
  description: string;
}

export const PIECES: Record<PieceKind, PieceDef> = {
  king: {
    kind: 'king', name: t('Король'), role: t('Сердце армии'),
    hp: 240, atk: 10, attackCd: 12, moveCd: 14, range: 0, cost: 0,
    description: t('Отступает от угроз и прячется за своими. Соседние союзники получают +20% к атаке. Пал король — бой проигран.'),
  },
  pawn: {
    kind: 'pawn', name: t('Пешка'), role: t('Стена'),
    hp: 90, atk: 10, attackCd: 10, moveCd: 12, range: 0, cost: 20,
    description: t('Идёт только вперёд и закрывает собой выстрелы. Дойдя до края доски, становится ферзём.'),
  },
  knight: {
    kind: 'knight', name: t('Конь'), role: t('Убийца'),
    hp: 110, atk: 16, attackCd: 9, moveCd: 8, range: 0, cost: 50,
    description: t('Прыгает через фигуры буквой «Г» и охотится на стрелков и короля.'),
  },
  bishop: {
    kind: 'bishop', name: t('Слон'), role: t('Стрелок'),
    hp: 85, atk: 18, attackCd: 12, moveCd: 9, range: 4, cost: 70,
    description: t('Стреляет по диагонали на 4 клетки. Хрупкий — держите за пешками.'),
  },
  rook: {
    kind: 'rook', name: t('Ладья'), role: t('Тяжёлый стрелок'),
    hp: 170, atk: 16, attackCd: 13, moveCd: 10, range: 7, cost: 150,
    description: t('Стреляет по прямой через всю доску. Крепкая.'),
  },
  queen: {
    kind: 'queen', name: t('Ферзь'), role: t('Козырь'),
    hp: 180, atk: 26, attackCd: 10, moveCd: 7, range: 4, cost: 400,
    description: t('Бьёт во все 8 направлений. В армии может быть только один.'),
  },
  archbishop: {
    kind: 'archbishop', name: t('Архиепископ'), role: t('Слон и конь'),
    hp: 150, atk: 22, attackCd: 11, moveCd: 8, range: 4, cost: 280,
    description: t('Стреляет по диагонали как слон и прыгает буквой «Г» как конь.'),
  },
  chancellor: {
    kind: 'chancellor', name: t('Канцлер'), role: t('Ладья и конь'),
    hp: 210, atk: 20, attackCd: 12, moveCd: 9, range: 7, cost: 340,
    description: t('Стреляет по прямой как ладья и прыгает буквой «Г» как конь.'),
  },
  ghost: {
    kind: 'ghost', name: t('Призрак'), role: t('Охотник из тени'),
    hp: 120, atk: 24, attackCd: 9, moveCd: 7, range: 0, cost: 240,
    description: t('Прыгает на 2 клетки в любую сторону сквозь фигуры и камни и охотится на стрелков и короля.'),
  },
};

/** Pieces that only exist for players who unlocked them in the Crown Tree. */
export const PRESTIGE_PIECES: PieceKind[] = ['archbishop', 'chancellor', 'ghost'];

/** Pieces the player can recruit, in shop order. */
export const RECRUITABLE: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];

export const RANGED: ReadonlySet<PieceKind> = new Set(['bishop', 'rook', 'queen', 'archbishop', 'chancellor']);

/** Pieces that jump like a knight (also as an attack). */
export const JUMPERS: ReadonlySet<PieceKind> = new Set(['knight', 'archbishop', 'chancellor']);

/** Pieces that hunt shooters and the king first. */
export const HUNTERS: ReadonlySet<PieceKind> = new Set(['knight', 'ghost']);

/** Stat multiplier for a piece upgrade level (level 1 = base). */
export function levelMultiplier(level: number): number {
  return 1.18 ** (level - 1);
}

type Dir = readonly [number, number];

const ORTHO: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL: Dir[] = [...ORTHO, ...DIAG];

export const KNIGHT_OFFSETS: Dir[] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

/** The ghost jumps up to two cells in any direction, over anything. */
const GHOST_OFFSETS: Dir[] = [];
for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (dx || dy) GHOST_OFFSETS.push([dx, dy]);

/** Single-step move offsets (pawns are handled separately: forward only). */
export function moveOffsets(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'knight': return KNIGHT_OFFSETS;
    case 'king': return ALL;
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
    case 'archbishop': return [...DIAG, ...KNIGHT_OFFSETS];
    case 'chancellor': return [...ORTHO, ...KNIGHT_OFFSETS];
    case 'ghost': return GHOST_OFFSETS;
    default: return [];
  }
}

/** Directions of ranged line attacks. */
export function lineDirections(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
    case 'archbishop': return DIAG;
    case 'chancellor': return ORTHO;
    default: return [];
  }
}
