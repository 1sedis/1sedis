import { UNLOCKED_BY, getLevel } from '../../game/levels';
import { ABILITIES, ABILITY_LEVELS, abilityTier } from '../../game/abilities';
import { ALTAR, ALTAR_ORDER, type AltarId } from '../../game/altar';
import { PIECES, levelMultiplier, type PieceKind } from '../../game/pieces';
import {
  BUILDINGS, BUILDING_ORDER, altarCost, buildingCost, buyAltar, buyBuilding, isAbyssOpen, forgeMultiplier, isUnlocked, recruit, recruitCost,
  upgradeCost, upgradePiece, type BuildingId,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { el, pulse, setText, toast } from '../dom';
import { fmt } from '../format';
import { audio } from '../audio';
import { spriteUrl, type Tier } from '../sprites';

const ARMY_ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen'];

interface ArmyRow {
  kind: PieceKind;
  root: HTMLElement;
  meta: HTMLElement;
  stats: HTMLElement;
  ability: HTMLElement;
  icon: HTMLImageElement;
  recruitBtn: HTMLButtonElement;
  upgradeBtn: HTMLButtonElement;
}

interface BuildingRow { id: BuildingId; level: HTMLElement; btn: HTMLButtonElement }

export class CampScreen implements Screen {
  readonly root = el('section', 'camp-screen');
  private armyRows: ArmyRow[] = [];
  private buildingRows: BuildingRow[] = [];
  private altarCard = el('div', 'card camp-altar');
  private shardCount = el('span', 'shard-count');
  private altarRows: { id: AltarId; level: HTMLElement; btn: HTMLButtonElement }[] = [];

  constructor(private ctx: Ctx) {
    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', '← Карта');
    back.addEventListener('click', () => this.ctx.go('map'));
    const titles = el('div', 'arena-titles');
    titles.append(el('h1', 'arena-title', 'Улучшения'), el('div', 'arena-sub', 'Нанимайте фигуры и повышайте их уровень: он действует на все фигуры этого типа'));
    top.append(back, titles);

    const army = el('div', 'card camp-army');
    army.append(el('div', 'panel-title', 'Армия'));
    for (const kind of ARMY_ORDER) army.append(this.buildArmyRow(kind));

    const buildings = el('div', 'card camp-buildings');
    buildings.append(el('div', 'panel-title', 'Постройки'));
    for (const id of BUILDING_ORDER) buildings.append(this.buildBuildingRow(id));

    const altarHead = el('div', 'panel-head');
    altarHead.append(el('span', 'panel-title', 'Алтарь бездны'), this.shardCount);
    this.altarCard.append(altarHead,
      el('p', 'hint', 'Осколки добываются только в Бездне. Улучшения алтаря остаются навсегда, даже после новой партии.'));
    for (const id of ALTAR_ORDER) this.altarCard.append(this.buildAltarRow(id));
    const sideCol = el('div', 'camp-side');
    sideCol.append(buildings, this.altarCard);

    const grid = el('div', 'camp-grid');
    grid.append(army, sideCol);
    this.root.append(top, grid);
  }

  private buildArmyRow(kind: PieceKind): HTMLElement {
    const def = PIECES[kind];
    const root = el('div', 'row army-row');
    const icon = el('img', 'row-icon');
    icon.src = spriteUrl(kind, 'ally');
    icon.alt = '';
    const body = el('div', 'row-body');
    const name = el('div', 'row-name', def.name);
    name.append(el('span', 'row-role', ` · ${def.role}`));
    const meta = el('div', 'row-level');
    const stats = el('div', 'row-meta');
    const ability = el('div', 'row-ability');
    body.append(name, el('div', 'row-desc', def.description), stats, ability, meta);
    const actions = el('div', 'row-actions');
    const recruitBtn = el('button', 'btn btn-buy');
    recruitBtn.addEventListener('click', () => {
      if (recruit(this.ctx.state, kind)) {
        pulse(recruitBtn);
        audio.play('buy');
        this.ctx.save();
      }
    });
    const upgradeBtn = el('button', 'btn btn-up');
    upgradeBtn.addEventListener('click', () => {
      const before = abilityTier(this.ctx.state.levels[kind]);
      if (upgradePiece(this.ctx.state, kind)) {
        pulse(upgradeBtn);
        const tier = abilityTier(this.ctx.state.levels[kind]);
        if (tier > before) {
          audio.play('levelup');
          pulse(icon);
          icon.classList.add('evolve');
          setTimeout(() => icon.classList.remove('evolve'), 900);
          const ab = ABILITIES[kind];
          toast(tier === 1
            ? `${PIECES[kind].name} в стальной броне и выучил приём «${ab.name}»!`
            : `${PIECES[kind].name} в золотой броне, «${ab.name}» усилен!`, 'good');
        } else audio.play('levelup');
        this.ctx.save();
      }
    });
    if (kind === 'king') recruitBtn.hidden = true;
    actions.append(recruitBtn, upgradeBtn);
    root.append(icon, body, actions);
    this.armyRows.push({ kind, root, meta, stats, ability, icon, recruitBtn, upgradeBtn });
    return root;
  }

  private buildBuildingRow(id: BuildingId): HTMLElement {
    const def = BUILDINGS[id];
    const root = el('div', 'row');
    const body = el('div', 'row-body');
    const level = el('span', 'row-level');
    const name = el('div', 'row-name', def.name);
    name.append(' ', level);
    body.append(name, el('div', 'row-desc', def.description));
    const btn = el('button', 'btn btn-buy');
    btn.addEventListener('click', () => {
      if (buyBuilding(this.ctx.state, id)) {
        pulse(btn);
        audio.play('buy');
        this.ctx.save();
      }
    });
    root.append(el('div', `row-badge badge-${id}`), body, btn);
    this.buildingRows.push({ id, level, btn });
    return root;
  }

  private buildAltarRow(id: AltarId): HTMLElement {
    const def = ALTAR[id];
    const root = el('div', 'row');
    const body = el('div', 'row-body');
    const level = el('span', 'row-level');
    const name = el('div', 'row-name', def.name);
    name.append(' ', level);
    body.append(name, el('div', 'row-desc', def.description));
    const btn = el('button', 'btn btn-shard');
    btn.addEventListener('click', () => {
      if (buyAltar(this.ctx.state, id)) {
        pulse(btn);
        audio.play('relic');
        this.ctx.save();
      }
    });
    root.append(el('div', 'row-badge badge-shard'), body, btn);
    this.altarRows.push({ id, level, btn });
    return root;
  }

  show(): void {}

  frame(): void {
    const s = this.ctx.state;
    const forge = forgeMultiplier(s);
    for (const row of this.armyRows) {
      const def = PIECES[row.kind];
      const unlocked = isUnlocked(s, row.kind);
      row.root.classList.toggle('locked', !unlocked);
      const lvl = s.levels[row.kind];
      const m = levelMultiplier(lvl) * forge;
      setText(row.stats, unlocked
        ? `❤ ${fmt(def.hp * m)}   ⚔ ${fmt(def.atk * m)}${def.range ? `   ◎ ${def.range}` : ''}`
        : `Откроется после боя ${UNLOCKED_BY[row.kind]} «${getLevel(UNLOCKED_BY[row.kind]!).name}»`);
      const armor = ['обычная броня, стальная с ур. 5', 'стальная броня, золотая с ур. 10', 'золотая броня'][abilityTier(lvl)];
      setText(row.meta, unlocked ? `Уровень ${lvl} · ${armor} · в армии ${s.army[row.kind]}` : '');
      const ab = ABILITIES[row.kind];
      const tier = abilityTier(lvl);
      const src = spriteUrl(row.kind, 'ally', tier as Tier);
      if (row.icon.src !== src) row.icon.src = src;
      row.icon.classList.toggle('tier-2', tier === 2);
      const [lv1, lv2] = ABILITY_LEVELS;
      setText(row.ability, tier === 0
        ? `★ «${ab.name}» с ур. ${lv1}: ${ab.tiers[0]}`
        : tier === 1
          ? `★ «${ab.name}»: ${ab.tiers[0]} С ур. ${lv2}: ${ab.tiers[1]}`
          : `★★ «${ab.name}»: ${ab.tiers[0]} ${ab.tiers[1]}`);
      row.ability.classList.toggle('learned', tier > 0);
      row.ability.hidden = !unlocked;

      const maxedQueen = row.kind === 'queen' && s.army.queen >= 1;
      const rCost = recruitCost(s, row.kind);
      setText(row.recruitBtn, !unlocked ? '🔒' : maxedQueen ? 'Есть' : `Нанять · ${fmt(rCost)}`);
      row.recruitBtn.disabled = !unlocked || maxedQueen || s.gold < rCost;

      const uCost = upgradeCost(s, row.kind);
      setText(row.upgradeBtn, unlocked ? `Ур. ${lvl + 1} · ${fmt(uCost)}` : '🔒');
      row.upgradeBtn.disabled = !unlocked || s.gold < uCost;
    }
    const pawnRow = this.armyRows.find((r) => r.kind === 'pawn');
    const knightRow = this.armyRows.find((r) => r.kind === 'knight');
    void (this.ctx.tip('t_camp_up', pawnRow?.upgradeBtn,
      'Уровень усиливает все фигуры этого типа. На 5-м уровне фигура выучит особый приём.')
      || (isUnlocked(s, 'knight') && s.army.knight === 0 && this.ctx.tip('t_knight', knightRow?.recruitBtn,
        'Конь открыт! Наймите его: он прыгает через строй и охотится на стрелков и короля.')));
    this.altarCard.hidden = !isAbyssOpen(s) && s.shards === 0 && ALTAR_ORDER.every((id) => s.altar[id] === 0);
    setText(this.shardCount, `◆ ${fmt(s.shards)}`);
    for (const row of this.altarRows) {
      const def = ALTAR[row.id];
      const lvl = s.altar[row.id];
      const maxed = lvl >= def.maxLevel;
      setText(row.level, `${lvl}/${def.maxLevel}`);
      const cost = altarCost(s, row.id);
      setText(row.btn, maxed ? 'Макс.' : `◆ ${fmt(cost)}`);
      row.btn.disabled = maxed || s.shards < cost;
    }
    for (const row of this.buildingRows) {
      const def = BUILDINGS[row.id];
      const lvl = s.buildings[row.id];
      const maxed = lvl >= def.maxLevel;
      setText(row.level, `${lvl}/${def.maxLevel}`);
      const cost = buildingCost(s, row.id);
      setText(row.btn, maxed ? 'Макс.' : fmt(cost));
      row.btn.disabled = maxed || s.gold < cost;
    }
  }
}
