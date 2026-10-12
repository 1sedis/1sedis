import { t } from '../i18n';
const BOARD_SIZE = 8;

/**
 * Board terrain. Legend for maps (8 rows, row 0 is the enemy back rank):
 *   .  plain
 *   #  rock   — nobody stands here, blocks shots
 *   ~  water  — nobody stands here, shots fly over
 *   f  forest — a piece here takes 30% less damage
 *   ^  hill   — a shooter here deals 25% more damage
 *   x  dark   — "Тьма на доске": drains the player's pieces, heals enemies
 */
export type Terrain = 'plain' | 'rock' | 'water' | 'forest' | 'hill' | 'dark';

export const TERRAIN_CHARS: Record<string, Terrain> = { '.': 'plain', '#': 'rock', '~': 'water', f: 'forest', '^': 'hill', x: 'dark' };

export const TERRAIN_INFO: Record<Exclude<Terrain, 'plain'>, { name: string; text: string }> = {
  rock: { name: t('Камень'), text: t('Нельзя встать, блокирует выстрелы.') },
  water: { name: t('Вода'), text: t('Нельзя встать, выстрелы пролетают над ней. Конь перепрыгивает.') },
  forest: { name: t('Лес'), text: t('Фигура в лесу получает на 30% меньше урона.') },
  hill: { name: t('Холм'), text: t('Слон, ладья или ферзь на холме бьёт на 25% сильнее.') },
  dark: { name: t('Тьма'), text: t('Ваша фигура здесь теряет 4% здоровья в секунду, вражеская — лечится.') },
};

export const FOREST_DEFENSE = 0.7;
export const HILL_BONUS = 1.25;

/** Rows 3..4 of most maps; a short way to write the middle of the board. */
function mid(row3: string, row4: string, row5 = '........'): string[] {
  return ['........', '........', '........', row3, row4, row5, '........', '........'];
}

/** Hand-made terrain per campaign level. Levels without an entry are plain. */
const MAPS: Record<string, string[]> = {
  // Chapter 1: fields — a few groves and stones.
  '1-3': mid('........', '...ff...'),
  '1-4': mid('..f..f..', '........'),
  '1-5': mid('...##...', '........'),
  '1-6': mid('........', 'ff....ff'),
  '1-7': mid('...ff...', '#......#'),
  '1-8': mid('..ffff..', '........'),
  '1-9': mid('..#..#..', '........', '.f....f.'),
  // Chapter 2: the horse forest — thickets and streams.
  '2-1': mid('.ff..ff.', 'f......f'),
  '2-2': mid('...ff...', '.f.~~.f.'),
  '2-3': mid('..f..f..', '~~....~~'),
  '2-4': mid('f.f..f.f', '........', '...f....'),
  '2-5': mid('f......f', '..~~~~..'),
  '2-6': mid('.f.ff.f.', '.f....f.'),
  '2-7': mid('........', '~~.ff.~~'),
  '2-8': mid('ff.~~.ff', '........', 'f......f'),
  '2-9': mid('..f..f..', '.~~..~~.'),
  // Chapter 3: towers — walls and hills for the shooters.
  '3-1': mid('..^..^..', '...##...'),
  '3-2': mid('#......#', '...^^...'),
  '3-3': mid('........', '##.^^.##'),
  '3-4': mid('.#....#.', '...^^...'),
  '3-5': mid('^......^', '..#..#..'),
  '3-6': mid('.f....f.', '..#..#..'),
  '3-7': mid('...##...', '^......^'),
  '3-8': mid('..#..#..', '.^....^.'),
  '3-9': mid('#..^^..#', '........'),
  // Chapter 4: the throne hall — pillars and a raised dais.
  '4-1': mid('..#..#..', '........'),
  '4-2': mid('........', '.#....#.'),
  '4-3': mid('#..^^..#', '........'),
  '4-4': mid('.#....#.', '...^^...'),
  '4-5': mid('........', '#..##..#'),
  '4-6': mid('..#^^#..', '........'),
  '4-7': mid('.#....#.', '...ff...'),
  '4-8': mid('........', '#.^..^.#'),
  '4-9': mid('..#..#..', '#..^^..#'),
};

const PLAIN: Terrain[] = new Array(BOARD_SIZE * BOARD_SIZE).fill('plain');

/** Parse 8 map rows into a flat array (index y * 8 + x). */
export function parseTerrain(rows: string[] | undefined): Terrain[] {
  if (!rows) return PLAIN;
  const out: Terrain[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) out.push(TERRAIN_CHARS[rows[y]?.[x] ?? '.'] ?? 'plain');
  }
  return out;
}

export function levelTerrainRows(levelId: string): string[] | undefined {
  return MAPS[levelId];
}

export function levelTerrain(levelId: string, dark = false): Terrain[] {
  return parseTerrain(dark ? withDarkness(levelId, levelTerrainRows(levelId)) : levelTerrainRows(levelId));
}

/**
 * "Тьма на доске": two mirrored pairs of dark cells on plain squares — one in
 * no man's land (rows 3-4) and one in the player's front row (row 5).
 * Deterministic per level so the player can plan around them.
 */
export function withDarkness(levelId: string, rows: string[] | undefined): string[] {
  const out = (rows ?? new Array(BOARD_SIZE).fill('........')).map((r) => [...r]);
  let h = 2166136261;
  for (const ch of levelId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const pick = (ys: number[]) => {
    const cells: [number, number][] = [];
    for (const y of ys) for (let x = 0; x < 4; x++) if (out[y][x] === '.' && out[y][7 - x] === '.') cells.push([x, y]);
    if (!cells.length) return;
    h = Math.imul(h ^ 0x9e3779b9, 16777619) >>> 0;
    const [x, y] = cells[h % cells.length];
    out[y][x] = out[y][7 - x] = 'x';
  };
  pick([3, 4]);
  pick([5]);
  return out.map((r) => r.join(''));
}

/** Pieces can stand here. */
export function walkable(t: Terrain): boolean {
  return t !== 'rock' && t !== 'water';
}

/** Kinds of terrain present on a level, for the task card and tips. */
export function terrainKinds(levelId: string, dark = false): Exclude<Terrain, 'plain'>[] {
  const set = new Set(levelTerrain(levelId, dark).filter((t): t is Exclude<Terrain, 'plain'> => t !== 'plain'));
  return [...set];
}
