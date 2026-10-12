import type { BossId } from '../game/bosses';

/**
 * Giant pixel portraits of the campaign bosses. Each is painted from simple
 * shapes in "materials"; a shading pass lights every material from the upper
 * left and an outline pass draws the dark contour, so all four share one look.
 */
type Material = 'body' | 'steel' | 'gold' | 'red' | 'stone' | 'wood' | 'glow' | 'dark' | 'pale' | 'cape';

const TONES: Record<Material, [string, string, string]> = {
  // light, mid, dark
  body: ['#7a4fa0', '#4a2b66', '#2c1640'],
  steel: ['#e4e8f4', '#9aa3be', '#5b6282'],
  gold: ['#fff1a8', '#ffcf4a', '#b8861e'],
  red: ['#ff8aa6', '#ff4f7b', '#a8203f'],
  stone: ['#8e86a6', '#5f587a', '#3b3552'],
  wood: ['#b07a46', '#7a4f2a', '#4e3018'],
  glow: ['#fff2f5', '#ff2d55', '#ff2d55'],
  dark: ['#3a2a4a', '#221630', '#140c1e'],
  pale: ['#d8c8ec', '#a890c4', '#6e5a8a'],
  cape: ['#c23a5c', '#8a1f3d', '#561028'],
};

const OUTLINE = '#0c0614';

class Painter {
  readonly grid: (Material | null)[];
  constructor(readonly w: number, readonly h: number) {
    this.grid = new Array(w * h).fill(null);
  }
  dot(x: number, y: number, m: Material): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.grid[y * this.w + x] = m;
  }
  rect(x0: number, y0: number, x1: number, y1: number, m: Material): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.dot(x, y, m);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.dot(x, y, m);
      }
    }
  }
  poly(points: [number, number][], m: Material): void {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.dot(x, y, m);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, m: Material, width = 1): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      for (let d = 0; d < width; d++) this.dot(x + (d % 2), y + Math.floor(d / 2), m);
    }
  }
  /** Shade by neighbours (light from the upper left), outline, and paint at `scale`. */
  render(scale: number): string {
    const { w, h, grid } = this;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : grid[y * w + x]);
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = at(x, y);
        let color: string | null = null;
        if (m) {
          const [light, mid, dark] = TONES[m];
          const lit = at(x - 1, y) !== m || at(x, y - 1) !== m;
          const shade = at(x + 1, y) !== m || at(x, y + 1) !== m || at(x + 1, y + 1) !== m;
          color = m === 'glow' ? mid : lit && !shade ? light : shade && !lit ? dark : mid;
        } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) {
          color = OUTLINE;
        }
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return canvas.toDataURL();
  }
}

export const BOSS_ART_SIZE = { w: 38, h: 46 };

function captain(p: Painter): void {
  // Banner of the Black King on a long pole.
  p.rect(5, 3, 6, 43, 'wood');
  p.poly([[7, 4], [19, 4], [16, 9.5], [19, 15], [7, 15]], 'red');
  p.rect(7, 8, 15, 9, 'cape');
  p.ellipse(11, 9, 1.6, 1.6, 'gold');
  p.ellipse(6, 2.5, 1.5, 1.5, 'gold');
  // Base and bell-shaped armoured body.
  p.ellipse(20, 42, 13, 3, 'body');
  p.rect(10, 38, 30, 41, 'body');
  p.poly([[14, 22], [26, 22], [30, 38], [10, 38]], 'body');
  p.rect(13, 27, 27, 28, 'gold');
  p.line(20, 23, 20, 37, 'dark');
  p.rect(15, 20, 25, 22, 'gold');
  // Helmet with a glowing visor and a red plume.
  p.ellipse(20, 14, 6.5, 6, 'steel');
  p.rect(15, 14, 25, 15, 'glow');
  p.rect(19, 8, 21, 20, 'steel');
  p.poly([[19, 2], [26, 4], [24, 8], [19, 8]], 'red');
  // Round shield with a gold rim.
  p.ellipse(31, 30, 6, 6.5, 'gold');
  p.ellipse(31, 30, 4.6, 5.1, 'cape');
  p.rect(30, 26, 32, 34, 'gold');
  p.rect(27, 29, 35, 31, 'gold');
}

