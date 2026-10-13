import type { PieceKind } from '../game/pieces';

/**
 * 24x24 pixel maps. Legend:
 *   o outline   f fill   h highlight   s shade   d deep shade   g gem   w gem shine   e detail (outline colour)   . transparent
 * Every piece shares the same two-step base so the army reads as one set.
 */
const MAPS: Record<PieceKind, string[]> = {
  king: [
    '..........oooo..........',
    '..........ogwo..........',
    '........oooggooo........',
    '........ogggwggo........',
    '........oooggooo........',
    '..........oggo..........',
    '......oooooooooooo......',
    '.....ohhgffggffgsdo.....',
    '.....ohhffffffffsdo.....',
    '......oooooooooooo......',
    '.......ohhfffssdo.......',
    '........ohffssdo........',
    '......oooooooooooo......',
    '......ohhfffffssdo......',
    '......oooooooooooo......',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  queen: [
    '....g...g..gg..g...g....',
    '....o...o..oo..o...o....',
    '....oo..oo.oo.oo..oo....',
    '....ohoooohffoooofso....',
    '....ohhffohffffoffso....',
    '....ohhffffffffffsdo....',
    '.....ohfgffffffgsdo.....',
    '.....oooooooooooooo.....',
    '.......ohhffffsdo.......',
    '........ohffssdo........',
    '........ohffssdo........',
    '......oooooooooooo......',
    '......ohhfffffssdo......',
    '......oooooooooooo......',
    '........ohffssdo........',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  rook: [
    '........................',
    '........................',
    '....ooo..oooooo..ooo....',
    '....oho..ohffso..oso....',
    '....ohfoooohffooofso....',
    '....ohhffffffffffsdo....',
    '....oooooooooooooooo....',
    '......ohhffffffsdo......',
    '......ohhffeeffsdo......',
    '......ohhffeeffsdo......',
    '......ohhffffffsdo......',
    '......ohhfffffssdo......',
    '.....oooooooooooooo.....',
    '.....ohhfffffffssdo.....',
    '.....oooooooooooooo.....',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  bishop: [
    '..........oggo..........',
    '..........ogwo..........',
    '..........oooo..........',
    '.........ohffso.........',
    '........ohfffoso........',
    '.......ohhffoffso.......',
    '.......ohhfoffsso.......',
    '.......ohhoffssdo.......',
    '.......ohfffffsdo.......',
    '........ohffssdo........',
    '.........ohfsdo.........',
    '......oooooooooooo......',
    '......ohhfffffssdo......',
    '......oooooooooooo......',
    '.........ohfsdo.........',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  knight: [
    '........................',
    '..........oo.oo.........',
    '.........ohoohfo........',
    '........ohhffffsoo......',
    '.......ohhffffffsdo.....',
    '......ohffeffffffsdo....',
    '.....ohfffffffffffsdo...',
    '....ohffffffffffffsdo...',
    '...ohffffffoohfffffsdo..',
    '...offffsdo.ohffffsdo...',
    '....oooooo.ohffffssdo...',
    '..........ohfffffsdo....',
    '.........ohhffffssdo....',
    '.......oooooooooooo.....',
    '........ohffffssdo......',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  pawn: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.........oooooo.........',
    '........ohhfffso........',
    '.......ohhhffffso.......',
    '.......ohhfffffso.......',
    '.......ohfffffsso.......',
    '.......offfffssdo.......',
    '........offfssdo........',
    '......oooooooooooo......',
    '......ohhfffffssdo......',
    '......oooooooooooo......',
    '.........ohfsdo.........',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  // Archbishop: a horse's head wearing a bishop's slit and gem.
  archbishop: [
    '...........ogo..........',
    '..........oogoo.........',
    '.........ohoohfo........',
    '........ohhffffsoo......',
    '.......ohhfffoffsdo.....',
    '......ohffefffoffsdo....',
    '.....ohffffffffoffsdo...',
    '....ohfffffffffffosdo...',
    '...ohffffffoohfffffsdo..',
    '...offffsdo.ohffffsdo...',
    '....oooooo.ohffffssdo...',
    '..........ohfffffsdo....',
    '.........ohhffffssdo....',
    '.......oooooooooooo.....',
    '........ohfgffssdo......',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  // Chancellor: a rook's battlements topped by a horse's head.
  chancellor: [
    '.........oo.oo..........',
    '........ohoohfo.........',
    '.......ohhffffoo........',
    '......ohffeffffso.......',
    '.....ohfffffffsdo.......',
    '....offfoohffffsdo......',
    '.....ooo.ohffffsdo......',
    '....ooo.ohfffsdo.ooo....',
    '....oho.ohfffsdo.oso....',
    '....ohooohffffsdooso....',
    '....ohhffffffffffsdo....',
    '....oooooooooooooooo....',
    '......ohhffeeffsdo......',
    '.....oooooooooooooo.....',
    '.....ohhfffgfffssdo.....',
    '........ohffssdo........',
    '.......ohhfffssdo.......',
    '.......ohhfffssdo.......',
    '......ohhffffssddo......',
    '.....ohhhffffffsddo.....',
    '....oooooooooooooooo....',
    '....ohhffffffffsssdo....',
    '....oooooooooooooooo....',
    '........................',
  ],
  // Ghost: a hooded wisp with glowing eyes, no base.
  ghost: [
    '........................',
    '........................',
    '........oooooooo........',
    '.......ohhffffsso.......',
    '......ohhffffffsso......',
    '.....ohhffffffffsso.....',
    '.....ohfeefffeefsdo.....',
    '.....ohfgefffgeffdo.....',
    '.....ohffffffffffdo.....',
    '.....ohfffffffffsdo.....',
    '....ohhffffffffffsdo....',
    '....ohfffffffffffsdo....',
    '....ohfffffffffffsdo....',
    '....ohfffffffffffsdo....',
    '...ohffffffffffffssdo...',
    '...ohffffffffffffssdo...',
    '...offfffffffffffssdo...',
    '...ofsdofsdofsdofsddo...',
    '...oo..oo..oo..oo..oo...',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
};

export type Team = 'ally' | 'enemy';
/** Visual tier: 0 basic, 1 from level 5 (steel / crimson), 2 from level 10 (gold / obsidian). */
export type Tier = 0 | 1 | 2;

const OUTLINE = { o: '#1a1433', e: '#1a1433' };

const PALETTES: Record<Team, Record<string, string>[]> = {
  ally: [
    { ...OUTLINE, f: '#fff1dc', h: '#ffffff', s: '#f0b49c', d: '#c47f6e', g: '#3ee6c1', w: '#d8fff6', b: '#3ee6c1' },
    { ...OUTLINE, f: '#e3ecff', h: '#ffffff', s: '#8fa7d9', d: '#5d73b0', g: '#3ee6c1', w: '#d8fff6', b: '#3ee6c1' },
    { ...OUTLINE, f: '#ffe39a', h: '#fff8dc', s: '#e0a53c', d: '#a8701e', g: '#ff5d85', w: '#ffe1ea', b: '#ff5d85' },
  ],
  enemy: [
    { ...OUTLINE, f: '#9b6bff', h: '#d4bfff', s: '#5a35c4', d: '#3a1f8a', g: '#ff4f7b', w: '#ffd3de', b: '#ff4f7b' },
    { ...OUTLINE, f: '#c2457a', h: '#f39ac0', s: '#7a1f4a', d: '#4f0f2f', g: '#ffcf4a', w: '#fff1b8', b: '#ffcf4a' },
    // Obsidian pieces get a crimson outline so they never melt into a dark board.
    { o: '#c7305f', e: '#c7305f', f: '#3b2d63', h: '#8a76d1', s: '#1e1638', d: '#120c24', g: '#ff4f7b', w: '#ffd3de', b: '#ff4f7b' },
  ],
};

/** Row painted as a coloured band from tier 1, and the base row trimmed at tier 2. */
const BAND_ROW: Record<PieceKind, number> = { archbishop: 14, chancellor: 14, ghost: 10, king: 13, queen: 12, rook: 13, bishop: 12, knight: 14, pawn: 12 };
const BASE_ROW: Record<PieceKind, number> = { archbishop: 21, chancellor: 21, ghost: 15, king: 21, queen: 21, rook: 21, bishop: 21, knight: 21, pawn: 21 };

/** The pixel map for a piece at a tier: higher tiers add a band and a trimmed base. */
export function tierMap(kind: PieceKind, tier: Tier): string[] {
  return MAPS[kind].map((row, y) => {
    const band = (tier >= 1 && y === BAND_ROW[kind]) || (tier >= 2 && y === BASE_ROW[kind]);
    return band ? row.replace(/[fh]/g, 'b') : row;
  });
}

const SIZE = 24;
const cache = new Map<string, string>();

/** Returns a data-URL PNG of the piece, scaled up crisply. */
export function spriteUrl(kind: PieceKind, team: Team, tier: Tier = 0): string {
  const key = `${kind}:${team}:${tier}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const palette = PALETTES[team][tier];
  const scale = 4;
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
