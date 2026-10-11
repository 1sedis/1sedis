/** Boss mechanics: one signature skill on a timer, and a rage phase below half health. */
export type BossId = 'captain' | 'rider' | 'fortress' | 'queen' | 'guardian';

export interface BossDef {
  id: BossId;
  /** Signature skill and what it does. */
  skill: string;
  skillText: string;
  /** Rage phase (below 50% health). */
  rage: string;
  rageText: string;
  /** Ticks between skill casts, normal and enraged. */
  cooldown: number;
  rageCooldown: number;
}

export const BOSSES: Record<BossId, BossDef> = {
  captain: {
    id: 'captain', skill: 'Подкрепление', skillText: 'призывает пешку в строй (до 4 за бой)',
    rage: 'Сомкнуть ряды', rageText: 'все его пешки получают щит, подкрепление чаще',
    cooldown: 110, rageCooldown: 70,
  },
  rider: {
    id: 'rider', skill: 'Прыжок смерти', skillText: 'прыгает к вашему стрелку или королю, бьёт и оглушает',
    rage: 'Тень', rageText: '+30% к атаке, прыгает чаще',
    cooldown: 90, rageCooldown: 55,
  },
  fortress: {
    id: 'fortress', skill: 'Обвал', skillText: 'красные клетки — сюда упадут камни: урон и новый камень на доске',
    rage: 'Каменная кожа', rageText: 'получает на 40% меньше урона, обвалы чаще',
    cooldown: 100, rageCooldown: 70,
  },
  queen: {
    id: 'queen', skill: 'Тёмная корона', skillText: 'красная вертикаль — через миг по ней ударит тьма',
    rage: 'Гвардия', rageText: 'призывает двух пешек, удары тьмы чаще',
    cooldown: 120, rageCooldown: 80,
  },
  guardian: {
    id: 'guardian', skill: 'Сотрясение', skillText: 'красный квадрат 3×3 — через миг удар по площади',
    rage: 'Голод бездны', rageText: '+30% к атаке, сотрясения чаще',
    cooldown: 100, rageCooldown: 70,
  },
};

const BY_LEVEL: Record<string, BossId> = { '1-9': 'captain', '2-9': 'rider', '3-9': 'fortress', '4-9': 'queen' };

/** The boss mechanic of a level, if any (every 10th Abyss floor has the guardian). */
export function bossFor(levelId: string): BossId | undefined {
  if (levelId.startsWith('abyss-')) return Number(levelId.slice(6)) % 10 === 0 ? 'guardian' : undefined;
  return BY_LEVEL[levelId];
}

/** Ticks between a warning and the blow, so the player sees it coming. */
export const WARN_TICKS = 15;
export const MAX_SUMMONS = 4;
