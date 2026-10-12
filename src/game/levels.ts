import type { Placement } from './battle';
import type { PieceKind } from './pieces';
import { t } from '../i18n';

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
    id: 1, name: t('Пешечные поля'), subtitle: t('Строй и король'), limit: 4,
    levels: [
      L('1-1', t('Первый ход'), 1, 1, ['....k...', '........', '...pp...'],
        t('Пешки идут только вперёд. Поставьте их прямо перед вражескими.')),
      L('1-2', t('Застава'), 1, 1, ['....k...', '........', '..ppp...'],
        t('Союзники рядом с королём бьют на 20% сильнее.')),
      L('1-3', t('Стена'), 1, 2, ['...k....', '........', '.pppp...'],
        t('Пешка, которой некого бить, дойдёт до края и станет ферзём.')),
      L('1-4', t('Двойной ряд'), 1, 2, ['...k....', '..pp....', '...ppp..'],
        t('Улучшайте пешек в лагере: каждый уровень даёт +18% к силе.')),
      L('1-5', t('Фланги'), 2, 2, ['....k...', '........', 'pp....pp'],
        t('Враг заходит по краям. Конь поможет добраться до их короля.')),
      L('1-6', t('Клин'), 2, 2, ['...k....', '..ppp...', '.p...p..'],
        t('Пешки, стоящие колонной, прикрывают друг друга.')),
      L('1-7', t('Гарнизон'), 2, 2, ['..pkp...', '........', '.pp..pp.'],
        t('Свободная колонна — путь для превращения в ферзя.')),
      L('1-8', t('Королевская стража'), 3, 3, ['..pkp...', '..ppp...', '........'],
        t('Король спрятан за пешками. Конь перепрыгивает строй.')),
      L('1-9', t('Пешечный капитан'), 3, 3, ['...k....', '..pPp...', '.p...p..'],
        t('У капитана втрое больше здоровья. Окружите его и не подпускайте к королю.'), t('Пешечный капитан')),
    ],
  },
  {
    id: 2, name: t('Конный лес'), subtitle: t('Берегите тыл'), limit: 6,
    levels: [
      L('2-1', t('Разведка'), 4, 2, ['...k....', '.n......', '..ppp...'],
        t('Вражеские кони прыгают к вашим стрелкам и королю.')),
      L('2-2', t('Засада'), 4, 2, ['....k...', 'n......n', '..pp....'],
        t('Окружите короля пешками — конь бьёт только вплотную или «буквой Г».')),
      L('2-3', t('Тропа'), 5, 3, ['...k....', '..n.n...', '..pppp..'],
        t('Слон в заднем ряду достаёт коней, пока они пробиваются.')),
      L('2-4', t('Чаща'), 5, 3, ['..nkn...', '........', '.pp..pp.'],
        t('Своих коней ставьте по краям — им проще обойти строй.')),
      L('2-5', t('Конница'), 6, 3, ['...k....', '.n.nn...', '..ppp...'],
        t('Три коня — большая угроза. Король не должен стоять на краю.')),
      L('2-6', t('Обход'), 6, 3, ['n..k...n', '........', '.pp..pp.'],
        t('Кони идут с флангов. Закройте углы своего лагеря.')),
      L('2-7', t('Лесная крепость'), 6, 3, ['..pkp...', '.n....n.', '..pppp..'],
        t('Пробейте центр, а кони пусть займутся королём.')),
      L('2-8', t('Табун'), 6, 4, ['.n.k.n..', '..n.n...', '.pp..pp.'],
        t('Слоны за стеной пешек — лучший ответ на конницу.')),
      L('2-9', t('Чёрный всадник'), 6, 4, ['...k....', '..nNn...', '..pppp..'],
        t('Всадник охотится на стрелков. Поставьте их подальше от флангов.'), t('Чёрный всадник')),
    ],
  },
  {
    id: 3, name: t('Башни'), subtitle: t('Линии огня'), limit: 8,
    levels: [
      L('3-1', t('Дозор'), 8, 3, ['...k....', '..b..b..', '..pppp..'],
        t('Слоны бьют по диагонали. Любая фигура на линии закрывает выстрел.')),
      L('3-2', t('Бойницы'), 9, 3, ['r..k...r', '........', '.pp..pp.'],
        t('Ладьи стреляют по прямой через всю доску. Не оставляйте короля на открытой линии.')),
      L('3-3', t('Перекрёсток'), 10, 4, ['..bkb...', '........', '.pppppp.'],
        t('Своя ладья на свободной колонне достанет их короля.')),
      L('3-4', t('Цитадель'), 11, 4, ['r.bkb..r', '........', '..pppp..'],
        t('Кони — лучший способ добраться до стрелков в тылу.')),
      L('3-5', t('Огневой рубеж'), 11, 4, ['...k....', '.b.rr.b.', '..pppp..'],
        t('Чем плотнее ваш строй, тем меньше линий открыто врагу.')),
      L('3-6', t('Осада'), 10, 4, ['r..k...r', '..n..n..', '.pppppp.'],
        t('Кони прорываются, ладьи прикрывают. Держите пешки перед королём.')),
      L('3-7', t('Галерея'), 12, 5, ['.bbkbb..', '........', 'pppppppp'],
        t('Четыре слона, но только по диагоналям. Ортогональные клетки безопасны.')),
      L('3-8', t('Бастион'), 12, 5, ['r.nkn..r', '..b..b..', '.pppppp.'],
        t('Не жалейте пешек — их задача принять удар.')),
      L('3-9', t('Башня-крепость'), 14, 5, ['...k....', '..bRb...', '.pppppp.'],
        t('Крепость держит удар втрое лучше. Сначала снимите слонов.'), t('Башня-крепость')),
    ],
  },
  {
    id: 4, name: t('Тронный зал'), subtitle: t('Финальная партия'), limit: 10,
    levels: [
      L('4-1', t('Аудиенция'), 12, 4, ['..bkq...', '..n..n..', '.pppppp.'],
        t('Вражеский ферзь бьёт во все стороны. Закройте его линии.')),
      L('4-2', t('Гвардия'), 12, 5, ['r.bkb..r', '.n....n.', '.pppppp.'],
        t('Полная армия против полной армии. Решает расстановка.')),
      L('4-3', t('Совет'), 13, 5, ['..qk....', '.bn..nb.', 'pppppppp'],
        t('Ваш ферзь — козырь. Держите его рядом с королём ради ауры.')),
      L('4-4', t('Зал зеркал'), 13, 5, ['rb.k..br', '..n..n..', 'pppppppp'],
        t('Симметрия врага — ищите слабую сторону.')),
      L('4-5', t('Тайный ход'), 13, 5, ['n.qk..n.', '.b....b.', 'pp.pp.pp'],
        t('Дыры в строю — путь для ваших пешек к превращению.')),
      L('4-6', t('Почётный караул'), 14, 6, ['r.bkqb.r', '........', 'pppppppp'],
        t('Улучшайте всех: на этом этапе слабое звено ломает строй.')),
      L('4-7', t('Последний рубеж'), 14, 6, ['rnbkqbnr', '........', 'pppppppp'],
        t('Полный шахматный набор. Постройте свою идеальную партию.')),
      L('4-8', t('Тень трона'), 14, 6, ['rnbkqbnr', '..p..p..', 'pppppppp'],
        t('Кузница и реликвии — главное оружие перед финалом главы.')),
      L('4-9', t('Чёрный ферзь'), 15, 7, ['rnbkQbnr', '........', 'pppppppp'],
        t('Финальный бой. Ферзь-босс сметает всё на линиях — закрывайте их.'), t('Чёрный ферзь')),
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

export const ABYSS_CHAPTER: ChapterDef = { id: 5, name: t('Бездна'), subtitle: t('Бесконечный спуск'), limit: 8, levels: [] };

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
    name: boss ? t('Страж глубин') : t('Этаж {floor}', { floor }),
    rows: grid.map((r) => r.join('')),
    level,
    maxLosses: 3 + Math.floor(floor / 10),
    hint: boss
      ? t('Каждые 10 этажей путь преграждает страж с тройным здоровьем.')
      : t('Чем глубже, тем сильнее враги. Улучшайте армию и включите авто-спуск.'),
    boss: boss ? t('Страж глубин') : undefined,
  };
}

