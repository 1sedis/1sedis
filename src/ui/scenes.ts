import { DISTORTIONS, distortionFor } from '../game/distortions';
import type { UnitView } from './board';
import type { Step } from './cutscene';

/** Cell index of (x, y). */
const C = (x: number, y: number) => y * 8 + x;

const say = (id: string, text: string): Step => ({ t: 'say', id, text });

// ---------- Before levels: the Black King on his own board ----------

/** Scenes for the levels that have the Black King's lines; the cast is the level's pieces. */
export function levelScene(levelId: string): Step[] | null {
  const bk = 'bk';
  switch (levelId) {
    case '1-1':
      return [
        { t: 'hop', id: bk },
        say(bk, 'Ещё один полководец Белого короля? Как трогательно.'),
        { t: 'teamHop', team: 'enemy', kinds: ['pawn'] },
        say(bk, 'Мои пешки растопчут тебя на первой же клетке.'),
        say('wk', 'Посмотрим.'),
      ];
    case '1-9':
      return [say(bk, 'Капитан! Покажи этому выскочке, что такое настоящий строй.'), { t: 'roar', id: 'boss' }];
    case '2-1':
      return [
        say(bk, 'Ты прошёл поля? Неважно.'),
        { t: 'teamHop', team: 'enemy', kinds: ['knight'] },
        say(bk, 'В моём лесу всадники видят каждую тень. Береги тыл.'),
      ];
    case '2-9':
      return [{ t: 'roar', id: 'boss' }, say(bk, 'Чёрный всадник ещё не знал поражений. Беги, пока цел.')];
    case '3-1':
      return [
        { t: 'teamHop', team: 'enemy', kinds: ['bishop', 'rook'] },
        say(bk, 'Башни стоят тысячу лет, и их стрелки не промахиваются.'),
        say(bk, 'Каждая открытая линия — твоя могила.'),
      ];
    case '3-9':
      return [say(bk, 'Крепость неприступна. Твоя армия разобьётся о её стены.'), { t: 'roar', id: 'boss' }, { t: 'shake', big: true }];
    case '4-1':
      return [say(bk, 'Добро пожаловать в Тронный зал. Отсюда ещё никто не ушёл.'), say('wk', 'Значит, я буду первым.')];
    case '4-9':
      return [
        { t: 'roar', id: bk },
        say(bk, 'Довольно игр!'),
        say(bk, 'Ферзь, сотри их с доски. Эта партия — моя.'),
        { t: 'roar', id: 'boss' },
      ];
    case 'abyss-1':
      return [
        say(bk, 'Ты победил меня… но под доской есть Бездна.'),
        { t: 'crack' },
        { t: 'dark', cells: [C(2, 3), C(5, 3), C(3, 4), C(4, 4)] },
        say(bk, 'И она голодна. Спускайся, если не боишься.'),
      ];
    default:
      return null;
  }
}

// ---------- A new game: the Chronicle acted out ----------

/** The opening cast: two small armies facing each other, the e-file left open for the kings to meet. */
function opening(queen = false): Step[] {
  const steps: Step[] = [
    { t: 'spawn', id: 'wk', kind: 'king', team: 'ally', x: 4, y: 7, tier: 2 },
    { t: 'spawn', id: 'bk', kind: 'king', team: 'enemy', x: 4, y: 0, tier: 2 },
  ];
  [1, 2, 5, 6].forEach((x) => {
    steps.push({ t: 'spawn', id: `wp${x}`, kind: 'pawn', team: 'ally', x, y: 6, tier: 1 });
    steps.push({ t: 'spawn', id: `bp${x}`, kind: 'pawn', team: 'enemy', x, y: 1, tier: 1 });
  });
  steps.push({ t: 'spawn', id: 'wn', kind: 'knight', team: 'ally', x: 2, y: 7, tier: 1 });
  steps.push({ t: 'spawn', id: 'bn', kind: 'knight', team: 'enemy', x: 5, y: 0, tier: 1 });
  if (queen) steps.push({ t: 'spawn', id: 'bq', kind: 'queen', team: 'enemy', x: 3, y: 0, tier: 2 });
  return steps;
}

