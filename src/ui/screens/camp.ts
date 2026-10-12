import { UNLOCKED_BY, getLevel } from '../../game/levels';
import { ABILITY_LEVELS, abilityOf, abilityTier, type Branch } from '../../game/abilities';
import { BUFF_BY_ID, EPIC_PITY, LEGEND_PITY, RARITY, SPIN_COST, ownedSummary } from '../../game/roulette';
import { PIECES, PRESTIGE_PIECES, levelMultiplier, type PieceKind } from '../../game/pieces';
import {
  BUILDINGS, BUILDING_ORDER, buildingCost, buyBuilding, armyCap, spinCost, spinRoulette, isAbyssOpen, forgeMultiplier, isUnlocked, recruit, recruitCost,
  upgradeCost, upgradePiece, type BuildingId,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { el, infoBtn, pulse, setText, toast } from '../dom';
import { featureOpen } from '../../game/features';
import { fmt } from '../format';
import { audio } from '../audio';
import { spriteUrl, type Tier } from '../sprites';
import { openCodex } from '../codex';
import { showMulti, showSpin } from '../roulette';

const ARMY_ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];
const SHORT_BUILDING: Record<BuildingId, string> = { hq: '+1 фигура в бою', forge: '+6% к силе армии' };

interface ArmyRow {
  kind: PieceKind;
  root: HTMLElement;
  meta: HTMLElement;
  stats: HTMLElement;
  ability: HTMLButtonElement[];
  icon: HTMLImageElement;
  recruitBtn: HTMLButtonElement;
  upgradeBtn: HTMLButtonElement;
}

interface BuildingRow { id: BuildingId; level: HTMLElement; btn: HTMLButtonElement }

export class CampScreen implements Screen {
  readonly root = el('section', 'camp-screen');
  private armyRows: ArmyRow[] = [];
  private buildingRows: BuildingRow[] = [];
  private buildingsCard!: HTMLElement;
  private altarCard = el('div', 'card camp-altar');
  private shardCount = el('span', 'shard-count');
  private spinBtn = el('button', 'btn btn-shard spin-btn');
  private spin10Btn = el('button', 'btn btn-shard spin-btn');
  private pityLine = el('div', 'pity-line');
  private legendList = el('div', 'legend-list');
  private bonusList = el('div', 'bonus-list');
  private rouletteSig = '';

