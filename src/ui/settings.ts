export interface Settings {
  /** Battle speed the game starts with. */
  speed: 1 | 2 | 4;
  /** Floating damage numbers and particles. */
  effects: boolean;
}

const KEY = 'chess-autobattler-settings';

const DEFAULTS: Settings = { speed: 1, effects: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // ignore unavailable or corrupt storage
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
