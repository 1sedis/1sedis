import { STORY, storyKey } from '../game/story';
import type { GameState } from '../game/state';
import { el, openModal } from './dom';
import { spriteUrl } from './sprites';

/** Show the Black King's lines for a level once per save. Resolves when dismissed (at once if nothing to say). */
export function playStory(s: GameState, levelId: string, save: () => void): Promise<void> {
  const lines = STORY[levelId];
  const key = storyKey(levelId);
  if (!lines || s.tutorial.includes(key) || (s.stars[levelId] ?? 0) > 0) return Promise.resolve();
  s.tutorial.push(key);
  save();
  return new Promise((resolve) => {
    const content = el('div', 'story');
    const face = el('img', 'story-face');
    face.src = spriteUrl('king', 'enemy', 2);
    face.alt = '';
    const speech = el('div', 'story-speech');
    speech.append(el('div', 'story-name', 'Чёрный король'));
    const text = el('p', 'story-text');
    speech.append(text);
    const next = el('button', 'btn btn-primary btn-small');
    const actions = el('div', 'modal-actions');
    actions.append(next);
    content.append(face, speech, actions);
    let i = 0;
    const close = openModal(content, { dismissable: false, cls: 'story-modal' });
    const show = () => {
      text.textContent = lines[i];
      next.textContent = i < lines.length - 1 ? 'Дальше ▶' : 'К бою';
    };
    next.addEventListener('click', () => {
      i++;
      if (i < lines.length) return show();
      close();
      resolve();
    });
    show();
  });
}
