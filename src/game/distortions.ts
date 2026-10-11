/**
 * Distortions: the Black King bends the rules of the campaign as the story goes.
 * They never touch the Abyss or the finale.
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

/**
 * Distortions in force for a campaign chapter. They pile up through the story:
 * game 2 brings "Пробуждение", then "Тьма" from chapter 3; game 3 adds
 * "Чёрная гвардия", then "Король на поле" from chapter 3. After the story
 * (game 4 on) one distortion at a time, in turn.
 */
export function distortionsFor(game: number, chapter: number): DistortionId[] {
  if (game < 2) return [];
  if (game === 2) return chapter >= 3 ? ['awakening', 'darkness'] : ['awakening'];
  if (game === 3) return chapter >= 3 ? ['awakening', 'darkness', 'guard', 'blackKing'] : ['awakening', 'darkness', 'guard'];
  return [DISTORTION_ORDER[(game - 4) % DISTORTION_ORDER.length]];
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
