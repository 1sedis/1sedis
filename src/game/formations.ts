import { t } from '../i18n';
import type { Placement } from './battle';
import type { PieceKind } from './pieces';
import { walkable, type Terrain } from './terrain';

/**
 * Living enemies: a run battle does not always stand the way its level was drawn.
 * The same pieces (or an equal-value swap) take one of several formations,
 * sometimes mirrored, chosen by the run's seed — so 2-4 differs from run to run.
 */
export type FormationId = 'classic' | 'line' | 'wedge' | 'flanks' | 'fortress' | 'ambush' | 'column' | 'checker';

/**
 * Rows 0-3 of the enemy side. K king, f front (pawns), m middle (knights and jumpers),
 * b back (shooters). Cells of a role are filled in reading order; pieces that do not
 * fit their role take any free cell of the enemy side.
 */
const SHAPES: Record<Exclude<FormationId, 'classic'>, string[]> = {
  line: ['bmbKbmbb', 'ffffffff', '........', '........'],
  wedge: ['..bKbb..', '.bmffmb.', '..fmmf..', '...ff...'],
  flanks: ['bb.K..bb', 'mf....fm', 'ff....ff', '........'],
  fortress: ['Kbmb....', 'bfmf....', 'fffff...', '........'],
  ambush: ['bbbKbbbb', 'm......m', '........', 'f.f.f.f.'],
  column: ['..bKb...', '..mbm...', '..fmf...', '..fff...'],
  checker: ['b.bKb.b.', '.f.m.f.m', 'f.f.f.f.', '........'],
};

export const FORMATION_NAMES: Record<FormationId, string> = {
  classic: t('Классика'), line: t('Линия'), wedge: t('Клин'), flanks: t('Фланги'), fortress: t('Крепость'),
  ambush: t('Засада'), column: t('Колонна'), checker: t('Шахматка'),
};

export const FORMATION_IDS = Object.keys(FORMATION_NAMES) as FormationId[];

function role(kind: PieceKind): 'K' | 'f' | 'm' | 'b' {
  if (kind === 'king') return 'K';
  if (kind === 'pawn') return 'f';
  if (kind === 'knight' || kind === 'ghost') return 'm';
  return 'b';
}

/** A small deterministic generator for a text key. */
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Equal-value swaps that change what a squad is made of: a knight for a bishop (or back),
 * a rook for a bishop and a pawn. At most two per battle.
 */
function swapPieces(pieces: Placement[], rand: () => number): Placement[] {
  const out = pieces.map((p) => ({ ...p }));
  const swaps = Math.floor(rand() * 3);
  for (let n = 0; n < swaps; n++) {
    const idx = out.map((p, i) => ({ p, i })).filter(({ p }) => !p.boss && ['knight', 'bishop', 'rook'].includes(p.kind));
    if (!idx.length) break;
    const { p, i } = idx[Math.floor(rand() * idx.length)];
    if (p.kind === 'knight') out[i] = { ...p, kind: 'bishop', trait: undefined };
    else if (p.kind === 'bishop') out[i] = { ...p, kind: 'knight', trait: undefined };
    else {
      out[i] = { ...p, kind: 'bishop', trait: undefined };
      out.push({ ...p, kind: 'pawn', trait: undefined });
    }
  }
  return out;
}

/**
 * Rearrange a level's enemies into a formation picked by `key` (run seed and level).
 * Bosses and their levels are left as drawn; terrain is respected.
 */
export function arrangeEnemies(pieces: Placement[], terrain: Terrain[], key: string): { pieces: Placement[]; formation: FormationId } {
  if (pieces.some((p) => p.boss)) return { pieces, formation: 'classic' };
  const rand = seeded(key);
  const id = FORMATION_IDS[Math.floor(rand() * FORMATION_IDS.length)];
  const squad = rand() < 0.5 ? swapPieces(pieces, rand) : pieces.map((p) => ({ ...p }));
  if (id === 'classic') return { pieces: squad.length === pieces.length ? squad.map((p, i) => ({ ...p, x: pieces[i].x, y: pieces[i].y })) : pieces, formation: 'classic' };
  const mirror = rand() < 0.5;
  const ok = (x: number, y: number) => walkable(terrain[y * 8 + x] ?? 'plain');
  const cells: Record<string, [number, number][]> = { K: [], f: [], m: [], b: [] };
  SHAPES[id].forEach((row, y) => [...row].forEach((ch, x) => {
    const cx = mirror ? 7 - x : x;
    if (ch !== '.' && ok(cx, y)) cells[ch].push([cx, y]);
  }));
  const taken = new Set<string>();
  const spare: [number, number][] = [];
  for (const y of [1, 0, 2, 3]) for (const x of [3, 4, 2, 5, 1, 6, 0, 7]) if (ok(x, y)) spare.push([x, y]);
  const place = (want: 'K' | 'f' | 'm' | 'b'): [number, number] | undefined => {
    const order = want === 'K' ? ['K', 'b', 'm', 'f'] : [want, want === 'f' ? 'm' : 'b', 'm', 'f'];
    for (const r of order) {
      const c = cells[r].find(([x, y]) => !taken.has(`${x},${y}`));
      if (c) return c;
    }
    return spare.find(([x, y]) => !taken.has(`${x},${y}`));
  };
  // Kings first, then shooters, then the rest, so the back line is never crowded out.
  const sorted = [...squad].sort((a, b) => 'Kbmf'.indexOf(role(a.kind)) - 'Kbmf'.indexOf(role(b.kind)));
  const out: Placement[] = [];
  for (const p of sorted) {
    const at = place(role(p.kind));
    if (!at) continue;
    taken.add(`${at[0]},${at[1]}`);
    out.push({ ...p, x: at[0], y: at[1] });
  }
  return { pieces: out, formation: id };
}
