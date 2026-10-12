/** 8x8 pixel icons that replace system glyphs (★ 🔒 ❤ ⚔ ◎ ◆ ♛ ☠ ✦) in UI text. */
export type IconId = 'coin' | 'star' | 'starEmpty' | 'lock' | 'heart' | 'sword' | 'range' | 'shard' | 'crown' | 'skull' | 'spark'
  | 'fire' | 'bag' | 'question' | 'flag';

const MAPS: Record<IconId, string[]> = {
  coin: ['..oooo..', '.ohhaao.', 'ohaooabo', 'oaaoaabo', 'oaaoaabo', 'oaaooabo', '.oabbbo.', '..oooo..'],
  star: ['...o....', '..oho...', 'oooaaooo', 'ohaaaabo', '.oaaabo.', '.oabobo.', 'oabo.obo', 'ooo...oo'],
  starEmpty: ['...o....', '..o.o...', 'ooo..ooo', 'o......o', '.o....o.', '.o.oo.o.', 'o.o..o.o', 'oo....oo'],
  lock: ['..oooo..', '.o....o.', '.o....o.', 'oooooooo', 'ohaaaabo', 'oaaobaao', 'oaaobabo', 'oooooooo'],
  heart: ['.oo..oo.', 'ohaoohao', 'ohaaaabo', 'oaaaaabo', '.oaaabo.', '..oabo..', '...oo...', '........'],
  sword: ['......oo', '.....oho', '....oho.', 'o..oho..', 'oooho...', '.oao....', 'obooo...', 'oo..o...'],
  range: ['..oooo..', '.oaaaao.', 'oao..oao', 'oa.hh.ao', 'oa.hh.ao', 'oao..oao', '.oaaaao.', '..oooo..'],
  shard: ['...oo...', '..ohao..', '.ohaaao.', 'ohaaaabo', '.oaaabo.', '..oabo..', '...oo...', '........'],
  crown: ['........', 'o..o..o.', 'ohoaoao.', 'ohaaaao.', 'oaaaabo.', 'oaaaabo.', 'oooooooo', '........'],
  skull: ['.oooooo.', 'ohaaaaao', 'oaaaaaao', 'ao.aa.ao', 'oaaooaao', '.oaaaao.', '.oaoaoo.', '..oooo..'],
  spark: ['...o....', '...a....', '..oho...', 'oahhhao.', '..oho...', '...a....', '...o....', '........'],
  fire: ['...o....', '..oho...', '.ohaho..', '.oaaao.o', 'oaabaaoo', 'oabbbao.', '.obbbo..', 'llllllll'],
  bag: ['..ooo...', '...o....', '.ooaoo..', 'ohaaaao.', 'oaacaao.', 'oacccao.', 'oaacabo.', '.oooooo.'],
  question: ['..oooo..', '.ohaaao.', '.oo..ao.', '....oao.', '...oao..', '...oo...', '........', '...ha...'],
  flag: ['oaaaaa..', 'oahaaaa.', 'oaaaaaa.', 'oabbbb..', 'o.......', 'o.......', 'o.......', 'o.......'],
};

const COLORS: Record<IconId, Record<string, string>> = {
  coin: { o: '#6b4709', h: '#fff4c2', a: '#ffcf4a', b: '#e0a020' },
  star: { o: '#6b4709', h: '#fff4c2', a: '#ffcf4a', b: '#e0a020' },
  starEmpty: { o: '#6e6699' },
  lock: { o: '#1a1433', h: '#fff1b8', a: '#e0b040', b: '#a87a1c' },
  heart: { o: '#4a0f22', h: '#ffc2d0', a: '#ff4d6d', b: '#c42a4a' },
  sword: { o: '#1a1433', h: '#eef2ff', a: '#9aa6c8', b: '#a8743a' },
  range: { o: '#1a1433', h: '#ff4d6d', a: '#cfd6ff' },
  shard: { o: '#2a1660', h: '#f0e2ff', a: '#b78cff', b: '#7a4fe0' },
  crown: { o: '#6b4709', h: '#fff4c2', a: '#ffcf4a', b: '#e0a020' },
  skull: { o: '#1a1433', h: '#ffffff', a: '#e8e2f2' },
  spark: { o: '#c98f12', a: '#ffcf4a', h: '#fff8dc' },
  fire: { o: '#5a1a08', h: '#fff4c2', a: '#ff9a2e', b: '#ff4f1d', l: '#7a4a22' },
  bag: { o: '#3a2208', h: '#f2d29a', a: '#c48a3c', b: '#8a5a20', c: '#ffcf4a' },
  question: { o: '#3a2a7a', h: '#ffffff', a: '#c9b8ff' },
  flag: { o: '#d8d0ef', a: '#ff5d85', h: '#ffffff', b: '#c42a4a' },
};

const GLYPHS: Record<string, IconId> = {
  '★': 'star', '☆': 'starEmpty', '🔒': 'lock', '❤': 'heart', '⚔': 'sword', '◎': 'range', '◆': 'shard', '♛': 'crown', '☠': 'skull', '✦': 'spark',
};
const GLYPH_RE = /(★|☆|🔒|❤|⚔|◎|◆|♛|☠|✦)/u;
const SPLIT_RE = /(★|☆|🔒|❤|⚔|◎|◆|♛|☠|✦)/gu;

const cache = new Map<IconId, string>();

export function iconUrl(id: IconId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8 * scale;
  const ctx = canvas.getContext('2d')!;
  MAPS[id].forEach((row, y) => [...row].forEach((ch, x) => {
    const c = COLORS[id][ch];
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}

export function hasGlyphs(text: string): boolean {
  return GLYPH_RE.test(text);
}

/** Fill a node with text where glyphs become pixel icons. */
export function renderRich(node: HTMLElement, text: string): void {
  const parts = text.split(SPLIT_RE);
  node.replaceChildren(...parts.filter((p) => p !== '').map((p) => {
    const id = GLYPHS[p];
    if (!id) return document.createTextNode(p);
    const img = document.createElement('img');
    img.className = 'icon';
    img.src = iconUrl(id);
    img.alt = p;
    return img;
  }));
}

/** CSS variables for icons used from stylesheets (pseudo-elements). */
export function installIconVars(): void {
  const root = document.documentElement.style;
  root.setProperty('--icon-crown', `url(${iconUrl('crown')})`);
  root.setProperty('--icon-star', `url(${iconUrl('star')})`);
  root.setProperty('--icon-coin', `url(${iconUrl('coin')})`);
}
