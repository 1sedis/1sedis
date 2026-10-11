export type RelicId =
  | 'phalanx' | 'earlyCrown' | 'royalHealer' | 'wideAura' | 'warCry' | 'stunJump'
  | 'piercing' | 'heavyShot' | 'secondLife' | 'plunder' | 'fertile' | 'reserve'
  | 'queensGambit' | 'chainmail' | 'forcedMarch' | 'avengers' | 'sharpBlades' | 'bloodQueen';

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
}

export const RELICS: Record<RelicId, RelicDef> = {
  phalanx: { id: 'phalanx', name: 'Фаланга', description: 'Пешка, рядом с которой в ряду стоит другая пешка, получает на 30% меньше урона.' },
  earlyCrown: { id: 'earlyCrown', name: 'Ранняя коронация', description: 'Пешки превращаются в ферзя на ряд раньше.' },
  forcedMarch: { id: 'forcedMarch', name: 'Форсированный марш', description: 'Пешки ходят на 40% быстрее.' },
  queensGambit: { id: 'queensGambit', name: 'Ферзевый гамбит', description: 'Ферзи из превращённых пешек бьют на 50% сильнее.' },
  bloodQueen: { id: 'bloodQueen', name: 'Кровавая корона', description: 'Ферзи лечатся на 25% нанесённого урона.' },
  royalHealer: { id: 'royalHealer', name: 'Королевский лекарь', description: 'Каждые 3 с король лечит соседних союзников на 10% здоровья.' },
  wideAura: { id: 'wideAura', name: 'Широкая мантия', description: 'Аура короля действует на 2 клетки вокруг.' },
  secondLife: { id: 'secondLife', name: 'Вторая жизнь', description: 'Один раз за бой король переживает смертельный удар с 30% здоровья.' },
  stunJump: { id: 'stunJump', name: 'Оглушающий прыжок', description: 'Первый удар каждого коня оглушает цель на 2 с.' },
  piercing: { id: 'piercing', name: 'Пронзающие стрелы', description: 'Выстрел слона задевает следующую фигуру на линии на 60% урона.' },
  heavyShot: { id: 'heavyShot', name: 'Тяжёлые ядра', description: 'Ладьи наносят на 50% больше урона королям и боссам.' },
  warCry: { id: 'warCry', name: 'Боевой клич', description: 'Первые 6 секунд боя вся армия бьёт на 35% сильнее.' },
  avengers: { id: 'avengers', name: 'Мстители', description: 'Когда союзник гибнет, его соседи до конца боя бьют на 15% сильнее.' },
  chainmail: { id: 'chainmail', name: 'Кольчуга', description: 'Вся армия получает +15% здоровья.' },
  sharpBlades: { id: 'sharpBlades', name: 'Точильный камень', description: 'Вся армия получает +12% к атаке.' },
  reserve: { id: 'reserve', name: 'Резерв', description: '+1 фигура в каждом бою.' },
  plunder: { id: 'plunder', name: 'Мародёры', description: '+30% золота за победы.' },
  fertile: { id: 'fertile', name: 'Щедрые земли', description: '+35% к доходу казны.' },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** Total stars needed per milestone relic. */
export const STARS_PER_RELIC = 12;

/** Pick up to three distinct relics the player does not own yet, deterministically from `seed`. */
export function rollOffer(owned: RelicId[], seed: number): RelicId[] {
  const pool = RELIC_IDS.filter((id) => !owned.includes(id));
  let a = (seed * 2654435761) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
