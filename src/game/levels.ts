import type { Placement } from './battle';
import type { PieceKind } from './pieces';

export interface LevelDef {
  id: string;
  name: string;
  /** Enemy formation for rows 0..2: k p n b r q, uppercase = boss. */
  rows: string[];
  /** Upgrade level of enemy pieces. */
  level: number;
  /** Third star: lose at most this many pieces. */
  maxLosses: number;
  hint: string;
  /** Display name of the boss piece, if any. */
  boss?: string;
}

export interface ChapterDef {
  id: number;
  name: string;
  subtitle: string;
  /** Pieces allowed per battle, the king not counted. */
  limit: number;
  levels: LevelDef[];
}

const L = (id: string, name: string, level: number, maxLosses: number, rows: string[], hint: string, boss?: string): LevelDef =>
  ({ id, name, level, maxLosses, rows, hint, boss });

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1, name: 'Пешечные поля', subtitle: 'Строй и король', limit: 4,
    levels: [
      L('1-1', 'Первый ход', 1, 1, ['....k...', '........', '...pp...'],
        'Пешки идут только вперёд. Поставьте их прямо перед вражескими.'),
      L('1-2', 'Застава', 1, 1, ['....k...', '........', '..ppp...'],
        'Союзники рядом с королём бьют на 20% сильнее.'),
      L('1-3', 'Стена', 1, 2, ['...k....', '........', '.pppp...'],
        'Пешка, которой некого бить, дойдёт до края и станет ферзём.'),
      L('1-4', 'Двойной ряд', 1, 2, ['...k....', '..pp....', '...ppp..'],
        'Улучшайте пешек в лагере: каждый уровень даёт +18% к силе.'),
      L('1-5', 'Фланги', 2, 2, ['....k...', '........', 'pp....pp'],
        'Враг заходит по краям. Конь поможет добраться до их короля.'),
      L('1-6', 'Клин', 2, 2, ['...k....', '..ppp...', '.p...p..'],
        'Пешки, стоящие колонной, прикрывают друг друга.'),
      L('1-7', 'Гарнизон', 2, 2, ['..pkp...', '........', '.pp..pp.'],
        'Свободная колонна — путь для превращения в ферзя.'),
      L('1-8', 'Королевская стража', 3, 3, ['..pkp...', '..ppp...', '........'],
        'Король спрятан за пешками. Конь перепрыгивает строй.'),
      L('1-9', 'Пешечный капитан', 3, 3, ['...k....', '..pPp...', '.p...p..'],
        'У капитана втрое больше здоровья. Окружите его и не подпускайте к королю.', 'Пешечный капитан'),
    ],
  },
  {
    id: 2, name: 'Конный лес', subtitle: 'Берегите тыл', limit: 6,
    levels: [
      L('2-1', 'Разведка', 4, 2, ['...k....', '.n......', '..ppp...'],
        'Вражеские кони прыгают к вашим стрелкам и королю.'),
      L('2-2', 'Засада', 4, 2, ['....k...', 'n......n', '..pp....'],
        'Окружите короля пешками — конь бьёт только вплотную или «буквой Г».'),
      L('2-3', 'Тропа', 5, 3, ['...k....', '..n.n...', '..pppp..'],
        'Слон в заднем ряду достаёт коней, пока они пробиваются.'),
      L('2-4', 'Чаща', 5, 3, ['..nkn...', '........', '.pp..pp.'],
        'Своих коней ставьте по краям — им проще обойти строй.'),
      L('2-5', 'Конница', 6, 3, ['...k....', '.n.nn...', '..ppp...'],
        'Три коня — большая угроза. Король не должен стоять на краю.'),
      L('2-6', 'Обход', 6, 3, ['n..k...n', '........', '.pp..pp.'],
        'Кони идут с флангов. Закройте углы своего лагеря.'),
      L('2-7', 'Лесная крепость', 7, 3, ['..pkp...', '.n....n.', '..pppp..'],
        'Пробейте центр, а кони пусть займутся королём.'),
      L('2-8', 'Табун', 7, 4, ['.n.k.n..', '..n.n...', '.pp..pp.'],
        'Слоны за стеной пешек — лучший ответ на конницу.'),
      L('2-9', 'Чёрный всадник', 8, 4, ['...k....', '..nNn...', '..pppp..'],
        'Всадник охотится на стрелков. Поставьте их подальше от флангов.', 'Чёрный всадник'),
    ],
  },
  {
    id: 3, name: 'Башни', subtitle: 'Линии огня', limit: 8,
    levels: [
      L('3-1', 'Дозор', 8, 3, ['...k....', '..b..b..', '..pppp..'],
        'Слоны бьют по диагонали. Любая фигура на линии закрывает выстрел.'),
      L('3-2', 'Бойницы', 9, 3, ['r..k...r', '........', '.pp..pp.'],
        'Ладьи стреляют по прямой через всю доску. Не оставляйте короля на открытой линии.'),
      L('3-3', 'Перекрёсток', 10, 4, ['..bkb...', '........', '.pppppp.'],
        'Своя ладья на свободной колонне достанет их короля.'),
      L('3-4', 'Цитадель', 11, 4, ['r.bkb..r', '........', '..pppp..'],
        'Кони — лучший способ добраться до стрелков в тылу.'),
      L('3-5', 'Огневой рубеж', 11, 4, ['...k....', '.b.rr.b.', '..pppp..'],
        'Чем плотнее ваш строй, тем меньше линий открыто врагу.'),
      L('3-6', 'Осада', 10, 4, ['r..k...r', '..n..n..', '.pppppp.'],
        'Кони прорываются, ладьи прикрывают. Держите пешки перед королём.'),
      L('3-7', 'Галерея', 12, 5, ['.bbkbb..', '........', 'pppppppp'],
        'Четыре слона, но только по диагоналям. Ортогональные клетки безопасны.'),
      L('3-8', 'Бастион', 12, 5, ['r.nkn..r', '..b..b..', '.pppppp.'],
        'Не жалейте пешек — их задача принять удар.'),
      L('3-9', 'Башня-крепость', 14, 5, ['...k....', '..bRb...', '.pppppp.'],
        'Крепость держит удар втрое лучше. Сначала снимите слонов.', 'Башня-крепость'),
    ],
  },
  {
    id: 4, name: 'Тронный зал', subtitle: 'Финальная партия', limit: 10,
    levels: [
      L('4-1', 'Аудиенция', 13, 4, ['..bkq...', '..n..n..', '.pppppp.'],
        'Вражеский ферзь бьёт во все стороны. Закройте его линии.'),
      L('4-2', 'Гвардия', 14, 5, ['r.bkb..r', '.n....n.', '.pppppp.'],
        'Полная армия против полной армии. Решает расстановка.'),
      L('4-3', 'Совет', 14, 5, ['..qk....', '.bn..nb.', 'pppppppp'],
        'Ваш ферзь — козырь. Держите его рядом с королём ради ауры.'),
      L('4-4', 'Зал зеркал', 14, 5, ['rb.k..br', '..n..n..', 'pppppppp'],
        'Симметрия врага — ищите слабую сторону.'),
      L('4-5', 'Тайный ход', 15, 5, ['n.qk..n.', '.b....b.', 'pp.pp.pp'],
        'Дыры в строю — путь для ваших пешек к превращению.'),
      L('4-6', 'Почётный караул', 15, 6, ['r.bkqb.r', '........', 'pppppppp'],
        'Улучшайте всех: на этом этапе слабое звено ломает строй.'),
      L('4-7', 'Последний рубеж', 15, 6, ['rnbkqbnr', '........', 'pppppppp'],
        'Полный шахматный набор. Постройте свою идеальную партию.'),
      L('4-8', 'Тень трона', 14, 6, ['rnbkqbnr', '..p..p..', 'pppppppp'],
        'Казна и Кузница ускоряют подготовку к финалу.'),
      L('4-9', 'Чёрный ферзь', 15, 7, ['rnbkQbnr', '........', 'pppppppp'],
        'Финальный бой. Ферзь-босс сметает всё на линиях — закрывайте их.', 'Чёрный ферзь'),
    ],
  },
];

