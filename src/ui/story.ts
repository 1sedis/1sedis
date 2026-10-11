import { STORY, loreForGame, storyKey, LORE } from '../game/story';
import { DISTORTIONS, distortionFor } from '../game/distortions';
import type { GameState } from '../game/state';
import { el, openModal } from './dom';
import type { BoardView, UnitView } from './board';
import { Stage, playStageOverlay } from './cutscene';
import { gameIntroScene, levelScene } from './scenes';

/** The Black King's scene before a level, acted on the arena board, once per save. */
export function playStory(s: GameState, levelId: string, save: () => void, board: BoardView, cast: UnitView[]): Promise<void> {
  const steps = levelScene(levelId);
  const key = storyKey(levelId);
  if (!STORY[levelId] || !steps || s.tutorial.includes(key) || (s.stars[levelId] ?? 0) > 0) return Promise.resolve();
  s.tutorial.push(key);
  save();
  return new Stage(board, cast).run(steps);
}

/** The scene that opens a new game: the Chronicle chapter acted out, then the new distortion. */
export function playGameIntro(game: number): Promise<void> {
  return playStageOverlay(gameIntroScene(game), Math.min(4, Math.max(1, game - 1)));
}

/** Re-read the chronicle: every chapter up to the current game, and the ending once it is reached. */
export function openChronicle(game: number, onCredits?: () => void): void {
  const content = el('div', 'chronicle');
  content.append(el('h2', '', 'Летопись'));
  const count = Math.min(game - 1, LORE.length);
  if (count <= 0) content.append(el('p', 'muted', 'Летопись начнётся со второй партии.'));
  for (let g = 2; g <= count + 1; g++) {
    const lore = loreForGame(g)!;
    const id = distortionFor(g);
    const item = el('div', 'chronicle-item');
    item.append(el('div', 'chronicle-title', `Партия ${g} · ${lore.title}`));
    for (const line of lore.lines) item.append(el('p', '', line));
    if (id) item.append(el('div', 'chronicle-distortion', `◆ ${DISTORTIONS[id].name}: ${DISTORTIONS[id].text}`));
    const watch = el('button', 'btn btn-small chronicle-watch', '▶ Смотреть');
    watch.addEventListener('click', () => {
      done();
      void playGameIntro(g);
    });
    item.append(watch);
    content.append(item);
  }
  if (onCredits) {
    const item = el('div', 'chronicle-item chronicle-ending');
    item.append(el('div', 'chronicle-title', 'Финал · Доска, которая стоит'));
    item.append(el('p', '', 'Рука над доской опущена. Белый и Чёрный король стоят рядом, и доска больше не переворачивается.'));
    content.append(item);
  }
  const close = el('button', 'btn btn-small', 'Закрыть');
  const actions = el('div', 'modal-actions');
  if (onCredits) {
    const credits = el('button', 'btn btn-small', 'Титры');
    credits.addEventListener('click', () => {
      done();
      onCredits();
    });
    actions.append(credits);
  }
  actions.append(close);
  content.append(actions);
  const done = openModal(content, { cls: 'chronicle-modal' });
  close.addEventListener('click', () => done());
}
