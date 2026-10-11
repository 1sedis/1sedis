/** Altar of the Abyss: permanent perks bought with abyss shards. They survive a new game. */

export type AltarId = 'darkSteel' | 'deepHide' | 'mantle' | 'voidGold' | 'veterans' | 'echo';

export interface AltarDef {
  id: AltarId;
  name: string;
  description: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
}

export const ALTAR: Record<AltarId, AltarDef> = {
  darkSteel: { id: 'darkSteel', name: 'Тёмная сталь', description: '+4% к атаке всей армии', baseCost: 5, growth: 1.5, maxLevel: 15 },
  deepHide: { id: 'deepHide', name: 'Шкура глубин', description: '+4% к здоровью всей армии', baseCost: 5, growth: 1.5, maxLevel: 15 },
  mantle: { id: 'mantle', name: 'Мантия бездны', description: '+20% к здоровью короля', baseCost: 8, growth: 1.7, maxLevel: 5 },
  voidGold: { id: 'voidGold', name: 'Золото бездны', description: '+10% к золоту из боёв и казны', baseCost: 6, growth: 1.6, maxLevel: 10 },
  veterans: { id: 'veterans', name: 'Ветераны', description: 'Новая партия начинается с фигурами на 1 уровень выше', baseCost: 25, growth: 2.2, maxLevel: 4 },
  echo: { id: 'echo', name: 'Эхо реликвий', description: 'Новая партия начинается с выбором ещё одной реликвии', baseCost: 30, growth: 2.5, maxLevel: 3 },
};

export const ALTAR_ORDER: AltarId[] = ['darkSteel', 'deepHide', 'mantle', 'voidGold', 'veterans', 'echo'];

export function emptyAltar(): Record<AltarId, number> {
  return { darkSteel: 0, deepHide: 0, mantle: 0, voidGold: 0, veterans: 0, echo: 0 };
}

/** Shards for clearing an abyss floor: a few per floor, a big pile for every guardian. */
export function shardsForFloor(floor: number): number {
  const base = 1 + Math.floor(floor / 10);
  return floor % 10 === 0 ? base + 5 * (floor / 10) : base;
}
