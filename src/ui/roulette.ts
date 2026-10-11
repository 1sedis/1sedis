import { RARITY, randomBuff, type BuffDef } from '../game/roulette';
import { audio } from './audio';
import { el, openModal } from './dom';
import { iconUrl } from './icons';
import { spriteUrl } from './sprites';

function buffIcon(b: BuffDef): string {
  if (b.icon === 'army') return iconUrl('sword');
  if (b.icon === 'gold') return iconUrl('coin');
  return spriteUrl(b.icon, 'ally', b.rarity === 'legendary' ? 2 : b.rarity === 'epic' ? 1 : 0);
}

function card(b: BuffDef, big = false): HTMLElement {
  const c = el('div', `buff-card r-${b.rarity}${big ? ' big' : ''}`);
  const img = el('img', 'buff-icon');
  img.src = buffIcon(b);
  img.alt = '';
  c.append(el('span', 'buff-rarity', RARITY[b.rarity].name), img, el('span', 'buff-name', b.name));
  if (big) c.append(el('span', 'buff-text', b.text));
  return c;
}

const FANFARE = { common: 'buy', rare: 'levelup', epic: 'relic', legendary: 'achievement' } as const;

/** One spin: a strip of cards races past and slows down on the prize. */
export function showSpin(prize: BuffDef, onClose: () => void): void {
  const content = el('div', 'spin');
  content.append(el('h2', '', 'Рулетка бездны'));
  const viewport = el('div', 'spin-viewport');
  const strip = el('div', 'spin-strip');
  const STOP = 34;
  for (let i = 0; i < STOP + 4; i++) strip.append(card(i === STOP ? prize : randomBuff()));
  viewport.append(strip, el('div', 'spin-marker'));
  const result = el('div', 'spin-result');
  const actions = el('div', 'modal-actions');
  const ok = el('button', 'btn btn-primary', 'Забрать');
  ok.hidden = true;
  actions.append(ok);
  content.append(viewport, result, actions);
  const close = openModal(content, { dismissable: false, cls: 'spin-modal' });
  ok.addEventListener('click', () => {
    close();
    onClose();
  });

  requestAnimationFrame(() => {
    const cardW = (strip.firstElementChild as HTMLElement).getBoundingClientRect().width + 8;
    const offset = STOP * cardW - viewport.clientWidth / 2 + cardW / 2 + (Math.random() - 0.5) * cardW * 0.6;
    const duration = 3600;
    const start = performance.now();
    let lastIndex = -1;
    const ease = (t: number) => 1 - (1 - t) ** 4;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const x = offset * ease(t);
      strip.style.transform = `translateX(${-Math.round(x)}px)`;
      const index = Math.floor((x + viewport.clientWidth / 2) / cardW);
      if (index !== lastIndex) {
        lastIndex = index;
        audio.play('click');
      }
      if (t < 1) requestAnimationFrame(tick);
      else land();
    };
    requestAnimationFrame(tick);
  });

  const land = () => {
    audio.play(FANFARE[prize.rarity]);
    viewport.classList.add(`landed-${prize.rarity}`);
    result.replaceChildren(card(prize, true));
    result.classList.add('show');
    ok.hidden = false;
  };
}

/** Ten spins at once: cards flip one by one, the best one shines. */
export function showMulti(prizes: BuffDef[], onClose: () => void): void {
  const content = el('div', 'spin');
  content.append(el('h2', '', 'Рулетка бездны ×10'));
  const grid = el('div', 'multi-grid');
  const order = ['common', 'rare', 'epic', 'legendary'];
  const best = Math.max(...prizes.map((p) => order.indexOf(p.rarity)));
  prizes.forEach((p, i) => {
    const slot = el('div', 'multi-slot face-down');
    slot.append(card(p, true), el('span', 'multi-back', '?'));
    setTimeout(() => {
      slot.classList.remove('face-down');
      slot.classList.add('flip');
      audio.play(order.indexOf(p.rarity) >= 2 ? FANFARE[p.rarity] : 'star');
    }, 300 + i * 220);
    if (order.indexOf(p.rarity) === best && best >= 2) slot.classList.add('best');
    grid.append(slot);
  });
  const actions = el('div', 'modal-actions');
  const ok = el('button', 'btn btn-primary', 'Забрать');
  actions.append(ok);
  content.append(grid, actions);
  const close = openModal(content, { dismissable: false, cls: 'spin-modal multi' });
  ok.addEventListener('click', () => {
    close();
    onClose();
  });
}
