import type { Placement } from './battle';
import type { PieceKind } from './pieces';

/** Traits of elite enemy pieces. */
export type Trait = 'armored' | 'furious' | 'vampire' | 'thorns' | 'swift' | 'explosive';

export interface TraitDef {
  /** Adjective, masculine and feminine. */
  name: [string, string];
  text: string;
}

export const TRAITS: Record<Trait, TraitDef> = {
  armored: { name: ['Бронированный', 'Бронированная'], text: 'получает на 40% меньше урона от выстрелов издалека' },
  furious: { name: ['Яростный', 'Яростная'], text: 'ниже половины здоровья бьёт в полтора раза сильнее' },
  vampire: { name: ['Кровавый', 'Кровавая'], text: 'лечится на 30% нанесённого урона' },
  thorns: { name: ['Шипастый', 'Шипастая'], text: 'возвращает 30% урона тем, кто бьёт вплотную' },
  swift: { name: ['Быстрый', 'Быстрая'], text: 'ходит вдвое быстрее и бьёт на 25% чаще' },
  explosive: { name: ['Взрывной', 'Взрывная'], text: 'при гибели взрывается и бьёт всех соседей' },
};

export const TRAIT_ORDER: Trait[] = ['armored', 'furious', 'vampire', 'thorns', 'swift', 'explosive'];

const FEMININE = new Set<PieceKind>(['pawn', 'rook']);

/** "Бронированная ладья" and the like (the noun in lower case). */
export function traitAdjective(trait: Trait, kind: PieceKind): string {
  return TRAITS[trait].name[FEMININE.has(kind) ? 1 : 0];
}

/** Traits that can appear per chapter; chapter 1 has no elites. */
const POOLS: Record<number, Trait[]> = {
  2: ['swift', 'thorns', 'furious', 'vampire'],
  3: ['armored', 'explosive', 'vampire', 'furious', 'thorns'],
  4: TRAIT_ORDER,
};

/** How many elites a level has. */
function eliteCount(levelId: string): { count: number; pool: Trait[] } {
  if (levelId.startsWith('abyss-')) {
    const floor = Number(levelId.slice(6));
    return { count: floor < 4 ? 0 : Math.min(4, 1 + Math.floor(floor / 8)), pool: TRAIT_ORDER };
  }
  const [chapter, n] = levelId.split('-').map(Number);
  const pool = POOLS[chapter];
  if (!pool) return { count: 0, pool: [] };
  const count = chapter === 2 ? (n <= 5 ? 1 : 2) : chapter === 3 ? 2 : 3;
  return { count, pool };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Give some enemy pieces a trait. Deterministic per level, so the player can
 * plan around them. Kings, bosses and pawns stay plain.
 */
export function withElites(levelId: string, enemies: Placement[]): Placement[] {
  const { count, pool } = eliteCount(levelId);
  if (!count) return enemies;
  const candidates = enemies
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.boss && p.kind !== 'king' && p.kind !== 'pawn')
    .sort((a, b) => hash(`${levelId}:${a.i}`) - hash(`${levelId}:${b.i}`));
  const out = enemies.map((p) => ({ ...p }));
  candidates.slice(0, count).forEach(({ i }, n) => {
    out[i].trait = pool[hash(`${levelId}#${n}`) % pool.length];
  });
  return out;
}
