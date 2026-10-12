import { getLevel } from '../game/levels';
import { ELITE_RULES } from '../game/battle';
import { PIECES, type PieceKind } from '../game/pieces';
import { RELICS } from '../game/relics';
import { CHAPTERS, getLevel as levelOf } from '../game/levels';
import {
  EVENTS, buyItem, campForge, campGain, campTrain, canBuy, chooseEvent, finishNode, lives, shopItems, type RunNode, type RunOver,
} from '../game/run';
import { battleGold, enemyLevel, startNextRun, upgradeCost, type GameState } from '../game/state';
import { enemyPlacements } from '../game/levels';
import { TRAITS, traitAdjective, withElites } from '../game/elites';
import { BOSSES, bossFor } from '../game/bosses';
import { traitUrl } from './traitIcons';
import { ARMIES, ARMY_ORDER, type ArmyId } from '../game/armies';
import { activeThreats } from '../game/ascension';
import { audio } from './audio';
import type { Ctx } from './context';
import { el, openModal, toast } from './dom';
import { fmt } from './format';
import { iconUrl, type IconId } from './icons';
import { relicIcon } from './relics';
import { spriteUrl } from './sprites';
import { plural, t } from '../i18n';

export const NODE_ICON: Record<RunNode['kind'], IconId> = {
  battle: 'sword', elite: 'skull', event: 'question', shop: 'bag', camp: 'fire', boss: 'crown',
};

export function nodeLabel(node: RunNode): string {
  switch (node.kind) {
    case 'battle': return getLevel(node.level!).name;
    case 'elite': return t('Элита: {name}', { name: node.rule ? ELITE_RULES[node.rule].name : getLevel(node.level!).name });
    case 'boss': return getLevel(node.level!).boss ?? t('Босс');
    case 'event': return node.event ? EVENTS[node.event].title : t('Событие');
    case 'shop': return t('Торговец');
    case 'camp': return t('Лагерь');
  }
}

export const NODE_HELP: Record<RunNode['kind'], string> = {
  battle: t('Бой. Победа приносит золото.'),
  elite: t('Элита: враги на 2 уровня сильнее, с Чемпионом и особым правилом боя. За победу — реликвия.'),
  event: t('Событие: выбор с последствиями.'),
  shop: t('Торговец: реликвии, запасное знамя и заточка за золото.'),
  camp: t('Лагерь: заточить оружие или потренировать фигуру.'),
  boss: t('Босс главы. Победа открывает следующую главу.'),
};

/** Lives as flags: every run has one, a spare banner adds a second. */
export function livesRow(s: GameState): HTMLElement {
  const n = lives(s);
  const row = el('span', 'banner-row');
  row.title = n > 1
    ? t('Жизни: 2. Запасное знамя сгорит вместо поражения — бой можно будет переиграть.')
    : t('Одна жизнь: поражение заканчивает забег. Запасное знамя даёт вторую.');
  for (let i = 0; i < n; i++) {
    const img = el('img', 'banner-flag');
    img.src = iconUrl('flag');
    img.alt = '';
    row.append(img);
  }
  const threat = s.run.threat ?? 0;
  if (threat) {
    const chip = el('span', 'threat-chip', t('☠ Угроза {n}', { n: threat }));
    chip.title = activeThreats(threat).map((r) => `${r.level}. ${r.name} — ${r.text}`).join('\n');
    row.append(chip);
  }
  return row;
}

/** Choose the starting army of the next run (straight on when only one is open). */
export function pickArmy(ctx: Ctx, onPick: (army: ArmyId, threat: number) => void): void {
  const s = ctx.state;
  let threat = Math.min(s.run.threat ?? 0, s.threatMax);
  if (s.armies.length <= 1 && s.threatMax === 0) {
    onPick(s.armies[0] ?? 'guard', 0);
    return;
  }
  const content = el('div', 'army-picker');
  content.append(el('h2', '', t('Выберите армию')), el('p', 'hint', t('С ней начнётся следующий забег. Новые армии открываются за боссов.')));
  // Threat levels open after a won game: pick how hard the next run is.
  if (s.threatMax > 0) {
    const box = el('div', 'threat-picker');
    const row = el('div', 'threat-row');
    const info = el('div', 'threat-info');
    const render = () => {
      row.replaceChildren(...Array.from({ length: s.threatMax + 1 }, (_, n) => {
        const b = el('button', `threat-btn${n === threat ? ' active' : ''}`, String(n));
        b.addEventListener('click', () => {
          threat = n;
          render();
        });
        return b;
      }));
      const rules = activeThreats(threat);
      info.replaceChildren(
        el('div', 'threat-title', threat ? t('Угроза {n} · +{c} ♛ за победу', { n: threat, c: threat }) : t('Без угрозы')),
        ...rules.map((r) => el('div', `threat-rule${r.level === threat ? ' new' : ''}`, `${r.level}. ${r.name} — ${r.text}`)),
      );
    };
    render();
    box.append(el('div', 'threat-label', t('Уровень угрозы')), row, info);
    content.append(box);
  }
  const grid = el('div', 'army-grid');
  const close = openModal(content, { dismissable: false, cls: 'army-modal' });
  for (const id of ARMY_ORDER) {
    const def = ARMIES[id];
    const open = s.armies.includes(id);
    const card = el('button', `army-card${open ? '' : ' locked'}${s.run.army === id ? ' last' : ''}`);
    card.disabled = !open;
    const pics = el('div', 'army-pics');
    const add = (kind: PieceKind) => {
      const img = el('img');
      img.src = spriteUrl(kind, 'ally');
      img.alt = '';
      pics.append(img);
    };
    add('king');
    for (const [kind, n] of Object.entries(def.pieces) as [PieceKind, number][]) for (let i = 0; i < n; i++) add(kind);
    card.append(el('div', 'army-name', def.name), pics, el('div', 'army-rule', open ? def.rule : `🔒 ${def.unlock}`),
      el('div', 'army-gold', open ? t('Золото: {n}', { n: def.gold }) : ''));
    card.addEventListener('click', () => {
      close();
      onPick(id, threat);
    });
    grid.append(card);
  }
  content.append(grid);
}

