import { createBattle, stepBattle, threatMap, type Battle, type BattleEvent, type Unit } from '../../game/battle';
import { adviceLabel, adviseUpgrade } from '../../game/advice';
import { bestFormation } from '../../game/autoformation';
import { SYNERGIES, synergyProgress } from '../../game/synergies';
import { BOSSES, bossFor } from '../../game/bosses';
import { TERRAIN_INFO, levelTerrain, terrainKinds } from '../../game/terrain';
import { terrainUrl } from '../terrainArt';
import { traitUrl } from '../traitIcons';
import { TRAITS, traitAdjective } from '../../game/elites';
import { buildReport, pieceName } from '../../game/report';
import {
  CHAPTERS, UNLOCKED_BY, abyssFloor, abyssReward, chapterOf, firstReward, getLevel, isAbyss, levelIncome, nextLevelId,
  replayReward,
} from '../../game/levels';
import { ABILITIES, abilityTier } from '../../game/abilities';
import { shardsForFloor } from '../../game/altar';
import { PIECES, type PieceKind } from '../../game/pieces';
import {
  available, battleSetup, clearFormation, commandLimit, fieldedCount, isCleared, isLevelOpen, isPlayerCell,
  moveSlot, placeFromReserve, recordResult, removeSlot, sanitizeFormation, slotAt, upgradePiece, type BattleOutcome,
  type FormationSlot,
} from '../../game/state';
import { audio } from '../audio';
import { BoardView, type UnitView } from '../board';
import { openRelicPicker, relicStrip } from '../relics';
import { playStory } from '../story';
import { openCodex } from '../codex';
import type { Ctx, Screen } from '../context';
import { el, infoBtn, openModal, setDisabled, setHidden, setText, toast } from '../dom';
import { fmt } from '../format';
import { saveSettings, type Settings } from '../settings';
import { spriteUrl, type Tier } from '../sprites';

const TICK_MS = 100;
/** More pending ticks than this means we are catching up: skip effects. */
const LIVE_FX_LIMIT = 20;
const TRAY_ORDER: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];

type Phase = 'prep' | 'battle' | 'result';
type Selection = { kind: PieceKind; from: { x: number; y: number } | null } | null;

export class ArenaScreen implements Screen {
  readonly root = el('section', 'arena-screen');
  private board: BoardView;
  private levelId = '1-1';
  private phase: Phase = 'prep';
  private battle: Battle | null = null;
  private acc = 0;
  private selection: Selection = null;
  private slotKeys = new WeakMap<FormationSlot, string>();
  private nextSlotKey = 1;

  private title = el('h1', 'arena-title');
  private subtitle = el('div', 'arena-sub');
  private fightBtn = el('button', 'btn btn-primary');
  private speedBtns: { b: HTMLButtonElement; sp: Settings['speed'] }[] = [];
  private tray = el('div', 'tray');
  private trayItems = new Map<PieceKind, { btn: HTMLButtonElement; count: HTMLElement; img: HTMLImageElement }>();
  private trayTitle = el('span');
  private prepTools = el('div', 'tray-tools');
  private synergyRow = el('div', 'synergy-row');
  private bossBar = el('div', 'boss-bar');
  private bossName = el('span', 'boss-bar-name');
  private bossPhase = el('span', 'boss-bar-phase');
  private bossFill = el('div', 'boss-bar-fill');
  private bossInfo = el('div', 'boss-info');
  /** performance.now() until which the boss intro plays and the battle waits. */
  private introUntil = 0;
  private terrainRow = el('div', 'terrain-row');
  private eliteRow = el('div', 'terrain-row elite-row');
  private synergySig = '';
  private autoBtn!: HTMLButtonElement;
  private threatSig = '';
  private infoPanel = el('div', 'side-stack');
  private battlePanel = el('div', 'side-stack');
  private limitText = el('b');
  private enemyText = el('div', 'info-line');
  private conditions = el('ul', 'conditions');
  private rewardText = el('div', 'info-line');
  private hintText = el('p', 'hint-text');
  private relicCard = el('div', 'task-relics');
  private relicSlot = el('div');
  private kingBars: Record<'ally' | 'enemy', { fill: HTMLElement; text: HTMLElement }>;
  private battleTime = el('div', 'battle-time');
  private autoBtn2 = el('button', 'toggle');
  private autoDescend = false;
  private autoTimer: number | null = null;

