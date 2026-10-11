/**
 * Distortions: every new game the Black King bends one rule of the campaign.
 * Game 2 brings the first one; after game 5 they repeat in a cycle.
 * They never touch the Abyss.
 */
export type DistortionId = 'awakening' | 'darkness' | 'guard' | 'blackKing';

export interface DistortionDef {
  name: string;
  /** What changes, for the map card and the task card. */
  text: string;
  /** The Black King announces it when the game starts. */
  speech: string[];
}

export const DISTORTIONS: Record<DistortionId, DistortionDef> = {
  awakening: {
    name: 'Пробуждение',
    text: 'Вражеские фигуры владеют приёмами на 3 уровня раньше.',
    speech: [
      'Ты снова здесь. И снова думаешь, что мои фигуры — просто дерево.',
      'В этот раз они помнят прошлую партию. Каждый приём, каждый удар.',
    ],
  },
  darkness: {
    name: 'Тьма на доске',
    text: 'На поле тёмные клетки: ваши фигуры на них теряют здоровье, враги — лечатся.',
    speech: [
      'Доска треснула, когда я перевернул её. Из трещин сочится тьма.',
      'Мои фигуры пьют её. Твои — растворяются. Смотри, куда ступаешь.',
    ],
  },
  guard: {
    name: 'Чёрная гвардия',
    text: 'Элитные враги встречаются уже на Пешечных полях, а в каждом бою их на одного больше.',
    speech: [
      'Я больше не посылаю новобранцев.',
      'Моя гвардия стоит на каждой клетке — с первой до последней.',
    ],
  },
  blackKing: {
    name: 'Король на поле',
    text: 'Вражеский король вдвое крепче и бьёт в полтора раза сильнее.',
    speech: [
      'Довольно прятаться за пешками. В этой партии я выйду сам.',
      'Попробуй сразить меня — если твои фигуры до меня доживут.',
    ],
  },
};

export const DISTORTION_ORDER: DistortionId[] = ['awakening', 'darkness', 'guard', 'blackKing'];

/** The distortion of a game (game 1 has none). */
export function distortionFor(game: number): DistortionId | null {
  if (game < 2) return null;
  return DISTORTION_ORDER[(game - 2) % DISTORTION_ORDER.length];
}

/** Levels earlier enemies learn abilities under "Пробуждение". */
export const AWAKENING_SHIFT = 3;
/** Enemy king multipliers under "Король на поле". */
export const BLACK_KING_HP = 2;
export const BLACK_KING_ATK = 1.5;
/** Share of max health drained (allies) or restored (enemies) per second on a dark cell. */
export const DARK_DRAIN = 0.04;
export const DARK_HEAL = 0.02;
/** Darkness wears a piece down but never finishes it. */
export const DARK_FLOOR = 1;