function distortionCard(game: number): Step[] {
  const id = distortionFor(game);
  if (!id) return [];
  return [{ t: 'title', text: `Искажение: ${DISTORTIONS[id].name}`, sub: DISTORTIONS[id].text, accent: true }];
}

/** What each new game shows: a chapter of the Chronicle played on the board, then the new distortion. */
export function gameIntroScene(game: number): Step[] {
  const head: Step[] = [{ t: 'title', text: `Партия ${game}` }];
  switch (game) {
    case 2:
      return [
        ...opening(true), ...head,
        { t: 'caption', text: 'Чёрный ферзь пал.' },
        { t: 'shatter', id: 'bq' },
        { t: 'move', id: 'wk', x: 4, y: 4, ms: 700 },
        { t: 'caption', text: 'Ты ждёшь, что Чёрный король склонит голову…' },
        { t: 'hop', id: 'bk' },
        say('bk', 'Склонить голову? Ха. Ха-ха-ха!'),
        { t: 'roar', id: 'bk' },
        { t: 'crack' },
        { t: 'flip' },
        { t: 'flash' },
        { t: 'move', id: 'wk', x: 4, y: 7, ms: 300 },
        { t: 'caption', text: 'Ты снова у первой клетки. Только в руке светятся короны прошлой партии.' },
        { t: 'crown', id: 'wk' },
        say('bk', 'В этот раз мои фигуры помнят прошлую партию. Каждый приём, каждый удар.'),
        ...[1, 2, 5, 6].map((x): Step => ({ t: 'glow', id: `bp${x}`, color: '#c77dff' })),
        { t: 'glow', id: 'bn', color: '#c77dff' },
        { t: 'teamHop', team: 'enemy' },
        ...distortionCard(game),
      ];
    case 3:
      return [
        ...opening(), ...head,
        { t: 'move', id: 'bk', x: 4, y: 3, ms: 800 },
        { t: 'move', id: 'wk', x: 4, y: 5, ms: 600 },
        say('bk', 'Ты правда думал, что это первая партия?'),
        say('bk', 'Я играю её тысячу лет. Проиграв, я переворачиваю доску — и всё начинается заново.'),
        say('bk', 'Но ты… ты помнишь. Этого раньше не случалось.'),
        { t: 'crack' },
        { t: 'dark', cells: [C(1, 4), C(6, 4), C(2, 5), C(5, 5), C(3, 4)] },
        { t: 'move', id: 'wp2', x: 2, y: 5, ms: 400 },
        { t: 'fade', id: 'wp2', to: 0.35, ms: 900 },
        say('bk', 'Из трещин сочится тьма. Мои фигуры её пьют, а твои — растворяются.'),
        ...distortionCard(game),
      ];
    case 4:
      return [
        ...opening(), ...head,
        { t: 'caption', text: 'Бездна под доской — не пустота. Это все фигуры, сброшенные за тысячу партий.' },
        { t: 'spawn', id: 'g1', kind: 'rook', team: 'ally', x: 1, y: 5, hidden: true },
        { t: 'spawn', id: 'g2', kind: 'queen', team: 'enemy', x: 3, y: 4, hidden: true },
        { t: 'spawn', id: 'g3', kind: 'bishop', team: 'ally', x: 5, y: 4, hidden: true },
        { t: 'spawn', id: 'g4', kind: 'knight', team: 'enemy', x: 6, y: 5, hidden: true },
        ...['g1', 'g2', 'g3', 'g4'].map((id): Step => ({ t: 'fade', id, to: 0.4, ms: 500, par: true })),
        { t: 'wait', ms: 600 },
        ...['g1', 'g2', 'g3', 'g4'].map((id, i): Step => ({ t: 'move', id, x: [1, 3, 5, 6][i], y: 2, ms: 1400, par: true })),
        ...['g1', 'g2', 'g3', 'g4'].map((id): Step => ({ t: 'fade', id, to: 0, ms: 1400, par: true })),
        { t: 'caption', text: 'Осколки, что ты собираешь, — их память. Поэтому рулетка шепчет голосами павших.' },
        say('bk', 'Я больше не посылаю новобранцев.'),
        { t: 'badge', id: 'bp1', trait: 'swift' },
        { t: 'badge', id: 'bp2', trait: 'thorns' },
        { t: 'badge', id: 'bp5', trait: 'furious' },
        { t: 'badge', id: 'bp6', trait: 'armored' },
        { t: 'badge', id: 'bn', trait: 'vampire' },
        say('bk', 'Моя гвардия стоит на каждой клетке — с первой до последней.'),
        ...distortionCard(game),
      ];
    case 5:
      return [
        ...opening(), ...head,
        { t: 'move', id: 'bk', x: 4, y: 3, ms: 800 },
        { t: 'move', id: 'wk', x: 4, y: 4, ms: 800 },
        say('bk', 'Знаешь, кем был твой Белый король до тебя?'),
        { t: 'morph', id: 'bk', kind: 'king', team: 'ally' },
        { t: 'caption', text: 'Он снимает шлем. Под ним — то же лицо. Тот же взгляд, только уставший от тысячи поражений.' },
        say('bk', 'Мной. Каждый, кто побеждал, становился мной. Корона меняет того, кто её носит.'),
        { t: 'morph', id: 'bk', kind: 'king', team: 'enemy' },
        { t: 'move', id: 'bk', x: 4, y: 2, ms: 400 },
        say('bk', 'Довольно прятаться за пешками. В этой партии я выйду сам.'),
        { t: 'grow', id: 'bk', scale: 1.35 },
        { t: 'roar', id: 'bk' },
        ...distortionCard(game),
      ];
    case 6:
      return [
        ...opening(), ...head,
        { t: 'caption', text: 'Ты понимаешь: дело не в ферзе и не в короле.' },
        { t: 'handIn' },
        { t: 'caption', text: 'Доску переворачивает рука над ней.' },
        say('giant-hand', 'ЕЩЁ. ОДНА. ПАРТИЯ.'),
        { t: 'handOut' },
        say('bk', 'Ты тоже её видел? Значит, она пришла и за тобой.'),
        say('bk', 'Иди к краю доски. Если хватит сил — она будет ждать там.'),
        { t: 'caption', text: 'Чтобы закончить цикл, мало выиграть партию. Нужно не дать доске перевернуться.' },
        ...distortionCard(game),
      ];
    default:
      return [
        ...opening(), ...head,
        { t: 'crack' },
        { t: 'flip' },
        { t: 'caption', text: 'Доска снова переворачивается. Но теперь ты считаешь партии сам.' },
        say('bk', 'Снова ты. Каждая корона — шаг к руке над доской.'),
        { t: 'caption', text: 'Однажды доска не перевернётся. Не в этот раз. Но однажды.' },
        ...distortionCard(game),
      ];
  }
}

