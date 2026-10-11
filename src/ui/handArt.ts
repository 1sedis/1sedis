/**
 * The Hand over the board: an obsidian hand with clawed fingers, glowing veins
 * and an eye on its back, a crown for a bracelet; the forearm fades into smoke.
 */
const HAND = [
  '................S.S.S.S.S...............',
  '...............S...S...S................',
  '................j.S.S.S.S...............',
  '...............S.S.S.S.S.S..............',
  '...............Sj.SSS.SSS...............',
  '...............S.S.S.S.S.S..............',
  '...............SjSSSSSSSSS..............',
  '...............oRsssssssSo..............',
  '...............oRsssssssSo..............',
  '..............oRsGssGssGsRo.............',
  '..............oRsgssissgsSo.............',
  '..............ogggggVgggggo.............',
  '..............oGggGggGggGgo.............',
  '..............oRssssvssssSo.............',
  '..............oRsssssssssSo.............',
  '............ooRsssooooosssRoo...........',
  '...........ovRsssowwwwwosssRvo..........',
  '.........ooRssvowwiipwiwwovssRo.........',
  '........oRRsssowwwippiiwwwosssRo........',
  '......ooRsssssowwwiippiwwwosssSo........',
  '....ooRRsssssssowwiipiiwwossssSo........',
  '...oRRjjSsVsssvssowwwwwossssssSo........',
  '...oRjjSoRssssssssooooossvssssSo........',
  '...oRjSo.oRbbssvssssssssssssVbbo........',
  '...oRSo..oRssSsssssvssvssssSssSo........',
  '...oRo...oRsSoRssbbssssbbsSoRsSo........',
  '..oRSo..oRsSo.oRssssSssssSo.oRsRo.......',
  '..oRSo..oRsSo..oRvsSoRssvo..oRsSo.......',
  '..oRo...oRsSo..oRsSo.oRsSo..oRjSo.......',
  '..occ...oRjSo..oRsSo.oRsSo...oRbRo......',
  '...cc..oRbSo...oVSo...oRVo...oRjSo......',
  '..c....oRjSo..oRsSo...oRsRo..oRjSo......',
  '..c....oRjSo..oRjSo...oRjSo...oRSo......',
  '.......oRSo...oRbSo...oRbSo...oRsRo.....',
  '.......oRSo...oRjSo...oRjSo....oRSo.....',
  '.......oRSo...oRjSo...oRjSo....oRSo.....',
  '.......oRSo...oRSo.....oRSo....oRcco....',
  '.......oRSo...oRSo.....oRSo.....occ.....',
  '......oRcco...oRSo.....oRSo......oc.....',
  '.......occ....oRSo.....oRSo.......c.....',
  '........c.....oRSo.....oRSo.......c.....',
  '........c....oRcco.....oRcco............',
  '.......c......occ.......occ.............',
  '...............c.........c..............',
  '...............c.........c..............',
  '..............c...........c.............',
];

const PALETTE: Record<string, string> = {
  // outline, skin, its shade and purple rim light, joints, bone knuckles, claws
  o: '#05030a', s: '#3a2a57', S: '#24183a', R: '#9d7cff', j: '#4a3870', b: '#e6dcff', c: '#f2e9ff',
  // glowing veins, the crown bracelet, the eye
  v: '#ff2e88', V: '#ff8de0', g: '#c98f12', G: '#ffe08a', w: '#fff3e6', i: '#ff2448', p: '#0a0006',
};

let cached = '';

export function handUrl(): string {
  if (cached) return cached;
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = 40 * scale;
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
