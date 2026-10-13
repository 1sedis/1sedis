import type { Trait } from '../game/elites';

/** 8x8 badges for elite traits. o outline, a main, b dark, h light. */
const MAPS = {
  armored: [
    '.oooooo.',
    'ohhaaabo',
    'ohaaaabo',
    'ohaaaabo',
    'oaaaabbo',
    '.oaabbo.',
    '..obbo..',
    '...oo...',
  ],
  furious: [
    '...o....',
    '..oao...',
    '..oaao..',
    '.ohaao.o',
    '.ohaaaoa',
    'ohaabaao',
    'oaabbbao',
    '.oooooo.',
  ],
  vampire: [
    '...oo...',
    '..ohao..',
    '..oaao..',
    '.ohaaao.',
    '.ohaabo.',
    'ohaaabbo',
    'oaaabbbo',
    '.oooooo.',
  ],
  thorns: [
    'o..o..o.',
    'ao.a.oa.',
    '.oaaao..',
    'oaahaaao',
    '.oaabao.',
    'oaabbbao',
    '.o.b.o..',
    'o..o..o.',
  ],
  swift: [
    '....ooo.',
    '...ohao.',
    '..ohao..',
    '.ohaaooo',
    'oooaabo.',
    '..oabo..',
    '.oabo...',
    '.ooo....',
  ],
  explosive: [
    '.....oh.',
    '....o.h.',
    '..oooo..',
    '.ohaaao.',
    'ohaaaabo',
    'oaaaabbo',
    '.oabbbo.',
    '..oooo..',
  ],
};

const EXTRA: Partial<Record<Trait, string[]>> = {
  healer: ['..oooo..', '..ohao..', 'oooaaooo', 'ohhaaaao', 'oaaaaabo', 'oooaaooo', '..oabo..', '..oooo..'],
  summoner: ['..oooo..', '.ohaaao.', 'ohaoobao', 'oaobboao', 'oaobboao', 'oaboobao', '.oaaabo.', '..oooo..'],
  banner: ['oo......', 'ohooooo.', 'ohaaaaao', 'ohaaaao.', 'ohaaabo.', 'oboooo..', 'ob......', 'oo......'],
  warder: ['.oooooo.', 'ohhaaabo', 'ohaoobao', 'ohaoobao', 'oaabbbbo', '.oabbbo.', '..obbo..', '...oo...'],
  blinker: ['..oooo..', '.ohhhao.', 'ohhaaaao', 'ohoaaoao', 'oaaaaaao', 'oaaaaaao', 'oaoaoaoo', 'o.o.o.o.'],
  // A cracked stone: splits in two.
  splitter: ['.oooooo.', 'ohhaobao', 'ohaaobbo', 'oaaao.bo', 'oaao.abo', 'oaob.abo', 'oobbaabo', '.oooooo.'],
  // A snowflake.
  frost: ['...oo...', '.o.hh.o.', '..ohho..', 'ohhaahho', 'ohhaahho', '..ohho..', '.o.hh.o.', '...oo...'],
  // A horseshoe magnet.
  magnet: ['oooooooo', 'ohaaaabo', 'oao..oao', 'oao..oao', 'oao..oao', 'ohh..hho', 'ohh..hho', 'oooooooo'],
  // A shield with a crown mark.
  bodyguard: ['oooooooo', 'ohhaaabo', 'ohahabao', 'ohaaaabo', '.oaaabo.', '.oahabo.', '..obbo..', '...oo...'],
};
Object.assign(MAPS, EXTRA);

const COLORS: Record<Trait, Record<string, string>> = {
  armored: { o: '#1a1433', h: '#e6ecff', a: '#9fb0d6', b: '#5d6a94' },
  furious: { o: '#1a1433', h: '#fff1a6', a: '#ff7a2f', b: '#c3261f' },
  vampire: { o: '#1a1433', h: '#ff9fb5', a: '#e01e4b', b: '#8a0f2e' },
  thorns: { o: '#1a1433', h: '#d4ff9f', a: '#62c94a', b: '#2f7d33' },
  swift: { o: '#1a1433', h: '#e8fbff', a: '#6fe3ff', b: '#2a8fc4' },
  explosive: { o: '#1a1433', h: '#ffcf4a', a: '#5b5470', b: '#332d47' },
  healer: { o: '#1a1433', h: '#ffffff', a: '#5be08a', b: '#2b9a52' },
  summoner: { o: '#1a1433', h: '#f0d6ff', a: '#a45cff', b: '#5a2a9a' },
  banner: { o: '#1a1433', h: '#ffd0dc', a: '#ff4f7b', b: '#8a5a2a' },
  warder: { o: '#1a1433', h: '#fff4c2', a: '#ffcf4a', b: '#b8861e' },
  blinker: { o: '#1a1433', h: '#ffffff', a: '#bfeaff', b: '#7aaed0' },
  splitter: { o: '#1a1433', h: '#e6dccb', a: '#a8957a', b: '#5e4f3d' },
  frost: { o: '#1a1433', h: '#ffffff', a: '#7fd8ff' },
  magnet: { o: '#1a1433', h: '#e8e8f0', a: '#e0304e', b: '#8a1a2e' },
  bodyguard: { o: '#1a1433', h: '#fff4c2', a: '#7b8ccf', b: '#3e4a80' },
};

const cache = new Map<Trait, string>();

export function traitUrl(t: Trait): string {
  const hit = cache.get(t);
  if (hit) return hit;
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8 * scale;
  const ctx = canvas.getContext('2d')!;
  (MAPS as Record<Trait, string[]>)[t].forEach((row, y) => [...row].forEach((ch, x) => {
    const c = COLORS[t][ch];
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  const url = canvas.toDataURL();
  cache.set(t, url);
  return url;
}
