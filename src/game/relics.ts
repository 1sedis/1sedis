import { t } from '../i18n';
export type RelicId =
  | 'phalanx' | 'earlyCrown' | 'royalHealer' | 'wideAura' | 'warCry' | 'stunJump'
  | 'piercing' | 'heavyShot' | 'secondLife' | 'plunder' | 'spareBanner' | 'reserve'
  | 'queensGambit' | 'chainmail' | 'forcedMarch' | 'avengers' | 'sharpBlades' | 'bloodQueen'
  | 'pawnStorm' | 'lance' | 'holyArrows' | 'ironKing' | 'loneWolf' | 'piggyBank' | 'charter'
  | 'fangs' | 'thornMail' | 'executioner' | 'feast' | 'bastion' | 'powderKeg' | 'campfire';

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
}

export const RELICS: Record<RelicId, RelicDef> = {
  phalanx: { id: 'phalanx', name: t('Фаланга'), description: t('Пешка, рядом с которой в ряду стоит другая пешка, получает на 30% меньше урона.') },
  earlyCrown: { id: 'earlyCrown', name: t('Ранняя коронация'), description: t('Пешки превращаются в ферзя на два ряда раньше.') },
  forcedMarch: { id: 'forcedMarch', name: t('Форсированный марш'), description: t('Пешки ходят на 40% быстрее.') },
  queensGambit: { id: 'queensGambit', name: t('Ферзевый гамбит'), description: t('Пешки превращаются на ряд раньше, а их ферзи бьют на 50% сильнее.') },
  bloodQueen: { id: 'bloodQueen', name: t('Кровавая корона'), description: t('Ферзи лечатся на 25% нанесённого урона.') },
  royalHealer: { id: 'royalHealer', name: t('Королевский лекарь'), description: t('Каждые 3 с король лечит соседних союзников на 15% здоровья.') },
  wideAura: { id: 'wideAura', name: t('Широкая мантия'), description: t('Аура короля действует на 2 клетки вокруг и даёт +30% к атаке вместо +20%.') },
  secondLife: { id: 'secondLife', name: t('Вторая жизнь'), description: t('Один раз за бой король переживает смертельный удар с 30% здоровья.') },
  stunJump: { id: 'stunJump', name: t('Оглушающий прыжок'), description: t('Первый удар каждого коня оглушает цель на 2 с.') },
  piercing: { id: 'piercing', name: t('Пронзающие стрелы'), description: t('Выстрел слона задевает следующую фигуру на линии на 60% урона.') },
  heavyShot: { id: 'heavyShot', name: t('Тяжёлые ядра'), description: t('Ладьи наносят на 50% больше урона королям и боссам.') },
  warCry: { id: 'warCry', name: t('Боевой клич'), description: t('Первые 6 секунд боя вся армия бьёт на 35% сильнее.') },
  avengers: { id: 'avengers', name: t('Мстители'), description: t('Когда союзник гибнет, его соседи до конца боя бьют на 12% сильнее.') },
  chainmail: { id: 'chainmail', name: t('Кольчуга'), description: t('Вся армия получает +15% здоровья.') },
  sharpBlades: { id: 'sharpBlades', name: t('Точильный камень'), description: t('Вся армия получает +12% к атаке.') },
  reserve: { id: 'reserve', name: t('Резерв'), description: t('+1 фигура в каждом бою.') },
  plunder: { id: 'plunder', name: t('Мародёры'), description: t('+30% золота за победы.') },
  spareBanner: { id: 'spareBanner', name: t('Запасное знамя'), description: t('Вторая жизнь: одно поражение не обрывает забег, бой можно переиграть. Знамя сгорает.') },
  pawnStorm: { id: 'pawnStorm', name: t('Пешечный вал'), description: t('Каждая пешка в строю даёт всем пешкам +5% к атаке.') },
  lance: { id: 'lance', name: t('Рыцарское копьё'), description: t('Первый удар каждого коня в бою — втрое сильнее.') },
  holyArrows: { id: 'holyArrows', name: t('Освящённые стрелы'), description: t('Выстрел слона лечит самого раненого союзника на 40% урона.') },
  ironKing: { id: 'ironKing', name: t('Железный король'), description: t('Король крепче на 50% и бьёт на 40% сильнее.') },
  loneWolf: { id: 'loneWolf', name: t('Одинокий волк'), description: t('Если кроме короля в строю не больше трёх фигур, вся армия +40% к атаке и здоровью.') },
  piggyBank: { id: 'piggyBank', name: t('Копилка'), description: t('После каждой победы +10% к золоту, что у вас есть (не больше половины награды за бой главы).') },
  charter: { id: 'charter', name: t('Торговая грамота'), description: t('Торговцы и кузнецы берут вдвое меньше.') },
  fangs: { id: 'fangs', name: t('Вампирские клыки'), description: t('Вся армия лечится на 10% нанесённого урона.') },
  thornMail: { id: 'thornMail', name: t('Шипастые латы'), description: t('Ваши фигуры возвращают 20% урона ближнего боя.') },
  executioner: { id: 'executioner', name: t('Топор палача'), description: t('Удары по врагам с меньше чем 30% здоровья на 60% сильнее.') },
  feast: { id: 'feast', name: t('Пир победителей'), description: t('Когда враг гибнет, вся армия лечится на 5% здоровья.') },
  bastion: { id: 'bastion', name: t('Бастион'), description: t('Ладьи получают на 30% меньше урона.') },
  powderKeg: { id: 'powderKeg', name: t('Пороховые бочки'), description: t('Павшая пешка взрывается и бьёт соседних врагов.') },
  campfire: { id: 'campfire', name: t('Походный котёл'), description: t('Привал даёт вдвое больше: +2 уровня Кузницы или фигуре.') },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

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
