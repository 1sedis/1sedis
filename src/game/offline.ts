import { bestFormation } from './autoformation';
import { createBattle, simulate } from './battle';
import { abyssId } from './levels';
import { battleSetup, commandLimit, isAbyssOpen, recordResult, type GameState } from './state';

/** Minutes of absence per Abyss floor and the most floors one absence can clear. */
export const OFFLINE_FLOOR_MINUTES = 10;
export const OFFLINE_FLOOR_CAP = 10;

export interface OfflineDescent { floors: number; gold: number; shards: number; relics: number; stoppedAt: number | null }

/**
 * While the player was away the army keeps descending the Abyss: one floor per
 * OFFLINE_FLOOR_MINUTES, stopping at the first lost battle. Only for players
 * who have already started the Abyss.
 */
export function offlineDescent(s: GameState, awayMs: number): OfflineDescent {
  const result: OfflineDescent = { floors: 0, gold: 0, shards: 0, relics: 0, stoppedAt: null };
  if (!isAbyssOpen(s) || s.abyss.best === 0) return result;
  const tries = Math.min(OFFLINE_FLOOR_CAP, Math.floor(awayMs / 60_000 / OFFLINE_FLOOR_MINUTES));
  const formation = s.formation.map((f) => ({ ...f }));
  for (let i = 0; i < tries; i++) {
    const id = abyssId(s.abyss.floor);
    bestFormation(s, id, commandLimit(s, id));
    const b = createBattle(battleSetup(s, id));
    simulate(b);
    if (b.result !== 'win') {
      result.stoppedAt = s.abyss.floor;
      break;
    }
    const out = recordResult(s, id, b);
    result.floors++;
    result.gold += out.reward;
    result.shards += out.shards;
    result.relics += out.relicsEarned;
  }
  s.formation = formation;
  return result;
}
