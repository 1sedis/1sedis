import type { GameState } from '../game/state';
import type { Settings } from './settings';

export type ScreenId = 'menu' | 'map' | 'arena' | 'camp' | 'achievements';

/** What screens need from the app shell. */
export interface Ctx {
  /** Current game state (the object is replaced on a new game). */
  readonly state: GameState;
  settings: Settings;
  go(screen: ScreenId, levelId?: string): void;
  save(): void;
  /** Show a one-time tutorial tip pointing at `target`. Returns true while it is visible. */
  tip(id: string, target: HTMLElement | null | undefined, text: string, then?: HTMLElement | null): boolean;
}

export interface Screen {
  root: HTMLElement;
  show(levelId?: string): void;
  /** Called every animation frame while the screen is visible. */
  frame(dt: number): void;
}
