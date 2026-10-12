import type { BattleEvent } from '../game/battle';

/** A beat of the battle worth feeling: a short freeze (hit-stop) and maybe a punch of the board. */
export interface Accent {
  /** Freeze of the battle clock, in real milliseconds. */
  stop: number;
  /** Zoom-punch of the board: 0 none, 1 light, 2 heavy. */
  punch: 0 | 1 | 2;
}

/**
 * What a batch of battle events should feel like. Crits, falls and promotions
 * freeze the clock for a moment; the fall of a king or boss freezes it longest
 * and punches the board, and so do the boss's own blows on the army.
 * At ×4 nothing freezes; at ×2 freezes are halved.
 */
export function accentFor(events: BattleEvent[], bossUid: number | undefined, speed: number): Accent {
  let stop = 0;
  let punch: 0 | 1 | 2 = 0;
  for (const e of events) {
    if (e.type === 'death') {
      stop = Math.max(stop, e.big ? 220 : 70);
      if (e.big) punch = 2;
    } else if (e.type === 'promote') stop = Math.max(stop, 90);
    else if (e.type === 'hit' && e.crit) stop = Math.max(stop, 50);
    else if (e.type === 'blast') {
      stop = Math.max(stop, 80);
      punch = Math.max(punch, 1) as 1 | 2;
    }
    if (e.type === 'hit' && bossUid !== undefined && e.fromUid === bossUid && e.side === 'ally') punch = Math.max(punch, 1) as 1 | 2;
  }
  if (speed >= 4) stop = 0;
  else if (speed >= 2) stop = Math.round(stop / 2);
  return { stop, punch };
}
