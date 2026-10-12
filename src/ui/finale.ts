import { gameNumber, type GameState } from '../game/state';
import { PIECES, type PieceKind } from '../game/pieces';
import { el } from './dom';
import { fmt } from './format';
import { handUrl } from './handArt';
import { spriteUrl, type Tier } from './sprites';
import { abilityTier } from '../game/abilities';
import type { BoardView, UnitView } from './board';
import { Stage } from './cutscene';
import { endingScene, finaleScene } from './scenes';
import { audio } from './audio';

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

/**
 * The scene before a finale phase, acted on the arena board. Phases 1 and 2
 * play once per save; the Hand's monologue every time (it reads the clock).
 */
export function playFinaleScene(s: GameState, phase: number, save: () => void, board: BoardView, cast: UnitView[]): Promise<void> {
  const key = `story_final_${phase}`;
  if (s.tutorial.includes(key) && phase !== 3) return Promise.resolve();
  if (!s.tutorial.includes(key)) {
    s.tutorial.push(key);
    save();
  }
  const steps = finaleScene(phase, cast, { battles: battles(s.stats.battles), game: gameNumber(s), clock: clock() });
  return new Stage(board, cast).run(steps);
}

/** After the Hand falls: its last words and the crowning on the board, then the credits. */
export async function playEnding(s: GameState, board: BoardView, cast: UnitView[]): Promise<void> {
  await new Stage(board, cast).run(endingScene(cast));
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
      `Забегов: ${fmt(s.stats.runs)} · даров короны: ${Object.keys(s.roulette.owned).length}`);
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
