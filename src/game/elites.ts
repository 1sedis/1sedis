import { t } from '../i18n';
import type { Placement } from './battle';
import type { PieceKind } from './pieces';

/** Traits of elite enemy pieces. */
export type Trait = 'armored' | 'furious' | 'vampire' | 'thorns' | 'swift' | 'explosive'
  | 'healer' | 'summoner' | 'banner' | 'warder' | 'blinker'
  | 'splitter' | 'frost' | 'magnet' | 'bodyguard';

export interface TraitDef {
  /** Adjective, masculine and feminine. */
  name: [string, string];
  text: string;
}

export const TRAITS: Record<Trait, TraitDef> = {
  armored: { name: [t('Бронированный'), t('Бронированная')], text: t('получает на 40% меньше урона от выстрелов издалека') },
  furious: { name: [t('Яростный'), t('Яростная')], text: t('ниже половины здоровья бьёт в полтора раза сильнее') },
  vampire: { name: [t('Кровавый'), t('Кровавая')], text: t('лечится на 30% нанесённого урона') },
  thorns: { name: [t('Шипастый'), t('Шипастая')], text: t('возвращает 30% урона тем, кто бьёт вплотную') },
  swift: { name: [t('Быстрый'), t('Быстрая')], text: t('ходит вдвое быстрее и бьёт на 25% чаще') },
  explosive: { name: [t('Взрывной'), t('Взрывная')], text: t('при гибели взрывается и бьёт всех соседей') },
  healer: { name: [t('Целящий'), t('Целящая')], text: t('каждые 3 с лечит соседних союзников на 12% здоровья') },
  summoner: { name: [t('Зовущий'), t('Зовущая')], text: t('каждые 6 с зовёт в строй пешку (до двух за бой)') },
  banner: { name: [t('Знаменный'), t('Знаменная')], text: t('соседние союзники бьют на 25% сильнее') },
  warder: { name: [t('Щитовой'), t('Щитовая')], text: t('каждые 4 с даёт соседним союзникам щит в 15% здоровья') },
  blinker: { name: [t('Призрачный'), t('Призрачная')], text: t('получив удар, исчезает и появляется рядом (раз в 3 с)') },
  splitter: { name: [t('Раскалывающийся'), t('Раскалывающаяся')], text: t('при гибели распадается на две пешки') },
  frost: { name: [t('Ледяной'), t('Ледяная')], text: t('его удары замораживают цель на полсекунды') },
  magnet: { name: [t('Притягивающий'), t('Притягивающая')], text: t('каждые 5 с подтягивает ближайшую вражескую фигуру на клетку к себе') },
  bodyguard: { name: [t('Телохранитель'), t('Телохранительница')], text: t('принимает на себя половину урона по соседнему королю') },
};

export const TRAIT_ORDER: Trait[] = ['armored', 'furious', 'vampire', 'thorns', 'swift', 'explosive', 'healer', 'summoner', 'banner', 'warder', 'blinker',
  'splitter', 'frost', 'magnet', 'bodyguard'];

const FEMININE = new Set<PieceKind>(['pawn', 'rook']);

/** "Бронированная ладья" and the like (the noun in lower case). */
export function traitAdjective(trait: Trait, kind: PieceKind): string {
  return TRAITS[trait].name[FEMININE.has(kind) ? 1 : 0];
}

/** Traits that can appear per chapter; chapter 1 has no elites. */
const POOLS: Record<number, Trait[]> = {
  2: ['swift', 'thorns', 'banner', 'healer', 'furious', 'frost'],
  3: ['armored', 'explosive', 'warder', 'summoner', 'vampire', 'blinker', 'splitter', 'magnet', 'bodyguard'],
  4: TRAIT_ORDER,
};

/** Chapter 1 traits under the "Чёрная гвардия" distortion. */
const GUARD_POOL: Trait[] = ['swift', 'thorns', 'furious', 'banner'];

/** How many elites a level has; "Чёрная гвардия" adds one everywhere and opens chapter 1. */
function eliteCount(levelId: string, guard: boolean): { count: number; pool: Trait[] } {
  const base = baseEliteCount(levelId);
  if (!guard) return base;
  return base.count ? { ...base, count: base.count + 1 } : { count: 1, pool: GUARD_POOL };
}

function baseEliteCount(levelId: string): { count: number; pool: Trait[] } {
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
 * plan around them. Kings and bosses stay plain; pawns too, unless the
 * "Чёрная гвардия" distortion is on and there is nobody else.
 */
export function withElites(levelId: string, enemies: Placement[], guard = false, salt = ''): Placement[] {
  const { count, pool } = eliteCount(levelId, guard);
  if (!count) return enemies;
  const officers = enemies.filter((p) => !p.boss && p.kind !== 'king' && p.kind !== 'pawn').length;
  const candidates = enemies
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.boss && p.kind !== 'king' && (p.kind !== 'pawn' || (guard && officers < count)))
    .sort((a, b) => Number(a.p.kind === 'pawn') - Number(b.p.kind === 'pawn')
      || hash(`${levelId}${salt}:${a.i}`) - hash(`${levelId}${salt}:${b.i}`))
    .sort((a, b) => hash(`${levelId}${salt}:${a.i}`) - hash(`${levelId}${salt}:${b.i}`));
  const out = enemies.map((p) => ({ ...p }));
  candidates.slice(0, count).forEach(({ i }, n) => {
    out[i].trait = pool[hash(`${levelId}${salt}#${n}`) % pool.length];
  });
  return out;
}
