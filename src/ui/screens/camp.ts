import { UNLOCKED_BY, getLevel } from '../../game/levels';
import { ABILITY_LEVELS, abilityOf, abilityTier, type Branch } from '../../game/abilities';
import { PIECES, PRESTIGE_PIECES, levelMultiplier, type PieceKind } from '../../game/pieces';
import {
  BUILDINGS, BUILDING_ORDER, buildingCost, buyBuilding, armyCap, forgeMultiplier, isUnlocked, recruit, recruitCost,
  upgradeCost, upgradePiece, type BuildingId,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { el, infoBtn, pulse, setText, toast } from '../dom';
import { featureOpen } from '../../game/features';
import { fmt } from '../format';
import { audio } from '../audio';
import { spriteUrl, type Tier } from '../sprites';
import { openCodex } from '../codex';
import { t } from '../../i18n';

const ARMY_ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];
const SHORT_BUILDING: Record<BuildingId, string> = { hq: t('+1 фигура в бою'), forge: t('+6% к силе армии') };

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

  constructor(private ctx: Ctx) {
    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', t('← Карта'));
    back.addEventListener('click', () => this.ctx.go('map'));
    const titles = el('div', 'arena-titles');
    titles.append(el('h1', 'arena-title', t('Улучшения')));
    const codexBtn = el('button', 'btn btn-small', t('Справочник'));
    codexBtn.addEventListener('click', () => openCodex(this.ctx.state));
    top.append(back, titles, codexBtn);

    const army = el('div', 'card camp-army');
    const armyHead = el('div', 'panel-head');
    armyHead.append(el('span', 'panel-title', t('Армия')), infoBtn(t('Армия'),
      t('Нанимайте фигуры и повышайте уровень типа: он действует на все фигуры этого типа, +18% к силе за уровень.\nНа {lv1}-м уровне фигура получает приём и стальную броню, на {lv2}-м приём усиливается, броня становится золотой.', { lv1: ABILITY_LEVELS[0], lv2: ABILITY_LEVELS[1] })));
    army.append(armyHead);
    for (const kind of ARMY_ORDER) army.append(this.buildArmyRow(kind));

    const buildings = el('div', 'card camp-buildings');
    this.buildingsCard = buildings;
    const bHead = el('div', 'panel-head');
    bHead.append(el('span', 'panel-title', t('Постройки')), infoBtn(t('Постройки'),
      BUILDING_ORDER.map((id) => `${BUILDINGS[id].name}: ${BUILDINGS[id].description}.`).join('\n')));
    buildings.append(bHead);
    for (const id of BUILDING_ORDER) buildings.append(this.buildBuildingRow(id));

    const sideCol = el('div', 'camp-side');
    sideCol.append(buildings);

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
        toast(t('{name}: приём «{ab}»', { name: def.name, ab: abilityOf(kind, branch).name }), 'good');
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
            ? t('{name} в стальной броне и выучил приём «{ab}»!', { name: PIECES[kind].name, ab: ab.name })
            : t('{name} в золотой броне, «{ab}» усилен!', { name: PIECES[kind].name, ab: ab.name }), 'good');
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

  /** Full description behind the "?" of a piece row. */
  private pieceInfo(kind: PieceKind): string {
    const def = PIECES[kind];
    const [lv1, lv2] = ABILITY_LEVELS;
    const unlock = UNLOCKED_BY[kind];
    const branch = (b: Branch) => {
      const ab = abilityOf(kind, b);
      return t('{mark} «{name}»: {t1} С ур. {lv}: {t2}', { mark: this.ctx.state.abilityBranch[kind] === b ? '▶' : '·', name: ab.name, t1: ab.tiers[0], lv: lv2, t2: ab.tiers[1] });
    };
    return [
      `${def.role}. ${def.description}`,
      t('Приём с ур. {lv} — выберите один из двух, менять можно в любой момент:', { lv: lv1 }),
      branch(0),
      branch(1),
      ...(isUnlocked(this.ctx.state, kind) || !unlock ? [] : [t('🔒 Откроется после боя {id} «{name}».', { id: unlock, name: getLevel(unlock).name })]),
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
        : `${t('🔒 после {id}', { id: String(UNLOCKED_BY[row.kind]) })}  `;
      setText(row.stats, stats.trim());
      setText(row.meta, unlocked ? `${t('ур. {lv}', { lv: lvl })}${row.kind === 'king' ? '' : ` · ×${s.army[row.kind]}`}` : '');
      const chosen = s.abilityBranch[row.kind];
      row.ability.forEach((chip, i) => {
        const ab = abilityOf(row.kind, i as Branch);
        setText(chip, `${tier === 2 ? '★★' : '★'} ${ab.name}`);
        chip.title = `${tier === 0 ? t('С ур. {lv}: ', { lv: ABILITY_LEVELS[0] }) : ''}${ab.tiers[Math.max(0, tier - 1)]}`;
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
      const rMain = !unlocked ? '🔒' : maxed ? (cap === 1 ? t('Есть') : t('Все {n}', { n: cap })) : t('Нанять · {cost}', { cost: fmt(rCost) });
      const rSub = !unlocked || maxed ? '' : s.gold < rCost ? t('не хватает {n}', { n: fmt(rCost - s.gold) }) : t('придёт ур. {lv}', { lv: lvl });
      twoLines(row.recruitBtn, rMain, rSub);
      row.recruitBtn.disabled = !unlocked || maxed || s.gold < rCost;

      const uCost = upgradeCost(s, row.kind);
      const gain = Math.round((levelMultiplier(lvl + 1) / levelMultiplier(lvl) - 1) * 100);
      const uSub = !unlocked ? '' : s.gold < uCost ? t('не хватает {n}', { n: fmt(uCost - s.gold) })
        : row.kind === 'king' ? t('+{p}% ❤⚔', { p: gain }) : t('+{p}% ❤⚔ всем ×{n}', { p: gain, n: s.army[row.kind] });
      twoLines(row.upgradeBtn, unlocked ? t('Ур. {lv} · {cost}', { lv: lvl + 1, cost: fmt(uCost) }) : '🔒', uSub);
      row.upgradeBtn.disabled = !unlocked || s.gold < uCost;
    }
    const pawnRow = this.armyRows.find((r) => r.kind === 'pawn');
    const knightRow = this.armyRows.find((r) => r.kind === 'knight');
    void (this.ctx.tip('t_camp_up', pawnRow?.upgradeBtn,
      t('Уровень усиливает все фигуры этого типа. На 5-м уровне фигура выучит особый приём.'))
      || (isUnlocked(s, 'knight') && s.army.knight === 0 && this.ctx.tip('t_knight', knightRow?.recruitBtn,
        t('Конь открыт! Наймите его: он прыгает через строй и охотится на стрелков и короля.'))));
    for (const row of this.buildingRows) {
      const def = BUILDINGS[row.id];
      const lvl = s.buildings[row.id];
      const maxed = lvl >= def.maxLevel;
      setText(row.level, `${lvl}/${def.maxLevel}`);
      const cost = buildingCost(s, row.id);
      twoLines(row.btn, maxed ? t('Макс.') : fmt(cost), maxed ? '' : s.gold < cost ? t('не хватает {n}', { n: fmt(cost - s.gold) }) : '');
      row.btn.disabled = maxed || s.gold < cost;
    }
  }
}

/** A buy button with a main line and a small second line (what it gives, or what is missing). */
function twoLines(btn: HTMLElement, main: string, sub: string): void {
  const key = `${main}|${sub}`;
  if (btn.dataset.text === key) return;
  btn.dataset.text = key;
  btn.replaceChildren(el('span', 'btn-main', main), ...(sub ? [el('small', 'btn-sub', sub)] : []));
}
