import type { Terrain } from '../game/terrain';

/** 16x16 pixel tiles for terrain. o outline, a/b/c tones, h highlight, . transparent. */
const MAPS: Record<Exclude<Terrain, 'plain'>, string[]> = {
  rock: [
    '................',
    '................',
    '.....oooooo.....',
    '....ohhaaaao....',
    '...ohaaaaabbo...',
    '..ohaaaaaabbbo..',
    '..ohaaaabbbbbo..',
    '.ohaaaaabbbbbbo.',
    '.ohaaaabbbbbcbo.',
    '.oaaaabbbbbbcco.',
    '.oaabbbbbbbccco.',
    '.obbbbbbbbcccco.',
    '..obbbbbcccccoo.',
    '...oooooooooo...',
    '................',
    '................',
  ],
  forest: [
    '....o...........',
    '...oho......o...',
    '...oao.....oho..',
    '..ohaao....oao..',
    '..oaaao...ohaao.',
    '.ohaabao..oaaao.',
    '.oaaabbo.ohaabao',
    'ohaaabbbooaaabbo',
    'oooooooo.oaaabbo',
    '...occo..oooooo.',
    '...occo....oco..',
    '...oooo....oco..',
    '...........ooo..',
    '................',
    '................',
    '................',
  ],
  water: [
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aahhhaaaaaaaaaaa',
    'ahaaahaaaaaaaaaa',
    'aaaaaaaaaaahhhaa',
    'aaaaaaaaaahaaaha',
    'bbaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaahhhaaaaaaaa',
    'aaaahaaahaaaaaaa',
    'aaaaaaaaaaaaaaab',
    'aaaaaaaaaaahhhaa',
    'aaaaaaaaaahaaaha',
    'abbaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaa',
  ],
  hill: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......oooo......',
    '....oohhhhoo....',
    '...ohhaaaaaao...',
    '..ohaaaaaaaabo..',
    '.ohaaaaaaaabbbo.',
    '.oaaaaaaaabbbbo.',
    'ohaaaaaaabbbbbbo',
    'oaaaaaaabbbbbbco',
    'oaaaaabbbbbbccco',
    'oooooooooooooooo',
    '................',
  ],
};

const PALETTE: Record<Exclude<Terrain, 'plain'>, Record<string, string>> = {
  rock: { o: '#1a1433', h: '#c9c4e0', a: '#8f89ad', b: '#6a6489', c: '#4a4566' },
  forest: { o: '#10241c', h: '#7fe08f', a: '#3fae62', b: '#26804a', c: '#7a4a2a' },
  water: { a: '#2f6fb0', b: '#25598f', h: '#9fd6ff' },
  hill: { o: '#2a2416', h: '#d9d07a', a: '#9fae4c', b: '#77873a', c: '#57642a' },
};

const cache = new Map<string, string>();

export function terrainUrl(t: Exclude<Terrain, 'plain'>): string {
  const hit = cache.get(t);
  if (hit) return hit;
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16 * scale;
  const ctx = canvas.getContext('2d')!;
  MAPS[t].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[t][ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  const url = canvas.toDataURL();
  cache.set(t, url);
  return url;
}