// ---------- The finale ----------

function free(cast: UnitView[], y: number, near: number): number {
  const taken = new Set(cast.filter((v) => v.y === y).map((v) => v.x));
  const xs = [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => Math.abs(a - near) - Math.abs(b - near));
  return xs.find((x) => !taken.has(x)) ?? near;
}

/** Scenes before each finale phase, acted by the pieces already on the board. */
export function finaleScene(phase: number, cast: UnitView[], numbers: { battles: string; game: number; clock: string }): Step[] {
  const wk = cast.find((v) => v.team === 'ally' && v.kind === 'king' && !v.skin) ?? { x: 3, y: 7 };
  if (phase === 1) {
    return [
      { t: 'hop', id: 'bk' },
      say('bk', 'Ты дошёл до края доски. Я узнал тебя — ты помнишь все партии, как и я.'),
      say('bk', 'Это последняя партия. Если я проиграю, доска снова перевернётся.'),
      { t: 'roar', id: 'bk' },
      { t: 'teamHop', team: 'enemy' },
      say('bk', 'Поэтому — всё сразу. Вся армия. Все искажения.'),
    ];
  }
  if (phase === 2) {
    const bk = cast.find((v) => v.skin === 'blackKing') ?? { x: wk.x + 1, y: wk.y };
    return [
      { t: 'team', team: 'enemy', show: false, except: ['black-king'] },
      { t: 'place', id: 'ally-bk', x: 4, y: 0 },
      say('ally-bk', 'Ты… победил. Сейчас она перевернёт доску. Смотри наверх.'),
      { t: 'handIn' },
      say('giant-hand', 'ЕЩЁ. ОДНА. ПАРТИЯ.'),
      { t: 'flip' },
      { t: 'team', team: 'enemy', show: true },
      say('ally-bk', 'Это твоя армия… в чёрном. Её руками.'),
      { t: 'handOut' },
      { t: 'move', id: 'ally-bk', x: bk.x, y: bk.y, ms: 900 },
      say('ally-bk', 'Я встану рядом с тобой. Впервые за тысячу партий.'),
      say('wk', 'Тогда сыграем вместе.'),
    ];
  }
  const side = free(cast, 7, wk.x + 3);
  return [
    say('hand', 'Ты всё ещё здесь.'),
    say('hand', `${numbers.battles}. ${numbers.game}-я партия. На твоих часах ${numbers.clock} — а ты всё играешь.`),
    { t: 'glitch', ms: 600 },
    say('hand', 'Ты правда не понял? Я — рука над доской. Та, что каждый раз нажимала «Новая партия».'),
    { t: 'flash', color: '#c77dff' },
    { t: 'glitch', ms: 900 },
    say('hand', 'Я — это ты.'),
    { t: 'spawn', id: 'bk2', kind: 'king', team: 'enemy', x: side, y: 7, tier: 2, hidden: true },
    { t: 'fade', id: 'bk2', to: 1, ms: 400 },
    say('bk2', 'Тогда победи себя. Только так доска перестанет переворачиваться.'),
  ];
}