/** The end of a run: how far it got and the crowns it paid. `onNext` runs after the next run starts. */
export function openRunEnd(ctx: Ctx, onNext: () => void): void {
  const s = ctx.state;
  const o: RunOver | null = s.run.over;
  if (!o) return;
  const content = el('div', `run-end ${o.won ? 'won' : 'lost'}`);
  const where = o.at.startsWith('abyss-')
    ? t('в Бездне на этаже {n}', { n: o.abyss + 1 })
    : o.won ? t('после победы над Чёрным ферзём') : t('в главе {n} «{chapter}», бой «{level}»', { n: o.chapter, chapter: CHAPTERS[o.chapter - 1].name, level: levelOf(o.at).name });
  content.append(
    el('h2', 'run-end-title', o.won ? t('Партия выиграна!') : t('Забег окончен')),
    el('p', 'run-end-where', o.won ? t('Забег завершён {where}.', { where }) : t('Армия пала {where}.', { where })),
  );
  const stats = el('ul', 'run-end-stats');
  for (const [label, value] of [
    [t('Побед в боях'), o.wins], [t('Элитных отрядов'), o.elites], [t('Боссов'), o.bosses], ...(o.abyss ? [[t('Этажей Бездны'), o.abyss]] : []),
  ] as [string, number][]) {
    stats.append(el('li', '', `${label}: ${value}`));
  }
  content.append(stats, el('div', 'result-reward', t('+{n} ♛ короны', { n: o.crowns })));
  content.append(el('p', 'hint', o.won
    ? t('Следующая партия будет труднее: Чёрный король принесёт новое искажение. Короны тратятся в Древе короны.')
    : t('Короны остаются с вами — потратьте их в Древе короны. {tip}Новый забег начнётся с 1-1.', { tip: o.crowns ? '' : t('Короны дают боссы — дойдите хотя бы до первого. ') })));
  const actions = el('div', 'modal-actions');
  const next = el('button', 'btn btn-primary', o.won ? t('Новая партия ▶') : t('Новый забег ▶'));
  actions.append(next);
  content.append(actions);
  const close = openModal(content, { dismissable: false, cls: 'run-end-modal' });
  audio.play(o.won ? 'achievement' : 'lose');
  next.addEventListener('click', () => {
    close();
    pickArmy(ctx, (army, threat) => {
      startNextRun(s, Date.now(), army, threat);
      ctx.save();
      onNext();
    });
  });
}

function modal(title: string, text: string): { content: HTMLElement; body: HTMLElement; actions: HTMLElement } {
  const content = el('div', 'node-dialog');
  const body = el('div', 'node-body');
  const actions = el('div', 'modal-actions');
  content.append(el('h2', '', title), el('p', 'node-text', text), body, actions);
  return { content, body, actions };
}

/**
 * A look at a fight before stepping on its node (stepping in is final: the path is chosen).
 * `onGo` enters the node.
 */
