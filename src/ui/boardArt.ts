import { seeded } from '../game/formations';

/**
 * Pixel textures for the board's squares, one material per chapter:
 * 1 meadow grass, 2 forest moss, 3 mountain stone, 4 castle flagstones, 5 the void of the finale.
 * Each square picks one of a few variants so the board never tiles visibly.
 */
const TILE = 16;
export const CELL_VARIANTS = 4;

interface Material {
  light: string;
  dark: string;
  /** Speck colours drawn over the base, lighter and darker. */
  hi: string;
  lo: string;
  /** Rare accent pixels: flowers, mushrooms, gems. */
  accent: string[];
  style: 'grass' | 'moss' | 'stone' | 'flag' | 'void';
}

const MATERIALS: Record<number, Material> = {
  0: { light: '#393071', dark: '#2b235c', hi: '#463c86', lo: '#221b4b', accent: ['#9b6bff'], style: 'flag' },
  1: { light: '#6f8f4e', dark: '#5a7740', hi: '#86a65d', lo: '#4b6535', accent: ['#ffe27a', '#fff1dc', '#ff9ec0'], style: 'grass' },
  2: { light: '#2f6152', dark: '#22483d', hi: '#3c7563', lo: '#1a3a31', accent: ['#c9733a', '#e8b04a', '#ff6b6b'], style: 'moss' },
  3: { light: '#5d6886', dark: '#48516d', hi: '#717d9e', lo: '#393f57', accent: ['#9fb4ff'], style: 'stone' },
  4: { light: '#7d3b59', dark: '#622d46', hi: '#93496b', lo: '#4c2136', accent: ['#ffcf4a'], style: 'flag' },
  5: { light: '#2a2150', dark: '#1d1640', hi: '#382c68', lo: '#140f2e', accent: ['#c77dff', '#3ee6c1'], style: 'void' },
};

const cache = new Map<string, string>();

function paint(m: Material, dark: boolean, variant: number, chapter: number): string {
  const canvas = document.createElement('canvas');
  const scale = 4;
  canvas.width = TILE * scale;
  canvas.height = TILE * scale;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); };
  const rand = seeded(`${chapter}:${dark ? 'd' : 'l'}:${variant}`);
  ctx.fillStyle = dark ? m.dark : m.light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const hi = m.hi;
  const lo = m.lo;
  const r = (n: number) => Math.floor(rand() * n);

  if (m.style === 'grass' || m.style === 'moss') {
    // Short blades: a dark root pixel with a light tip above it.
    const blades = m.style === 'grass' ? 9 : 6;
    for (let i = 0; i < blades; i++) {
      const x = r(TILE);
      const y = 2 + r(TILE - 3);
      px(x, y, lo);
      px(x, y - 1, dark ? lo : hi);
      if (m.style === 'grass' && rand() < 0.5) px(x + 1, y - 1, hi);
    }
    // Moss: soft clumps of a lighter tone.
    if (m.style === 'moss') for (let i = 0; i < 3; i++) {
      const x = r(TILE - 2);
      const y = r(TILE - 2);
      px(x, y, hi); px(x + 1, y, hi); px(x, y + 1, hi);
    }
    // Now and then a flower, a fallen leaf or a mushroom.
    if (rand() < (dark ? 0.25 : 0.55)) px(1 + r(TILE - 2), 1 + r(TILE - 2), m.accent[r(m.accent.length)]);
  } else if (m.style === 'stone' || m.style === 'flag') {
    // Bevelled slab: light top-left edge, dark bottom-right edge.
    for (let i = 0; i < TILE; i++) { px(i, 0, hi); px(0, i, hi); px(i, TILE - 1, lo); px(TILE - 1, i, lo); }
    if (m.style === 'flag') {
      // Polished slab: a soft vein of light running corner to corner.
      let x = 1 + r(4);
      let y = 1 + r(3);
      const dx = rand() < 0.5 ? 1 : -1;
      if (dx < 0) x = TILE - 2 - r(4);
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 9; i++) {
        if (x < 1 || x > TILE - 2 || y > TILE - 2) break;
        px(x, y, hi);
        if (rand() < 0.7) x += dx;
        if (rand() < 0.7) y += 1;
      }
      ctx.globalAlpha = 1;
    } else {
      // A short crack wandering across the stone, either way.
      let x = 3 + r(TILE - 6);
      let y = 2 + r(4);
      const dx = rand() < 0.5 ? 1 : -1;
      for (let i = 0; i < 4 + r(4); i++) {
        px(x, y, lo);
        if (rand() < 0.5) x += dx; else y += 1;
        if (x < 1 || x > TILE - 2 || y > TILE - 2) break;
      }
      // Pebbles with a lit top.
      for (let i = 0; i < 2; i++) { const px0 = 2 + r(TILE - 4); const py0 = 3 + r(TILE - 5); px(px0, py0, lo); px(px0, py0 - 1, hi); }
    }
    for (let i = 0; i < 5; i++) px(1 + r(TILE - 2), 1 + r(TILE - 2), rand() < 0.5 ? hi : lo);
    if (variant === 0) px(2 + r(TILE - 4), 2 + r(TILE - 4), m.accent[0]);
  } else {
    // The void: a few faint stars.
    for (let i = 0; i < 4; i++) px(r(TILE), r(TILE), hi);
    if (rand() < 0.4) px(r(TILE), r(TILE), m.accent[r(m.accent.length)]);
  }
  return canvas.toDataURL();
}