/** After the Hand falls: it lets go, the Black King comes to stand beside you and crowns you. */
export function endingScene(cast: UnitView[]): Step[] {
  const wk = cast.find((v) => v.team === 'ally' && v.kind === 'king' && !v.skin) ?? { x: 3, y: 7 };
  const bx = free(cast.filter((v) => !v.dead), wk.y, wk.x + 1);
  return [
    { t: 'spawn', id: 'the-hand', kind: 'hand', team: 'enemy', x: 3, y: 0 },
    say('the-hand', '…Хорошо.'),
    say('the-hand', 'Пусть доска стоит.'),
    { t: 'flash' },
    { t: 'shatter', id: 'the-hand' },
    { t: 'wait', ms: 600 },
    { t: 'spawn', id: 'bk3', kind: 'king', team: 'enemy', x: bx, y: 0, tier: 2, hidden: true },
    { t: 'fade', id: 'bk3', to: 1, ms: 500 },
    { t: 'move', id: 'bk3', x: bx, y: wk.y, ms: 1400 },
    say('bk3', 'Цикл разорван. Впервые за тысячу партий никто не перевернёт доску.'),
    say('bk3', 'Возьми корону. Настоящую — она больше не меняет того, кто её носит.'),
    { t: 'crown', id: 'wk' },
    { t: 'teamHop', team: 'ally' },
    { t: 'caption', text: 'Белый и Чёрный король стоят рядом. Над доской — только небо.' },
  ];
}
