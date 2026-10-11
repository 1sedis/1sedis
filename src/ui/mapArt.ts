/**
 * Pixel-art landscapes behind the chapter map. The scene is drawn at a quarter
 * of the element's size and scaled up crisply, so the road always meets the
 * real level nodes whatever the screen size.
 */

type Px = string[];

interface Theme {
  ground: [string, string];
  speck: string;
  road: string;
  roadEdge: string;
  roadSpeck: string;
  decor: { sprite: Px; colors: Record<string, string>; weight: number }[];
  density: number;
}

const TREE: Px = [
  '...oo...',
  '..oaao..',
  '.oaaabo.',
  'oaaaabbo',
  'oaaabbbo',
  '.oobbbo.',
  '...tt...',
  '...tt...',
];
const PINE: Px = [
  '...o....',
  '..oao...',
  '..oabo..',
  '.oaabo..',
  '.oaabbo.',
  'oaaabbbo',
  'ooooooo.',
  '...tt...',
];
const BUSH: Px = [
  '........',
  '........',
  '........',
  '..oooo..',
  '.oaaabo.',
  'oaaaabbo',
  'oobbbboo',
  '........',
];
const FLOWER: Px = [
  '........',
  '........',
  '........',
  '........',
  '.p...p..',
  'pyp.pyp.',
  '.a...a..',
  '.a...a..',
];
const ROCK: Px = [
  '........',
  '........',
  '........',
  '..ooo...',
  '.ohaao..',
  'ohaaabo.',
  'oaabbbo.',
  '.ooooo..',
];
const POND: Px = [
  '........',
  '........',
  '..oooo..',
  '.owwwwo.',
  'owhwwwwo',
  'owwwwwwo',
  '.oowwoo.',
  '...oo...',
];
const MUSHROOM: Px = [
  '........',
  '........',
  '........',
  '........',
  '..ooo...',
  '.orhro..',
  '..oto...',
  '..oto...',
];
const WALL: Px = [
  '........',
  'o.o.o.o.',
  'oaoaoao.',
  'oaaaaao.',
  'oabaaao.',
  'oaaabao.',
  'oaaaaao.',
  'ooooooo.',
];
const TOWER: Px = [
  'o.o.o...',
  'oaoao...',
  'oaaao...',
  '.oao....',
  '.oao....',
  '.oho....',
  '.oao....',
  'ooooo...',
];
const PILLAR: Px = [
  'oooooo..',
  '.ohao...',
  '.ohao...',
  '.ohao...',
  '.ohao...',
  '.ohao...',
  'oooooo..',
  '........',
];
const TORCH: Px = [
  '..y.....',
  '.yry....',
  '.ryr....',
  '..o.....',
  '..t.....',
  '..t.....',
  '.ooo....',
  '........',
];
const BANNER: Px = [
  'oooo....',
  'orro....',
  'oryo....',
  'orro....',
  'or.o....',
  'o..o....',
  'o.......',
  'o.......',
];

