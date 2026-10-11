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
};

/** 0 = no ability, 1 = learned, 2 = empowered. */
export function abilityTier(level: number): 0 | 1 | 2 {
  return level >= ABILITY_LEVELS[1] ? 2 : level >= ABILITY_LEVELS[0] ? 1 : 0;
}
