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
  spareBanner: { id: 'spareBanner', name: 'Запасное знамя', description: 'Вторая жизнь: одно поражение не обрывает забег, бой можно переиграть. Знамя сгорает.' },
  pawnStorm: { id: 'pawnStorm', name: 'Пешечный вал', description: 'Каждая пешка в строю даёт всем пешкам +6% к атаке.' },
  lance: { id: 'lance', name: 'Рыцарское копьё', description: 'Первый удар каждого коня в бою — втрое сильнее.' },
  holyArrows: { id: 'holyArrows', name: 'Освящённые стрелы', description: 'Выстрел слона лечит самого раненого союзника на 40% урона.' },
  ironKing: { id: 'ironKing', name: 'Железный король', description: 'Король крепче на 50% и бьёт на 40% сильнее.' },
  loneWolf: { id: 'loneWolf', name: 'Одинокий волк', description: 'Если кроме короля в строю не больше трёх фигур, вся армия +40% к атаке и здоровью.' },
  piggyBank: { id: 'piggyBank', name: 'Копилка', description: 'После каждой победы +10% к золоту, что у вас есть (не больше половины награды за бой главы).' },
  charter: { id: 'charter', name: 'Торговая грамота', description: 'Торговцы и кузнецы берут на 30% меньше.' },
  fangs: { id: 'fangs', name: 'Вампирские клыки', description: 'Вся армия лечится на 10% нанесённого урона.' },
  thornMail: { id: 'thornMail', name: 'Шипастые латы', description: 'Ваши фигуры возвращают 20% урона ближнего боя.' },
  executioner: { id: 'executioner', name: 'Топор палача', description: 'Удары по врагам с меньше чем 30% здоровья на 60% сильнее.' },
  feast: { id: 'feast', name: 'Пир победителей', description: 'Когда враг гибнет, вся армия лечится на 5% здоровья.' },
  bastion: { id: 'bastion', name: 'Бастион', description: 'Ладьи получают на 30% меньше урона.' },
  powderKeg: { id: 'powderKeg', name: 'Пороховые бочки', description: 'Павшая пешка взрывается и бьёт соседних врагов.' },
  campfire: { id: 'campfire', name: 'Походный котёл', description: 'Привал даёт вдвое больше: +2 уровня Кузницы или фигуре.' },
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
