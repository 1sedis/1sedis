import { STORY, loreForGame, storyKey, LORE } from '../game/story';
import { DISTORTIONS, distortionFor } from '../game/distortions';
import type { GameState } from '../game/state';
import { el, openModal } from './dom';
import { spriteUrl } from './sprites';
import { handUrl } from './handArt';

/** One page of a scene: who speaks and what. */
export interface Page {
  who: 'black' | 'white' | 'hand';
  name: string;
  text: string;
  /** Highlighted page (a distortion card). */
  accent?: boolean;
}

/** Show a sequence of pages in the story modal. Resolves when the last one is dismissed. */
export function playScene(pages: Page[], last = 'К бою'): Promise<void> {
  if (!pages.length) return Promise.resolve();
  return new Promise((resolve) => {
    const content = el('div', 'story');
    const face = el('img', 'story-face');
    face.alt = '';
    const speech = el('div', 'story-speech');
    const name = el('div', 'story-name');
    const text = el('p', 'story-text');
    speech.append(name, text);
    const next = el('button', 'btn btn-primary btn-small');
    const actions = el('div', 'modal-actions');
    actions.append(next);
    content.append(face, speech, actions);
    let i = 0;
    const close = openModal(content, { dismissable: false, cls: 'story-modal' });
    const show = () => {
      const p = pages[i];
      face.src = p.who === 'hand' ? handUrl() : spriteUrl('king', p.who === 'black' ? 'enemy' : 'ally', 2);
      content.classList.toggle('story-white', p.who === 'white');
      content.classList.toggle('story-hand', p.who === 'hand');
      content.classList.toggle('story-accent', !!p.accent);
      name.textContent = p.name;
      text.textContent = p.text;
      next.textContent = i < pages.length - 1 ? 'Дальше ▶' : last;
    };
    next.addEventListener('click', () => {
      i++;
      if (i < pages.length) return show();
      close();
      resolve();
    });
    show();
  });
}

/** Show the Black King's lines for a level once per save. Resolves when dismissed (at once if nothing to say). */
export function playStory(s: GameState, levelId: string, save: () => void): Promise<void> {
  const lines = STORY[levelId];
  const key = storyKey(levelId);
  if (!lines || s.tutorial.includes(key) || (s.stars[levelId] ?? 0) > 0) return Promise.resolve();
  s.tutorial.push(key);
  save();
  return playScene(lines.map((text) => ({ who: 'black', name: 'Чёрный король', text })));
}

/** Pages for a game's opening: the chronicle chapter, then the Black King announcing the distortion. */
function gamePages(game: number): Page[] {
  const pages: Page[] = [];
  const lore = loreForGame(game);
  if (lore) pages.push(...lore.lines.map((text) => ({ who: 'white' as const, name: `Летопись · ${lore.title}`, text })));
  const id = distortionFor(game);
  if (id) {
    const d = DISTORTIONS[id];
    pages.push(...d.speech.map((text) => ({ who: 'black' as const, name: 'Чёрный король', text })));
    pages.push({ who: 'black', name: `Искажение · ${d.name}`, text: d.text, accent: true });
  }
  return pages;
}

/** The scene that opens a new game. */
export function playGameIntro(game: number): Promise<void> {
  return playScene(gamePages(game), 'Начать партию');
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
