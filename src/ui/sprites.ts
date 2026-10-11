import type { PieceKind } from '../game/pieces';

/**
 * 16x16 pixel maps. Legend:
 *   o outline   f fill   h highlight   s shade   g gem   w gem shine   e detail (outline colour)   . transparent
 * Every piece shares the same two-step base so the army reads as one set.
 */
const MAPS: Record<PieceKind, string[]> = {
  king: [
    '................',
    '.......gg.......',
    '......gwwg......',
    '.......gg.......',
    '.....oooooo.....',
    '....ohhfffso....',
    '....ohffffso....',
    '.....ohffso.....',
    '......offo......',
    '.....ohffso.....',
    '.....ohffso.....',
    '....ohfffsso....',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
  ],
  queen: [
    '...g...gg...g...',
    '...o...oo...o...',
    '..ohoo.oo.oofo..',
    '..ohffoffoffso..',
    '...ohffffffso...',
    '....oooooooo....',
    '.....ohffso.....',
    '.....ohffso.....',
    '......ohfo......',
    '.....ohffso.....',
    '....ohfffsso....',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
    '................',
  ],
  rook: [
    '................',
    '..ooo.oooo.ooo..',
    '..oho.ohfo.oso..',
    '..ohoooffooofo..',
    '..ohffffffffso..',
    '..oooooooooooo..',
    '...ohffffffso...',
    '...ohffoofsso...',
    '...ohffoofsso...',
    '...ohffffffso...',
    '...ohgffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..ohhfffffssso..',
    '..oooooooooooo..',
    '................',
  ],
  bishop: [
    '.......gg.......',
    '......oggo......',
    '.....ohffo......',
    '....ohffofo.....',
    '....ohfofso.....',
    '....ohoffso.....',
    '....ohffsso.....',
    '.....ohfso......',
    '....oooooooo....',
    '.....ohffso.....',
    '.....ohffso.....',
    '....ohfffsso....',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
  ],
  knight: [
    '................',
    '......oo.o......',
    '.....ohfoho.....',
    '....ohffffso....',
    '...ohffeffsso...',
    '..ohfffffffso...',
    '.ohffffffffso...',
    '.offfoohffsso...',
    '..ooo.ohffsso...',
    '......ohffso....',
    '.....ohfffso....',
    '....ohffffsso...',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
  ],
  pawn: [
    '................',
    '................',
    '......oooo......',
    '.....ohhffo.....',
    '.....ohfffo.....',
    '.....offsso.....',
    '......oooo......',
    '.....ohffso.....',
    '......ohfo......',
    '......ohfo......',
    '.....ohffso.....',
    '....ohfffsso....',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
  ],
};

export type Team = 'ally' | 'enemy';

const PALETTES: Record<Team, Record<string, string>> = {
  ally: { o: '#1a1433', e: '#1a1433', f: '#fff1dc', h: '#ffffff', s: '#f0b49c', g: '#3ee6c1', w: '#d8fff6' },
  enemy: { o: '#1a1433', e: '#1a1433', f: '#9b6bff', h: '#d4bfff', s: '#5a35c4', g: '#ff4f7b', w: '#ffd3de' },
};

const SIZE = 16;
const cache = new Map<string, string>();

/** Returns a data-URL PNG of the piece, scaled up crisply. */
export function spriteUrl(kind: PieceKind, team: Team): string {
  const key = `${kind}:${team}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const palette = PALETTES[team];
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * scale;
  canvas.height = SIZE * scale;
  const ctx = canvas.getContext('2d')!;
  MAPS[kind].forEach((row, y) => {
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
