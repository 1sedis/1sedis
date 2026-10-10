export type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen';

export interface PieceDef {
  kind: PieceKind;
  name: string;
  hp: number;
  atk: number;
  /** Ticks between attacks. */
  attackCd: number;
  /** Ticks between moves. */
  moveCd: number;
  /** Max distance for line attacks (bishop/rook/queen). */
  range: number;
  cost: number;
  unlockWave: number;
  white: string;
  black: string;
  description: string;
}

export const PIECES: Record<PieceKind, PieceDef> = {
  pawn: {
    kind: 'pawn', name: 'Пешка', hp: 60, atk: 8, attackCd: 10, moveCd: 7, range: 1,
    cost: 10, unlockWave: 1, white: '♙', black: '♟',
    description: 'Дешёвый боец ближнего боя.',
  },
  knight: {
    kind: 'knight', name: 'Конь', hp: 85, atk: 13, attackCd: 9, moveCd: 8, range: 1,
    cost: 60, unlockWave: 3, white: '♘', black: '♞',
    description: 'Прыгает буквой «Г» и бьёт с клеток хода коня.',
  },
  bishop: {
    kind: 'bishop', name: 'Слон', hp: 60, atk: 16, attackCd: 12, moveCd: 7, range: 3,
    cost: 150, unlockWave: 5, white: '♗', black: '♝',
    description: 'Стреляет по диагонали на 3 клетки.',
  },
  rook: {
    kind: 'rook', name: 'Ладья', hp: 180, atk: 15, attackCd: 14, moveCd: 9, range: 3,
    cost: 400, unlockWave: 8, white: '♖', black: '♜',
    description: 'Крепкий танк, бьёт по прямой на 3 клетки.',
  },
  queen: {
    kind: 'queen', name: 'Ферзь', hp: 160, atk: 26, attackCd: 10, moveCd: 6, range: 3,
    cost: 1500, unlockWave: 12, white: '♕', black: '♛',
    description: 'Бьёт во все 8 направлений.',
  },
};

export const PIECE_ORDER: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

export const MAX_STARS = 5;

/** Each star doubles HP and attack. */
export function starMultiplier(stars: number): number {
  return 2 ** (stars - 1);
}

type Dir = readonly [number, number];

const ORTHO: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL: Dir[] = [...ORTHO, ...DIAG];
const KNIGHT: Dir[] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

/** Single-step move offsets for each piece. */
export function moveOffsets(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'pawn': return ORTHO;
    case 'knight': return KNIGHT;
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
  }
}

/** Directions of ranged line attacks, empty for pieces without them. */
export function lineDirections(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
    default: return [];
  }
}

export const KNIGHT_OFFSETS = KNIGHT;
