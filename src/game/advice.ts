import { t } from '../i18n';
import { formationScore } from './autoformation';
import { PIECES, type PieceKind } from './pieces';
import { upgradeCost, type GameState } from './state';

export interface UpgradeAdvice {
  kind: PieceKind;
  /** Level after the upgrade. */
  level: number;
  cost: number;
  /** The same formation wins once this upgrade is bought. */
  wins: boolean;
}

const WIN = 100_000;

/**
 * Pick the upgrade that helps most against this level, by simulating the
 * current formation with each fielded piece type one level higher.
 * Prefers the cheapest upgrade that wins; otherwise the best gain per gold.
 */
export function adviseUpgrade(s: GameState, levelId: string): UpgradeAdvice | null {
  const kinds = [...new Set(s.formation.map((f) => f.kind))];
  if (!kinds.length) return null;
  const base = formationScore(s, levelId);
  const options = kinds.map((kind) => {
    const trial: GameState = { ...s, levels: { ...s.levels, [kind]: s.levels[kind] + 1 } };
    const score = formationScore(trial, levelId);
    return { kind, level: s.levels[kind] + 1, cost: upgradeCost(s, kind), score, wins: score >= WIN };
  });
  const winners = options.filter((o) => o.wins).sort((a, b) => a.cost - b.cost);
  const pick = winners[0]
    ?? options.sort((a, b) => (b.score - base) / b.cost - (a.score - base) / a.cost || a.cost - b.cost)[0];
  return { kind: pick.kind, level: pick.level, cost: pick.cost, wins: pick.wins };
}

export function adviceLabel(a: UpgradeAdvice): string {
  return t('{piece} → ур. {lv}', { piece: PIECES[a.kind].name, lv: a.level });
}