export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);

/** The level that unlocks a piece for recruitment (null = available from the start). */
export const UNLOCKED_BY: Record<PieceKind, string | null> = {
  king: null, pawn: null, knight: '1-2', bishop: '1-9', rook: '2-9', queen: '3-9',
  // Prestige pieces are unlocked in the Crown Tree, not by levels.
  archbishop: null, chancellor: null, ghost: null,
};

const LETTERS: Record<string, PieceKind> = { k: 'king', p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

export function levelIndex(id: string): number {
  return ALL_LEVELS.findIndex((l) => l.id === id);
}

// ---------- Abyss: endless generated floors ----------

export const ABYSS_UNLOCK = '2-9';
const ABYSS_PREFIX = 'abyss-';

export const ABYSS_CHAPTER: ChapterDef = { id: 5, name: 'Бездна', subtitle: 'Бесконечный спуск', limit: 8, levels: [] };

export function isAbyss(id: string): boolean {
  return id.startsWith(ABYSS_PREFIX);
}

export function abyssId(floor: number): string {
  return `${ABYSS_PREFIX}${floor}`;
}

export function abyssFloor(id: string): number {
  return Number(id.slice(ABYSS_PREFIX.length));
}

/** Enemy formation for an abyss floor; deterministic, so a retry meets the same army. */
export function abyssLevel(floor: number): LevelDef {
  let a = (floor * 2654435761) >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const grid = [...Array(3)].map(() => [...'........']);
  const kingX = Math.floor(rand() * 8);
  grid[0][kingX] = 'k';
  const boss = floor % 10 === 0;
  const pool = ['n', ...(floor >= 3 ? ['b'] : []), ...(floor >= 6 ? ['r'] : []), ...(floor >= 12 ? ['q'] : [])];
  const pieces = Math.min(7, 1 + Math.floor(floor / 3));
  const pawns = Math.min(8, 3 + Math.floor(floor / 4));
  const place = (ch: string, rows: number[]) => {
    for (let tries = 0; tries < 40; tries++) {
      const y = rows[Math.floor(rand() * rows.length)];
      const x = Math.floor(rand() * 8);
      if (grid[y][x] === '.') {
        grid[y][x] = ch;
        return;
      }
    }
  };
  if (boss) place(pool[Math.floor(rand() * pool.length)].toUpperCase(), [1]);
  for (let i = 0; i < pieces; i++) place(pool[Math.floor(rand() * pool.length)], [0, 1]);
  for (let i = 0; i < pawns; i++) place('p', [2]);
  const level = Math.round(4 + floor * 0.45);
  return {
    id: abyssId(floor),
    name: boss ? `Страж глубин` : `Этаж ${floor}`,
    rows: grid.map((r) => r.join('')),
    level,
    maxLosses: 3 + Math.floor(floor / 10),
    hint: boss
      ? 'Каждые 10 этажей путь преграждает страж с тройным здоровьем.'
      : 'Чем глубже, тем сильнее враги. Улучшайте армию и включите авто-спуск.',
    boss: boss ? 'Страж глубин' : undefined,
  };
}

export function abyssReward(floor: number): number {
  return Math.round(70 * 1.13 ** floor);
}

// ---------- The finale: «Рука над доской» ----------

const FINALE_PREFIX = 'final-';

export const FINALE_CHAPTER: ChapterDef = { id: 6, name: 'Край доски', subtitle: 'Рука над доской', limit: 12, levels: [] };

/**
 * Three phases fought in a row. Enemy levels are set from the player's army
 * (see `finaleSetup` in state.ts), so `level` here is only a placeholder.
 */
export const FINALE_LEVELS: LevelDef[] = [
  L('final-1', 'Последняя партия', 1, 6, ['rnbqKbnr', 'pppppppp', '........'],
    'Полная армия Чёрного короля и все искажения сразу. Король сам выходит на поле — доберитесь до него.', 'Чёрный король'),
  L('final-2', 'Зеркало', 1, 6, ['........', '........', '........'],
    'Рука перевернула доску: против вас ваша же армия. Чёрный король теперь на вашей стороне.', 'Тень полководца'),
  L('final-3', 'Рука над доской', 1, 8, ['...K....', '..n..n..', 'pppppppp'],
    'Рука не двигается, но бьёт ладонью, щёлкает фигуры и переставляет их. Окружите её.', 'Рука над доской'),
];

export function isFinale(id: string): boolean {
  return id.startsWith(FINALE_PREFIX);
}

/** Phase number 1..3 of a finale level. */
export function finalePhase(id: string): number {
  return Number(id.slice(FINALE_PREFIX.length));
}

export function finaleId(phase: number): string {
  return `${FINALE_PREFIX}${phase}`;
}

export function getLevel(id: string): LevelDef {
  if (isAbyss(id)) return abyssLevel(abyssFloor(id));
  if (isFinale(id)) {
    const level = FINALE_LEVELS[finalePhase(id) - 1];
    if (!level) throw new Error(`Unknown level ${id}`);
    return level;
  }
  const level = ALL_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

export function chapterOf(id: string): ChapterDef {
  if (isAbyss(id)) return ABYSS_CHAPTER;
  if (isFinale(id)) return FINALE_CHAPTER;
  return CHAPTERS.find((c) => c.levels.some((l) => l.id === id))!;
}

export function nextLevelId(id: string): string | null {
  if (isAbyss(id)) return abyssId(abyssFloor(id) + 1);
  if (isFinale(id)) return finalePhase(id) < FINALE_LEVELS.length ? finaleId(finalePhase(id) + 1) : null;
  return ALL_LEVELS[levelIndex(id) + 1]?.id ?? null;
}

export function enemyPlacements(level: LevelDef): Placement[] {
  const result: Placement[] = [];
  level.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const kind = LETTERS[ch.toLowerCase()];
      if (kind) result.push({ kind, x, y, level: level.level, boss: ch !== ch.toLowerCase() });
    });
  });
  return result;
}

export function firstReward(id: string): number {
  return Math.round(30 * 1.15 ** levelIndex(id));
}

export function replayReward(id: string): number {
  return Math.round(firstReward(id) * 0.35);
}

/** Gold per minute the treasury earns from this level once cleared. */
export function levelIncome(id: string): number {
  return Math.round((2 + levelIndex(id) * 0.8) * 10) / 10;
}