  constructor(private ctx: Ctx) {
    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', '← Карта');
    back.addEventListener('click', () => this.ctx.go('map'));
    const titles = el('div', 'arena-titles');
    titles.append(el('h1', 'arena-title', 'Улучшения'));
    const codexBtn = el('button', 'btn btn-small', 'Справочник');
    codexBtn.addEventListener('click', () => openCodex(this.ctx.state));
    top.append(back, titles, codexBtn);

    const army = el('div', 'card camp-army');
    const armyHead = el('div', 'panel-head');
    armyHead.append(el('span', 'panel-title', 'Армия'), infoBtn('Армия',
      'Нанимайте фигуры и повышайте уровень типа: он действует на все фигуры этого типа, +18% к силе за уровень.\n'
      + `На ${ABILITY_LEVELS[0]}-м уровне фигура получает приём и стальную броню, на ${ABILITY_LEVELS[1]}-м приём усиливается, броня становится золотой.`));
    army.append(armyHead);
    for (const kind of ARMY_ORDER) army.append(this.buildArmyRow(kind));

    const buildings = el('div', 'card camp-buildings');
    this.buildingsCard = buildings;
    const bHead = el('div', 'panel-head');
    bHead.append(el('span', 'panel-title', 'Постройки'), infoBtn('Постройки',
      BUILDING_ORDER.map((id) => `${BUILDINGS[id].name}: ${BUILDINGS[id].description}.`).join('\n')));
    buildings.append(bHead);
    for (const id of BUILDING_ORDER) buildings.append(this.buildBuildingRow(id));

    const altarHead = el('div', 'panel-head');
    altarHead.append(el('span', 'panel-title', 'Рулетка бездны'), this.shardCount, infoBtn('Рулетка бездны',
      `Осколки ◆ добываются только в Бездне. Каждая крутка стоит ${SPIN_COST} ◆ (4 ◆ с доктриной «Удача») и даёт случайное вечное улучшение — оно остаётся даже после новой партии.\n`
      + Object.values(RARITY).map((r) => `${r.name}: ${r.weight}%`).join(' · ') + '\n'
      + `Эпическая или лучше — не реже раза в ${EPIC_PITY} круток, легендарная — не позже ${LEGEND_PITY}-й.\n`
      + 'Легендарные улучшения уникальны и меняют поведение фигур.'));
    const spinRow = el('div', 'spin-buttons');
    this.spinBtn.addEventListener('click', () => this.spin(1));
    this.spin10Btn.addEventListener('click', () => this.spin(10));
    spinRow.append(this.spinBtn, this.spin10Btn);
    this.altarCard.append(altarHead, spinRow, this.pityLine, this.legendList, this.bonusList);
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
    const meta = el('span', 'row-level');
    name.append(' ', meta, infoBtn(def.name, () => this.pieceInfo(kind)));
    const stats = el('div', 'row-meta');
    const ability = ([0, 1] as Branch[]).map((branch) => {
      const chip = el('button', 'ability-chip');
      chip.addEventListener('click', () => {
        const st = this.ctx.state;
        if (st.abilityBranch[kind] === branch) return;
        st.abilityBranch[kind] = branch;
        this.ctx.save();
        toast(`${def.name}: приём «${abilityOf(kind, branch).name}»`, 'good');
      });
      return chip;
    });
    const pick = el('div', 'ability-pick');
    pick.append(...ability);
    body.append(name, stats, pick);
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
          const ab = abilityOf(kind, this.ctx.state.abilityBranch[kind]);
          toast(tier === 1
            ? `${PIECES[kind].name} в стальной броне и выучил приём «${ab.name}»!`
            : `${PIECES[kind].name} в золотой броне, «${ab.name}» усилен!`, 'good');
        } else audio.play('levelup');
        this.ctx.save();
      }
    });
    if (kind === 'king') recruitBtn.hidden = true;
    actions.append(recruitBtn, upgradeBtn);
    const portrait = el('div', 'portrait');
    portrait.append(icon);
    root.append(portrait, body, actions);
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
    body.append(name, el('div', 'row-desc', SHORT_BUILDING[id]));
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

  private spin(count: number): void {
    const prizes = spinRoulette(this.ctx.state, count);
    if (!prizes) return;
    this.ctx.save();
    const done = () => {
      this.rouletteSig = '';
    };
    if (count === 1) showSpin(prizes[0], done);
    else showMulti(prizes, done);
  }

  /** Full description behind the "?" of a piece row. */
  private pieceInfo(kind: PieceKind): string {
    const def = PIECES[kind];
    const [lv1, lv2] = ABILITY_LEVELS;
    const unlock = UNLOCKED_BY[kind];
    const branch = (b: Branch) => {
      const ab = abilityOf(kind, b);
      return `${this.ctx.state.abilityBranch[kind] === b ? '▶' : '·'} «${ab.name}»: ${ab.tiers[0]} С ур. ${lv2}: ${ab.tiers[1]}`;
    };
    return [
      `${def.role}. ${def.description}`,
      `Приём с ур. ${lv1} — выберите один из двух, менять можно в любой момент:`,
      branch(0),
      branch(1),
      ...(isUnlocked(this.ctx.state, kind) || !unlock ? [] : [`🔒 Откроется после боя ${unlock} «${getLevel(unlock).name}».`]),
    ].join('\n');
  }

  show(): void {}

  frame(): void {
    this.buildingsCard.hidden = !featureOpen(this.ctx.state, 'buildings');
    const s = this.ctx.state;
    const forge = forgeMultiplier(s);
    for (const row of this.armyRows) {
      const def = PIECES[row.kind];
      const unlocked = isUnlocked(s, row.kind);
      row.root.classList.toggle('locked', !unlocked);
      // Prestige pieces stay out of sight until the Crown Tree unlocks them.
      row.root.hidden = PRESTIGE_PIECES.includes(row.kind) && !unlocked;
      const lvl = s.levels[row.kind];
      const m = levelMultiplier(lvl) * forge;
      const tier = abilityTier(lvl);
      const stats = unlocked
        ? `❤ ${fmt(def.hp * m)}  ⚔ ${fmt(def.atk * m)}${def.range ? `  ◎ ${def.range}` : ''}  `
        : `🔒 после ${UNLOCKED_BY[row.kind]}  `;
      setText(row.stats, stats.trim());
      setText(row.meta, unlocked ? `ур. ${lvl}${row.kind === 'king' ? '' : ` · ×${s.army[row.kind]}`}` : '');
      const chosen = s.abilityBranch[row.kind];
      row.ability.forEach((chip, i) => {
        const ab = abilityOf(row.kind, i as Branch);
        setText(chip, `${tier === 2 ? '★★' : '★'} ${ab.name}`);
        chip.title = `${tier === 0 ? `С ур. ${ABILITY_LEVELS[0]}: ` : ''}${ab.tiers[Math.max(0, tier - 1)]}`;
        chip.classList.toggle('chosen', i === chosen);
        chip.classList.toggle('learned', tier > 0 && i === chosen);
        chip.hidden = !unlocked;
      });
      const src = spriteUrl(row.kind, 'ally', tier as Tier);
      if (row.icon.src !== src) row.icon.src = src;
      row.icon.classList.toggle('tier-2', tier === 2);
      row.icon.parentElement!.dataset.tier = String(unlocked ? tier : -1);

      const cap = armyCap(s, row.kind);
      const maxed = s.army[row.kind] >= cap;
      const rCost = recruitCost(s, row.kind);
      setText(row.recruitBtn, !unlocked ? '🔒' : maxed ? (cap === 1 ? 'Есть' : `Все ${cap}`) : `Нанять · ${fmt(rCost)}`);
      row.recruitBtn.disabled = !unlocked || maxed || s.gold < rCost;

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
    const r = s.roulette;
    this.altarCard.hidden = !isAbyssOpen(s) && s.shards === 0 && r.spins === 0;
    setText(this.shardCount, `◆ ${fmt(s.shards)}`);
    const cost = spinCost(s);
    setText(this.spinBtn, `Крутить · ${cost} ◆`);
    setText(this.spin10Btn, `×10 · ${cost * 10} ◆`);
    this.spinBtn.disabled = s.shards < cost;
    this.spin10Btn.disabled = s.shards < cost * 10;
    setText(this.pityLine, `До гаранта: эпической — ${EPIC_PITY - r.sinceEpic}, легендарной — ${LEGEND_PITY - r.sinceLegend}`);
    const sig = JSON.stringify(r.owned);
    if (sig !== this.rouletteSig) {
      this.rouletteSig = sig;
      const legends = Object.keys(r.owned).map((id) => BUFF_BY_ID[id]).filter((b) => b?.legend);
      this.legendList.replaceChildren(...legends.map((b) => {
        const chip = el('span', 'legend-chip', `♛ ${b.name}`);
        chip.title = b.text;
        return chip;
      }));
      const lines = ownedSummary(r);
      this.bonusList.replaceChildren(...(lines.length ? lines : ['Пока пусто — крутите рулетку!']).map((l) => el('div', 'bonus-line', l)));
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