export function abyssReward(floor: number): number {
  return Math.round(70 * 1.13 ** floor);
}

// ---------- The finale: «Рука над доской» ----------

const FINALE_PREFIX = 'final-';

export const FINALE_CHAPTER: ChapterDef = { id: 6, name: t('Край доски'), subtitle: t('Рука над доской'), limit: 12, levels: [] };

/**
 * Three phases fought in a row. Enemy levels are set from the player's army
 * (see `finaleSetup` in state.ts), so `level` here is only a placeholder.
 */
export const FINALE_LEVELS: LevelDef[] = [
  L('final-1', t('Последняя партия'), 1, 6, ['rnbqKbnr', 'pppppppp', '........'],
    t('Полная армия Чёрного короля и все искажения сразу. Король сам выходит на поле — доберитесь до него.'), t('Чёрный король')),
  L('final-2', t('Зеркало'), 1, 6, ['........', '........', '........'],
    t('Рука перевернула доску: против вас ваша же армия. Чёрный король теперь на вашей стороне.'), t('Тень полководца')),
  L('final-3', t('Рука над доской'), 1, 8, ['...K....', '..n..n..', 'pppppppp'],
    t('Рука не двигается, но бьёт ладонью, щёлкает фигуры и переставляет их. Окружите её.'), t('Рука над доской')),
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
