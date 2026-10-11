import { UNLOCKED_BY, getLevel } from '../../game/levels';
import { PIECES, levelMultiplier, type PieceKind } from '../../game/pieces';
import {
  BUILDINGS, BUILDING_ORDER, buildingCost, buyBuilding, forgeMultiplier, isUnlocked, recruit, recruitCost,
  upgradeCost, upgradePiece, type BuildingId,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { el, pulse, setText } from '../dom';
import { fmt } from '../format';
import { audio } from '../audio';
import { spriteUrl } from '../sprites';

const ARMY_ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen'];

interface ArmyRow {
  kind: PieceKind;
  root: HTMLElement;
  meta: HTMLElement;
  stats: HTMLElement;
  recruitBtn: HTMLButtonElement;
  upgradeBtn: HTMLButtonElement;
}

interface BuildingRow { id: BuildingId; level: HTMLElement; btn: HTMLButtonElement }

export class CampScreen implements Screen {
  readonly root = el('section', 'camp-screen');
  private armyRows: ArmyRow[] = [];
  private buildingRows: BuildingRow[] = [];

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

    const grid = el('div', 'camp-grid');
    grid.append(army, buildings);
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
    body.append(name, el('div', 'row-desc', def.description), stats, meta);
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
      if (upgradePiece(this.ctx.state, kind)) {
        pulse(upgradeBtn);
        audio.play('buy');
        this.ctx.save();
      }
    });
    if (kind === 'king') recruitBtn.hidden = true;
    actions.append(recruitBtn, upgradeBtn);
    root.append(icon, body, actions);
    this.armyRows.push({ kind, root, meta, stats, recruitBtn, upgradeBtn });
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
      setText(row.meta, unlocked ? `Уровень ${lvl} · в армии ${s.army[row.kind]}` : '');

      const maxedQueen = row.kind === 'queen' && s.army.queen >= 1;
      const rCost = recruitCost(s, row.kind);
      setText(row.recruitBtn, !unlocked ? '🔒' : maxedQueen ? 'Есть' : `Нанять · ${fmt(rCost)}`);
      row.recruitBtn.disabled = !unlocked || maxedQueen || s.gold < rCost;

      const uCost = upgradeCost(s, row.kind);
      setText(row.upgradeBtn, unlocked ? `Ур. ${lvl + 1} · ${fmt(uCost)}` : '🔒');
      row.upgradeBtn.disabled = !unlocked || s.gold < uCost;
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
