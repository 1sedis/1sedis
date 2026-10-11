import { gameNumber, type GameState } from '../game/state';
import { PIECES, type PieceKind } from '../game/pieces';
import { el } from './dom';
import { fmt } from './format';
import { handUrl } from './handArt';
import { spriteUrl, type Tier } from './sprites';
import { abilityTier } from '../game/abilities';
import { playScene, type Page } from './story';
import { audio } from './audio';

const BK = (text: string): Page => ({ who: 'black', name: 'Чёрный король', text });
const HAND = (text: string): Page => ({ who: 'hand', name: 'Рука над доской', text });

/** "02:14 ночи", "15:40 дня" — the player's own clock, read aloud by the Hand. */
function clock(): string {
  const d = new Date();
  const h = d.getHours();
  const part = h < 5 ? 'ночи' : h < 12 ? 'утра' : h < 17 ? 'дня' : h < 23 ? 'вечера' : 'ночи';
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${part}`;
}

function battles(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? 'бой' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'боя' : 'боёв';
  return `${fmt(n)} ${word}`;
}

/** The scene before each phase of the finale. The Hand speaks to the person at the screen. */
function phasePages(s: GameState, phase: number): Page[] {
  if (phase === 1) {
    return [
      BK('Ты дошёл до края доски. Я узнал тебя — ты помнишь все партии, как и я.'),
      BK('Это последняя партия. Если я проиграю, доска снова перевернётся. Так было тысячу раз.'),
      BK('Поэтому я выставлю всё: полную армию и все искажения сразу. Победи — и посмотри, что будет.'),
    ];
  }
  if (phase === 2) {
    return [
      BK('Ты… победил. Сейчас она перевернёт доску. Смотри наверх.'),
      HAND('ЕЩЁ. ОДНА. ПАРТИЯ.'),
      BK('Это Рука. Она переворачивает доску каждый раз, когда кто-то побеждает.'),
      BK('Теперь против тебя — твоя же армия, отражённая в чёрном. Я встану рядом с твоим королём.'),
    ];
  }
  return [
    HAND('Ты всё ещё здесь.'),
    HAND(`${battles(s.stats.battles)}. ${gameNumber(s)}-я партия. На твоих часах ${clock()} — а ты всё играешь.`),
    HAND('Ты правда не понял? Я — рука над доской. Та, что каждый раз нажимала «Новая партия».'),
    HAND('Я — это ты.'),
    BK('Тогда победи себя. Только так доска перестанет переворачиваться.'),
  ];
}

/** Show a phase's scene once per save (the Hand's monologue every time: it knows the clock). */
export function playFinaleScene(s: GameState, phase: number, save: () => void): Promise<void> {
  const key = `story_final_${phase}`;
  if (s.tutorial.includes(key) && phase !== 3) return Promise.resolve();
  if (!s.tutorial.includes(key)) {
    s.tutorial.push(key);
    save();
  }
  return playScene(phasePages(s, phase), 'В бой');
}

/** After the Hand falls: the last words, then the credits. */
export async function playEnding(s: GameState): Promise<void> {
  await playScene([
    HAND('…Хорошо.'),
    HAND('Пусть доска стоит.'),
    BK('Цикл разорван. Впервые за тысячу партий никто не перевернёт доску.'),
    BK('Возьми корону. Настоящую — она больше не меняет того, кто её носит.'),
    { who: 'white', name: 'Летопись · Доска, которая стоит', text: 'Белый и Чёрный король стоят рядом. Над доской — только небо.', accent: true },
  ], 'Титры');
  await playCredits(s);
}

/** Full-screen rolling credits with the player's own numbers. */
export function playCredits(s: GameState): Promise<void> {
  return new Promise((resolve) => {
    const overlay = el('div', 'credits');
    const roll = el('div', 'credits-roll');
    const block = (title: string, ...lines: (string | HTMLElement)[]) => {
      const b = el('div', 'credits-block');
      b.append(el('div', 'credits-title', title));
      for (const line of lines) b.append(typeof line === 'string' ? el('div', 'credits-line', line) : line);
      roll.append(b);
    };
    const castRow = (src: string, name: string, role: string) => {
      const row = el('div', 'credits-cast');
      const img = el('img');
      img.src = src;
      img.alt = '';
      row.append(img, el('span', 'credits-name', name), el('span', 'credits-role', role));
      return row;
    };
    roll.append(el('div', 'credits-logo', 'Пиксельный гамбит'));
    roll.append(el('div', 'credits-sub', 'Летопись завершена'));
    const army = (Object.keys(s.army) as PieceKind[]).filter((k) => s.army[k] > 0);
    block('В главных ролях', ...army.map((k) => castRow(
      spriteUrl(k, 'ally', abilityTier(s.levels[k]) as Tier),
      `${PIECES[k].name}${s.army[k] > 1 ? ` ×${s.army[k]}` : ''}`,
      `уровень ${s.levels[k]}`,
    )));
    block('Против них',
      castRow(spriteUrl('queen', 'enemy', 2), 'Чёрный ферзь', 'тысячу раз'),
      castRow(spriteUrl('king', 'enemy', 2), 'Чёрный король', 'больше не враг'),
      castRow(handUrl(), 'Рука над доской', 'это был ты'));
    block('Летопись в цифрах',
      `Партий: ${gameNumber(s)}`,
      `Боёв: ${fmt(s.stats.battles)} · побед: ${fmt(s.stats.wins)}`,
      `Фигур сражено: ${fmt(s.stats.kills)}`,
      `Пешек стали ферзями: ${fmt(s.stats.promotions)}`,
      `Приёмов применено: ${fmt(s.stats.abilities)}`,
      `Золота добыто: ${fmt(Math.round(s.stats.goldEarned))}`,
      `Глубина Бездны: ${s.abyss.best}`);
    block('Над игрой работали',
      'Полководец, геймдизайнер и главный тестер — ты',
      'Код, пиксели и 8-битная музыка — Claude');
    roll.append(el('div', 'credits-end', 'Доска больше не переворачивается.'));
    roll.append(el('div', 'credits-sub', 'Спасибо за игру'));
    const skip = el('button', 'btn btn-small credits-skip', 'Пропустить');
    overlay.append(roll, skip);
    document.body.append(overlay);
    audio.play('achievement');
    const done = () => {
      overlay.remove();
      resolve();
    };
    skip.addEventListener('click', done);
    roll.addEventListener('animationend', () => {
      skip.textContent = 'Дальше';
      skip.classList.add('btn-primary');
    });
  });
}
