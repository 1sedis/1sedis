/** Small generated pixel sprites for battle effects: a melee slash and a rising soul. */
type Team = 'ally' | 'enemy';

const COLORS: Record<Team, { edge: string; mid: string }> = {
  ally: { edge: '#3ee6c1', mid: '#a8ffe9' },
  enemy: { edge: '#ff5d85', mid: '#ffc2d1' },
};
const cache = new Map<string, string>();

function draw(w: number, h: number, scale: number, paint: (px: (x: number, y: number, c: string) => void) => void): string {
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  paint((x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); });
  return canvas.toDataURL();
}

/** A crescent swipe opening to the right; the effect rotates it towards the target. */
export function slashUrl(team: Team): string {
  const key = `slash:${team}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { edge, mid } = COLORS[team];
  const url = draw(16, 16, 4, (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5;
        const dy = y - 7.5;
        const r = Math.hypot(dx, dy);
        const a = Math.abs(Math.atan2(dy, dx));
        if (a > 1.25) continue;
        // Thicker in the middle of the arc, thin at the tips.
        const thick = 2.6 * Math.cos(a * 1.1);
        if (r > 9.5 - thick && r <= 9.5) px(x, y, r > 9.5 - thick * 0.45 ? '#ffffff' : r > 9.5 - thick * 0.75 ? mid : edge);
      }
    }
  });
  cache.set(key, url);
  return url;
}

const SOUL = [
  '...a...',
  '..aba..',
  '.abbba.',
  '.abcba.',
  'abcccba',
  'abcccba',
  '.abcba.',
  '..aaa..',
  '...a...',
];

/** A small wisp that leaves a fallen piece. */
export function soulUrl(team: Team): string {
  const key = `soul:${team}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { edge, mid } = COLORS[team === 'ally' ? 'ally' : 'enemy'];
  const pal: Record<string, string> = { a: team === 'ally' ? edge : '#9b6bff', b: team === 'ally' ? mid : '#d4bfff', c: '#ffffff' };
  const url = draw(7, 9, 4, (px) => SOUL.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) px(x, y, pal[ch]); })));
  cache.set(key, url);
  return url;
}
