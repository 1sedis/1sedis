import type { RelicId } from '../game/relics';

/**
 * 12x12 relic icons. Legend: o outline, a main, b dark/secondary, c highlight, . transparent.
 * Each relic has its own picture and three colours.
 */
const ICONS: Record<RelicId, { map: string[]; a: string; b: string; c: string }> = {
  phalanx: {
    a: '#4f8df5', b: '#2d5bb8', c: '#bfe0ff', map: [
      '............', '..oooooooo..', '.oaaaaaaaao.', '.oaccaaaabo.', '.oacaaaaabo.', '.oaaaaaaabo.',
      '.oaaaaaabbo.', '..oaaaaabo..', '..oaaaabbo..', '...oaabbo...', '....obbo....', '.....oo.....',
    ],
  },
  earlyCrown: {
    a: '#ffcf4a', b: '#c98f12', c: '#3ee6c1', map: [
      '.....oo.....', '....occo....', '...occcco...', '.....oo.....', '.o...oo...o.', '.oo.oaao.oo.',
      '.oaooaaooao.', '.oaaaaaaaao.', '.oacaaaacao.', '.oooooooooo.', '.obbbbbbbbo.', '.oooooooooo.',
    ],
  },
  forcedMarch: {
    a: '#b07a4a', b: '#5a3d24', c: '#e8c39a', map: [
      '............', '...oooo.....', '...oaao.....', '...oaco.....', '...oaao.....', '...oaao.....',
      '...oaaooo...', '..oaaaaaaoo.', '..oacaaaaaao', '..oaaaaaaaao', '..obbbbbbbbo', '..oooooooooo',
    ],
  },
  queensGambit: {
    a: '#ffcf4a', b: '#c98f12', c: '#ffffff', map: [
      '.....oo.....', '.....oo.....', '....oaao....', '....oaao....', 'oooooaaooooo', '.oaaacaaaao.',
      '..oaaaaaao..', '...oaaaao...', '...oaaaao...', '..oaao.oaao.', '.oao....oao.', '.oo......oo.',
    ],
  },
  bloodQueen: {
    a: '#e0324f', b: '#8c1530', c: '#ff9db0', map: [
      '.....oo.....', '.....oo.....', '....oaao....', '....oaao....', '...oaaaao...', '..oaaaaaao..',
      '.oacaaaaabo.', '.oacaaaaabo.', '.oaaaaaabbo.', '..oaaaabbo..', '...oobboo...', '.....oo.....',
    ],
  },
  royalHealer: {
    a: '#ff5d85', b: '#b82d55', c: '#ffffff', map: [
      '............', '.ooo....ooo.', 'oaaao..oaaao', 'oaccaooaaabo', 'oaaaacaaaabo', 'oaaacccaaabo',
      '.oaaacaaabo.', '..oaaaaabo..', '...oaaabo...', '....oabo....', '.....oo.....', '............',
    ],
  },
  wideAura: {
    a: '#ffcf4a', b: '#9b6bff', c: '#ffffff', map: [
      '............', '...oooooo...', '..oaaaaaao..', '.oaaoooaaao.', '.oaobbbboao.', '.oaobccboao.',
      '.oaobccboao.', '.oaobbbboao.', '.oaaoooooao.', '..oaaaaaao..', '...oooooo...', '............',
    ],
  },
  secondLife: {
    a: '#e8c39a', b: '#7a5a3a', c: '#ffcf4a', map: [
      '.oooooooooo.', '.obbbbbbbbo.', '..oaaaaaao..', '...oaaaao...', '....oaao....', '.....oo.....',
      '....oaco....', '...oaacao...', '..oaaaccao..', '.obbbbbbbbo.', '.oooooooooo.', '............',
    ],
  },
  stunJump: {
    a: '#ffe14a', b: '#c98f12', c: '#ffffff', map: [
      '......oooo..', '.....oaco...', '....oaao....', '...oaao.....', '..oaaaoooo..', '...oooaao...',
      '.....oao....', '....oao.....', '...oao......', '..oao.......', '.oo.........', '............',
    ],
  },
  piercing: {
    a: '#c8d0ec', b: '#7a5a3a', c: '#3ee6c1', map: [
      '............', '......ooooo.', '.......oaao.', '......oaaao.', '.....obaoao.', '....obo..oo.',
      '...obo......', '..obo.......', '.obo........', 'ocao........', '.oo.........', '............',
    ],
  },
  heavyShot: {
    a: '#4a4170', b: '#241d4a', c: '#9e95c9', map: [
      '........oo..', '.......oco..', '......oo....', '...oooooo...', '..oaaaaaao..', '.oaccaaaaao.',
      '.oacaaaaaao.', '.oaaaaaaabo.', '.oaaaaaabbo.', '..oaaabbbo..', '...oooooo...', '............',
    ],
  },
  warCry: {
    a: '#e8c39a', b: '#b07a4a', c: '#ffffff', map: [
      '............', '.........oo.', '........oao.', '.......oaao.', '..ooooocaao.', '.oaaaaaaaao.',
      '.obbbbbbbao.', '..ooooobaao.', '.......obao.', '........obo.', '.........oo.', '............',
    ],
  },
  avengers: {
    a: '#ff5d85', b: '#8c1530', c: '#dfe6f5', map: [
      'oo........oo', 'oco......oco', '.oco....oco.', '..oco..oco..', '...ocooco...', '....occo....',
      '....occo....', '...ocooco...', '.oaoo..ooao.', '.oao....oao.', 'oao......oao', 'oo........oo',
    ],
  },
  chainmail: {
    a: '#9aa3bd', b: '#5d6886', c: '#dfe6f5', map: [
      '............', '..ooo..ooo..', '.oaaooooaao.', 'oaaaaaaaaaao', 'oacacacacaao', 'ooaaaaaaaaoo',
      '.oacacacaco.', '.oaaaaaaaao.', '.oacacacaco.', '.oaaaaaaaao.', '.oooooooooo.', '............',
    ],
  },
  sharpBlades: {
    a: '#7a5a3a', b: '#c98f12', c: '#e6ecff', map: [
      '.....oo.....', '....ocao....', '....ocao....', '....ocao....', '....ocao....', '....ocao....',
      '....ocao....', '..oooooooo..', '..obbbbbbo..', '....obbo....', '....oaao....', '.....oo.....',
    ],
  },
  reserve: {
    a: '#3ee6c1', b: '#7a5a3a', c: '#ffffff', map: [
      '..oo........', '..oaooooo...', '..oaacccao..', '..oaaccaaao.', '..oaacccao..', '..oaooooo...',
      '..ob........', '..ob........', '..ob........', '..ob........', '.oooo.......', '............',
    ],
  },
  plunder: {
    a: '#c98f4a', b: '#7a5a3a', c: '#ffcf4a', map: [
      '....oooo....', '....obbo....', '.....oo.....', '...oooooo...', '..oaaaaaao..', '.oaaaccaaao.',
      '.oaacaaaaao.', '.oaaaccaaao.', '.oaaaacaaao.', '.oaaccaaaao.', '..oaaaaaao..', '...oooooo...',
    ],
  },
  spareBanner: {
    a: '#ff5d85', b: '#c42a4a', c: '#ffd0dc', map: [
      '..oo........', '..ocoooooo..', '..ocaaaaaao.', '..ocaccaaao.', '..ocaaaaabo.', '..ocabbbbbo.',
      '..ocoooooo..', '..oc........', '..oc........', '..oc........', '.oooo.......', '............',
    ],
  },
};

export const RELIC_ICON_MAPS = ICONS;

const cache = new Map<RelicId, string>();

export function relicIconUrl(id: RelicId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const icon = ICONS[id];
  const palette: Record<string, string> = { o: '#1a1433', a: icon.a, b: icon.b, c: icon.c };
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 12 * scale;
  const ctx = canvas.getContext('2d')!;
  icon.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}
