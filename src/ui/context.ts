import type { GameState } from '../game/state';
import type { Settings } from './settings';

export type ScreenId = 'menu' | 'map' | 'arena' | 'camp';

/** What screens need from the app shell. */
export interface Ctx {
  /** Current game state (the object is replaced on a new game). */
  readonly state: GameState;
  settings: Settings;
  go(screen: ScreenId, levelId?: string): void;
  save(): void;
}

export interface Screen {
  root: HTMLElement;
  show(levelId?: string): void;
  /** Called every animation frame while the screen is visible. */
  frame(dt: number): void;
}
