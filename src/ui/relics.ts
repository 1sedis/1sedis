import { RELICS, type RelicId } from '../game/relics';
import { chooseRelic, relicOffer } from '../game/state';
import { audio } from './audio';
import type { Ctx } from './context';
import { el, openModal, toast } from './dom';
import { spriteUrl } from './sprites';

/** Small square icon for a relic: the related piece, or a coin for economy relics. */
export function relicIcon(id: RelicId): HTMLElement {
  const def = RELICS[id];
  const box = el('span', `relic-icon${def.icon === 'gold' ? ' gold' : ''}`);
  if (def.icon !== 'gold') {
    const img = el('img');
    img.src = spriteUrl(def.icon, 'ally');
    img.alt = '';
    box.append(img);
  }
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
    el('h2', '', 'Выберите реликвию'),
    el('p', 'hint', 'Реликвия действует до конца игры. Остальные две могут выпасть позже.'),
  );
  const cards = el('div', 'relic-cards');
  let close = () => {};
  for (const id of offer) {
    const def = RELICS[id];
    const card = el('button', 'relic-card');
    card.append(relicIcon(id), el('span', 'relic-name', def.name), el('span', 'relic-desc', def.description));
    card.addEventListener('click', () => {
      if (!chooseRelic(ctx.state, id)) return;
      ctx.save();
      audio.play('relic');
      toast(`Реликвия «${def.name}» получена`, 'good');
      close();
      // Several picks can be pending (a boss on a star milestone).
      if (relicOffer(ctx.state)) openRelicPicker(ctx, onDone);
      else onDone?.();
    });
    cards.append(card);
  }
  const later = el('button', 'btn btn-ghost', 'Выбрать позже');
  later.addEventListener('click', () => {
    close();
    onDone?.();
  });
  const actions = el('div', 'modal-actions');
  actions.append(later);
  content.append(cards, actions);
  close = openModal(content, { dismissable: false, cls: 'relic-modal' });
}
