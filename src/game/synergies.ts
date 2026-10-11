import type { PieceKind } from './pieces';

export type SynergyId = 'phalanx' | 'cavalry' | 'bishops' | 'towers' | 'fullSet';

export interface SynergyDef {
  id: SynergyId;
  name: string;
  description: string;
  /** Pieces of a kind needed (fullSet: one of every kind but the king). */
  kind: PieceKind | null;
  need: number;
  /** Bonus multipliers for the affected kinds. */
  hp: number;
  atk: number;
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'phalanx', name: 'Фаланга', description: '3 пешки: пешки +20% здоровья', kind: 'pawn', need: 3, hp: 1.2, atk: 1 },
  { id: 'cavalry', name: 'Кавалерия', description: '2 коня: кони +20% атаки', kind: 'knight', need: 2, hp: 1, atk: 1.2 },
  { id: 'bishops', name: 'Пара слонов', description: '2 слона: слоны +25% атаки', kind: 'bishop', need: 2, hp: 1, atk: 1.25 },
  { id: 'towers', name: 'Башни', description: '2 ладьи: ладьи +15% здоровья и атаки', kind: 'rook', need: 2, hp: 1.15, atk: 1.15 },
  { id: 'fullSet', name: 'Полный набор', description: 'Все 5 видов фигур: вся армия +10% атаки', kind: null, need: 5, hp: 1, atk: 1.1 },
];

const ARMY_KINDS: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

/** How far each synergy is: [have, need]. */
export function synergyProgress(kinds: PieceKind[]): { def: SynergyDef; have: number; active: boolean }[] {
  return SYNERGIES.map((def) => {
    const have = def.kind
      ? kinds.filter((k) => k === def.kind).length
      : ARMY_KINDS.filter((k) => kinds.includes(k)).length;
    return { def, have: Math.min(have, def.need), active: have >= def.need };
  });
}

/** Multipliers a piece of `kind` gets from the active synergies of an army. */
export function synergyBonus(kinds: PieceKind[], kind: PieceKind): { hp: number; atk: number } {
  let hp = 1;
  let atk = 1;
  for (const { def, active } of synergyProgress(kinds)) {
    if (!active || (def.kind && def.kind !== kind)) continue;
    hp *= def.hp;
    atk *= def.atk;
  }
  return { hp, atk };
}
