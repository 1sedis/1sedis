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
      L('3-6', 'Осада', 12, 4, ['r..k...r', '..n..n..', '.pppppp.'],
        'Кони прорываются, ладьи прикрывают. Держите пешки перед королём.'),
      L('3-7', 'Галерея', 12, 5, ['.bbkbb..', '........', 'pppppppp'],
        'Четыре слона, но только по диагоналям. Ортогональные клетки безопасны.'),
      L('3-8', 'Бастион', 13, 5, ['r.nkn..r', '..b..b..', '.pppppp.'],
        'Не жалейте пешек — их задача принять удар.'),
      L('3-9', 'Башня-крепость', 14, 5, ['...k....', '..bRb...', '.pppppp.'],
        'Крепость держит удар втрое лучше. Сначала снимите слонов.', 'Башня-крепость'),
    ],
  },
  {
    id: 4, name: 'Тронный зал', subtitle: 'Финальная партия', limit: 10,
    levels: [
      L('4-1', 'Аудиенция', 14, 4, ['..bkq...', '..n..n..', '.pppppp.'],
        'Вражеский ферзь бьёт во все стороны. Закройте его линии.'),
      L('4-2', 'Гвардия', 15, 5, ['r.bkb..r', '.n....n.', '.pppppp.'],
        'Полная армия против полной армии. Решает расстановка.'),
      L('4-3', 'Совет', 15, 5, ['..qk....', '.bn..nb.', 'pppppppp'],
        'Ваш ферзь — козырь. Держите его рядом с королём ради ауры.'),
      L('4-4', 'Зал зеркал', 16, 5, ['rb.k..br', '..n..n..', 'pppppppp'],
        'Симметрия врага — ищите слабую сторону.'),
      L('4-5', 'Тайный ход', 16, 5, ['n.qk..n.', '.b....b.', 'pp.pp.pp'],
        'Дыры в строю — путь для ваших пешек к превращению.'),
      L('4-6', 'Почётный караул', 17, 6, ['r.bkqb.r', '........', 'pppppppp'],
        'Улучшайте всех: на этом этапе слабое звено ломает строй.'),
      L('4-7', 'Последний рубеж', 17, 6, ['rnbkqbnr', '........', 'pppppppp'],
        'Полный шахматный набор. Постройте свою идеальную партию.'),
      L('4-8', 'Тень трона', 17, 6, ['rnbkqbnr', '..p..p..', 'pppppppp'],
        'Казна и Кузница ускоряют подготовку к финалу.'),
      L('4-9', 'Чёрный ферзь', 18, 7, ['rnbkQbnr', '........', 'pppppppp'],
        'Финальный бой. Ферзь-босс сметает всё на линиях — закрывайте их.', 'Чёрный ферзь'),
    ],
  },
];

export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);

/** The level that unlocks a piece for recruitment (null = available from the start). */
export const UNLOCKED_BY: Record<PieceKind, string | null> = {
  king: null, pawn: null, knight: '1-4', bishop: '1-9', rook: '2-9', queen: '3-9',
};

const LETTERS: Record<string, PieceKind> = { k: 'king', p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

export function levelIndex(id: string): number {
  return ALL_LEVELS.findIndex((l) => l.id === id);
}

export function getLevel(id: string): LevelDef {
  const level = ALL_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

export function chapterOf(id: string): ChapterDef {
  return CHAPTERS.find((c) => c.levels.some((l) => l.id === id))!;
}

export function nextLevelId(id: string): string | null {
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
  return Math.round(50 * 1.2 ** levelIndex(id));
}

export function replayReward(id: string): number {
  return Math.round(firstReward(id) * 0.35);
}

/** Gold per minute the treasury earns from this level once cleared. */
export function levelIncome(id: string): number {
  return Math.round((2 + levelIndex(id) * 0.8) * 10) / 10;
}
