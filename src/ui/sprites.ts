import type { PieceKind } from '../game/pieces';

/**
 * 12x12 pixel maps. Legend:
 *   o outline   f fill   h highlight   s shade   g gem   . transparent
 */
const MAPS: Record<PieceKind, string[]> = {
  pawn: [
    '............',
    '....oooo....',
    '...ohhffo...',
    '...ohfffo...',
    '...offsso...',
    '....oooo....',
    '....ohfo....',
    '....offo....',
    '...ohffso...',
    '..ohfffsso..',
    '..oooooooo..',
    '............',
  ],
  knight: [
    '............',
    '.....oo.....',
    '....ohfoo...',
    '...ohfffso..',
    '..ohffoffso.',
    '.ohffffffso.',
    '.ooooohffso.',
    '.....ohffso.',
    '....ohfffso.',
    '...ohffffsso',
    '...ooooooooo',
    '............',
  ],
  bishop: [
    '.....gg.....',
    '....ohfo....',
    '...ohfoso...',
    '...ohofso...',
    '...offsso...',
    '....offo....',
    '...oooooo...',
    '....ohfo....',
    '....offo....',
    '...ohffso...',
    '..oooooooo..',
    '............',
  ],
  rook: [
    '............',
    '..oo.oo.oo..',
    '..ohofofso..',
    '..ohffffso..',
    '..oooooooo..',
    '...ohffso...',
    '...ohgfso...',
    '...ohffso...',
    '..oooooooo..',
    '..ohfffsso..',
    '..oooooooo..',
    '............',
  ],
  queen: [
    '..g..gg..g..',
    '..o..oo..o..',
    '.ohoohfoofo.',
    '.ohfffffffo.',
    '..ohffffso..',
    '..oooooooo..',
    '...ohffso...',
    '...ohffso...',
    '..ohfffsso..',
    '.ohffffssso.',
    '.oooooooooo.',
    '............',
  ],
};

export type Team = 'ally' | 'enemy';

const PALETTES: Record<Team, Record<string, string>> = {
  ally: { o: '#1a1433', f: '#fff4e0', h: '#ffffff', s: '#ffc9a8', g: '#3ee6c1' },
  enemy: { o: '#1a1433', f: '#9b6bff', h: '#d7c2ff', s: '#5b35c9', g: '#ff4f7b' },
};

const cache = new Map<string, string>();

/** Returns a data-URL PNG of the piece, scaled up crisply. */
export function spriteUrl(kind: PieceKind, team: Team): string {
  const key = `${kind}:${team}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const map = MAPS[kind];
  const palette = PALETTES[team];
  const scale = 8;
  const canvas = document.createElement('canvas');
  canvas.width = 12 * scale;
  canvas.height = 12 * scale;
  const ctx = canvas.getContext('2d')!;
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export const SPRITE_MAPS = MAPS;
