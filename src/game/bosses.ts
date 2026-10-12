import { t } from '../i18n';
/** Boss mechanics: one signature skill on a timer, and a rage phase below half health. */
export type BossId = 'captain' | 'rider' | 'fortress' | 'queen' | 'guardian' | 'blackKing' | 'hand';

export interface BossDef {
  id: BossId;
  /** Signature skill and what it does. */
  skill: string;
  skillText: string;
  /** Rage phase (below 50% health). */
  rage: string;
  rageText: string;
  /** A rule that holds for the whole fight, if any. */
  passive?: string;
  passiveText?: string;
  /** Ticks between skill casts, normal and enraged. */
  cooldown: number;
  rageCooldown: number;
}

export const BOSSES: Record<BossId, BossDef> = {
  captain: {
    id: 'captain', skill: t('Подкрепление'), skillText: t('призывает пешку в строй (до 4 за бой)'),
    rage: t('Сомкнуть ряды'), rageText: t('все его пешки получают щит, подкрепление чаще'),
    passive: t('Стена щитов'), passiveText: t('пока рядом с капитаном стоят две его пешки, он получает на 65% меньше урона — сначала снимите строй'),
    cooldown: 110, rageCooldown: 70,
  },
  rider: {
    id: 'rider', skill: t('Прыжок смерти'), skillText: t('прыгает к вашему стрелку или королю, бьёт и оглушает'),
    rage: t('Табун'), rageText: t('зовёт двух чёрных коней, +20% к атаке, прыгает чаще'),
    passive: t('Неуловимый'), passiveText: t('стрелки наносят ему лишь 40% урона — ловите его вблизи'),
    cooldown: 90, rageCooldown: 55,
  },
  fortress: {
    id: 'fortress', skill: t('Обвал'), skillText: t('красные клетки — сюда упадут камни: урон и новый камень на доске'),
    rage: t('Каменная кожа и залп'), rageText: t('получает на 40% меньше урона, через раз бьёт залпом по целому ряду — уводите фигуры ходами'),
    passive: t('Твердыня'), passiveText: t('крепость не двигается с места'),
    cooldown: 100, rageCooldown: 70,
  },
  queen: {
    id: 'queen', skill: t('Тёмная корона'), skillText: t('красная вертикаль — через миг по ней ударит тьма'),
    rage: t('Отражения'), rageText: t('создаёт две свои копии; пока жива хоть одна, ферзь неуязвим'),
    cooldown: 120, rageCooldown: 80,
  },
  guardian: {
    id: 'guardian', skill: t('Сотрясение'), skillText: t('красный квадрат 3×3 — через миг удар по площади'),
    rage: t('Голод бездны'), rageText: t('+30% к атаке, сотрясения чаще'),
    cooldown: 100, rageCooldown: 70,
  },
  blackKing: {
    id: 'blackKing', skill: t('Искажение'), skillText: t('по очереди: тьма на доске, пробуждение приёмов, новая элита, королевская кровь'),
    rage: t('Все искажения'), rageText: t('всё сразу, +30% к атаке, искажения чаще'),
    cooldown: 90, rageCooldown: 60,
  },
  hand: {
    id: 'hand', skill: t('Ход рукой'), skillText: t('ладонь бьёт квадрат 3×3, щелчок сбивает сильнейшую фигуру, рука переставляет ваши фигуры, призывает тени'),
    rage: t('Переворот доски'), rageText: t('доска переворачивается, тьма расползается, время не ускорить'),
    cooldown: 75, rageCooldown: 55,
  },
};

const BY_LEVEL: Record<string, BossId> = {
  '1-9': 'captain', '2-9': 'rider', '3-9': 'fortress', '4-9': 'queen', 'final-1': 'blackKing', 'final-3': 'hand',
};

/** The boss mechanic of a level, if any (every 10th Abyss floor has the guardian). */
export function bossFor(levelId: string): BossId | undefined {
  if (levelId.startsWith('abyss-')) return Number(levelId.slice(6)) % 10 === 0 ? 'guardian' : undefined;
  return BY_LEVEL[levelId];
}

/** Ticks between a warning and the blow, so the player sees it coming. */
export const WARN_TICKS = 15;
export const MAX_SUMMONS = 4;
