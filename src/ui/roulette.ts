import { EPIC_PITY, LEGEND_PITY, RARITY, ROMAN, SPIN_COST, ownedGifts, rank, type BuffDef, type Rarity } from '../game/roulette';
import { chooseGift, spinCost, spinRoulette } from '../game/state';
import { audio } from './audio';
import type { Ctx } from './context';
import { el, openModal, toast } from './dom';
import { iconUrl } from './icons';
import { spriteUrl } from './sprites';

function giftIcon(b: BuffDef): string {
  if (b.icon === 'army') return iconUrl('sword');
  if (b.icon === 'gold') return iconUrl('coin');
  return spriteUrl(b.icon, 'ally', b.rarity === 'legendary' ? 2 : b.rarity === 'epic' ? 1 : 0);
}

/** A gift card; with `next` it shows the rank the pick would reach. */
function giftCard(b: BuffDef, have: number, next = false): HTMLElement {
  const c = el(next ? 'button' : 'div', `buff-card big r-${b.rarity}`);
  const img = el('img', 'buff-icon');
  img.src = giftIcon(b);
  img.alt = '';
  const rankText = b.max === 1 ? 'уникальный' : next ? (have ? `ранг ${ROMAN[have]} → ${ROMAN[have + 1]}` : 'ранг I') : `ранг ${ROMAN[have]}`;
  c.append(el('span', 'buff-rarity', RARITY[b.rarity].name), img, el('span', 'buff-name', b.name),
    el('span', 'buff-text', b.text), el('span', 'buff-rank', rankText));
  return c;
}

const FANFARE: Record<Rarity, 'buy' | 'levelup' | 'relic' | 'achievement'> = { common: 'buy', rare: 'levelup', epic: 'relic', legendary: 'achievement' };
/** The strip of rarities racing past: mostly common, now and then a flash of gold. */
const STRIP: Rarity[] = ['common', 'rare', 'common', 'epic', 'common', 'rare', 'legendary', 'common', 'rare', 'common', 'epic'];

/**
 * The Crown Wheel: spin for crowns, the wheel lands on a rarity, then pick one
 * gift of three. `onChange` runs whenever crowns or gifts change.
 */
export function openWheel(ctx: Ctx, onChange: () => void): void {
  const s = ctx.state;
  const content = el('div', 'wheel');
  const close = openModal(content, { cls: 'wheel-modal' });

  const home = () => {
    const cost = spinCost(s);
    const r = s.roulette;
    const head = el('div', 'wheel-head');
    head.append(el('h2', '', 'Колесо короны'), el('span', 'wheel-crowns', `♛ ${s.crowns}`));
    const spin = el('button', 'btn btn-buy wheel-spin', cost ? `Крутить · ${SPIN_COST} ♛` : 'Крутить бесплатно');
    spin.disabled = s.crowns < cost;
    spin.addEventListener('click', () => roll());
    const pity = el('div', 'pity-line', `Эпический или лучше — не позже чем через ${EPIC_PITY - r.sinceEpic}, легендарный — через ${LEGEND_PITY - r.sinceLegend}`);
    const hint = el('p', 'hint', 'Колесо выбирает редкость, а вы — один дар из трёх. Дары вечные; повторный дар повышает ранг (до III), легендарные — уникальны.');
    const owned = ownedGifts(r);
    const shelf = el('div', 'gift-shelf');
    if (owned.length) for (const { def, rank: n } of owned) shelf.append(giftCard(def, n));
    else shelf.append(el('p', 'hint', 'Даров пока нет.'));
    const actions = el('div', 'modal-actions');
    const done = el('button', 'btn btn-ghost', 'Закрыть');
    done.addEventListener('click', close);
    actions.append(done);
    content.replaceChildren(head, hint, spin, pity, el('div', 'wheel-subtitle', 'Ваши дары'), shelf, actions);
  };

  /** The rarity strip races past and stops; then the choice. */
  const roll = () => {
    const offer = spinRoulette(s);
    if (!offer?.length) return;
    ctx.save();
    onChange();
    const rarity = offer[0].rarity;
    const viewport = el('div', 'spin-viewport');
    const strip = el('div', 'spin-strip');
    const STOP = 30;
    for (let i = 0; i < STOP + 4; i++) {
      const k = i === STOP ? rarity : STRIP[(i * 5 + 3) % STRIP.length];
      const tile = el('div', `rarity-tile r-${k}`, RARITY[k].name);
      strip.append(tile);
    }
    viewport.append(strip, el('div', 'spin-marker'));
    content.replaceChildren(el('h2', '', 'Колесо короны'), viewport);
    requestAnimationFrame(() => {
      const tileW = (strip.firstElementChild as HTMLElement).getBoundingClientRect().width + 8;
      const offset = STOP * tileW - viewport.clientWidth / 2 + tileW / 2 + (Math.random() - 0.5) * tileW * 0.5;
      const duration = 2600;
      const start = performance.now();
      let last = -1;
      const ease = (t: number) => 1 - (1 - t) ** 4;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const x = offset * ease(t);
        strip.style.transform = `translateX(${-Math.round(x)}px)`;
        const index = Math.floor((x + viewport.clientWidth / 2) / tileW);
        if (index !== last) {
          last = index;
          audio.play('click');
        }
        if (t < 1) requestAnimationFrame(tick);
        else {
          audio.play(FANFARE[rarity]);
          viewport.classList.add(`landed-${rarity}`);
          setTimeout(() => choose(offer), 650);
        }
      };
      requestAnimationFrame(tick);
    });
  };

  const choose = (offer: BuffDef[]) => {
    const cards = el('div', 'gift-choice');
    for (const b of offer) {
      const card = giftCard(b, rank(s.roulette, b.id), true);
      card.addEventListener('click', () => {
        const got = chooseGift(s, b.id);
        if (!got) return;
        ctx.save();
        audio.play(FANFARE[got.rarity]);
        toast(`Дар «${got.name}»${got.max > 1 ? ` · ранг ${ROMAN[rank(s.roulette, got.id)]}` : ''}`, 'good');
        onChange();
        home();
      });
      cards.append(card);
    }
    content.replaceChildren(el('h2', `wheel-landed r-${offer[0].rarity}`, `${RARITY[offer[0].rarity].name} дар — выберите один`), cards);
  };

  // A spin that landed before (the game was closed mid-choice) is still waiting.
  if (s.roulette.offer) choose(spinRoulette(s)!);
  else home();
}
