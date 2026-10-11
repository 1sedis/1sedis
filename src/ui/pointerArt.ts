/** A small pixel glove pointing up, the finger that shows the player where to tap. */
const POINTER = [
  '....oo......',
  '...owwo.....',
  '...owwo.....',
  '...owwo.....',
  '...owwoooo..',
  '...owwowwoo.',
  '.ooowwowwowo',
  'owwowwwwwwwo',
  'owwwwwwwwwwo',
  '.owwwwwwwwwo',
  '.owwwgwwwwo.',
  '..owwwwwwwo.',
  '..owwwwwwo..',
  '...oggggo...',
  '...oooooo...',
];

const PALETTE: Record<string, string> = { o: '#120a24', w: '#fff6e0', g: '#ffcf4a' };

let cached = '';

export function pointerUrl(): string {
  if (cached) return cached;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 12 * scale;
  canvas.height = POINTER.length * scale;
  const ctx = canvas.getContext('2d')!;
  POINTER.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!PALETTE[ch]) return;
    ctx.fillStyle = PALETTE[ch];
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  cached = canvas.toDataURL();
  return cached;
}
