import { RELICS, type RelicId } from '../game/relics';
import { chooseRelic, relicOffer } from '../game/state';
import { audio } from './audio';
import type { Ctx } from './context';
import { el, openModal, toast } from './dom';
import { relicIconUrl } from './relicIcons';
import { t } from '../i18n';

/** Small framed pixel icon for a relic. */
export function relicIcon(id: RelicId): HTMLElement {
  const box = el('span', 'relic-icon');
  const img = el('img');
  img.src = relicIconUrl(id);
  img.alt = '';
  box.append(img);
  return box;
}

/** A compact row of owned relic icons with names in tooltips. */
export function relicStrip(ids: RelicId[]): HTMLElement {
  const strip = el('div', 'relic-strip');
  for (const id of ids) {
    const item = relicIcon(id);
    item.title = `${RELICS[id].name}: ${RELICS[id].description}`;
    strip.append(item);
  }
  return strip;
}

/** Show the 1-of-3 relic choice. Calls onDone after a pick or when postponed. */
export function openRelicPicker(ctx: Ctx, onDone?: () => void): void {
  const offer = relicOffer(ctx.state);
  if (!offer) {
    onDone?.();
    return;
  }
  const content = el('div', 'relic-picker');
  content.append(
    el('h2', '', t('Выберите реликвию')),
    el('p', 'hint', t('Реликвия действует до конца игры. Остальные две могут выпасть позже.')),
  );
  const cards = el('div', 'relic-cards');
  let close = () => {};
  offer.forEach((id, i) => {
    const def = RELICS[id];
    const card = el('button', 'relic-card face-down');
    card.disabled = true;
    const back = el('span', 'relic-back');
    back.append(el('span', 'relic-back-mark', '?'));
    card.append(relicIcon(id), el('span', 'relic-name', def.name), el('span', 'relic-desc', def.description), back);
    // Cards lie face down, then flip one by one.
    setTimeout(() => {
      card.classList.add('flipping');
      audio.play('star');
      setTimeout(() => {
        card.classList.remove('face-down');
        card.disabled = false;
      }, 140);
    }, 450 + i * 320);
    card.addEventListener('animationend', (e) => {
      if (e.animationName === 'relic-flip') card.classList.remove('flipping');
    });
    card.addEventListener('click', () => {
      if (!chooseRelic(ctx.state, id)) return;
      ctx.save();
      audio.play('relic');
      toast(t('Реликвия «{name}» получена', { name: def.name }), 'good');
      close();
      // Several picks can be pending (a boss on a star milestone).
      if (relicOffer(ctx.state)) openRelicPicker(ctx, onDone);
      else onDone?.();
    });
    cards.append(card);
  });
  const later = el('button', 'btn btn-ghost', t('Выбрать позже'));
  later.addEventListener('click', () => {
    close();
    onDone?.();
  });
  const actions = el('div', 'modal-actions');
  actions.append(later);
  content.append(cards, actions);
  close = openModal(content, { dismissable: false, cls: 'relic-modal' });
}
