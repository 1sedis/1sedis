/**
 * The Hand over the board (77×100 pixels): an obsidian hand lit from the
 * upper left, clawed fingers with bony knuckles, an eye with a slit pupil on
 * its back, glowing veins, a jewelled crown for a bracelet; the forearm fades
 * into smoke. Generated once, kept as rows of palette letters.
 */
const HAND = [
  '...............................................a.............................',
  '.............................................................................',
  '.........................a.....b...b...b.b.b...b.............................',
  '............................................c....a...c.......................',
  '.............................b.b.b.b.b.b.b.b.b.b.............................',
  '..........................b.......................b..........................',
  '.............................b.b.b.b.b.b.b.b.b.b.b...........................',
  '..........................b.b.c.b...b...b...b.b.b............................',
  '.............................b.b.b.b.b.b.b.b.bab.bb..........................',
  '............................b.b.b.b.b.b.b.b.b.b.b............................',
  '.............................b.b.b.b.b.bbb.b.b.b.b...........................',
  '...........................adbe.f.a.a.a.c.a.a.a.f............................',
  '.............................geh.faa.aac.cac.aaa.d...........................',
  '............................fce.f.aca.a.a.c.a.a.f.d..........................',
  '...........................dgh.hhf.aaa.cac.caa.ahf...........................',
  '............................g.h.f.a.a.a.c.a.a.a.a.d..........................',
  '...........................dghhfhfaaacacacacaafaffd..........................',
  '............................geh.ffa.aaa.cac.afa.ahd..........................',
  '...........................dgehffafaaaacacacaaaaffd..........................',
  '...........................dg.hhf.aaa.aac.aac.afa.d..........................',
  '...........................dghhffaaaacacacacaaaaffd..........................',
  '..........................dhgehhffaaaaadcacaaaafahgd.........................',
  '..........................dgeehffdaaaadidcacadaaffhd.........................',
  '..........................ddehhhdidaadiijdaadidffffd.........................',
  '..........................didhhdiijdadiijdadiijdaadid........................',
  '.........................diijdfdiijddiiijjddiijdadiijd.......................',
  '.........................diijddiiijjdiiijjdiiijjddiijd.......................',
  '..........................dddddddddddddddddddddddddd.........................',
  '..........................kkkkkkikkkkkkikkkkkkikkkkk.........................',
  '..........................iliiijiliiiijliiiiiliiiiil.........................',
  '.........................jmmjjnjoojjjnmmjjjjoojjjjmmj........................',
  '.........................nnnnpnnnnnnpnnnnnnpnnnnnnpnn........................',
  '.........................dddddddddddddddddddddddddddd........................',
  '.........................dgcfffhaqaaaacacacaaaafqfahd........................',
  '..........................dghfffaqaaacacacacacaqaarfd........................',
  '....................ddd.ddfgehffaqassssssssscaaqafrrrdd......................',
  '..................ddfggdrgghehhfasqaacacacacssaqaarfcggdd....................',
  '.................dfggecgreeehhfssaqbbbbbbbbbaaqsaffqfhcggd...................',
  '...............ddfgheefhqehhhfsfbbbddddtddddbbqasaaufafhfgd..................',
  '..............dhgghehehhhqhhfhbbddtttttttttttddbbaaqaffffhgd.................',
  '.............dfgehehhfhfhfqfbbdtttvvvwwxwwvvvtttdbbqaaaafffgd................',
  '...........ddhgeehhhfhfhffqbbdttvvvvwyyxyywvvvvttdqbafaffffhd................',
  '..........dfggehhhhfhffaaaaqdttvvvvwyyxxmzzwvvvvttdbaaaaafffgd...............',
  '........ddfgheehhhhffhafafadttvvvvwyymxxmzyywvvAvttdafafaffhfd...............',
  '.......dfgghehhhhfaaaaacaaadttvAAvwymmxxBmmywvvvvttdacaaaafafd...............',
  '......dhgeeehhbccaafaaaaaahdttAvvvwymBxxBBmywvvvvttdaacfafaffd...............',
  '......dgeehhhbbsbcfaaafcacadttvvvvwymmxxBmmywvvAAttdacaaaafafgd..............',
  '......dgehhcsbbsshfaaffaaaadttvAvvwyymxxmmyywvAvvttduqaaafafsd...............',
  '......dgehbsbsbcdgcafafahcqqdttCCCCwDyxxmyywCCCCttdcaqqcaaacfd...............',
  '.....dfgehsbscdd.dghfffaqqcccdttCCCCwyyxyywCCCCttdccaacqafaffd...............',
  '.....dghesbsbd.ddfghhfqqccacccdtttCCCwwxwwCCCtttdcccccahrrfafd...............',
  '....dhgehbsbd.dhgghehhqacaaaaaccddtttttttttttddccccccccarraffd...............',
  '....dghhbbbd..dgeEEhhrqcacaaaaaccccddddtddddccccccccccacbrbafgd..............',
  '...dfgehbsfd..dgebbbrrbccaafaaaaaccqccccccccqqcacccccccaafaffhd..............',
  '...dghesbsd..dhgehhrrsbbaafaaaahccqcccacacachqcbccbbbcaabbbaffgd.............',
  '..dhgebbshd..dgeebbbsbsbfhafafaccaqacaaaafafaqccbcbbscafafafahfd.............',
  '..dgehbsbd...dghhhbsbscdgcfcfEEbcqccacaaaaaaEEqbbsbbssffhcaafafgd............',
  '..dgehbbd....dgehcbbsbd.dgcffbbbbcqccaafafafbbqrrbsbcddgcfafaffhd............',
  '..dgesafd...dfghhbbbbd...dghhfcbbqqbaafafcfaaacrrrcdd..dgcffafffgd...........',
  '..dgebshd...dghehcbsfd...dgehbbbsrsbfhfhshfabbbcbrd.....dghaaffhfd...........',
  '..dgebbd....dgehhbbsd....dghhfcbbrcddddgdgcafaacafd.....dgcaaafafgd..........',
  '..dgeafd...dfgehbbchd....dgehhbcrbd....d.dghfaaaahd......dgcffEEfhgd.........',
  '..dFFFhd...dghehbssfd....dghhfbsafd......dghaaaaffd.......dghabbbfhd.........',
  '..dGGGd....dgehhscbd.....dgehhbbshd......dgcffafahd.......dgcffffffd.........',
  '..dGGHd...dfgEEbbsfd.....dghhfcbbd........dghfaaffd........dghbbbafd.........',
  '..dGGFd...dghbbbbbd......dgehccafd........dgehafahd........dgcaaaffd.........',
  '..dGGFd...dgehhcafd......dghhbbafd........dgeafaffd.........dgcaaahgd........',
  '..dGFd....dgebbbahd......dgehcbsfd........dgcfffahd..........dghaffhd........',
  '.dIIFd....dgehbssfd......dghhbbsd..........dghhaffd..........dgcfaffd........',
  '.dIGd.....dgehscbd......dhgEEachd..........dgeEEahgd..........dghEEhgd.......',
  '.dGd......dgehbsfd......dgebbbffd..........dgebbbfhd..........dgcbbbfd.......',
  'dId.......dgeebbd.......dgehhffhd..........dgehffffd...........dghfffd.......',
  'dd.......dfgesafd.......dgebbbffd..........dghbbbafd...........dgbbbfd.......',
  '.........dgEEbshd.......dgehbbshd..........dgcafaffd...........dgcaffd.......',
  '.........dgbbbbd........dgehcbbd............dghfaahd............dghafgd......',
  '.........dgehafd........dgehcafd............dgehaffd............dgcffhd......',
  '.........dgbbbfd........dgehbafd............dgecaafd.............dgFFFd......',
  '.........dgebsfd........dgehbsfd............dgcfaffd.............dFGGGd......',
  '.........dghbsd.........dgehbsd..............dghaahd..............dGGGd......',
  '.........dgeahd.........dgEEahd..............dgEEffd..............dGGGd......',
  '.........dFFFfd.........dgbbbfd..............dgbbbfd...............dGGGd.....',
  '.........dGGGHd.........dgehahd..............dgehffd...............dGGGd.....',
  '.........dGGHd..........dgbbbfd..............dgbbbhd................dGIId....',
  '.........dGGFd..........dgebshd..............dgcfffd.................dIId....',
  '.........dGGFd..........dgebbd................dghafd..................dIId...',
  '........dGGFd...........dgeafd................dgeffd...................dId...',
  '........dIGFd...........dgeafd................dgeahd....................ddd..',
  '........dIFd............dFFFfd................dgFFFd......................dd.',
  '.......dIGd.............dGGGHd................dFGGGd........................d',
  '.......dId..............dGGHd..................dGGGd.........................',
  '......dId...............dGGFd..................dGGGd.........................',
  '......dd................dGGFd..................dGGGd.........................',
  '.....dd.................dGFd....................dGGd.........................',
  '....d..................dIGFd....................dGGId........................',
  '.......................dIFd......................dIId........................',
  '.......................dId........................dId........................',
  '......................dIGd........................dIId.......................',
  '......................dGd..........................dId.......................',
  '.....................ddd............................ddd......................',
  '....................dd................................dd.....................',
];

const PALETTE: Record<string, string> = {
  A: '#e0607a', B: '#ff7a3d', C: '#f2d6d0', D: '#ffb0a0', E: '#e6dcff', F: '#8a7ca8', G: '#d6cce6', H: '#3a3050',
  I: '#f4eeff', a: '#352552', b: '#1b1130', c: '#271a40', d: '#05030a', e: '#7a5cb0', f: '#463266', g: '#cdb8ff',
  h: '#5c4486', i: '#e8b030', j: '#c98f12', k: '#ffe08a', l: '#ffd0e0', m: '#ff2448', n: '#9c6a0c', o: '#b06bff',
  p: '#6b4508', q: '#e0287a', r: '#ff8de0', s: '#0f0820', t: '#e8b8b8', u: '#ffd0f4', v: '#fff1e6', w: '#5a0018',
  x: '#05000a', y: '#b0102e', z: '#ffffff',
};

let cached = '';

export function handUrl(): string {
  if (cached) return cached;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 77 * scale;
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
