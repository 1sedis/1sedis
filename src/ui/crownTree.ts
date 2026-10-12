import { t } from '../i18n';
import {
  BRANCHES, BRANCH_ORDER, NODES, RESET_COST, TIER_COST, TIER_FROM_GAME, lockReason, nodeCost, nodeState, spentCrowns,
  type CrownNode,
} from '../game/crownTree';
import { buyNode, gameNumber, resetTree } from '../game/state';
import { audio } from './audio';
import type { Ctx } from './context';
import { confirmDialog, el, openModal, setText, toast } from './dom';
import { spriteUrl } from './sprites';

const ROMAN = ['I', 'II', 'III', 'IV'];

/** The Crown Tree: three branches, a pair of doctrines on every tier, pick one. */
export function openCrownTree(ctx: Ctx, onChange?: () => void): void {
  const content = el('div', 'tree');
  const head = el('div', 'tree-head');
  const crowns = el('div', 'tree-crowns');
  const reset = el('button', 'btn btn-ghost btn-small', t('Сбросить выбор · {cost} ♛', { cost: RESET_COST }));
  head.append(el('h2', '', t('Древо короны')), crowns, reset);
  const hint = el('p', 'hint tree-hint', t('На каждом ярусе выберите одну доктрину из двух. Вторая закроется — до сброса выбора.'));
  const grid = el('div', 'tree-grid');
  const actions = el('div', 'modal-actions');
  const close = el('button', 'btn btn-primary', t('Готово'));
  actions.append(close);
  content.append(head, hint, grid, actions);
  const closeModal = openModal(content, { cls: 'tree-modal' });
  close.addEventListener('click', closeModal);

  const render = () => {
    const s = ctx.state;
    const game = gameNumber(s);
    setText(crowns, `♛ ${s.crowns}`);
    reset.disabled = spentCrowns(s.crownTree) === 0;
    grid.replaceChildren(...BRANCH_ORDER.map((branch) => {
      const col = el('div', `tree-branch b-${branch}`);
      const info = BRANCHES[branch];
      col.append(el('div', 'tree-branch-title', `${info.icon} ${info.name}`), el('div', 'tree-branch-sub', info.text));
      for (let tier = 0; tier < 4; tier++) {
        const row = el('div', 'tree-tier');
        const label = el('div', 'tree-tier-label', `${ROMAN[tier]} · ${TIER_COST[tier]} ♛`);
        if (game < TIER_FROM_GAME[tier]) label.append(el('span', 'tree-tier-lock', t(' · с партии {n}', { n: TIER_FROM_GAME[tier] })));
        row.append(label);
        const pair = el('div', 'tree-pair');
        for (const node of NODES.filter((x) => x.branch === branch && x.tier === tier)) pair.append(nodeCard(node));
        row.append(pair);
        col.append(row);
      }
      return col;
    }));
  };

  const nodeCard = (node: CrownNode): HTMLElement => {
    const s = ctx.state;
    const state = nodeState(s.crownTree, gameNumber(s), node);
    const card = el('button', `tree-node is-${state}${node.piece ? ' has-piece' : ''}`);
    if (node.piece) {
      const img = el('img', 'tree-node-piece');
      img.src = spriteUrl(node.piece, 'ally', 2);
      img.alt = '';
      card.append(img);
    }
    card.append(el('span', 'tree-node-name', node.name), el('span', 'tree-node-text', node.text));
    const affordable = s.crowns >= nodeCost(node);
    if (state === 'owned') card.append(el('span', 'tree-node-tag', t('Выбрано')));
    else if (state === 'available') card.append(el('span', 'tree-node-tag', affordable ? t('Взять · {cost} ♛', { cost: nodeCost(node) }) : t('Нужно {cost} ♛', { cost: nodeCost(node) })));
    else if (state === 'locked') card.append(el('span', 'tree-node-tag', lockReason(s.crownTree, gameNumber(s), node) ?? ''));
    card.disabled = state !== 'available' || !affordable;
    card.addEventListener('click', async () => {
      const ok = await confirmDialog(node.name, t('{text}\nВторая доктрина этого яруса закроется до сброса выбора.', { text: node.text }), t('Взять · {cost} ♛', { cost: nodeCost(node) }));
      if (!ok || !buyNode(ctx.state, node.id)) return;
      audio.play('achievement');
      toast(t('Доктрина «{name}» принята', { name: node.name }), 'good');
      ctx.save();
      onChange?.();
      render();
    });
    return card;
  };

  reset.addEventListener('click', async () => {
    const ok = await confirmDialog(t('Сбросить выбор'), t('Все доктрины снимутся, короны вернутся (кроме {cost} ♛ за сброс).', { cost: RESET_COST }), t('Сбросить'));
    if (!ok || !resetTree(ctx.state)) return;
    audio.play('click');
    ctx.save();
    onChange?.();
    render();
  });
  render();
}
