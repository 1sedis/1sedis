const BOARD_SIZE = 8;

/**
 * Board terrain. Legend for maps (8 rows, row 0 is the enemy back rank):
 *   .  plain
 *   #  rock   — nobody stands here, blocks shots
 *   ~  water  — nobody stands here, shots fly over
 *   f  forest — a piece here takes 30% less damage
 *   ^  hill   — a shooter here deals 25% more damage
 */
export type Terrain = 'plain' | 'rock' | 'water' | 'forest' | 'hill';

export const TERRAIN_CHARS: Record<string, Terrain> = { '.': 'plain', '#': 'rock', '~': 'water', f: 'forest', '^': 'hill' };

export const TERRAIN_INFO: Record<Exclude<Terrain, 'plain'>, { name: string; text: string }> = {
  rock: { name: 'Камень', text: 'Нельзя встать, блокирует выстрелы.' },
  water: { name: 'Вода', text: 'Нельзя встать, выстрелы пролетают над ней. Конь перепрыгивает.' },
  forest: { name: 'Лес', text: 'Фигура в лесу получает на 30% меньше урона.' },
  hill: { name: 'Холм', text: 'Слон, ладья или ферзь на холме бьёт на 25% сильнее.' },
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

/** Abyss floors get random features in the middle rows, more as you go deeper. */
function abyssMap(floor: number): string[] {
  let seed = (floor * 2246822519) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rows = [[...'........'], [...'........']];
  const pool = ['#', '~', 'f', '^'];
  const count = Math.min(6, 1 + Math.floor(floor / 4));
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * 4);
    const y = Math.floor(rand() * 2);
    const ch = pool[Math.floor(rand() * pool.length)];
    // Mirror the feature so floors stay fair to both flanks.
    rows[y][x] = ch;
    rows[y][7 - x] = ch;
  }
  return mid(rows[0].join(''), rows[1].join(''));
}

export function levelTerrainRows(levelId: string): string[] | undefined {
  if (levelId.startsWith('abyss-')) {
    const floor = Number(levelId.slice(6));
    return floor >= 3 ? abyssMap(floor) : undefined;
  }
  return MAPS[levelId];
}

export function levelTerrain(levelId: string): Terrain[] {
  return parseTerrain(levelTerrainRows(levelId));
}

/** Pieces can stand here. */
export function walkable(t: Terrain): boolean {
  return t !== 'rock' && t !== 'water';
}

/** Kinds of terrain present on a level, for the task card and tips. */
export function terrainKinds(levelId: string): Exclude<Terrain, 'plain'>[] {
  const set = new Set(levelTerrain(levelId).filter((t): t is Exclude<Terrain, 'plain'> => t !== 'plain'));
  return [...set];
}
