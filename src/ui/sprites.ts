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
  // Archbishop: a bishop's mitre with a horse's ear and mane.
  archbishop: [
    '...o...gg.......',
    '..oho.oggo......',
    '..ohfoohffo.....',
    '...ohffffofo....',
    '...ohffefoso....',
    '..ohffffoffso...',
    '.offffoohffso...',
    '..ooo..ohfsso...',
    '....oooooooo....',
    '.....ohffso.....',
    '.....ohgfso.....',
    '....ohfffsso....',
    '...ohhffffsso...',
    '..oooooooooooo..',
    '..ohffffffssso..',
    '..oooooooooooo..',
  ],
  // Chancellor: a rook's battlements topped by a horse's head.
  chancellor: [
    '.......oo.o.....',
    '......ohfoho....',
    '.....ohffeffo...',
    '....ohffffffso..',
    '....offfoohfso..',
    '.ooo.oooooooo...',
    '.oho.ohfo.ofo...',
    '.ohoooffooofo...',
    '.ohffffffffso...',
    '.oooooooooooo...',
    '..ohffoofsso....',
    '..ohgffffsso....',
    '.oooooooooooo...',
    '.ohffffffssso...',
    '.oooooooooooo...',
    '................',
  ],
  // Ghost: a hooded wisp with glowing eyes, no base.
  ghost: [
    '................',
    '.....oooooo.....',
    '....ohhfffso....',
    '...ohffffffso...',
    '...ohfoffoffo...',
    '...ohfgffgfso...',
    '...ohffffffso...',
    '...ohffffffso...',
    '..ohfffffffsso..',
    '..ohffffffffso..',
    '..ohfffffffsso..',
    '..offfffffffso..',
    '..ofsofsofsoso..',
    '..oo.oo.oo.oo...',
    '................',
    '................',
  ],
};

export type Team = 'ally' | 'enemy';
/** Visual tier: 0 basic, 1 from level 5 (steel / crimson), 2 from level 10 (gold / obsidian). */
export type Tier = 0 | 1 | 2;

const OUTLINE = { o: '#1a1433', e: '#1a1433' };

const PALETTES: Record<Team, Record<string, string>[]> = {
  ally: [
    { ...OUTLINE, f: '#fff1dc', h: '#ffffff', s: '#f0b49c', g: '#3ee6c1', w: '#d8fff6', b: '#3ee6c1' },
    { ...OUTLINE, f: '#e3ecff', h: '#ffffff', s: '#8fa7d9', g: '#3ee6c1', w: '#d8fff6', b: '#3ee6c1' },
    { ...OUTLINE, f: '#ffe39a', h: '#fff8dc', s: '#e0a53c', g: '#ff5d85', w: '#ffe1ea', b: '#ff5d85' },
  ],
  enemy: [
    { ...OUTLINE, f: '#9b6bff', h: '#d4bfff', s: '#5a35c4', g: '#ff4f7b', w: '#ffd3de', b: '#ff4f7b' },
    { ...OUTLINE, f: '#c2457a', h: '#f39ac0', s: '#7a1f4a', g: '#ffcf4a', w: '#fff1b8', b: '#ffcf4a' },
    // Obsidian pieces get a crimson outline so they never melt into a dark board.
    { o: '#c7305f', e: '#c7305f', f: '#3b2d63', h: '#8a76d1', s: '#1e1638', g: '#ff4f7b', w: '#ffd3de', b: '#ff4f7b' },
  ],
};

/** Row painted as a coloured band from tier 1, and the base row trimmed at tier 2. */
const BAND_ROW: Record<PieceKind, number> = { archbishop: 10, chancellor: 10, ghost: 9, king: 9, queen: 9, rook: 9, bishop: 9, knight: 10, pawn: 10 };
const BASE_ROW: Record<PieceKind, number> = { archbishop: 14, chancellor: 13, ghost: 11, king: 14, queen: 13, rook: 12, bishop: 14, knight: 14, pawn: 14 };

/** The pixel map for a piece at a tier: higher tiers add a band and a trimmed base. */
export function tierMap(kind: PieceKind, tier: Tier): string[] {
  return MAPS[kind].map((row, y) => {
    const band = (tier >= 1 && y === BAND_ROW[kind]) || (tier >= 2 && y === BASE_ROW[kind]);
    return band ? row.replace(/[fh]/g, 'b') : row;
  });
}

const SIZE = 16;
const cache = new Map<string, string>();

/** Returns a data-URL PNG of the piece, scaled up crisply. */
export function spriteUrl(kind: PieceKind, team: Team, tier: Tier = 0): string {
  const key = `${kind}:${team}:${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const palette = PALETTES[team][tier];
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * scale;
  canvas.height = SIZE * scale;
  const ctx = canvas.getContext('2d')!;
  tierMap(kind, tier).forEach((row, y) => {
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
