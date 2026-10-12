import { CHRONICLE, LORE, STORY, chronicleAt, loreKey, storyKey } from '../game/story';
import { gameNumber, type GameState } from '../game/state';
import { el, openModal } from './dom';
import { t } from '../i18n';
import type { BoardView, UnitView } from './board';
import { Stage, playStageOverlay } from './cutscene';
import { levelScene, loreScene, openingScene, revealScene } from './scenes';

/** The Black King's scene before a level, acted on the arena board, once per save. */
export function playStory(s: GameState, levelId: string, save: () => void, board: BoardView, cast: UnitView[]): Promise<void> {
  const steps = levelScene(levelId);
  const key = storyKey(levelId);
  if (!STORY[levelId] || !steps || s.tutorial.includes(key) || s.cleared[levelId]) return Promise.resolve();
  s.tutorial.push(key);
  save();
  return new Stage(board, cast).run(steps);
}

/** Play a chapter of the Chronicle on its own board and remember it was told. */
function playLore(s: GameState, lore: number, game: number, save: () => void): Promise<void> {
  if (!s.tutorial.includes(loreKey(lore))) {
    s.tutorial.push(loreKey(lore));
    save();
  }
  return lore === 4 ? playStageOverlay(revealScene(), 6) : playStageOverlay(loreScene(lore, game), Math.min(4, Math.max(1, game)));
}

/** The scene that opens a new game: its chapter of the Chronicle and the distortion it brings. */
export function playGameIntro(s: GameState, save: () => void): Promise<void> {
  const game = gameNumber(s);
  const lore = chronicleAt(game, 'start');
  return lore === null ? Promise.resolve() : playLore(s, lore, game, save);
}

/** A chapter of the Chronicle told on entering a level (once per game). */
export function playLevelLore(s: GameState, levelId: string, save: () => void): Promise<void> {
  const game = gameNumber(s);
  const lore = chronicleAt(game, levelId);
  const key = `${loreKey(lore ?? -1)}_g${game}`;
  if (lore === null || s.tutorial.includes(key)) return Promise.resolve();
  s.tutorial.push(key);
  return playLore(s, lore, game, save);
}

/** The opening of a new save: the White Kingdom falls. */
export function playOpening(): Promise<void> {
  return playStageOverlay(openingScene(), 1);
}

/** The edge of the board opens: the Hand's first appearance (the Chronicle's fifth chapter). */
export function playReveal(s: GameState, save: () => void): Promise<void> {
  return playLore(s, 4, gameNumber(s), save);
}

/** Re-read the Chronicle: every chapter told so far (with a replay), and the ending once it is reached. */
export function openChronicle(s: GameState, save: () => void, onCredits?: () => void): void {
  const content = el('div', 'chronicle');
  content.append(el('h2', '', t('Летопись')));
  const told = CHRONICLE.filter((b) => s.tutorial.includes(loreKey(b.lore)));
  if (!told.length) content.append(el('p', 'muted', t('Летопись начнётся во второй партии.')));
  for (const beat of told) {
    const lore = LORE[beat.lore];
    const item = el('div', 'chronicle-item');
    item.append(el('div', 'chronicle-title', `${beat.at === 'finale' ? t('Край доски') : t('Партия {n}', { n: beat.game })} · ${lore.title}`));
    for (const line of lore.lines) item.append(el('p', '', line));
    const watch = el('button', 'btn btn-small chronicle-watch', t('▶ Смотреть'));
    watch.addEventListener('click', () => {
      done();
      void playLore(s, beat.lore, beat.game, save);
    });
    item.append(watch);
    content.append(item);
  }
  if (onCredits) {
    const item = el('div', 'chronicle-item chronicle-ending');
    item.append(el('div', 'chronicle-title', t('Финал · Доска, которая стоит')));
    item.append(el('p', '', t('Рука над доской опущена. Белый и Чёрный король стоят рядом, и доска больше не переворачивается.')));
    content.append(item);
  }
  const close = el('button', 'btn btn-small', t('Закрыть'));
  const actions = el('div', 'modal-actions');
  if (onCredits) {
    const credits = el('button', 'btn btn-small', t('Титры'));
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