function rider(p: Painter): void {
  p.ellipse(19, 43, 13, 2.5, 'dark');
  // Tail and hind legs, braced for the rear.
  p.poly([[7, 24], [2, 33], [5, 36], [9, 29]], 'red');
  p.line(9, 31, 8, 41, 'body', 3);
  p.line(14, 32, 15, 41, 'body', 3);
  p.rect(7, 41, 10, 42, 'steel');
  p.rect(14, 41, 17, 42, 'steel');
  // Barrel, a thick neck and a long head with an ear, a mane and a burning eye.
  p.ellipse(17, 28, 11, 6.5, 'body');
  p.poly([[21, 25], [24, 13], [31, 11], [31, 26]], 'body');
  p.poly([[25, 9], [33, 10], [37, 15], [35, 18], [28, 16]], 'body');
  p.poly([[27, 8], [28, 4], [30, 9]], 'body');
  p.dot(31, 12, 'glow');
  p.dot(32, 12, 'glow');
  p.dot(35, 16, 'dark');
  p.poly([[24, 10], [20, 15], [21, 23], [25, 15]], 'red');
  // Front legs pawing the air.
  p.line(25, 31, 31, 24, 'body', 3);
  p.line(21, 32, 27, 27, 'body', 3);
  p.rect(31, 22, 33, 24, 'steel');
  p.rect(27, 25, 29, 27, 'steel');
  // Rider: cape, armour, helmet with a slit and a plume.
  p.poly([[14, 13], [8, 27], [15, 25], [17, 15]], 'cape');
  p.rect(14, 13, 20, 22, 'steel');
  p.rect(14, 17, 20, 18, 'gold');
  p.ellipse(17, 9.5, 3.5, 3.5, 'steel');
  p.rect(15, 9, 19, 9, 'glow');
  p.poly([[17, 3], [21, 4], [19, 7]], 'red');
  // The lance, held forward and up, with a pennant.
  p.line(19, 20, 36, 3, 'wood', 2);
  p.poly([[34, 3], [38, 1], [37, 6]], 'red');
  p.rect(18, 18, 21, 20, 'steel');
}

function fortress(p: Painter): void {
  p.ellipse(19, 43, 15, 2.5, 'dark');
  // Flag on the roof.
  p.rect(19, 0, 19, 7, 'wood');
  p.poly([[20, 0], [27, 1.5], [20, 4]], 'red');
  // Battlements.
  p.rect(5, 9, 33, 13, 'stone');
  for (const x of [5, 12, 19, 26]) p.rect(x, 5, x + 4, 9, 'stone');
  p.rect(31, 5, 33, 9, 'stone');
  // The tower body with brick lines.
  p.rect(8, 13, 30, 42, 'stone');
  for (let y = 17; y < 42; y += 5) p.line(8, y, 30, y, 'dark');
  for (let y = 13; y < 42; y += 5) for (let x = 11 + ((y / 5) % 2) * 4; x < 30; x += 8) p.line(x, y, x, y + 4, 'dark');
  // Glowing arrow slits and the great eye-window.
  p.rect(12, 17, 13, 21, 'glow');
  p.rect(25, 17, 26, 21, 'glow');
  p.ellipse(19, 23, 3, 2.5, 'dark');
  p.ellipse(19, 23, 1.6, 1.6, 'glow');
  // Gate.
  p.rect(15, 33, 23, 42, 'dark');
  p.ellipse(19, 33, 4, 3, 'dark');
  p.line(16, 34, 16, 42, 'wood');
  p.line(19, 31, 19, 42, 'wood');
  p.line(22, 34, 22, 42, 'wood');
  // Cannons on both flanks.
  p.rect(1, 25, 8, 28, 'steel');
  p.rect(0, 24, 2, 29, 'dark');
  p.rect(30, 25, 37, 28, 'steel');
  p.rect(36, 24, 37, 29, 'dark');
}

function queen(p: Painter): void {
  // Cloak spread behind her.
  p.poly([[10, 15], [28, 15], [36, 44], [2, 44]], 'cape');
  // Gown with a red hem.
  p.poly([[13, 18], [25, 18], [31, 43], [7, 43]], 'body');
  p.rect(8, 41, 30, 43, 'red');
  p.line(19, 20, 19, 40, 'dark');
  p.rect(14, 24, 24, 25, 'gold');
  // Torso, arms raised to call the dark.
  p.rect(15, 12, 23, 19, 'body');
  p.line(15, 14, 11, 11, 'body', 2);
  p.line(23, 14, 27, 11, 'body', 2);
  p.dot(10, 10, 'pale');
  p.dot(28, 10, 'pale');
  // Face with burning eyes and a tall crown.
  p.ellipse(19, 9, 3.5, 3.8, 'pale');
  p.dot(17, 9, 'glow');
  p.dot(21, 9, 'glow');
  p.poly([[14, 6], [15, 1], [17, 4], [19, 0], [21, 4], [23, 1], [24, 6]], 'gold');
  p.dot(19, 3, 'glow');
  // Dark orbs floating over her hands, with sparks.
  p.ellipse(7, 6, 2.8, 2.8, 'glow');
  p.ellipse(31, 6, 2.8, 2.8, 'glow');
  for (const [x, y] of [[3, 3], [11, 2], [4, 10], [35, 3], [27, 2], [34, 10]]) p.dot(x, y, 'gold');
}

const PAINT: Partial<Record<BossId, (p: Painter) => void>> = { captain, rider, fortress, queen };

const cache = new Map<BossId, string>();

/** Has this boss a giant portrait? */
export function hasBossArt(id: BossId | undefined): id is 'captain' | 'rider' | 'fortress' | 'queen' {
  return !!id && id in PAINT;
}

export function bossArtUrl(id: BossId): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = new Painter(BOSS_ART_SIZE.w, BOSS_ART_SIZE.h);
  PAINT[id]!(p);
  const url = p.render(4);
  cache.set(id, url);
  return url;
}
