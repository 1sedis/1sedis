/** The Hand over the board: a 24×30 pixel hand reaching down, fingers first. */
const HAND = [
  '.......ooooooooooo......',
  '.......ossstssstso......',
  '.......osstssstsso......',
  '.......ostssstssso......',
  '.......ossssssssso......',
  '........ohaaaaabo.......',
  '........ohaaaaabo.......',
  '........ohaaaaabo.......',
  '.....ooohaaaaaaabooo....',
  '.....ohaaaaaaaacaabo....',
  '...oohaaacaaaaaacaaboo..',
  '.oohaaaaaacaaaaacaaabo..',
  '.ohaaaaaaacaaaaaaaaabo..',
  '.ohaaaaaaaacaaaaaaaabo..',
  '.ohaaaaaaaaaaaaaaaaabo..',
  'ohaaaaaaaaaaaaaaaaaabo..',
  'ohaabbbohbbbohbbbohbbo..',
  'ohaaabo.ohao.ohao.ohao..',
  'ohaaabo.ohao.ohao.ohao..',
  '.oohabo.ohao.ohao.ohao..',
  '...ohao.ohco.ohao.ohao..',
  '...ohao.ohco.ohao.ohao..',
  '...ohao.ohao.ohco.ohao..',
  '....oo..ohao.ohao.ohao..',
  '........ohao.ohco.ohao..',
  '........ohao.ohao..oo...',
  '........ohao.ohao.......',
  '.........oo..ohao.......',
  '..............oo........',
  '........................',
];

const PALETTE: Record<string, string> = {
  o: '#120a24', s: '#2a1846', t: '#ff5d85', h: '#ffffff', a: '#e6dcff', b: '#a996e0', c: '#c77dff',
};

let cached = '';

export function handUrl(): string {
  if (cached) return cached;
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = 24 * scale;
  canvas.height = HAND.length * scale;
  const ctx = canvas.getContext('2d')!;
  HAND.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  cached = canvas.toDataURL();
  return cached;
}
