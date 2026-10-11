export type PieceKind = 'king' | 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen';

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
    kind: 'king', name: 'Король', role: 'Сердце армии',
    hp: 240, atk: 10, attackCd: 12, moveCd: 0, range: 0, cost: 0,
    description: 'Не двигается. Соседние союзники получают +20% к атаке. Пал король — бой проигран.',
  },
  pawn: {
    kind: 'pawn', name: 'Пешка', role: 'Стена',
    hp: 90, atk: 10, attackCd: 10, moveCd: 12, range: 0, cost: 20,
    description: 'Идёт только вперёд и закрывает собой выстрелы. Дойдя до края доски, становится ферзём.',
  },
  knight: {
    kind: 'knight', name: 'Конь', role: 'Убийца',
    hp: 110, atk: 16, attackCd: 9, moveCd: 8, range: 0, cost: 60,
    description: 'Прыгает через фигуры буквой «Г» и охотится на стрелков и короля.',
  },
  bishop: {
    kind: 'bishop', name: 'Слон', role: 'Стрелок',
    hp: 70, atk: 18, attackCd: 12, moveCd: 9, range: 4, cost: 90,
    description: 'Стреляет по диагонали на 4 клетки. Хрупкий — держите за пешками.',
  },
  rook: {
    kind: 'rook', name: 'Ладья', role: 'Тяжёлый стрелок',
    hp: 170, atk: 16, attackCd: 13, moveCd: 10, range: 7, cost: 150,
    description: 'Стреляет по прямой через всю доску. Крепкая.',
  },
  queen: {
    kind: 'queen', name: 'Ферзь', role: 'Козырь',
    hp: 180, atk: 26, attackCd: 10, moveCd: 7, range: 4, cost: 400,
    description: 'Бьёт во все 8 направлений. В армии может быть только один.',
  },
};

/** Pieces the player can recruit, in shop order. */
export const RECRUITABLE: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

export const RANGED: ReadonlySet<PieceKind> = new Set(['bishop', 'rook', 'queen']);

/** Stat multiplier for a piece upgrade level (level 1 = base). */
export function levelMultiplier(level: number): number {
  return 1.18 ** (level - 1);
}

type Dir = readonly [number, number];

const ORTHO: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG: Dir[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ALL: Dir[] = [...ORTHO, ...DIAG];

export const KNIGHT_OFFSETS: Dir[] = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

/** Single-step move offsets (pawns are handled separately: forward only). */
export function moveOffsets(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'knight': return KNIGHT_OFFSETS;
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
    default: return [];
  }
}

/** Directions of ranged line attacks. */
export function lineDirections(kind: PieceKind): Dir[] {
  switch (kind) {
    case 'bishop': return DIAG;
    case 'rook': return ORTHO;
    case 'queen': return ALL;
    default: return [];
  }
}
