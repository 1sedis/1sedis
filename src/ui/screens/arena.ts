import { createBattle, stepBattle, type Battle, type BattleEvent, type Unit } from '../../game/battle';
import { autoFormation } from '../../game/autoformation';
import {
  CHAPTERS, UNLOCKED_BY, chapterOf, enemyPlacements, firstReward, getLevel, levelIncome, nextLevelId, replayReward,
} from '../../game/levels';
import { ABILITIES, abilityTier } from '../../game/abilities';
import { PIECES, type PieceKind } from '../../game/pieces';
import {
  available, battleSetup, clearFormation, commandLimit, fieldedCount, isCleared, isLevelOpen, isPlayerCell,
  moveSlot, placeFromReserve, recordResult, removeSlot, sanitizeFormation, slotAt, type BattleOutcome, type FormationSlot,
} from '../../game/state';
import { audio } from '../audio';
import { BoardView, type UnitView } from '../board';
import { openRelicPicker, relicStrip } from '../relics';
import type { Ctx, Screen } from '../context';
import { el, openModal, setText, stars, toast } from '../dom';
import { fmt } from '../format';
import { saveSettings, type Settings } from '../settings';
import { spriteUrl } from '../sprites';

const TICK_MS = 100;
/** More pending ticks than this means we are catching up: skip effects. */
const LIVE_FX_LIMIT = 20;
const TRAY_ORDER: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

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
  private trayItems = new Map<PieceKind, { btn: HTMLButtonElement; count: HTMLElement }>();
  private trayTitle = el('span');
  private prepTools = el('div', 'tray-tools');
  private autoBtn!: HTMLButtonElement;
  private infoPanel = el('div', 'side-stack');
  private battlePanel = el('div', 'side-stack');
  private limitText = el('b');
  private enemyText = el('div', 'info-line');
  private conditions = el('ul', 'conditions');
  private rewardText = el('div', 'info-line');
  private hintText = el('p', 'hint-text');
  private relicCard = el('div', 'card');
  private relicSlot = el('div');
  private kingBars: Record<'ally' | 'enemy', { fill: HTMLElement; text: HTMLElement }>;
  private battleTime = el('div', 'battle-time');

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
    controls.append(seg, this.fightBtn);
    top.append(back, titles, controls);

    // Board column with the reserve tray.
    const boardCol = el('div', 'board-col');
    const boardWrap = el('div', 'board-wrap');
    boardWrap.append(this.board.frame);
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
      this.trayItems.set(kind, { btn, count });
    }
    const autoBtn = el('button', 'btn btn-small', 'Авто');
    this.autoBtn = autoBtn;
    autoBtn.title = 'Расставить армию автоматически';
    autoBtn.addEventListener('click', () => {
      autoFormation(this.ctx.state, this.limit());
      this.selection = null;
    });
    const clearBtn = el('button', 'btn btn-small btn-ghost', 'Очистить');
    clearBtn.addEventListener('click', () => {
      clearFormation(this.ctx.state);
      this.selection = null;
    });
    this.prepTools.append(autoBtn, clearBtn);
    trayPanel.append(trayHead, this.tray, this.prepTools);
    trayPanel.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) this.returnSelected();
    });
    boardCol.append(boardWrap, trayPanel);

    // Side: level info during prep, kings during battle.
    const side = el('aside', 'arena-side');
    const infoCard = el('div', 'card');
    const limitLine = el('div', 'info-line');
    limitLine.append('Фигуры в бою: ', this.limitText, ' + король');
    infoCard.append(el('div', 'panel-title', 'Задача'), this.enemyText, limitLine, this.conditions, this.rewardText);
    const hintCard = el('div', 'card hint-card');
    hintCard.append(el('div', 'panel-title', 'Совет'), this.hintText);
    const helpCard = el('div', 'card help-card');
    helpCard.append(el('div', 'panel-title', 'Как расставлять'),
      el('p', 'hint', 'Выберите фигуру в резерве и нажмите на клетку в трёх нижних рядах. Нажмите на свою фигуру, чтобы переставить её, или на резерв, чтобы убрать.'));
    this.relicCard.append(el('div', 'panel-title', 'Ваши реликвии'), this.relicSlot);
    this.infoPanel.append(infoCard, hintCard, this.relicCard, helpCard);

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
    const tipCard = el('div', 'card');
    tipCard.append(el('div', 'panel-title', 'Победа'), el('p', 'hint', 'Сразите вражеского короля. Если падёт ваш — бой проигран.'));
    this.battlePanel.append(kingsCard, tipCard);
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
  }

  private enterPrep(): void {
    this.phase = 'prep';
    this.battle = null;
    this.selection = null;
    this.board.showBanner(null);
    this.board.clearFx();
    sanitizeFormation(this.ctx.state, this.limit());
    this.renderInfo();
  }

  private renderInfo(): void {
    const s = this.ctx.state;
    const level = getLevel(this.levelId);
    const chapter = chapterOf(this.levelId);
    setText(this.title, `${level.id} · ${level.name}`);
    setText(this.subtitle, `Глава ${chapter.id}. ${chapter.name}`);
    this.board.setTheme(chapter.id);
    const enemies = enemyPlacements(level);
    setText(this.enemyText, `Враги: ${enemies.length} фигур, уровень ${level.level}${level.boss ? ` · босс: ${level.boss}` : ''}`);
    const best = s.stars[level.id] ?? 0;
    this.conditions.innerHTML = '';
    for (const [i, text] of [
      'Победить',
      'Король сохранил не меньше 50% здоровья',
      `Потерять не больше ${level.maxLosses} фигур`,
    ].entries()) {
      const li = el('li', best > i ? 'done' : '', `★ ${text}`);
      this.conditions.append(li);
    }
    setText(this.rewardText, isCleared(s, level.id)
      ? `Лучший результат ${stars(best)} · повтор: +${fmt(replayReward(level.id))} золота`
      : `Награда: +${fmt(firstReward(level.id))} золота и +${levelIncome(level.id)}/мин в казну`);
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
      else if (isPlayerCell(x, y)) {
        moveSlot(s, sel.from.x, sel.from.y, x, y);
        this.selection = null;
      } else toast('Свои фигуры ставятся в три нижних ряда');
      return;
    }
    if (sel) {
      const err = placeFromReserve(s, sel.kind, x, y, this.limit());
      if (err) toast(err);
      else if (available(s, sel.kind) <= 0) this.selection = null;
      return;
    }
    if (slot) {
      this.selection = { kind: slot.kind, from: { x, y } };
      return;
    }
    const enemy = enemyPlacements(getLevel(this.levelId)).find((p) => p.x === x && p.y === y);
    if (enemy) {
      const def = PIECES[enemy.kind];
      const tier = abilityTier(enemy.level);
      const ability = tier ? ` Приём «${ABILITIES[enemy.kind].name}»${tier === 2 ? ' (усилен)' : ''}.` : '';
      toast(`${enemy.boss ? getLevel(this.levelId).boss : def.name}, ур. ${enemy.level}: ${def.description}${ability}`);
    }
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
  }

  private returnSelected(): void {
    const from = this.selection?.from;
    if (!from || this.phase !== 'prep') return;
    if (!removeSlot(this.ctx.state, from.x, from.y)) toast('Король всегда участвует в бою');
    this.selection = null;
  }

  private startBattle(): void {
    const s = this.ctx.state;
    sanitizeFormation(s, this.limit());
    if (fieldedCount(s) === 0) {
      toast('Поставьте на доску хотя бы одну фигуру');
      return;
    }
    this.selection = null;
    this.battle = createBattle(battleSetup(s, this.levelId));
    this.phase = 'battle';
    this.acc = 0;
    this.ctx.save();
  }

  private retreat(): void {
    this.enterPrep();
    toast('Отступили. Бой не засчитан');
  }

  private leave(): void {
    if (this.phase === 'battle') this.enterPrep();
    this.ctx.go('map');
  }

  private finish(): void {
    const b = this.battle!;
    const outcome = recordResult(this.ctx.state, this.levelId, b);
    this.ctx.save();
    this.phase = 'result';
    this.board.showBanner(outcome.win ? 'Победа' : 'Поражение', outcome.win);
    audio.play(outcome.win ? 'win' : 'lose');
    setTimeout(() => {
      this.showResult(outcome);
      if (outcome.relicsEarned > 0) setTimeout(() => openRelicPicker(this.ctx), 500);
    }, 700);
  }

  private showResult(o: BattleOutcome): void {
    const level = getLevel(this.levelId);
    const content = el('div', 'result');
    content.append(el('h2', `result-title ${o.win ? 'win' : 'loss'}`, o.win ? 'Победа!' : 'Поражение'));
    const starRow = el('div', 'result-stars');
    for (let i = 0; i < 3; i++) {
      const st = el('span', i < o.stars ? 'on' : '', '★');
      st.style.animationDelay = `${0.15 + i * 0.2}s`;
      starRow.append(st);
    }
    content.append(starRow);
    const list = el('ul', 'conditions');
    const items: [boolean, string][] = [
      [o.conditions.win, 'Победить'],
      [o.conditions.king, 'Король не ниже 50% здоровья'],
      [o.conditions.losses, `Потери не больше ${level.maxLosses} (у вас ${this.battle?.allyLosses ?? 0})`],
    ];
    for (const [ok, text] of items) list.append(el('li', ok ? 'done' : 'fail', `${ok ? '✓' : '✗'} ${text}`));
    content.append(list);

    if (o.relicsEarned > 0) content.append(el('div', 'result-unlock relic', 'Новая реликвия! Выберите одну из трёх.'));
    if (o.win) {
      content.append(el('div', 'result-reward', `+${fmt(o.reward)} золота`));
      if (o.firstClear) {
        content.append(el('div', 'result-unlock', `Земля захвачена: +${levelIncome(this.levelId)} золота/мин в казну`));
        const unlocked = (Object.keys(UNLOCKED_BY) as PieceKind[]).find((k) => UNLOCKED_BY[k] === this.levelId);
        if (unlocked) content.append(el('div', 'result-unlock', `Новая фигура: ${PIECES[unlocked].name}! Наймите в лагере.`));
        const nextChapter = CHAPTERS.find((c) => c.levels[0].id === nextLevelId(this.levelId) && c.id !== chapterOf(this.levelId).id);
        if (nextChapter) content.append(el('div', 'result-unlock', `Открыта глава ${nextChapter.id}: ${nextChapter.name}`));
      }
    } else {
      content.append(el('p', 'hint-text', level.hint));
      content.append(el('p', 'hint', 'Повысьте уровень фигур в «Улучшениях», заберите золото из казны на карте или попробуйте другую расстановку.'));
    }

    const actions = el('div', 'modal-actions result-actions');
    const close = openModal(content, { dismissable: false, cls: 'result-modal' });
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
      button('Переиграть', '', () => this.enterPrep());
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

  // ---------- Frame ----------

  frame(dt: number): void {
    const speed = this.ctx.settings.speed;
    let events: BattleEvent[] = [];
    if (this.phase === 'battle' && this.battle) {
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
    this.board.render(this.collectUnits());
    if (events.length) {
      this.board.react(events, (uid) => `b${uid}`);
      playBattleSounds(events);
    }
    if (events.length && this.ctx.settings.effects && events.length <= 60) this.board.fx(events);

    setText(this.fightBtn, prep ? '▶ В бой' : '■ Отступить');
    this.fightBtn.classList.toggle('btn-danger', !prep);
    this.fightBtn.disabled = this.phase === 'result';
    this.speedBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === speed));
    this.infoPanel.hidden = !prep;
    this.battlePanel.hidden = prep;
    this.prepTools.hidden = !prep;

    const limit = this.limit();
    setText(this.limitText, `${fieldedCount(s)}/${limit}`);
    setText(this.trayTitle, prep ? `На доске ${fieldedCount(s)}/${limit} + король` : 'Идёт бой');
    for (const [kind, item] of this.trayItems) {
      const avail = available(s, kind);
      setText(item.count, `×${avail}`);
      item.btn.hidden = s.army[kind] === 0;
      item.btn.disabled = !prep;
      item.btn.classList.toggle('selected', this.selection?.kind === kind && !this.selection.from);
      item.btn.classList.toggle('empty', avail <= 0);
    }

    if (prep) this.tips();

    if (this.battle) {
      for (const side of ['ally', 'enemy'] as const) {
        const king = this.battle.units.find((u) => u.side === side && u.kind === 'king');
        const ratio = king ? Math.max(0, king.hp) / king.maxHp : 0;
        this.kingBars[side].fill.style.width = `${ratio * 100}%`;
        setText(this.kingBars[side].text, `${Math.round(ratio * 100)}%`);
      }
      setText(this.battleTime, `Время боя: ${(this.battle.tick / 10).toFixed(1)} с · потери: ${this.battle.allyLosses}`);
    }
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
      || ctx.tip('t_reserve', freeReserve,
        'В резерве есть свободная фигура. Выберите её и нажмите на клетку в трёх нижних рядах.'));
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
        key, team: 'ally', kind: f.kind, x: f.x, y: f.y, hp: 1, maxHp: 1,
        selected: !!from && from.x === f.x && from.y === f.y,
      };
    });
    enemyPlacements(getLevel(this.levelId)).forEach((p, i) => {
      views.push({ key: `e${this.levelId}-${i}`, team: 'enemy', kind: p.kind, x: p.x, y: p.y, hp: 1, maxHp: 1, boss: p.boss });
    });
    return views;
  }

  private unitView(u: Unit): UnitView {
    return {
      key: `b${u.uid}`, team: u.side, kind: u.kind, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp,
      shield: u.shield / u.maxHp,
      boss: u.boss, dead: u.hp <= 0,
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
}