const THEMES: Record<number, Theme> = {
  1: {
    ground: ['#4f7d3a', '#568641'], speck: '#6a9a4c', road: '#b9925a', roadEdge: '#8c6a3c', roadSpeck: '#cfa96d', density: 0.008,
    decor: [
      { sprite: TREE, colors: { o: '#1f3a1c', a: '#5fae4a', b: '#3d8034', t: '#6b4426' }, weight: 3 },
      { sprite: BUSH, colors: { o: '#1f3a1c', a: '#6cbc52', b: '#438a37' }, weight: 3 },
      { sprite: FLOWER, colors: { p: '#ffe8f0', y: '#ffcf4a', a: '#3d8034' }, weight: 4 },
      { sprite: ROCK, colors: { o: '#2a2a33', h: '#c9c4d6', a: '#9a95aa', b: '#6e6a80' }, weight: 1 },
    ],
  },
  2: {
    ground: ['#2c5236', '#30593b'], speck: '#3b6b45', road: '#7d5c3a', roadEdge: '#5a3f26', roadSpeck: '#94704a', density: 0.013,
    decor: [
      { sprite: PINE, colors: { o: '#0f2418', a: '#3f9a5a', b: '#26703f', t: '#5a3a22' }, weight: 6 },
      { sprite: TREE, colors: { o: '#0f2418', a: '#4aa860', b: '#2c7a44', t: '#5a3a22' }, weight: 2 },
      { sprite: POND, colors: { o: '#16324a', w: '#2f6fb0', h: '#9fd6ff' }, weight: 1 },
      { sprite: MUSHROOM, colors: { o: '#2a1420', r: '#e0424f', h: '#ffd9d9', t: '#e8dcc8' }, weight: 2 },
    ],
  },
  3: {
    ground: ['#464b62', '#4d526b'], speck: '#5a6080', road: '#9592ad', roadEdge: '#6c6a85', roadSpeck: '#b0adc6', density: 0.006,
    decor: [
      { sprite: ROCK, colors: { o: '#1a1a26', h: '#d0cde0', a: '#9a96b0', b: '#6c6886' }, weight: 4 },
      { sprite: WALL, colors: { o: '#1a1a26', a: '#7f7c99', b: '#5e5b78' }, weight: 2 },
      { sprite: TOWER, colors: { o: '#1a1a26', a: '#8a87a6', h: '#ffcf4a' }, weight: 2 },
      { sprite: BUSH, colors: { o: '#1a2a20', a: '#5a8a5a', b: '#3d6640' }, weight: 1 },
    ],
  },
  4: {
    ground: ['#46213a', '#4d2540'], speck: '#5a2c4a', road: '#b3263f', roadEdge: '#ffcf4a', roadSpeck: '#c93a52', density: 0.006,
    decor: [
      { sprite: PILLAR, colors: { o: '#1e0d18', h: '#e8d8e8', a: '#a890a8' }, weight: 3 },
      { sprite: TORCH, colors: { y: '#ffcf4a', r: '#ff7a2f', o: '#2a1a10', t: '#6b4426' }, weight: 3 },
      { sprite: BANNER, colors: { o: '#2a1420', r: '#9b1d3a', y: '#ffcf4a' }, weight: 2 },
    ],
  },
};

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from point to segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const SCALE = 4;

/**
 * Draw the chapter scene into `canvas`, sized to cover `width`×`height` CSS
 * pixels. `nodes` are node centres in CSS pixels, in path order.
 */
export function drawChapterScene(canvas: HTMLCanvasElement, chapter: number, width: number, height: number, nodes: [number, number][]): void {
  const theme = THEMES[chapter] ?? THEMES[1];
  const W = Math.max(1, Math.ceil(width / SCALE));
  const H = Math.max(1, Math.ceil(height / SCALE));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(chapter * 7919 + 13);
  // Ground: two tones in big soft checks plus specks.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = ((x >> 3) + (y >> 3)) % 2 ? theme.ground[0] : theme.ground[1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = theme.speck;
  for (let i = 0; i < W * H * 0.03; i++) ctx.fillRect(Math.floor(rand() * W), Math.floor(rand() * H), 1, 1);

  // Road between consecutive nodes.
  const pts = nodes.map(([x, y]) => [Math.round(x / SCALE), Math.round(y / SCALE)] as [number, number]);
  const half = 4;
  const segs: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([...pts[i], ...pts[i + 1]]);
  const onRoad = (x: number, y: number, r: number) => segs.some(([ax, ay, bx, by]) => segDist(x, y, ax, ay, bx, by) <= r);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (onRoad(x, y, half)) ctx.fillStyle = theme.road;
      else if (onRoad(x, y, half + 1)) ctx.fillStyle = theme.roadEdge;
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = theme.roadSpeck;
  for (let i = 0; i < W * H * 0.05; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    if (onRoad(x, y, half - 1)) ctx.fillRect(x, y, 1, 1);
  }

  // Decorations, away from the road and the nodes.
  const total = theme.decor.reduce((n, d) => n + d.weight, 0);
  const count = Math.round(W * H * theme.density);
  const placed: [number, number][] = [];
  for (let i = 0; i < count * 4 && placed.length < count; i++) {
    const x = Math.floor(rand() * (W - 8));
    const y = Math.floor(rand() * (H - 8));
    const cx = x + 4;
    const cy = y + 4;
    if (onRoad(cx, cy, half + 6)) continue;
    if (pts.some(([nx, ny]) => Math.abs(nx - cx) < 16 && Math.abs(ny - cy) < 18)) continue;
    if (placed.some(([px, py]) => Math.abs(px - x) < 8 && Math.abs(py - y) < 8)) continue;
    let pick = rand() * total;
    const d = theme.decor.find((it) => (pick -= it.weight) < 0) ?? theme.decor[0];
    d.sprite.forEach((row, sy) => [...row].forEach((ch, sx) => {
      const c = d.colors[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x + sx, y + sy, 1, 1);
    }));
    placed.push([x, y]);
  }
}
