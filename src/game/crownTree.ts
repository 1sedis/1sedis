/**
 * Crown Tree: crowns from new games buy doctrines that change the rules of
 * battle, the court and the Abyss. Each branch has four tiers; on every tier
 * the player picks one of two nodes. Deep tiers open in later games.
 */
import type { PieceKind } from './pieces';

export type BranchId = 'gambit' | 'court' | 'shadow';

export type NodeId =
  | 'doubleStep' | 'castling' | 'fork' | 'check' | 'earlyCrown' | 'sacrifice' | 'archbishop' | 'chancellor'
  | 'trophies' | 'tribute' | 'vault' | 'heritage' | 'heralds' | 'banner' | 'twoQueens' | 'warlord'
  | 'hunger' | 'luck' | 'shadowReserve' | 'fog' | 'echo' | 'lure' | 'ghost' | 'guardian';

export interface CrownNode {
  id: NodeId;
  branch: BranchId;
  /** 0..3 */
  tier: number;
  name: string;
  text: string;
  /** A prestige piece this node unlocks. */
  piece?: PieceKind;
}

export const BRANCHES: Record<BranchId, { name: string; text: string; icon: string }> = {
  gambit: { name: 'Гамбит', text: 'Шахматные приёмы', icon: '♞' },
  court: { name: 'Двор', text: 'Устройство королевства', icon: '♛' },
  shadow: { name: 'Тень', text: 'Сила Бездны', icon: '☠' },
};

export const BRANCH_ORDER: BranchId[] = ['gambit', 'court', 'shadow'];

/** Crown cost and the first game (1 = before any new game) per tier. */
export const TIER_COST = [2, 4, 6, 9];
export const TIER_FROM_GAME = [1, 1, 2, 3];

const N = (id: NodeId, branch: BranchId, tier: number, name: string, text: string, piece?: PieceKind): CrownNode =>
  ({ id, branch, tier, name, text, piece });

export const NODES: CrownNode[] = [
  N('doubleStep', 'gambit', 0, 'Двойной шаг', 'Пешки первым ходом проходят 2 клетки, как в шахматах.'),
  // Kept as 'castling' so old saves keep the node: castling itself is now a move anyone can make.
  N('castling', 'gambit', 0, 'Темп', 'Третий ход в каждом бою.'),
  N('fork', 'gambit', 1, 'Вилка', 'Взятие конём (и любой прыгающей фигурой) бьёт ещё одного врага в зоне прыжка.'),
  N('check', 'gambit', 1, 'Шах', 'Взятие вражеского короля оглушает его втрое дольше.'),
  N('earlyCrown', 'gambit', 2, 'Ранняя коронация', 'Пешки становятся ферзём на 2 ряда раньше.'),
  N('sacrifice', 'gambit', 2, 'Жертва', 'Павшая пешка дарит соседним союзникам щит в 25% здоровья.'),
  N('archbishop', 'gambit', 3, 'Архиепископ', 'Новая фигура: ходит и бьёт как слон и как конь.', 'archbishop'),
  N('chancellor', 'gambit', 3, 'Канцлер', 'Новая фигура: ходит и бьёт как ладья и как конь.', 'chancellor'),
  N('trophies', 'court', 0, 'Трофеи', 'Первая победа на каждом уровне даёт бесплатную крутку рулетки.'),
  N('tribute', 'court', 0, 'Дань', 'Боссы и элита платят вдвое больше золота.'),
  N('vault', 'court', 1, 'Сокровищница', 'Каждый забег начинается с выбора реликвии.'),
  N('heritage', 'court', 1, 'Наследство', 'Каждый забег начинается с Запасным знаменем — второй жизнью.'),
  N('heralds', 'court', 2, 'Герольды', 'Синергиям нужно на одну фигуру меньше.'),
  N('banner', 'court', 2, 'Знамя', '+1 фигура в каждом бою.'),
  N('twoQueens', 'court', 3, 'Две королевы', 'В армии можно держать двух ферзей.'),
  N('warlord', 'court', 3, 'Король-полководец', 'Король не прячется: сам идёт в атаку и бьёт на 2 клетки во все стороны.'),
  N('hunger', 'shadow', 0, 'Голод', '+1 осколок за каждый этаж Бездны.'),
  N('luck', 'shadow', 0, 'Удача', 'Крутка рулетки стоит 4 ◆ вместо 5.'),
  N('shadowReserve', 'shadow', 1, 'Теневой резерв', 'Первые две павшие в бою фигуры возвращаются тенями с третью здоровья.'),
  N('fog', 'shadow', 1, 'Туман войны', 'Первые 3 секунды боя враги не атакуют.'),
  N('echo', 'shadow', 2, 'Эхо легенд', 'Легендарки в рулетке выпадают вдвое чаще.'),
  N('lure', 'shadow', 2, 'Переманивание', 'В бою в Бездне одна случайная вражеская фигура переходит на вашу сторону.'),
  N('ghost', 'shadow', 3, 'Призрак', 'Новая фигура: прыгает на 2 клетки сквозь фигуры и камни и охотится на стрелков.', 'ghost'),
  N('guardian', 'shadow', 3, 'Страж на службе', 'Последний побеждённый страж Бездны сражается за вас в каждом бою Бездны.'),
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((x) => [x.id, x])) as Record<NodeId, CrownNode>;

export type NodeState = 'owned' | 'available' | 'rejected' | 'locked';

export function nodeCost(node: CrownNode): number {
  return TIER_COST[node.tier];
}

/** The other node of the same tier. */
export function twinOf(node: CrownNode): CrownNode {
  return NODES.find((x) => x.branch === node.branch && x.tier === node.tier && x.id !== node.id)!;
}

/** Owned; can be bought now (crowns permitting); its twin was picked; or not reachable yet. */
export function nodeState(owned: readonly NodeId[], game: number, node: CrownNode): NodeState {
  if (owned.includes(node.id)) return 'owned';
  if (owned.includes(twinOf(node).id)) return 'rejected';
  return lockReason(owned, game, node) ? 'locked' : 'available';
}

export function lockReason(owned: readonly NodeId[], game: number, node: CrownNode): string | null {
  if (node.tier > 0) {
    const below = NODES.filter((x) => x.branch === node.branch && x.tier === node.tier - 1);
    if (!below.some((x) => owned.includes(x.id))) return 'Сначала выберите узел ярусом ниже';
  }
  if (game < TIER_FROM_GAME[node.tier]) return `Откроется в партии ${TIER_FROM_GAME[node.tier]}`;
  return null;
}

/** Crowns spent on owned nodes (refunded by a reset). */
export function spentCrowns(owned: readonly NodeId[]): number {
  return owned.reduce((sum, id) => sum + nodeCost(NODE_BY_ID[id]), 0);
}

export const RESET_COST = 1;