export function openBattlePreview(ctx: Ctx, node: RunNode, onGo: () => void): void {
  const s = ctx.state;
  const level = levelOf(node.level!);
  const elite = node.kind === 'elite';
  const enemies = withElites(level.id, enemyPlacements(level), elite);
  const lv = enemyLevel(s, level.id, elite);
  const kind = node.kind === 'boss' ? t('Босс') : elite ? t('Элита') : t('Бой');
  const { content, body, actions } = modal(nodeLabel(node), t('{kind} · {id} «{name}»', { kind, id: level.id, name: level.name }));
  content.classList.add('preview-dialog', `preview-${node.kind}`);
  body.append(el('div', 'preview-line', t('Враги: {n} · ур. {lv}', { n: enemies.length + (elite && node.rule === 'mirror' ? 0 : 0), lv })));
  const traits = enemies.filter((p) => p.trait);
  if (traits.length) {
    const row = el('div', 'preview-traits');
    for (const p of traits) {
      const chip = el('span', 'terrain-chip');
      const img = el('img');
      img.src = traitUrl(p.trait!);
      img.alt = '';
      chip.append(img, `${traitAdjective(p.trait!, p.kind)} ${PIECES[p.kind].name.toLowerCase()}`);
      chip.title = TRAITS[p.trait!].text;
      row.append(chip);
    }
    body.append(row);
  }
  if (elite && node.rule) {
    const r = ELITE_RULES[node.rule];
    body.append(el('div', 'preview-rule', `☠ ${r.name}: ${r.text}.`), el('div', 'preview-note', t('Чемпион: самая сильная фигура врага — крупнее, крепче и всегда со свойством.')));
  }
  const boss = node.kind === 'boss' ? bossFor(level.id) : undefined;
  if (boss) {
    const d = BOSSES[boss];
    if (d.passive) body.append(el('div', 'preview-rule', `◆ ${d.passive}: ${d.passiveText}.`));
    body.append(el('div', 'preview-rule', `★ ${d.skill}: ${d.skillText}.`), el('div', 'preview-rule', `☠ ${d.rage}: ${d.rageText}.`));
  }
  body.append(el('div', 'preview-reward', t('Награда: +{gold} золота', { gold: fmt(battleGold(s, level.id, elite)) }) + (elite || boss ? t(' · реликвия') : '')));
  const close = openModal(content, { cls: 'node-modal' });
  const back = el('button', 'btn btn-ghost', t('Назад'));
  back.addEventListener('click', close);
  const go = el('button', `btn ${elite || boss ? 'btn-danger' : 'btn-primary'}`, t('В бой ▶'));
  go.addEventListener('click', () => {
    close();
    onGo();
  });
  actions.append(back, go);
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
      const next = el('button', 'btn btn-primary', t('Дальше'));
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
  const { content, body, actions } = modal(t('Торговец'), t('Бродячий торговец разложил товар у дороги. Купить можно один раз.'));
  const close = openModal(content, { dismissable: false, cls: 'node-modal' });
  const gold = el('div', 'shop-gold');
  const render = () => {
    gold.textContent = t('Золото: {n}', { n: fmt(s.gold) });
    body.replaceChildren(gold, ...shopItems(s, node).map((item) => {
      const row = el('div', 'shop-item');
      const icon = item.relic ? relicIcon(item.relic) : el('img', 'shop-icon');
      if (!item.relic) (icon as HTMLImageElement).src = iconUrl('sword');
      const text = el('div', 'shop-text');
      text.append(el('b', '', item.relic ? RELICS[item.relic].name : item.name), el('span', '', item.relic ? RELICS[item.relic].description : item.text));
      const why = canBuy(s, node, item);
      const buy = el('button', 'btn btn-buy btn-small', why === t('Куплено') || why === t('Уже есть') ? why : fmt(item.cost));
      buy.disabled = !!why;
      if (why && why !== t('Куплено') && why !== t('Уже есть')) buy.title = why;
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
  const leave = el('button', 'btn btn-primary', t('Уйти'));
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
  const { content, body } = modal(t('Лагерь'), t('Армия разбила лагерь у костра. Есть время на одно дело.'));
  const close = openModal(content, { dismissable: false, cls: 'node-modal' });
  const finish = (text: string) => {
    ctx.save();
    audio.play('achievement');
    toast(text, 'good');
    close();
    onDone();
  };
  const forge = el('button', 'btn choice-btn');
  const gain = campGain(s);
  const levels = plural(gain, ['уровень', 'уровня', 'уровней'], ['level', 'levels']);
  forge.append(el('span', 'choice-label', t('Заточить оружие')), el('span', 'choice-hint', t('+{n} {levels} Кузницы (сейчас {now})', { n: gain, levels, now: s.buildings.forge })));
  forge.addEventListener('click', () => {
    campForge(s);
    finish(t('Кузница: +{n}', { n: campGain(s) }));
  });
  body.append(forge, el('div', 'camp-train-title', t('Или тренировка: +{n} {levels} бесплатно', { n: gain, levels })));
  const grid = el('div', 'camp-train');
  for (const kind of Object.keys(s.army) as PieceKind[]) {
    if (s.army[kind] <= 0) continue;
    const btn = el('button', 'btn camp-piece');
    const img = el('img');
    img.src = spriteUrl(kind, 'ally');
    img.alt = '';
    btn.append(img, el('span', '', t('{name} → ур. {lv}', { name: PIECES[kind].name, lv: s.levels[kind] + 1 })), el('span', 'choice-hint', t('стоит {cost}', { cost: fmt(upgradeCost(s, kind)) })));
    btn.addEventListener('click', () => {
      if (campTrain(s, kind)) finish(t('{name}: ур. {lv}', { name: PIECES[kind].name, lv: s.levels[kind] }));
    });
    grid.append(btn);
  }
  body.append(grid);
}
