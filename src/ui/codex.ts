import { ABILITY_LEVELS, abilityOf } from '../game/abilities';
import { PIECES, type PieceKind } from '../game/pieces';
import { SYNERGIES } from '../game/synergies';
import { el, openModal } from './dom';
import { spriteUrl } from './sprites';

const ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen'];

/** Reference of all pieces (yours and the enemy's) and composition bonuses. */
export function openCodex(): void {
  const content = el('div', 'codex');
  content.append(el('h2', '', 'Справочник'));
  const list = el('div', 'codex-list');
  for (const kind of ORDER) {
    const def = PIECES[kind];
    const card = el('details', 'codex-item');
    const sum = el('summary', 'codex-head');
    const pics = el('span', 'codex-pics');
    for (const team of ['ally', 'enemy'] as const) {
      const img = el('img');
      img.src = spriteUrl(kind, team);
      img.alt = '';
      pics.append(img);
    }
    const title = el('span', 'codex-title', def.name);
    title.append(el('span', 'codex-role', ` · ${def.role}`));
    const stats = el('span', 'codex-stats', `❤ ${def.hp}  ⚔ ${def.atk}${def.range ? `  ◎ ${def.range}` : ''}${def.cost ? `  · ${def.cost} з.` : ''}`);
    const text = el('span', 'codex-text');
    text.append(title, stats);
    sum.append(pics, text);
    const body = el('div', 'codex-body');
    body.append(el('p', '', def.description));
    for (const b of [0, 1] as const) {
      const ab = abilityOf(kind, b);
      body.append(el('p', 'codex-ability',
        `★ ${ab.name}${b === 0 ? ' (и у врагов)' : ''}: ${ab.tiers[0]} С ур. ${ABILITY_LEVELS[1]}: ${ab.tiers[1]}`));
    }
    card.append(sum, body);
    list.append(card);
  }
  const syn = el('details', 'codex-item');
  const synHead = el('summary', 'codex-head');
  synHead.append(el('span', 'codex-title', '✦ Синергии состава'));
  const synBody = el('div', 'codex-body');
  for (const d of SYNERGIES) synBody.append(el('p', '', `${d.name}: ${d.description}.`));
  syn.append(synHead, synBody);
  list.append(syn);
  content.append(el('p', 'hint', `Здоровье и атака — на 1-м уровне, каждый уровень +18%. Приём открывается на ${ABILITY_LEVELS[0]}-м.`), list);
  const actions = el('div', 'modal-actions');
  const ok = el('button', 'btn btn-primary', 'Закрыть');
  actions.append(ok);
  content.append(actions);
  const close = openModal(content, { cls: 'codex-modal' });
  ok.addEventListener('click', close);
}
