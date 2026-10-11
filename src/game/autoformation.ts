import { createBattle, simulate } from './battle';
import type { PieceKind } from './pieces';
import { available, battleSetup, isPlayerCell, slotAt, type FormationSlot, type GameState } from './state';

export interface FormationTemplate {
  /** Column of the king on the back rank. */
  kingX: number;
  /** Row of the pawn wall (5 = front, 6 = middle). */
  pawnRow: 5 | 6;
  /** Knights on the flanks or next to the centre. */
  knights: 'flank' | 'center';
}

export const DEFAULT_TEMPLATE: FormationTemplate = { kingX: 3, pawnRow: 5, knights: 'flank' };

const clampX = (x: number) => Math.max(0, Math.min(7, x));

/** Preferred cells per kind for a template, best first. */
function spots(t: FormationTemplate): Record<PieceKind, [number, number][]> {
  const k = t.kingX;
  const around = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7].map((d) => clampX(k + d));
  const back = t.pawnRow === 5 ? 6 : 7;
  const uniq = (cells: [number, number][]) => cells.filter(([x, y], i) => cells.findIndex(([a, b]) => a === x && b === y) === i);
  return {
    king: [[k, 7]],
    queen: uniq([[clampX(k + 1), 6], [clampX(k - 1), 6], [clampX(k + 1), 7]]),
    pawn: uniq([...around.map((x): [number, number] => [x, t.pawnRow]), ...around.map((x): [number, number] => [x, back])]),
    knight: t.knights === 'flank'
      ? [[0, 6], [7, 6], [1, 6], [6, 6], [0, 7], [7, 7]]
      : uniq([[clampX(k - 2), 6], [clampX(k + 2), 6], [clampX(k - 3), 6], [clampX(k + 3), 6]]),
    bishop: uniq([[clampX(k - 1), back], [clampX(k + 2), back], [clampX(k - 2), back], [clampX(k + 1), back], [clampX(k - 1), 7], [clampX(k + 2), 7]]),
    rook: [[0, 7], [7, 7], [1, 7], [6, 7], [5, 6], [1, 6]],
  };
}

/** Replace the formation with one built from a template and the available army. */
export function autoFormation(s: GameState, limit: number, template: FormationTemplate = DEFAULT_TEMPLATE, levelId?: string): void {
  const kingSpot = [template.kingX, 3, 4, 2, 5, 1, 6, 0, 7].find((x) => isPlayerCell(x, 7, levelId)) ?? template.kingX;
  s.formation = [{ kind: 'king', x: kingSpot, y: 7 }];
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

  const prefs = spots(template);
  for (const kind of pick) {
    if (available(s, kind) <= 0) continue;
    const free = ([x, y]: [number, number]) => !slotAt(s, x, y) && isPlayerCell(x, y, levelId);
    const spot = prefs[kind].find(free) ?? allCells().find(free);
    if (spot) s.formation.push({ kind, x: spot[0], y: spot[1] });
  }
}

function allCells(): [number, number][] {
  const cells: [number, number][] = [];
  for (const y of [6, 5, 7]) for (let x = 0; x < 8; x++) if (isPlayerCell(x, y)) cells.push([x, y]);
  return cells;
}

/** Higher is better: any win beats any loss; then king health, losses and speed. */
export function formationScore(s: GameState, levelId: string): number {
  const b = createBattle(battleSetup(s, levelId));
  simulate(b);
  if (b.result === 'win') return 100_000 + b.kingMinRatio * 1000 - b.allyLosses * 100 - b.tick;
  const dealt = Object.values(b.report).filter((r) => r.side === 'ally').reduce((sum, r) => sum + r.dealt, 0);
  return dealt;
}

/**
 * Try every template against the actual enemy and keep the best formation.
 * Battles are cheap (a few milliseconds each), so 16 simulations are fine on a phone.
 */
export function bestFormation(s: GameState, levelId: string, limit: number): FormationTemplate {
  let best: { t: FormationTemplate; score: number; formation: FormationSlot[] } | null = null;
  for (const kingX of [3, 4, 2, 5]) {
    for (const pawnRow of [5, 6] as const) {
      for (const knights of ['flank', 'center'] as const) {
        const t = { kingX, pawnRow, knights };
        autoFormation(s, limit, t, levelId);
        const value = formationScore(s, levelId);
        if (!best || value > best.score) best = { t, score: value, formation: s.formation.map((f) => ({ ...f })) };
      }
    }
  }
  s.formation = best!.formation;
  return best!.t;
}
