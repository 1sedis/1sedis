import type { GameState } from './state';

/**
 * Parts of the game that open one by one through chapter 1, so a new player
 * meets one idea at a time. After the first new game everything is open.
 */
export type Feature = 'moves' | 'treasury' | 'camp' | 'speed' | 'auto' | 'buildings' | 'achievements' | 'relics' | 'synergies';

export const FEATURES: Record<Feature, { name: string; after: string }> = {
  moves: { name: 'Твой ход', after: '1-1' },
  treasury: { name: 'Казна', after: '1-1' },
  camp: { name: 'Улучшения', after: '1-2' },
  speed: { name: 'Ускорение боя', after: '1-3' },
  auto: { name: 'Авторасстановка', after: '1-3' },
  buildings: { name: 'Постройки', after: '1-6' },
  achievements: { name: 'Достижения', after: '1-7' },
  relics: { name: 'Реликвии', after: '1-9' },
  synergies: { name: 'Синергии', after: '1-9' },
};

export const FEATURE_ORDER = Object.keys(FEATURES) as Feature[];

export const openKey = (f: Feature) => `open_${f}`;

export function featureOpen(s: GameState, f: Feature): boolean {
  return s.prestige > 0 || (s.stars[FEATURES[f].after] ?? 0) > 0 || (f === 'relics' && (s.relics.length > 0 || s.relicPicks > 0));
}

/** Features open now that the player has not been told about yet. */
export function newlyOpened(s: GameState): Feature[] {
  return FEATURE_ORDER.filter((f) => featureOpen(s, f) && !s.tutorial.includes(openKey(f)));
}

/** Mark everything already open as known (a save from before this system must not get a burst of news). */
export function acknowledgeOpen(s: GameState): void {
  for (const f of newlyOpened(s)) s.tutorial.push(openKey(f));
}
