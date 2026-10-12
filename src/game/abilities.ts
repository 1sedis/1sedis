import { t } from '../i18n';
import type { PieceKind } from './pieces';

/** Levels at which a piece (yours or the enemy's) learns its ability and then empowers it. */
export const ABILITY_LEVELS = [5, 10] as const;

export interface AbilityDef {
  name: string;
  /** What the ability does at tier 1 and tier 2. */
  tiers: [string, string];
  /** Ticks between casts for active abilities (0 = passive). */
  cooldown: number;
}

export const ABILITIES: Record<PieceKind, AbilityDef> = {
  king: {
    name: t('Боевой клич'), cooldown: 80,
    tiers: [t('Каждые 8 с союзники в 2 клетках бьют на 25% сильнее 3 с.'), t('Клич слышит вся армия, +40% к атаке.')],
  },
  pawn: {
    name: t('Щит'), cooldown: 0,
    tiers: [t('Начинает бой со щитом в 30% здоровья.'), t('Щит в 60% здоровья.')],
  },
  knight: {
    name: t('Натиск'), cooldown: 0,
    tiers: [t('Каждый третий удар наносит двойной урон.'), t('Двойной удар ещё и оглушает на 1,5 с.')],
  },
  bishop: {
    name: t('Благословение'), cooldown: 70,
    tiers: [t('Каждые 7 с лечит самого раненого союзника в 3 клетках на 20%.'), t('Лечит на 35%.')],
  },
  rook: {
    name: t('Залп'), cooldown: 80,
    tiers: [t('Каждые 8 с бьёт всех врагов на одной линии на 80% урона, сквозь фигуры.'), t('Залп на 130% урона.')],
  },
  queen: {
    name: t('Буря'), cooldown: 90,
    tiers: [t('Каждые 9 с бьёт всех врагов в 2 клетках на 60% урона.'), t('Буря на 100% урона.')],
  },
  archbishop: {
    name: t('Озарение'), cooldown: 80,
    tiers: [t('Каждые 8 с лечит всех соседних союзников на 15%.'), t('Лечит на 25%.')],
  },
  chancellor: {
    name: t('Залп'), cooldown: 80,
    tiers: [t('Каждые 8 с бьёт всех врагов на одной линии на 80% урона, сквозь фигуры.'), t('Залп на 130% урона.')],
  },
  ghost: {
    name: t('Удар из тени'), cooldown: 0,
    tiers: [t('Первый удар в бою наносит 250% урона.'), t('Первый удар — 400% урона.')],
  },
};

/** The second ability of each piece, chosen instead of the first one. */
export const ALT_ABILITIES: Record<PieceKind, AbilityDef> = {
  king: {
    name: t('Цитадель'), cooldown: 0,
    tiers: [t('Король получает на 30% меньше урона.'), t('На 50% меньше урона, соседние союзники — на 15% меньше.')],
  },
  pawn: {
    name: t('Рывок'), cooldown: 0,
    tiers: [t('Идёт почти вдвое быстрее, первый удар двойной. Без щита.'), t('Первый удар тройной.')],
  },
  knight: {
    name: t('Охотник'), cooldown: 0,
    tiers: [t('+40% урона по стрелкам и королю.'), t('+80% урона по стрелкам и королю.')],
  },
  bishop: {
    name: t('Проклятье'), cooldown: 70,
    tiers: [t('Каждые 7 с проклинает врага на линии огня: он получает +30% урона 4 с.'), t('Проклятье +50% урона на 6 с.')],
  },
  rook: {
    name: t('Крепость'), cooldown: 0,
    tiers: [t('Получает на 35% меньше урона.'), t('На 50% меньше урона, соседние союзники — на 20% меньше.')],
  },
  queen: {
    name: t('Прилив'), cooldown: 90,
    tiers: [t('Каждые 9 с даёт союзникам в 2 клетках щит в 15% здоровья.'), t('Щит в 30% здоровья.')],
  },
  archbishop: {
    name: t('Проклятье'), cooldown: 70,
    tiers: [t('Каждые 7 с проклинает врага на линии огня: он получает +30% урона 4 с.'), t('Проклятье +50% урона на 6 с.')],
  },
  chancellor: {
    name: t('Крепость'), cooldown: 0,
    tiers: [t('Получает на 35% меньше урона.'), t('На 50% меньше урона, соседние союзники — на 20% меньше.')],
  },
  ghost: {
    name: t('Неуловимость'), cooldown: 0,
    tiers: [t('Получает на 30% меньше урона.'), t('На 45% меньше урона.')],
  },
};

/** 0 = the first ability, 1 = the alternative. */
export type Branch = 0 | 1;

export function abilityOf(kind: PieceKind, branch: Branch = 0): AbilityDef {
  return branch === 1 ? ALT_ABILITIES[kind] : ABILITIES[kind];
}

/** 0 = no ability, 1 = learned, 2 = empowered. */
export function abilityTier(level: number): 0 | 1 | 2 {
  return level >= ABILITY_LEVELS[1] ? 2 : level >= ABILITY_LEVELS[0] ? 1 : 0;
}