  constructor(private ctx: Ctx) {
    this.board = new BoardView((x, y) => this.onCell(x, y));

    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', '← Карта');
    back.addEventListener('click', () => this.leave());
    const titles = el('div', 'arena-titles');
    titles.append(this.title, this.subtitle);
    const controls = el('div', 'controls');
    const seg = el('div', 'seg');
    for (const sp of [1, 2, 4] as const) {
      const b = el('button', 'seg-btn', `×${sp}`);
      b.addEventListener('click', () => {
        this.ctx.settings.speed = sp;
        saveSettings(this.ctx.settings);
      });
      seg.append(b);
      this.speedBtns.push({ b, sp });
    }
    this.fightBtn.addEventListener('click', () => (this.phase === 'prep' ? this.startBattle() : this.retreat()));
    this.autoBtn2.title = 'После победы сразу спускаться на следующий этаж';
    this.autoBtn2.addEventListener('click', () => {
      this.autoDescend = !this.autoDescend;
    });
    controls.append(seg, this.autoBtn2, this.fightBtn);
    top.append(back, titles, controls);

    // Board column with the reserve tray.
    const boardCol = el('div', 'board-col');
    const boardWrap = el('div', 'board-wrap');
    // Drifting motes around the board, styled per chapter.
    const ambient = el('div', 'ambient');
    for (let i = 0; i < 14; i++) {
      const m = el('span', 'mote');
      m.style.left = `${(i * 53) % 100}%`;
      m.style.animationDelay = `${-(i * 1.7) % 12}s`;
      m.style.animationDuration = `${9 + (i % 5) * 2}s`;
      m.style.setProperty('--drift', `${((i * 37) % 60) - 30}px`);
      ambient.append(m);
    }
    boardWrap.append(ambient, this.board.frame);
    const bossHead = el('div', 'boss-bar-head');
    bossHead.append(this.bossName, this.bossPhase);
    const bossTrack = el('div', 'boss-bar-track');
    bossTrack.append(this.bossFill, el('span', 'boss-bar-notch'));
    this.bossBar.append(bossHead, bossTrack);
    boardCol.append(this.bossBar);
    const trayPanel = el('div', 'bench-panel');
    const trayHead = el('div', 'panel-head');
    trayHead.append(el('span', 'panel-title', 'Резерв'), this.trayTitle);
    for (const kind of TRAY_ORDER) {
      const btn = el('button', 'bench-item');
      const img = el('img');
      img.src = spriteUrl(kind, 'ally');
      img.alt = PIECES[kind].name;
      const count = el('span', 'tray-count');
      btn.append(img, count);
      btn.title = `${PIECES[kind].name} — ${PIECES[kind].role}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTray(kind);
      });
      this.tray.append(btn);
      this.trayItems.set(kind, { btn, count, img });
    }
    const autoBtn = el('button', 'btn btn-small', 'Авто');
    this.autoBtn = autoBtn;
    autoBtn.title = 'Проверить 16 расстановок в симуляции и поставить лучшую';
    autoBtn.addEventListener('click', () => {
      bestFormation(this.ctx.state, this.levelId, this.limit());
      toast('Подобрана лучшая из 16 расстановок');
      this.selection = null;
    });
    const clearBtn = el('button', 'btn btn-small btn-ghost', 'Очистить');
    clearBtn.addEventListener('click', () => {
      clearFormation(this.ctx.state);
      this.selection = null;
    });
    this.prepTools.append(autoBtn, clearBtn);
    trayPanel.append(trayHead, this.tray, this.synergyRow, this.prepTools);
    trayPanel.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) this.returnSelected();
    });
    boardCol.append(boardWrap, trayPanel);

    // Side: level info during prep, kings during battle.
    const side = el('aside', 'arena-side');
    const infoCard = el('div', 'card task-card');
    const taskHead = el('div', 'panel-head');
    const codexBtn = el('button', 'btn btn-ghost btn-small', 'Фигуры');
    codexBtn.addEventListener('click', openCodex);
    taskHead.append(el('span', 'panel-title', 'Задача'), codexBtn, infoBtn('Как играть',
      'Сразите вражеского короля. Если падёт ваш — бой проигран.\n'
      + 'Выберите фигуру в резерве и нажмите на клетку в трёх нижних рядах. Нажмите на свою фигуру, чтобы переставить её, или на резерв, чтобы убрать.\n'
      + 'Звёзды: победа, король сохранил не меньше 50% здоровья, потери не больше указанного.'));
    this.hintText.classList.add('task-hint');
    infoCard.append(taskHead, this.enemyText, this.bossInfo, this.eliteRow, this.conditions, this.rewardText, this.terrainRow, this.hintText, this.relicCard);
    this.infoPanel.append(infoCard);

    const kingsCard = el('div', 'card');
    kingsCard.append(el('div', 'panel-title', 'Короли'));
    const bar = (label: string, team: 'ally' | 'enemy') => {
      const row = el('div', `king-row ${team}`);
      const img = el('img');
      img.src = spriteUrl('king', team);
      const body = el('div', 'king-body');
      const head = el('div', 'king-head');
      const text = el('span');
      head.append(el('span', '', label), text);
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      track.append(fill);
      body.append(head, track);
      row.append(img, body);
      kingsCard.append(row);
      return { fill, text };
    };
    this.kingBars = { ally: bar('Ваш король', 'ally'), enemy: bar('Чёрный король', 'enemy') };
    kingsCard.append(this.battleTime);
    this.battlePanel.append(kingsCard);
    side.append(this.infoPanel, this.battlePanel);

    const grid = el('div', 'arena-grid');
    grid.append(boardCol, side);
    this.root.append(top, grid);
  }

  private limit(): number {
    return commandLimit(this.ctx.state, this.levelId);
  }

  show(levelId?: string): void {
    if (levelId) this.levelId = levelId;
    if (!isLevelOpen(this.ctx.state, this.levelId)) {
      this.ctx.go('map');
      return;
    }
    this.enterPrep();
    void playStory(this.ctx.state, this.levelId, () => this.ctx.save());
  }

  private enterPrep(): void {
    audio.setTrack('map');
    this.phase = 'prep';
    this.battle = null;
    this.selection = null;
    this.board.showBanner(null);
    this.board.clearFx();
    this.introUntil = 0;
    this.board.intro(null);
    this.board.setWarnings([]);
    sanitizeFormation(this.ctx.state, this.limit(), this.levelId);
    this.renderInfo();
  }

  /** Enemy placements as they will fight, including the new-game level bonus. */
  private enemies() {
    return battleSetup(this.ctx.state, this.levelId).enemies;
  }

  private renderInfo(): void {
    const s = this.ctx.state;
    const level = getLevel(this.levelId);
    const chapter = chapterOf(this.levelId);
    const abyss = isAbyss(this.levelId);
    setText(this.title, abyss ? `Бездна · ${level.name}` : `${level.id} · ${level.name}`);
    setText(this.subtitle, abyss
      ? `Этаж ${abyssFloor(this.levelId)} · рекорд ${s.abyss.best}`
      : `Глава ${chapter.id}. ${chapter.name}${s.prestige ? ` · партия ${s.prestige + 1}` : ''}`);
    this.board.setTheme(chapter.id);
    this.root.dataset.theme = String(chapter.id);
    document.body.dataset.chapter = String(chapter.id);
    this.board.setTerrain(levelTerrain(this.levelId));
    const kinds = terrainKinds(this.levelId);
    this.terrainRow.replaceChildren(...kinds.map((t) => {
      const chip = el('span', 'terrain-chip');
      const img = el('img');
      img.src = terrainUrl(t);
      img.alt = '';
      chip.append(img, TERRAIN_INFO[t].name);
      chip.title = TERRAIN_INFO[t].text;
      return chip;
    }));
    if (kinds.length) this.terrainRow.append(infoBtn('Ландшафт', kinds.map((t) => `${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`).join('\n')));
    this.terrainRow.hidden = kinds.length === 0;
    const elites = this.enemies().filter((p) => p.trait);
    this.eliteRow.hidden = elites.length === 0;
    this.eliteRow.replaceChildren(...elites.map((p) => {
      const chip = el('span', 'terrain-chip');
      const img = el('img');
      img.src = traitUrl(p.trait!);
      img.alt = '';
      chip.append(img, `${traitAdjective(p.trait!, p.kind)} ${PIECES[p.kind].name.toLowerCase()}`);
      chip.title = TRAITS[p.trait!].text;
      return chip;
    }));
    if (elites.length) {
      this.eliteRow.append(infoBtn('Элитные враги', [...new Set(elites.map((p) => p.trait!))]
        .map((t) => `${TRAITS[t].name[0]}: ${TRAITS[t].text}.`).join('\n') + '\nЭлиту видно по значку над фигурой.'));
    }
    const bossId = bossFor(this.levelId);
    this.bossInfo.hidden = !bossId;
    if (bossId) {
      const d = BOSSES[bossId];
      this.bossInfo.replaceChildren(el('span', '', `★ ${d.skill} · ☠ ${d.rage}`), infoBtn(getLevel(this.levelId).boss ?? 'Босс',
        `У босса втрое больше здоровья.\n★ ${d.skill}: ${d.skillText}.\n☠ ${d.rage} (ниже 50% здоровья): ${d.rageText}.`));
    }
    const enemies = this.enemies();
    setText(this.enemyText, `Враги: ${enemies.length} · ур. ${enemies[0]?.level ?? level.level}${level.boss ? ` · ${level.boss}` : ''}`);
    const best = s.stars[level.id] ?? 0;
    this.conditions.innerHTML = '';
    this.conditions.hidden = abyss;
    this.autoBtn2.hidden = !abyss;
    if (abyss) {
      const floor = abyssFloor(this.levelId);
      setText(this.rewardText, `Награда: +${fmt(Math.round(abyssReward(floor)))} золота · +${shardsForFloor(floor)} ◆`);
      setText(this.hintText, level.hint);
      this.relicCard.hidden = s.relics.length === 0;
      this.relicSlot.replaceChildren(relicStrip(s.relics));
      return;
    }
    for (const [i, text] of [
      'Победа',
      'Король ≥ 50%',
      `Потери ≤ ${level.maxLosses}`,
    ].entries()) {
      const li = el('li', best > i ? 'done' : '', `★ ${text}`);
      this.conditions.append(li);
    }
    setText(this.rewardText, isCleared(s, level.id)
      ? `Повтор: +${fmt(replayReward(level.id))} золота`
      : `Награда: +${fmt(firstReward(level.id))} золота · +${levelIncome(level.id)}/мин`);
    setText(this.hintText, level.hint);
    this.relicCard.hidden = s.relics.length === 0;
    this.relicSlot.replaceChildren(relicStrip(s.relics));
  }

  // ---------- Interaction ----------

  private onCell(x: number, y: number): void {
    if (this.phase !== 'prep') return;
    const s = this.ctx.state;
    const slot = slotAt(s, x, y);
    const sel = this.selection;
    if (sel?.from) {
      if (sel.from.x === x && sel.from.y === y) this.selection = null;
      else if (isPlayerCell(x, y, this.levelId)) {
        moveSlot(s, sel.from.x, sel.from.y, x, y, this.levelId);
        this.selection = null;
      } else toast(isPlayerCell(x, y) ? 'Сюда нельзя: камень или вода' : 'Свои фигуры ставятся в три нижних ряда');
      return;
    }
    if (sel) {
      const err = placeFromReserve(s, sel.kind, x, y, this.limit(), this.levelId);
      if (err) toast(err);
      else if (available(s, sel.kind) <= 0) this.selection = null;
      return;
    }
    if (slot) {
      this.selection = { kind: slot.kind, from: { x, y } };
      return;
    }
    const enemy = this.enemies().find((p) => p.x === x && p.y === y);
    if (enemy) {
      const def = PIECES[enemy.kind];
      const tier = abilityTier(enemy.level);
      const ability = tier ? ` Приём «${ABILITIES[enemy.kind].name}»${tier === 2 ? ' (усилен)' : ''}.` : '';
      const elite = enemy.trait ? ` ${traitAdjective(enemy.trait, enemy.kind)}: ${TRAITS[enemy.trait].text}.` : '';
      toast(`${enemy.boss ? getLevel(this.levelId).boss : def.name}, ур. ${enemy.level}.${elite} ${def.description}${ability}`);
      return;
    }
    const t = levelTerrain(this.levelId)[y * 8 + x];
    if (t !== 'plain') toast(`${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`);
  }

  private onTray(kind: PieceKind): void {
    if (this.phase !== 'prep') return;
    if (this.selection?.from) {
      this.returnSelected();
      return;
    }
    if (this.selection?.kind === kind) {
      this.selection = null;
      return;
    }
    if (available(this.ctx.state, kind) <= 0) {
      toast(this.ctx.state.army[kind] === 0 ? `${PIECES[kind].name}: наймите в лагере` : 'Все такие фигуры уже на доске');
      return;
    }
    this.selection = { kind, from: null };
    audio.play('select');
  }

  private returnSelected(): void {
    const from = this.selection?.from;
    if (!from || this.phase !== 'prep') return;
    if (!removeSlot(this.ctx.state, from.x, from.y)) toast('Король всегда участвует в бою');
    this.selection = null;
  }

  private startBattle(): void {
    const s = this.ctx.state;
    sanitizeFormation(s, this.limit(), this.levelId);
    if (fieldedCount(s) === 0) {
      toast('Поставьте на доску хотя бы одну фигуру');
      return;
    }
    this.selection = null;
    this.battle = createBattle(battleSetup(s, this.levelId));
    this.phase = 'battle';
    audio.setTrack(getLevel(this.levelId).boss ? 'boss' : 'battle');
    this.acc = 0;
    const bossId = this.battle.bossId;
    if (bossId && !(isAbyss(this.levelId) && this.autoDescend)) {
      const boss = this.battle.units.find((u) => u.uid === this.battle!.bossUid)!;
      this.board.intro({
        name: getLevel(this.levelId).boss ?? 'Босс', sprite: spriteUrl(boss.kind, 'enemy', boss.tier as Tier),
        skill: BOSSES[bossId].skill, rage: BOSSES[bossId].rage,
      });
      this.introUntil = performance.now() + 2200;
      audio.play('roar');
    } else audio.play('start');
    this.ctx.save();
  }

  private retreat(): void {
    this.enterPrep();
    toast('Отступили. Бой не засчитан');
  }

  private leave(): void {
    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.phase === 'battle' || isAbyss(this.levelId)) this.enterPrep();
    this.ctx.go('map');
  }

  private finish(): void {
    const b = this.battle!;
    const outcome = recordResult(this.ctx.state, this.levelId, b);
    this.ctx.save();
    this.phase = 'result';
    this.board.showBanner(outcome.win ? 'Победа' : 'Поражение', outcome.win);
    audio.play(outcome.win ? 'win' : 'lose');
    // Auto-descent: skip the dialog and go straight to the next floor.
    if (outcome.win && isAbyss(this.levelId) && this.autoDescend && outcome.relicsEarned === 0) {
      toast(`Этаж ${abyssFloor(this.levelId)}: +${fmt(outcome.reward)} золота, +${outcome.shards} ◆`, 'good');
      this.autoTimer = window.setTimeout(() => {
        this.autoTimer = null;
        if (!this.root.isConnected || this.root.closest('[hidden]') || this.phase !== 'result') return;
        this.show(nextLevelId(this.levelId)!);
        this.startBattle();
      }, 1300);
      return;
    }
    setTimeout(() => {
      this.showResult(outcome);
      if (outcome.relicsEarned > 0) setTimeout(() => openRelicPicker(this.ctx), 500);
    }, 700);
  }

  private showResult(o: BattleOutcome): void {
    const level = getLevel(this.levelId);
    const content = el('div', `result ${o.win ? 'is-win' : 'is-loss'}`);
    content.append(el('h2', `result-title ${o.win ? 'win' : 'loss'}`, o.win ? 'Победа!' : 'Поражение'));
    if (o.win) {
      // Falling pixel confetti over the dialog.
      const confetti = el('div', 'confetti');
      const colours = ['#3ee6c1', '#ffcf4a', '#ff5d85', '#9b6bff', '#ffffff'];
      for (let i = 0; i < 36; i++) {
        const c = el('span');
        c.style.left = `${(i * 29) % 100}%`;
        c.style.background = colours[i % colours.length];
        c.style.animationDelay = `${(i % 12) * 0.08}s`;
        c.style.animationDuration = `${1.4 + (i % 5) * 0.25}s`;
        c.style.setProperty('--sway', `${((i * 17) % 40) - 20}px`);
        confetti.append(c);
      }
      content.append(confetti);
    }
    const starRow = el('div', 'result-stars');
    if (o.win) starRow.append(el('div', 'result-rays'));
    for (let i = 0; i < 3; i++) {
      const st = el('span', i < o.stars ? 'on' : '', '★');
      st.style.animationDelay = `${0.15 + i * 0.2}s`;
      if (i < o.stars) audio.play('star', 0.15 + i * 0.2);
      starRow.append(st);
    }
    content.append(starRow);
    const list = el('ul', 'conditions');
    const items: [boolean, string][] = [
      [o.conditions.win, 'Победа'],
      [o.conditions.king, 'Король ≥ 50%'],
      [o.conditions.losses, `Потери ${this.battle?.allyLosses ?? 0} из ${level.maxLosses}`],
    ];
    for (const [ok, text] of items) list.append(el('li', ok ? 'done' : 'fail', `${ok ? '✓' : '✗'} ${text}`));
    content.append(list);
    if (this.battle) content.append(this.reportView(o.win));

    if (o.relicsEarned > 0) content.append(el('div', 'result-unlock relic', 'Новая реликвия! Выберите одну из трёх.'));
    if (o.win) {
      content.append(el('div', 'result-reward', `+${fmt(o.reward)} золота`));
      if (o.trophy) content.append(el('div', 'result-unlock relic', `Трофей: «${o.trophy.name}» — ${o.trophy.text}`));
      if (o.shards > 0) content.append(el('div', 'result-unlock shard', `+${o.shards} ◆ осколков бездны — крутите за них рулетку в «Улучшениях»`));
      if (o.firstClear) {
        content.append(el('div', 'result-unlock', `Земля захвачена: +${levelIncome(this.levelId)} золота/мин в казну`));
        const unlocked = (Object.keys(UNLOCKED_BY) as PieceKind[]).find((k) => UNLOCKED_BY[k] === this.levelId);
        if (unlocked) content.append(el('div', 'result-unlock', `Новая фигура: ${PIECES[unlocked].name}! Наймите в лагере.`));
        const nextChapter = CHAPTERS.find((c) => c.levels[0].id === nextLevelId(this.levelId) && c.id !== chapterOf(this.levelId).id);
        if (nextChapter) content.append(el('div', 'result-unlock', `Открыта глава ${nextChapter.id}: ${nextChapter.name}`));
      }
    } else {
      if (o.reward > 0) {
        content.append(el('div', 'result-reward small',
          `+${fmt(o.reward)} золота за ${Math.round(o.damageShare * 100)}% урона врагу`));
      }
    }

    const actions = el('div', 'modal-actions result-actions');
    const close = openModal(content, { dismissable: false, cls: 'result-modal' });
    if (!o.win) content.append(this.adviceView(close));
    const button = (label: string, cls: string, fn: () => void) => {
      const b = el('button', `btn ${cls}`, label);
      b.addEventListener('click', () => {
        close();
        fn();
      });
      actions.append(b);
    };
    button('Карта', 'btn-ghost', () => {
      this.enterPrep();
      this.ctx.go('map');
    });
    if (o.win) {
      button('Улучшения', '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      if (!isAbyss(this.levelId)) button('Переиграть', '', () => this.enterPrep());
      const next = nextLevelId(this.levelId);
      if (next) button('Дальше ▶', 'btn-primary', () => this.show(next));
    } else {
      button('Улучшения', '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      button('Ещё раз', 'btn-primary', () => this.enterPrep());
    }
    content.append(actions);
  }

  /** On a loss: the upgrade that helps most here, found by simulation, with a buy button. */
  private adviceView(close: () => void): HTMLElement {
    const s = this.ctx.state;
    const box = el('div', 'advice');
    const a = adviseUpgrade(s, this.levelId);
    if (!a) return box;
    box.append(el('img', 'advice-icon'));
    (box.firstChild as HTMLImageElement).src = spriteUrl(a.kind, 'ally');
    const body = el('div', 'advice-body');
    body.append(el('div', 'advice-title', `Совет: ${adviceLabel(a)}`));
    body.append(el('div', 'advice-sub', a.wins
      ? 'С этим улучшением та же расстановка побеждает.'
      : 'Даст больше всего силы именно в этом бою.'));
    box.append(body);
    const affordable = s.gold >= a.cost;
    const buy = el('button', 'btn btn-up btn-small', affordable ? `Улучшить · ${fmt(a.cost)}` : `Нужно ${fmt(a.cost)}`);
    buy.disabled = !affordable;
    buy.addEventListener('click', () => {
      if (!upgradePiece(s, a.kind)) return;
      audio.play('levelup');
      this.ctx.save();
      toast(`${adviceLabel(a)}`, 'good');
      close();
      this.enterPrep();
    });
    box.append(buy);
    if (!affordable) box.append(el('div', 'advice-sub advice-wide', 'Заберите золото из казны на карте или переиграйте пройденные бои.'));
    return box;
  }

  /** Composition bonuses: active ones lit, the rest dim with progress. */
  private renderSynergies(prep: boolean): void {
    this.synergyRow.hidden = !prep;
    if (!prep) return;
    const kinds = this.ctx.state.formation.map((f) => f.kind);
    const progress = synergyProgress(kinds, this.ctx.state.crownTree.includes('heralds') ? 1 : 0);
    const sig = progress.map((p) => p.have).join(',');
    if (sig === this.synergySig) return;
    const wasActive = new Set([...this.synergyRow.querySelectorAll<HTMLElement>('.synergy.active')].map((n) => n.dataset.id));
    const first = this.synergySig === '';
    this.synergySig = sig;
    this.synergyRow.replaceChildren(...progress.map(({ def, have, need, active }) => {
      const chip = el('span', `synergy${active ? ' active' : ''}`, active ? `✦ ${def.name}` : `${def.name} ${have}/${need}`);
      chip.dataset.id = def.id;
      chip.title = def.description;
      if (active && !first && !wasActive.has(def.id)) chip.classList.add('pop');
      return chip;
    }), this.synergyInfo);
  }

  private synergyInfo = infoBtn('Синергии', () => `Бонусы за состав армии на доске:\n${SYNERGIES.map((d) => `${d.name}: ${d.description}.`).join('\n')}`);

  /** The first time an ally uses an ability, explain where abilities come from. */
  private firstAbility(events: BattleEvent[]): void {
    const s = this.ctx.state;
    if (s.tutorial.includes('t_ability_seen')) return;
    const e = events.find((ev) => ev.type === 'ability' && ev.side === 'ally');
    if (!e?.fromKind) return;
    s.tutorial.push('t_ability_seen');
    toast(`${PIECES[e.fromKind].name}: приём «${e.label}»! На 5-м уровне фигура выбирает один из двух приёмов`, 'good');
  }

  // ---------- Frame ----------

  frame(dt: number): void {
    const speed = this.ctx.settings.speed;
    let events: BattleEvent[] = [];
    if (this.introUntil && performance.now() >= this.introUntil) {
      this.introUntil = 0;
      this.board.intro(null);
      audio.play('start');
    }
    if (this.phase === 'battle' && this.battle && !this.introUntil) {
      this.acc += dt * speed;
      const live = this.acc / TICK_MS < LIVE_FX_LIMIT;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < 2000 && this.phase === 'battle') {
        this.acc -= TICK_MS;
        stepBattle(this.battle);
        if (live) events.push(...this.battle.events);
        if (this.battle.result) this.finish();
        steps++;
      }
      if (!live) events = [];
    }
    this.render(events, speed);
  }

  private render(events: BattleEvent[], speed: number): void {
    const s = this.ctx.state;
    const prep = this.phase === 'prep';
    this.board.setMode(prep, this.selection !== null);
    this.board.setStep(180 / speed);
    this.board.setFxLevel(speed >= 4 ? 0 : speed >= 2 ? 1 : 2);
    this.board.render(this.collectUnits());
    if (events.length) {
      this.bossEvents(events);
      this.firstAbility(events);
      this.board.react(events, (uid) => `b${uid}`, this.ctx.settings.effects && events.length <= 60);
      playBattleSounds(events);
    }
    if (events.length && this.ctx.settings.effects && events.length <= 60) this.board.fx(events);

    setText(this.fightBtn, prep ? '▶ В бой' : '■ Отступить');
    setText(this.autoBtn2, `Авто-спуск: ${this.autoDescend ? 'вкл' : 'выкл'}`);
    this.autoBtn2.classList.toggle('on', this.autoDescend);
    this.fightBtn.classList.toggle('btn-danger', !prep);
    setDisabled(this.fightBtn, this.phase === 'result');
    this.speedBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === speed));
    setHidden(this.infoPanel, !prep);
    setHidden(this.battlePanel, prep);
    setHidden(this.prepTools, !prep);

    const limit = this.limit();
    setText(this.limitText, `${fieldedCount(s)}/${limit}`);
    setText(this.trayTitle, prep ? `На доске ${fieldedCount(s)}/${limit} + король` : 'Идёт бой');
    this.renderSynergies(prep);
    for (const [kind, item] of this.trayItems) {
      const avail = available(s, kind);
      const src = spriteUrl(kind, 'ally', abilityTier(s.levels[kind]) as Tier);
      if (item.img.src !== src) item.img.src = src;
      setText(item.count, `×${avail}`);
      setHidden(item.btn, s.army[kind] === 0);
      setDisabled(item.btn, !prep);
      item.btn.classList.toggle('selected', this.selection?.kind === kind && !this.selection.from);
      item.btn.classList.toggle('empty', avail <= 0);
    }

    if (prep) {
      this.updateThreats();
      this.tips();
    } else if (this.threatSig) {
      this.threatSig = '';
      this.board.setThreats(null);
    }

    if (this.battle) {
      for (const side of ['ally', 'enemy'] as const) {
        const king = this.battle.units.find((u) => u.side === side && u.kind === 'king');
        const ratio = king ? Math.max(0, king.hp) / king.maxHp : 0;
        const w = `${ratio * 100}%`;
        if (this.kingBars[side].fill.style.width !== w) this.kingBars[side].fill.style.width = w;
        setText(this.kingBars[side].text, `${Math.round(ratio * 100)}%`);
      }
      setText(this.battleTime, `Время боя: ${Math.floor(this.battle.tick / 10)} с · потери: ${this.battle.allyLosses}`);
    }
    this.renderBossBar();
  }

  private renderBossBar(): void {
    const b = this.battle;
    const boss = b?.units.find((u) => u.uid === b.bossUid);
    setHidden(this.bossBar, !b?.bossId || this.phase === 'prep');
    if (this.bossBar.hidden || !b) return;
    const ratio = boss ? Math.max(0, boss.hp) / boss.maxHp : 0;
    const bw = `${ratio * 100}%`;
    if (this.bossFill.style.width !== bw) this.bossFill.style.width = bw;
    setText(this.bossName, getLevel(this.levelId).boss ?? 'Босс');
    setText(this.bossPhase, ratio <= 0 ? 'Повержен' : b.bossPhase === 2 ? `☠ ${BOSSES[b.bossId!].rage}` : `${Math.ceil(ratio * 100)}%`);
    this.bossBar.classList.toggle('enraged', b.bossPhase === 2);
    this.board.setWarnings(b.warnings.flatMap((w) => w.cells));
  }

  /** Callouts for boss skills, rage, new rocks and the boss falling. */
  private bossEvents(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b?.bossId) return;
    for (const e of events) {
      if (e.type === 'boss') this.board.callout(`${e.label}!`, 'skill');
      else if (e.type === 'rage') this.board.callout(`Ярость: ${e.label}`, 'rage');
      else if (e.type === 'terrain') this.board.setTerrain(b.terrain);
      else if (e.type === 'death' && e.uid === b.bossUid) {
        this.board.callout('Босс повержен!', 'down');
        audio.play('bossDown');
      }
    }
  }

  /** Recompute the threat overlay only when the formation or level changes. */
  private updateThreats(): void {
    const sig = `${this.levelId}|${this.ctx.state.formation.map((f) => `${f.kind}${f.x}${f.y}`).join()}`;
    if (sig === this.threatSig) return;
    this.threatSig = sig;
    this.board.setThreats(threatMap(battleSetup(this.ctx.state, this.levelId)));
  }

  private tips(): void {
    const { ctx, board } = this;
    const freeReserve = [...this.trayItems.values()].find((i) => !i.btn.hidden && !i.btn.classList.contains('empty'))?.btn;
    void (ctx.tip('t_king', board.unitNode('ally', 'king'),
      'Это ваш король. Если он падёт, бой проигран. Фигуры рядом с ним бьют на 20% сильнее.')
      || ctx.tip('t_enemy_king', board.unitNode('enemy', 'king'),
        'Чёрный король. Сразите его, и бой выигран. Нажмите на любую вражескую фигуру, чтобы узнать о ней.')
      || ctx.tip('t_fight', this.fightBtn,
        'Расстановка готова, жмите «В бой». Бой можно ускорить кнопками ×2 и ×4.')
      || (this.levelId !== '1-1' && ctx.tip('t_move', this.autoBtn,
        'Нажмите на свою фигуру, а потом на клетку, чтобы её переставить. «Авто» расставит армию сама.'))
      || (!this.terrainRow.hidden && ctx.tip('t_terrain', this.terrainRow,
        'На доске ландшафт! Лес защищает, с холма стрелки бьют сильнее, камень и вода непроходимы. Нажмите на клетку, чтобы узнать больше.'))
      || (this.board.root.querySelector('.cell.threat') && ctx.tip('t_threats', this.board.root.querySelector<HTMLElement>('.cell.threat'),
        'Красные клетки простреливают вражеские стрелки. Не ставьте туда короля и закрывайте линии пешками.'))
      || ctx.tip('t_reserve', freeReserve,
        'В резерве есть свободная фигура. Выберите её и нажмите на клетку в трёх нижних рядах.'));
  }

  /** After-battle breakdown: loss reason, MVP, damage per piece and tips. */
  private reportView(win: boolean): HTMLElement {
    const r = buildReport(this.battle!);
    const box = el('details', 'report');
    box.open = !win;
    box.append(el('summary', 'report-title', 'Разбор боя'));
    if (r.lossReason) box.append(el('p', 'report-reason', r.lossReason));
    if (r.mvp) {
      box.append(el('p', 'report-mvp',
        `Лучшая фигура: ${pieceName(r.mvp)} — ${fmt(Math.round(r.mvp.dealt))} урона, сражено ${r.mvp.kills}`));
    }
    const max = Math.max(1, ...r.allies.map((a) => a.dealt));
    const table = el('div', 'report-table');
    for (const a of r.allies.slice(0, 10)) {
      const row = el('div', `report-row${a.killedBy ? ' fallen' : ''}`);
      const img = el('img');
      img.src = spriteUrl(a.kind, 'ally', abilityTier(this.ctx.state.levels[a.promoted ? 'pawn' : a.kind]) as Tier);
      img.alt = '';
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${(a.dealt / max) * 100}%`;
      track.append(fill);
      row.append(img, el('span', 'report-name', pieceName(a)), track,
        el('span', 'report-num', `${fmt(Math.round(a.dealt))}${a.killedBy ? ' ✝' : ''}`));
      table.append(row);
    }
    box.append(table);
    if (r.tips.length) {
      const tips = el('ul', 'report-tips');
      for (const t of r.tips) tips.append(el('li', '', t));
      box.append(tips);
    }
    return box;
  }

  private collectUnits(): UnitView[] {
    if (this.battle) return this.battle.units.map((u) => this.unitView(u));
    const s = this.ctx.state;
    const views: UnitView[] = s.formation.map((f) => {
      let key = this.slotKeys.get(f);
      if (!key) {
        key = `f${this.nextSlotKey++}`;
        this.slotKeys.set(f, key);
      }
      const from = this.selection?.from;
      return {
        key, team: 'ally', kind: f.kind, x: f.x, y: f.y, hp: 1, maxHp: 1, tier: abilityTier(s.levels[f.kind]) as Tier,
        selected: !!from && from.x === f.x && from.y === f.y,
      };
    });
    this.enemies().forEach((p, i) => {
      views.push({
        key: `e${this.levelId}-${i}`, team: 'enemy', kind: p.kind, x: p.x, y: p.y, hp: 1, maxHp: 1, boss: p.boss, trait: p.trait,
        tier: abilityTier(p.level) as Tier,
      });
    });
    return views;
  }

  private unitView(u: Unit): UnitView {
    return {
      key: `b${u.uid}`, team: u.side, kind: u.kind, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp,
      shield: u.shield / u.maxHp, tier: abilityTier(u.level) as Tier,
      boss: u.boss, trait: u.trait, dead: u.hp <= 0,
    };
  }
}

function hitSound(e: BattleEvent): 'crit' | 'shot' | 'hit' {
  if (e.crit) return 'crit';
  const dx = Math.abs(e.x - e.fromX);
  const dy = Math.abs(e.y - e.fromY);
  const knightJump = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  return Math.max(dx, dy) > 1 && !knightJump ? 'shot' : 'hit';
}

/** One sound per kind per frame keeps big fights readable. */
function playBattleSounds(events: BattleEvent[]): void {
  const types = new Set<string>(events.map((e) => (e.type === 'hit' ? hitSound(e) : e.type)));
  if (types.has('save')) audio.play('save');
  if (types.has('promote')) audio.play('promote');
  if (types.has('death')) audio.play('death');
  if (types.has('crit')) audio.play('crit');
  else if (types.has('hit')) audio.play('hit');
  else if (types.has('shot')) audio.play('shot');
  if (types.has('heal')) audio.play('heal');
  if (types.has('ability')) audio.play('ability');
  if (types.has('shieldBreak')) audio.play('shieldBreak');
  if (types.has('rage')) audio.play('roar');
  if (types.has('warn')) audio.play('warn');
  if (types.has('blast') || types.has('terrain')) audio.play('quake');
  if (types.has('summon') || types.has('boss')) audio.play('ability');
}
