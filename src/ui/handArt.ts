/**
 * The Hand over the board (62×104 pixels): a hand made of the space beyond
 * the screen. A clawing pose seen from the back, a starry void inside, a rim
 * of cold light brightest on the upper left, a crown ring on the ring finger;
 * the forearm scatters into star dust. Kept as rows of palette letters.
 */
const HAND = [
  '..............................a...............................',
  '.............................b................................',
  '.........................c...d...e...f...d...c................',
  '.........................a....g....a..ba......................',
  '.................a.......c.d.d.d.d.fbf.d.d.d.c................',
  '..................h.................a.........................',
  '.........................c.f.f.f.d.f.f.d.d.d.c................',
  '..............................................................',
  '.........................c.d.f.dhf.f.f.d.d.i.c................',
  '........................j...f...f...f...d...i.................',
  '.........................c.d.d.f.faf.f.d.d.i.c.g..............',
  '..........................d...d...f...f...d...................',
  '........................bchd.d.d.fbk.f.d.d.ibc................',
  '........................j.d.d.f.f.kgk.f.d.l.i.................',
  '.........................c.d.d.f.f.k.dgdad.i.c................',
  '..................h.....j.c.d.f.f.f.f.d.d.i.c.................',
  '...................h....jj.ddd.fbf.kff.ddi.hcc................',
  '..........................c.d.f.f.k.k.f.d.d.c.................',
  '.........................jcd.fff.ffk.ffd.ddd..................',
  '..........................c.f.f.f.f.f.f.f.f.c....h............',
  '.........................jcfffbfmfbffffffffdc.................',
  '..........................cbf.fbf.fbf.fbf.ffc.................',
  '........................ajcfffffbfbfbfbfbffdc.................',
  '.........................jc.fff.fbf.bbf.fff.c.................',
  '........................bjcdffffffbfbfbffffdc.................',
  '.........................jcfdffffbfbfbfbffddc.................',
  '........................njchfdffbfbfbfbffdedcn................',
  '........................njcffffbfbfbbbfbffddcn................',
  '........................njadffffbfbfbfbffffdan................',
  '.......................njjaffffbbbbbfbfbfbfdaan...............',
  '......................njjaafffbfbbbfmfbfbffddoan..............',
  '....................nnjjaafffffbbblbfbfbfbffddan..............',
  '...................njjjaafmdffffbbbmffkffffediaan.............',
  '..................njjaaaffffdffbbbbbfkhkffffddian.............',
  '.................njaadfffdfdfkffbfbfefkffffddikaan............',
  '................njaadfffffdfkhkbbbbbfbfbffffdkhkan............',
  '...............njaadddfdfdfdfkbfbbbfbfbhfffddikidan...........',
  '..............njjadfeffffffffbbbbgbbfbfbfbffddddian...........',
  '.............njjadfdfffffdffffebbbbfbfffbffffdddddan..........',
  '............njjadffffefffffffbbbbbbbfffbfmffffddddaan.........',
  '...........njjaiddfffffdlfffffbfbfbffffffffffdddddfan.........',
  '..........njjadddfffflfffffffbfbfbfffffffbffffffdffan.........',
  '.........njjadddfdfffdfffffffffffffffmfffhfffffffffan.........',
  '........njjaffdfffdffffbfbfbffffffffffdffffbfbfbfbfaan........',
  '........njadfdfdddfdffffbfbfhdfdfdfdfdfdfdffbfbfbfbfan........',
  '.......njaafdfdfdfdfdffbbbffffdfdfdfdldfdffbfbbbbbfffan.......',
  '......njjafdfdddmdddffbkbffffdfdfdfdfdfdfhffbfbfbfbffdan......',
  '.....njjafdfddiddddcfbkhkbffdfdfffdfdfdffffbfbfbbbbbffan......',
  '....nnjadddddhiiiiaaffbkbffdfdfdfffdfdedffffffffffbffdaan.....',
  '...njjadddddiiiiiaaffbbbbbmfdffffffffffffbfffffffbbbffdan.....',
  '...njaaddddiiiicoadfffbfbfndfdfffffdfdfffffdndfdffbffddan.....',
  '..njadddddidiccojadffbfbffnfdfdfffffffdfffdfdndffffbffdfan....',
  '..njadddmiiiccnjadfdfffdfnfdfdfdfdfnfdfddddddndddffffdfdan....',
  '..njadddieiccnnjafdfffffdndfffffdfdndedfdfdeidnddfffffddaan...',
  '..njaddddicnnnjjadfffddmdnffhffddddnfdddfddidinacdfffdfddan...',
  '.njjadddicn..njadfffffdfnffffbffdfdndddfdfddiinaocdffppppan...',
  '.njaiiiiccn..njafdfffdfdncafffbffddndidddddiiicnocddfpfdpdan..',
  '.njaidiccn..njjadffffffcnafbfbbbffcnocdddfddidanoocddfddddan..',
  '.njaiiicn...njadfffffdfcnaffbbbffdcnocihdddddiannocdddfddddan.',
  'njjaiicn....njafffffffcnjafbbbbbffcnnjcdddqdddannoocdfdfdhdan.',
  'njoiiccn...njjppppfdfdcnjaffbfbmfccnnjcirstsrian.nocddfddddan.',
  '.noaccn....njapffpffdfcnjafbfbffdcn.nrrsrrsdddan.nocdfffdedan.',
  '.njacn.....njafffffddcnnjaffbffldcn.nrsrrsrrsrrn..nocdfffddan.',
  '.njjjn....njaffbffdfdcnnjafbfbffdcn.njcdkprsrrsn..nocfffffdan.',
  '.njjn.....njadfffffdcn.njafffffddcn.njjcipddpdan...nocfppppaan',
  '.njjn.....njaffbffddcn.njappppdhicn..njciddddfdan..nocdfffffan',
  '.njn......njadfffdfdcn.njapdfpddcn...njcdiddfddan..nocddfdfdan',
  '.njn......njafffffdcn.njaadfffdfcn...njciddedfdan..noochdfffan',
  '..n.......njadfffdfcn.njaiddfdhdcn...njcddfddddcn...nocmddfdcn',
  '..........njafffffccn.njaddfdfddcn...nociddfdfdcn...nocdmfddcn',
  '.........njjppppfdcn..njciddfdfdcn...noocimdfdfcn...noocdddccn',
  '.........njaffffffcn..njcddfffdfcn....nocddffffcn....nocddicn.',
  '.........njafdfdfdcn..njciddfdfccn....njciddfffan....nocdiicn.',
  '.........njadfffdcn...njaddfffdcn.....njchdffffan....njcddicn.',
  '.........njcfdfdfcn...njaiddfddcn.....njcippppfan....noodiccn.',
  '.........nocdfffdcn...njaddfdfdcn.....njjcdffffan.....noaccn..',
  '.........noocdfdccn...njaidddddcn......njcddfdfan.....njacjn..',
  '..........nocfffcn....njappppddcn......njcdfdfdan.....njjjjn..',
  '..........nocdfdcn....njaidddicn.......njcddfddcn......njjn...',
  '..........njcdddcn....njadidddcn.......nocdfddicn......njjn...',
  '..........noomdccn....njaididicn.......noocddlccn......njjn...',
  '...........noaccn.....njcdddidcn........nocdiicn........nn....',
  '...........njacjn.....nocididicn........njciiicn..............',
  '...........njjjjn.....noociddccn........njcdiicn..............',
  '............njjn.......nocdidcn.........njciiicn..............',
  '............njjn.......njcddicn.........noodiccn..............',
  '............njjn.......njcdidcn..........noaccn...............',
  '.............nn........njcdddcn..........njacjn...............',
  '.......................njcdidcn..........njjjjn...............',
  '.......................nooldccn...........njjn................',
  '........................noaccn............njjn................',
  '........................njacjn............njjn................',
  '........................njjjjn.............nn.................',
  '.........................njjn.................................',
  '.........................njjn.................................',
  '.........................njjn.................................',
  '..........................nn..................................',
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '..............................................................',
  '..............................n...............................',
];

const PALETTE: Record<string, string> = {
  a: '#8a7cff', b: '#2c1565', c: '#5a46c8', d: '#0e0830', e: '#ffd6f5', f: '#1a0f4a', g: '#45207f', h: '#ffffff',
  i: '#07041a', j: '#e8f6ff', k: '#9fd8ff', l: '#bfe8ff', m: '#d9ccff', n: '#05030a', o: '#b9c8ff', p: '#6b5ad8',
  q: '#ffe08a', r: '#ffcf4a', s: '#c98f12', t: '#ff2448',
};

let cached = '';

export function handUrl(): string {
  if (cached) return cached;
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 62 * scale;
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
