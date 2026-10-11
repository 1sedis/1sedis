import type { PieceKind } from './pieces';
import { available, isPlayerCell, slotAt, type GameState } from './state';

// Preferred cells per kind, best first: pawns form the front wall, shooters
// stand behind them, knights go to the flanks, the queen guards the king.
const SPOTS: Record<PieceKind, [number, number][]> = {
  king: [[3, 7]],
  queen: [[4, 6], [2, 6], [4, 7]],
  pawn: [[3, 5], [4, 5], [2, 5], [5, 5], [1, 5], [6, 5], [0, 5], [7, 5], [3, 6], [2, 6], [4, 6]],
  knight: [[0, 6], [7, 6], [1, 6], [6, 6], [0, 7], [7, 7]],
  bishop: [[2, 6], [5, 6], [3, 6], [4, 6], [2, 7], [5, 7]],
  rook: [[0, 7], [7, 7], [1, 7], [6, 7], [5, 6], [1, 6]],
};

/** Replace the formation with a sensible default using the available army. */
export function autoFormation(s: GameState, limit: number): void {
  s.formation = [{ kind: 'king', x: 3, y: 7 }];
  const pick: PieceKind[] = [];
  const pool = { ...s.army };
  const take = (kind: PieceKind) => {
    if (pick.length < limit && pool[kind] > 0) {
      pool[kind]--;
      pick.push(kind);
      return true;
    }
    return false;
  };
  // Roughly half the slots go to pawns, the rest to the strongest pieces.
  const pawnShare = Math.ceil(limit / 2);
  for (let i = 0; i < pawnShare; i++) take('pawn');
  for (const kind of ['queen', 'rook', 'bishop', 'knight'] as PieceKind[]) while (take(kind));
  while (take('pawn'));

  for (const kind of pick) {
    if (available(s, kind) <= 0) continue;
    const spot = SPOTS[kind].find(([x, y]) => !slotAt(s, x, y))
      ?? allCells().find(([x, y]) => !slotAt(s, x, y));
    if (spot) s.formation.push({ kind, x: spot[0], y: spot[1] });
  }
}

function allCells(): [number, number][] {
  const cells: [number, number][] = [];
  for (const y of [6, 5, 7]) for (let x = 0; x < 8; x++) if (isPlayerCell(x, y)) cells.push([x, y]);
  return cells;
}
