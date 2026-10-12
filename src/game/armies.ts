import type { PieceKind } from './pieces';
import { t } from '../i18n';

/**
 * Starting armies: every run begins with one of them. Each has its own
 * pieces, gold and a rule that holds for the whole run. New ones open as the
 * story goes; the choice is made before every run.
 */
export type ArmyId = 'guard' | 'cavalry' | 'archers' | 'fortress' | 'warrior';

export interface ArmyDef {
  id: ArmyId;
  name: string;
  /** The run-long rule. */
  rule: string;
  /** Pieces besides the king. */
  pieces: Partial<Record<PieceKind, number>>;
  gold: number;
  /** How it opens. */
  unlock: string;
  /** The boss level that opens it (null: a won game, or open from the start for the guard). */
  unlockedBy: string | null;
  /** Battle multipliers per kind, king health, pawn shields, doctrines it grants. */
  kind?: Partial<Record<PieceKind, { atk: number; hp: number }>>;
  kingHp?: number;
  pawnShield?: number;
  warlord?: boolean;
}

export const ARMIES: Record<ArmyId, ArmyDef> = {
  guard: {
    id: 'guard', name: t('Королевская стража'), rule: t('Пешки крепче на 20%.'),
    pieces: { pawn: 3 }, gold: 60, unlock: t('Открыта с начала'), unlockedBy: null,
    kind: { pawn: { atk: 1, hp: 1.2 } },
  },
  cavalry: {
    id: 'cavalry', name: t('Конница'), rule: t('Кони бьют на 30% сильнее и крепче на 10%.'),
    pieces: { pawn: 1, knight: 2 }, gold: 30, unlock: t('Победите Пешечного капитана'), unlockedBy: '1-9',
    kind: { knight: { atk: 1.3, hp: 1.1 } },
  },
  archers: {
    id: 'archers', name: t('Лучники'), rule: t('Слоны и ладьи бьют на 30% сильнее и крепче на 15%.'),
    pieces: { pawn: 1, bishop: 2 }, gold: 30, unlock: t('Победите Чёрного всадника'), unlockedBy: '2-9',
    kind: { bishop: { atk: 1.3, hp: 1.15 }, rook: { atk: 1.3, hp: 1.15 } },
  },
  fortress: {
    id: 'fortress', name: t('Твердыня'), rule: t('Король крепче на 60%, пешки начинают бой со щитом в 20% здоровья.'),
    pieces: { pawn: 2, rook: 1 }, gold: 40, unlock: t('Победите Башню-крепость'), unlockedBy: '3-9',
    kingHp: 1.6, pawnShield: 0.2,
  },
  warrior: {
    id: 'warrior', name: t('Король-воин'), rule: t('Только король и золото. Король сам идёт в атаку, бьёт по площади и вдвое крепче.'),
    pieces: {}, gold: 180, unlock: t('Выиграйте партию'), unlockedBy: null,
    kingHp: 2, warlord: true, kind: { king: { atk: 1.5, hp: 1 } },
  },
};

export const ARMY_ORDER: ArmyId[] = ['guard', 'cavalry', 'archers', 'fortress', 'warrior'];

/** Squares the starting pieces take, in order, around the king on d1. */
export const START_SQUARES: [number, number][] = [[2, 5], [4, 5], [3, 5], [5, 5], [3, 6], [4, 6]];
