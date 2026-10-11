export interface Settings {
  /** Battle speed the game starts with. */
  speed: 1 | 2 | 4;
  /** Floating damage numbers and particles. */
  effects: boolean;
  sound: boolean;
  music: boolean;
  /** 0..1 */
  soundVolume: number;
  /** 0..1 */
  musicVolume: number;
  /** Tutorial tips. */
  hints: boolean;
}

const KEY = 'chess-autobattler-settings';

const DEFAULTS: Settings = { speed: 1, effects: true, sound: true, music: true, soundVolume: 0.8, musicVolume: 0.6, hints: true };

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