/** A data-URL texture for a square of the chapter's board. */
export function cellTextureUrl(chapter: number, dark: boolean, variant: number): string {
  const m = MATERIALS[chapter] ?? MATERIALS[0];
  const key = `${chapter}:${dark}:${variant % CELL_VARIANTS}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = paint(m, dark, variant % CELL_VARIANTS, chapter in MATERIALS ? chapter : 0);
  cache.set(key, url);
  return url;
}

/** Which variant a square uses: fixed per square so the board stays put between battles. */
export function cellVariant(x: number, y: number): number {
  return (x * 7 + y * 13 + ((x * y) % 3)) % CELL_VARIANTS;
}

/**
 * A wide pixel landscape behind the arena, tiling sideways: meadows, pine forest,
 * mountains, the castle; the void for anything else. Two layers, far and near.
 */
const SCENES: Record<number, { far: string; near: string; detail: string; light: string }> = {
  0: { far: '#221b45', near: '#17122f', detail: '#9b6bff', light: '#c9b8ff' },
  1: { far: '#2c3d2a', near: '#1e2b1d', detail: '#5d7a3e', light: '#ffe27a' },
  2: { far: '#173229', near: '#0f231c', detail: '#2f6152', light: '#7fe08f' },
  3: { far: '#2c3247', near: '#1d2132', detail: '#d8dcf0', light: '#9fb4ff' },
  4: { far: '#3a1a2c', near: '#26101d', detail: '#622d46', light: '#ffcf4a' },
  5: { far: '#1d1640', near: '#120d2a', detail: '#c77dff', light: '#3ee6c1' },
};
const SCENE_W = 192;
const SCENE_H = 64;
const sceneCache = new Map<number, string>();

export function backdropUrl(chapter: number): string {
  const hit = sceneCache.get(chapter);
  if (hit) return hit;
  const c = SCENES[chapter] ?? SCENES[0];
  const canvas = document.createElement('canvas');
  const scale = 4;
  canvas.width = SCENE_W * scale;
  canvas.height = SCENE_H * scale;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(((x % SCENE_W) + SCENE_W) % SCENE_W * scale, y * scale, scale, scale); };
  const column = (x: number, top: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x * scale, top * scale, scale, (SCENE_H - top) * scale); };
  const rand = seeded(`scene:${chapter}`);
  const wave = (x: number, periods: number[], amps: number[]) =>
    periods.reduce((sum, p, i) => sum + Math.sin((x / SCENE_W) * Math.PI * 2 * p + i) * amps[i], 0);
  // Tile-safe random positions: features near the right edge wrap through px().
  const spots = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * SCENE_W));

  if (chapter === 3) {
    // Jagged peaks with snow, then a rocky ridge.
    const peaks = spots(7);
    for (let x = 0; x < SCENE_W; x++) {
      let top = 40;
      for (const p of peaks) {
        const d = Math.min(Math.abs(x - p), SCENE_W - Math.abs(x - p));
        top = Math.min(top, 10 + d * 1.1 + (p % 7));
      }
      column(x, Math.round(top), c.far);
      if (top < 26) for (let y = Math.round(top); y < Math.round(top) + 3; y++) px(x, y, c.detail);
    }
    for (let x = 0; x < SCENE_W; x++) column(x, Math.round(48 + wave(x, [3, 7], [3, 1.5])), c.near);
  } else if (chapter === 4) {
    // Castle towers with lit windows and pennants.
    for (let x = 0; x < SCENE_W; x++) column(x, Math.round(44 + wave(x, [2, 5], [2, 1])), c.near);
    for (const at of spots(6)) {
      const w = 10 + Math.floor(rand() * 8);
      const top = 14 + Math.floor(rand() * 16);
      for (let x = at; x < at + w; x++) {
        ctx.fillStyle = c.far;
        ctx.fillRect(((x % SCENE_W) + SCENE_W) % SCENE_W * scale, top * scale, scale, (SCENE_H - top) * scale);
      }
      for (let x = at - 1; x < at + w + 1; x += 2) { px(x, top - 1, c.far); px(x, top - 2, c.far); }
      for (let y = top + 4; y < SCENE_H - 18; y += 7) px(at + Math.floor(w / 2), y, c.light);
      px(at + 1, top - 5, c.far); px(at + 1, top - 4, c.far); px(at + 1, top - 3, c.far);
      px(at + 2, top - 5, c.detail); px(at + 3, top - 5, c.detail); px(at + 2, top - 4, c.detail);
    }
  } else if (chapter === 2) {
    // Two rows of pines.
    const pine = (x0: number, base: number, h: number, col: string) => {
      for (let y = 0; y < h; y++) {
        const half = Math.floor((y * 0.55) + 1);
        for (let dx = -half; dx <= half; dx++) px(x0 + dx, base - h + y, col);
      }
    };
    for (let x = 0; x < SCENE_W; x++) column(x, 46, c.far);
    for (const at of spots(26)) pine(at, 48, 14 + Math.floor(rand() * 12), c.far);
    for (let x = 0; x < SCENE_W; x++) column(x, 56, c.near);
    for (const at of spots(16)) pine(at, 58, 18 + Math.floor(rand() * 14), c.near);
  } else if (chapter === 1) {
    // Rolling hills, a few round trees and a fence.
    for (let x = 0; x < SCENE_W; x++) column(x, Math.round(34 + wave(x, [2, 5], [6, 2])), c.far);
    for (const at of spots(9)) {
      const base = Math.round(34 + wave(at, [2, 5], [6, 2]));
      for (let dy = -6; dy <= 0; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + (dy + 3) * (dy + 3) <= 10) px(at + dx, base - 3 + dy, c.far);
    }
    for (let x = 0; x < SCENE_W; x++) column(x, Math.round(50 + wave(x, [3, 4], [3, 1])), c.near);
    for (let x = 0; x < SCENE_W; x += 8) {
      const top = Math.round(50 + wave(x, [3, 4], [3, 1]));
      for (let y = top - 5; y < top; y++) px(x, y, c.near);
    }
    for (const at of spots(14)) px(at, Math.round(52 + wave(at, [3, 4], [3, 1])) + 2, c.light);
  } else {
    // The void: floating islands under faint stars.
    for (const at of spots(30)) px(at, Math.floor(rand() * 30), c.light);
    for (let x = 0; x < SCENE_W; x++) column(x, Math.round(48 + wave(x, [2, 6], [5, 2])), c.near);
  }
  const url = canvas.toDataURL();
  sceneCache.set(chapter, url);
  return url;
}
