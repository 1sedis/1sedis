import { getLevel } from '../game/levels';
import { PIECES, type PieceKind } from '../game/pieces';
import { RELICS } from '../game/relics';
import {
  BANNERS, EVENTS, buyItem, campRest, campTrain, canBuy, chooseEvent, finishNode, shopItems, type RunNode,
} from '../game/run';
import { upgradeCost } from '../game/state';
import { audio } from './audio';
import type { Ctx } from './context';
import { el, openModal, toast } from './dom';
import { fmt } from './format';
import { iconUrl, type IconId } from './icons';
import { relicIcon } from './relics';
import { spriteUrl } from './sprites';

export const NODE_ICON: Record<RunNode['kind'], IconId> = {
  battle: 'sword', elite: 'skull', event: 'question', shop: 'bag', camp: 'fire', boss: 'crown',
};

export function nodeLabel(node: RunNode): string {
  switch (node.kind) {
    case 'battle': return getLevel(node.level!).name;
    case 'elite': return `Элита: ${getLevel(node.level!).name}`;
    case 'boss': return getLevel(node.level!).boss ?? 'Босс';
    case 'event': return node.event ? EVENTS[node.event].title : 'Событие';
    case 'shop': return 'Торговец';
    case 'camp': return 'Лагерь';
  }
}

export const NODE_HELP: Record<RunNode['kind'], string> = {
  battle: 'Бой. Победа приносит золото и звёзды.',
  elite: 'Элита: враги на уровень сильнее и с лишним элитным бойцом. За победу — реликвия.',
  event: 'Событие: выбор с последствиями.',
  shop: 'Торговец: реликвии, знамя и заточка за золото.',
  camp: 'Лагерь: вернуть знамя или потренировать фигуру.',
  boss: 'Босс главы. Победа открывает следующую главу.',
};

/** A row of banner flags: lit ones are left, dark ones were lost. */
export function bannerRow(left: number): HTMLElement {
  const row = el('span', 'banner-row');
  row.title = `Знамёна: ${left} из ${BANNERS}. Поражение снимает одно; без знамён глава начнётся заново.`;
  for (let i = 0; i < BANNERS; i++) {
    const img = el('img', `banner-flag${i < left ? '' : ' lost'}`);
    img.src = iconUrl('flag');
    img.alt = '';
    row.append(img);
  }
  return row;
}

function modal(title: string, text: string): { content: HTMLElement; body: HTMLElement; actions: HTMLElement } {
  const content = el('div', 'node-dialog');
  const body = el('div', 'node-body');
  const actions = el('div', 'modal-actions');
  content.append(el('h2', '', title), el('p', 'node-text', text), body, actions);
  return { content, body, actions };
}

/** The dialog of an event, merchant or camp node. `onDone` runs once the node is finished. */
export function openNodeDialog(ctx: Ctx, node: RunNode, onDone: () => void): void {
  if (node.kind === 'event') openEvent(ctx, node, onDone);
  else if (node.kind === 'shop') openShop(ctx, node, onDone);
  else if (node.kind === 'camp') openCamp(ctx, onDone);
}

function openEvent(ctx: Ctx, node: RunNode, onDone: () => void): void {
  const def = EVENTS[node.event!];
  const { content, body, actions } = modal(def.title, def.text);
  content.classList.add('event-dialog');
  const close = openModal(content, { dismissable: false, cls: 'node-modal' });
  def.choices.forEach((c, i) => {
    const btn = el('button', 'btn choice-btn');
    const blocked = c.blocked?.(ctx.state) ?? null;
    btn.append(el('span', 'choice-label', c.label), el('span', 'choice-hint', blocked ?? c.hint));
    btn.disabled = !!blocked;
    btn.addEventListener('click', () => {
      const line = chooseEvent(ctx.state, i);
      if (!line) return;
      ctx.save();
      audio.play('relic');
      body.replaceChildren(el('p', 'event-outcome', line));
      const next = el('button', 'btn btn-primary', 'Дальше');
      next.addEventListener('click', () => {
        close();
        onDone();
      });
      actions.replaceChildren(next);
    });
    body.append(btn);
  });
}

function openShop(ctx: Ctx, node: RunNode, onDone: () => void): void {
  const s = ctx.state;
  const { content, body, actions } = modal('Торговец', 'Бродячий торговец разложил товар у дороги. Купить можно один раз.');
  const close = openModal(content, { dismissable: false, cls: 'node-modal' });
  const gold = el('div', 'shop-gold');
  const render = () => {
    gold.textContent = `Золото: ${fmt(s.gold)}`;
    body.replaceChildren(gold, ...shopItems(s, node).map((item) => {
      const row = el('div', 'shop-item');
      const icon = item.relic ? relicIcon(item.relic) : el('img', 'shop-icon');
      if (!item.relic) (icon as HTMLImageElement).src = iconUrl(item.id === 'banner' ? 'flag' : 'sword');
      const text = el('div', 'shop-text');
      text.append(el('b', '', item.relic ? RELICS[item.relic].name : item.name), el('span', '', item.relic ? RELICS[item.relic].description : item.text));
      const why = canBuy(s, node, item);
      const buy = el('button', 'btn btn-buy btn-small', why === 'Куплено' || why === 'Уже есть' ? why : fmt(item.cost));
      buy.disabled = !!why;
      if (why && why !== 'Куплено' && why !== 'Уже есть') buy.title = why;
      buy.addEventListener('click', () => {
        if (!buyItem(s, node, item)) return;
        ctx.save();
        audio.play('coins');
        render();
      });
      row.append(icon, text, buy);
      return row;
    }));
  };
  render();
  const leave = el('button', 'btn btn-primary', 'Уйти');
  leave.addEventListener('click', () => {
    finishNode(s);
    ctx.save();
    close();
    onDone();
  });
  actions.append(leave);
}

function openCamp(ctx: Ctx, onDone: () => void): void {
  const s = ctx.state;
  const { content, body } = modal('Лагерь', 'Армия разбила лагерь у костра. Есть время на одно дело.');
  const close = openModal(content, { dismissable: false, cls: 'node-modal' });
  const finish = (text: string) => {
    ctx.save();
    audio.play('achievement');
    toast(text, 'good');
    close();
    onDone();
  };
  const rest = el('button', 'btn choice-btn');
  const full = s.run.banners >= BANNERS;
  rest.append(el('span', 'choice-label', 'Отдохнуть'), el('span', 'choice-hint', full ? 'Знамёна и так полны' : '+1 знамя'));
  rest.disabled = full;
  rest.addEventListener('click', () => {
    if (campRest(s)) finish('Армия отдохнула: +1 знамя');
  });
  body.append(rest, el('div', 'camp-train-title', 'Или тренировка: +1 уровень бесплатно'));
  const grid = el('div', 'camp-train');
  for (const kind of Object.keys(s.army) as PieceKind[]) {
    if (s.army[kind] <= 0) continue;
    const btn = el('button', 'btn camp-piece');
    const img = el('img');
    img.src = spriteUrl(kind, 'ally');
    img.alt = '';
    btn.append(img, el('span', '', `${PIECES[kind].name} → ур. ${s.levels[kind] + 1}`), el('span', 'choice-hint', `стоит ${fmt(upgradeCost(s, kind))}`));
    btn.addEventListener('click', () => {
      if (campTrain(s, kind)) finish(`${PIECES[kind].name}: ур. ${s.levels[kind]}`);
    });
    grid.append(btn);
  }
  body.append(grid);
}
