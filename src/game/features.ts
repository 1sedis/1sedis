import type { GameState } from './state';
import { t } from '../i18n';

/**
 * Parts of the game that open one by one through chapter 1, so a new player
 * meets one idea at a time. After the first new game everything is open.
 */
export type Feature = 'moves' | 'camp' | 'speed' | 'auto' | 'buildings' | 'achievements' | 'relics' | 'synergies';

/** Each part opens after this many won battles (the first chapter is a fixed lesson, then the map forks). */
export const FEATURES: Record<Feature, { name: string; wins: number }> = {
  moves: { name: t('Твой ход'), wins: 1 },
  camp: { name: t('Улучшения'), wins: 2 },
  speed: { name: t('Ускорение боя'), wins: 3 },
  auto: { name: t('Авторасстановка'), wins: 3 },
  buildings: { name: t('Постройки'), wins: 5 },
  achievements: { name: t('Достижения'), wins: 6 },
  relics: { name: t('Реликвии'), wins: 8 },
  synergies: { name: t('Синергии'), wins: 8 },
};

export const FEATURE_ORDER = Object.keys(FEATURES) as Feature[];

export const openKey = (f: Feature) => `open_${f}`;

export function featureOpen(s: GameState, f: Feature): boolean {
  return s.prestige > 0 || s.stats.wins >= FEATURES[f].wins || (f === 'relics' && (s.relics.length > 0 || s.relicPicks > 0));
}

/** Features open now that the player has not been told about yet. */
export function newlyOpened(s: GameState): Feature[] {
  return FEATURE_ORDER.filter((f) => featureOpen(s, f) && !s.tutorial.includes(openKey(f)));
}

/** Mark everything already open as known (a save from before this system must not get a burst of news). */
export function acknowledgeOpen(s: GameState): void {
  for (const f of newlyOpened(s)) s.tutorial.push(openKey(f));
}
