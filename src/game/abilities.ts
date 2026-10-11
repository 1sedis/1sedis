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
    name: 'Боевой клич', cooldown: 80,
    tiers: ['Каждые 8 с союзники в 2 клетках бьют на 25% сильнее 3 с.', 'Клич слышит вся армия, +40% к атаке.'],
  },
  pawn: {
    name: 'Щит', cooldown: 0,
    tiers: ['Начинает бой со щитом в 30% здоровья.', 'Щит в 60% здоровья.'],
  },
  knight: {
    name: 'Натиск', cooldown: 0,
    tiers: ['Каждый третий удар наносит двойной урон.', 'Двойной удар ещё и оглушает на 1,5 с.'],
  },
  bishop: {
    name: 'Благословение', cooldown: 70,
    tiers: ['Каждые 7 с лечит самого раненого союзника в 3 клетках на 20%.', 'Лечит на 35%.'],
  },
  rook: {
    name: 'Залп', cooldown: 80,
    tiers: ['Каждые 8 с бьёт всех врагов на одной линии на 80% урона, сквозь фигуры.', 'Залп на 130% урона.'],
  },
  queen: {
    name: 'Буря', cooldown: 90,
    tiers: ['Каждые 9 с бьёт всех врагов в 2 клетках на 60% урона.', 'Буря на 100% урона.'],
  },
  archbishop: {
    name: 'Озарение', cooldown: 80,
    tiers: ['Каждые 8 с лечит всех соседних союзников на 15%.', 'Лечит на 25%.'],
  },
  chancellor: {
    name: 'Залп', cooldown: 80,
    tiers: ['Каждые 8 с бьёт всех врагов на одной линии на 80% урона, сквозь фигуры.', 'Залп на 130% урона.'],
  },
  ghost: {
    name: 'Удар из тени', cooldown: 0,
    tiers: ['Первый удар в бою наносит 250% урона.', 'Первый удар — 400% урона.'],
  },
};

/** The second ability of each piece, chosen instead of the first one. */
export const ALT_ABILITIES: Record<PieceKind, AbilityDef> = {
  king: {
    name: 'Цитадель', cooldown: 0,
    tiers: ['Король получает на 30% меньше урона.', 'На 50% меньше урона, соседние союзники — на 15% меньше.'],
  },
  pawn: {
    name: 'Рывок', cooldown: 0,
    tiers: ['Идёт почти вдвое быстрее, первый удар двойной. Без щита.', 'Первый удар тройной.'],
  },
  knight: {
    name: 'Охотник', cooldown: 0,
    tiers: ['+40% урона по стрелкам и королю.', '+80% урона по стрелкам и королю.'],
  },
  bishop: {
    name: 'Проклятье', cooldown: 70,
    tiers: ['Каждые 7 с проклинает врага на линии огня: он получает +30% урона 4 с.', 'Проклятье +50% урона на 6 с.'],
  },
  rook: {
    name: 'Крепость', cooldown: 0,
    tiers: ['Получает на 35% меньше урона.', 'На 50% меньше урона, соседние союзники — на 20% меньше.'],
  },
  queen: {
    name: 'Прилив', cooldown: 90,
    tiers: ['Каждые 9 с даёт союзникам в 2 клетках щит в 15% здоровья.', 'Щит в 30% здоровья.'],
  },
  archbishop: {
    name: 'Проклятье', cooldown: 70,
    tiers: ['Каждые 7 с проклинает врага на линии огня: он получает +30% урона 4 с.', 'Проклятье +50% урона на 6 с.'],
  },
  chancellor: {
    name: 'Крепость', cooldown: 0,
    tiers: ['Получает на 35% меньше урона.', 'На 50% меньше урона, соседние союзники — на 20% меньше.'],
  },
  ghost: {
    name: 'Неуловимость', cooldown: 0,
    tiers: ['Получает на 30% меньше урона.', 'На 45% меньше урона.'],
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
