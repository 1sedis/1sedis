import { t } from '../i18n';
/**
 * Distortions: the Black King bends the rules of the campaign as the story goes.
 * They never touch the finale.
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
    name: t('Пробуждение'),
    text: t('Вражеские фигуры владеют приёмами на 3 уровня раньше.'),
    speech: [
      t('Ты снова здесь. И снова думаешь, что мои фигуры — просто дерево.'),
      t('В этот раз они помнят прошлую партию. Каждый приём, каждый удар.'),
    ],
  },
  darkness: {
    name: t('Тьма на доске'),
    text: t('На поле тёмные клетки: ваши фигуры на них теряют здоровье, враги — лечатся.'),
    speech: [
      t('Доска треснула, когда я перевернул её. Из трещин сочится тьма.'),
      t('Мои фигуры пьют её. Твои — растворяются. Смотри, куда ступаешь.'),
    ],
  },
  guard: {
    name: t('Чёрная гвардия'),
    text: t('Элитные враги встречаются уже на Пешечных полях, а в каждом бою их на одного больше.'),
    speech: [
      t('Я больше не посылаю новобранцев.'),
      t('Моя гвардия стоит на каждой клетке — с первой до последней.'),
    ],
  },
  blackKing: {
    name: t('Король на поле'),
    text: t('Вражеский король почти вдвое крепче и бьёт на 40% сильнее.'),
    speech: [
      t('Довольно прятаться за пешками. В этой партии я выйду сам.'),
      t('Попробуй сразить меня — если твои фигуры до меня доживут.'),
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
export const BLACK_KING_HP = 1.8;
export const BLACK_KING_ATK = 1.4;
/** Share of max health drained (allies) or restored (enemies) per second on a dark cell. */
export const DARK_DRAIN = 0.04;
export const DARK_HEAL = 0.02;
/** Darkness wears a piece down but never finishes it. */
export const DARK_FLOOR = 1;
