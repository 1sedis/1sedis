import { createBattle, stepBattle, type Battle, type BattleEvent, type Unit } from '../game/battle';
import { PIECE_ORDER, PIECES, type PieceKind } from '../game/pieces';
import {
  BOARD_SIZE, PRESTIGE_MIN_WAVE, UPGRADE_ORDER, UPGRADES,
  applyDefeat, atkMultiplier, benchPieces, buyPiece, buyUpgrade, canPrestige, clearSave,
  crownMultiplier, crownsForWave, grantVictory, hasSave, hpMultiplier, isPlayerCell, isUnlocked, loadGame,
  maxSlots, movePiece, newGame, pieceAt, pieceCost, placedPieces, prestige, saveGame, upgradeCost,
  waveReward, type GameState, type UpgradeId,
} from '../game/state';
import { fmt } from './format';
import { buildMenu, openSettings } from './menu';
import { loadSettings, saveSettings, type Settings } from './settings';
import { spriteUrl, type Team } from './sprites';

const TICK_MS = 100;
/** Pause between battles, in ticks. */
const RESULT_TICKS = 14;
/** More pending ticks than this means we are catching up: skip effects. */
const LIVE_FX_LIMIT = 20;

type Phase = 'setup' | 'battle' | 'result';
type Screen = 'menu' | 'game';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

function stars(n: number): string {
  return n > 1 ? '★'.repeat(n - 1) : '';
}

interface UnitView {
  key: string;
  team: Team;
  kind: PieceKind;
  stars: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  preview?: boolean;
  selected?: boolean;
  flash?: boolean;
}

interface ShopRow { kind: PieceKind; root: HTMLElement; meta: HTMLElement; btn: HTMLButtonElement }
interface UpgradeRow { id: UpgradeId; root: HTMLElement; level: HTMLElement; btn: HTMLButtonElement }

export class App {
  private state: GameState = loadGame();
  private phase: Phase = 'setup';
  private battle: Battle | null = null;
  private resultTicks = 0;
  private lastResult: { win: boolean; reward: number } | null = null;
  private settings: Settings = loadSettings();
  private auto = this.settings.auto;
  private speed: Settings['speed'] = this.settings.speed;
  private screen: Screen = 'menu';
  private menuEl!: HTMLElement;
  private gameEl!: HTMLElement;
  private selected: number | null = null;
  private acc = 0;
  private lastFrame = performance.now();
  private liveFx = true;
  private pendingFx: BattleEvent[] = [];
  private log: string[] = [];
  private logDirty = true;
  private benchSig = '';
  private lastGold = -1;

  // DOM
  private chips!: { gold: HTMLElement; wave: HTMLElement; best: HTMLElement; crowns: HTMLElement };
  private waveTitle!: HTMLElement;
  private waveSub!: HTMLElement;
  private status!: HTMLElement;
  private fightBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private autoBtn!: HTMLButtonElement;
  private board!: HTMLElement;
  private cells: HTMLElement[] = [];
  private unitLayer!: HTMLElement;
  private fxLayer!: HTMLElement;
  private banner!: HTMLElement;
  private unitEls = new Map<string, HTMLElement>();
  private bench!: HTMLElement;
  private benchTitle!: HTMLElement;
  private shopRows: ShopRow[] = [];
  private upgradeRows: UpgradeRow[] = [];
  private prestigeInfo!: HTMLElement;
  private prestigeBtn!: HTMLButtonElement;
  private logEl!: HTMLElement;
  private toastLayer!: HTMLElement;
  private tabs: { btn: HTMLButtonElement; panel: HTMLElement }[] = [];

  constructor(private root: HTMLElement) {}

  start(): void {
    this.build();
    this.showMenu();
    this.addLog('Добро пожаловать! Расставьте фигуры и жмите «В бой».');
    // Only persist once a game is actually in progress, so the menu does not
    // offer "Continue" for an untouched new game.
    const persist = () => {
      if (this.screen === 'game' || hasSave()) saveGame(this.state);
    };
    setInterval(persist, 5000);
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persist();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------- Loop ----------------

  private frame(now: number): void {
    const dt = Math.min(now - this.lastFrame, 30 * 60 * 1000);
    this.lastFrame = now;
    if (this.screen !== 'game') {
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    this.acc += dt * this.speed;
    this.liveFx = this.acc / TICK_MS < LIVE_FX_LIMIT;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < 4000) {
      this.acc -= TICK_MS;
      this.tick();
      steps++;
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  private tick(): void {
    if (this.phase === 'battle' && this.battle) {
      stepBattle(this.battle);
      if (this.liveFx) this.pendingFx.push(...this.battle.events);
      if (this.battle.result) this.finishBattle(this.battle.result === 'win');
    } else if (this.phase === 'result') {
      if (--this.resultTicks <= 0) {
        if (this.auto) this.startBattle(true);
        else this.enterSetup();
      }
    }
  }

  private startBattle(silent = false): void {
    if (placedPieces(this.state).length === 0) {
      if (!silent) this.toast('Поставьте хотя бы одну фигуру на доску');
      this.enterSetup();
      return;
    }
    this.selected = null;
    this.battle = createBattle(this.state);
    this.phase = 'battle';
  }

  private finishBattle(win: boolean): void {
    const wave = this.state.wave;
    if (win) {
      const reward = grantVictory(this.state);
      this.lastResult = { win, reward };
      this.addLog(`Волна ${wave} пройдена: +${fmt(reward)} золота`);
    } else {
      applyDefeat(this.state);
      this.lastResult = { win, reward: 0 };
      this.addLog(`Поражение на волне ${wave}. Отступаем на ${this.state.wave}`);
    }
    this.phase = 'result';
    this.resultTicks = RESULT_TICKS;
  }

  private enterSetup(): void {
    this.phase = 'setup';
    this.battle = null;
    this.lastResult = null;
  }

  private retreat(): void {
    this.enterSetup();
    this.addLog('Отступили для перестановки');
  }

  // ---------------- Screens ----------------

  private showMenu(): void {
    if (this.screen === 'game') saveGame(this.state);
    this.screen = 'menu';
    this.menuEl.replaceWith(this.menuEl = buildMenu({
      hasSave: hasSave(),
      summary: `Волна ${this.state.wave} · ${fmt(this.state.gold)} золота`,
      onContinue: () => this.showGame(),
      onNewGame: () => this.newGameFromMenu(),
      onSettings: () => this.openSettings(),
    }));
    this.menuEl.hidden = false;
    this.gameEl.hidden = true;
  }

  private showGame(): void {
    this.screen = 'game';
    this.lastFrame = performance.now();
    this.acc = 0;
    this.menuEl.hidden = true;
    this.gameEl.hidden = false;
  }

  private async newGameFromMenu(): Promise<void> {
    if (hasSave()) {
      const ok = await this.confirm('Новая игра', 'Текущий прогресс, включая короны, будет удалён. Начать заново?');
      if (!ok) return;
    }
    clearSave();
    this.state = newGame();
    this.enterSetup();
    this.selected = null;
    this.log = [];
    this.addLog('Новая партия! Расставьте фигуры и жмите «В бой».');
    saveGame(this.state);
    this.showGame();
  }

  private openSettings(): void {
    openSettings(this.settings, (next) => {
      this.settings = next;
      this.speed = next.speed;
      this.auto = next.auto;
      saveSettings(next);
    }, () => this.onReset());
  }

  // ---------------- Build DOM ----------------

  private build(): void {
    this.root.innerHTML = '';
    this.menuEl = el('div');
    this.root.append(this.menuEl);
    const shell = el('div', 'shell');
    this.gameEl = shell;

    // Top bar
    const top = el('header', 'topbar');
    const brand = el('div', 'brand');
    const logo = el('img', 'brand-logo');
    logo.src = spriteUrl('knight', 'ally');
    logo.alt = '';
    brand.append(logo, el('span', '', 'Пиксельный гамбит'));
    const chipBox = el('div', 'chips');
    const chip = (cls: string, label: string) => {
      const c = el('div', `chip ${cls}`);
      const value = el('b');
      c.append(el('span', 'chip-label', label), value);
      chipBox.append(c);
      return value;
    };
    this.chips = {
      gold: chip('chip-gold', 'Золото'),
      wave: chip('chip-wave', 'Волна'),
      best: chip('chip-best', 'Рекорд'),
      crowns: chip('chip-crown', 'Короны'),
    };
    const menuBtn = el('button', 'btn btn-ghost menu-btn', '☰ Меню');
    menuBtn.addEventListener('click', () => this.showMenu());
    top.append(menuBtn, brand, chipBox);

    const layout = el('main', 'layout');

    // Arena
    const arena = el('section', 'arena card');
    const head = el('div', 'arena-head');
    const titles = el('div', 'arena-titles');
    this.waveTitle = el('h1', 'wave-title');
    this.waveSub = el('div', 'wave-sub');
    titles.append(this.waveTitle, this.waveSub);
    const controls = el('div', 'controls');
    this.status = el('div', 'status');
    this.fightBtn = el('button', 'btn btn-primary');
    this.fightBtn.addEventListener('click', () => {
      if (this.phase === 'setup') this.startBattle();
      else this.retreat();
    });
    const speedBox = el('div', 'seg');
    for (const sp of [1, 2, 4]) {
      const b = el('button', 'seg-btn', `×${sp}`);
      b.addEventListener('click', () => {
        this.speed = sp as Settings['speed'];
        this.settings.speed = this.speed;
        saveSettings(this.settings);
      });
      speedBox.append(b);
      this.speedBtns.push(b);
    }
    this.autoBtn = el('button', 'toggle');
    this.autoBtn.addEventListener('click', () => {
      this.auto = !this.auto;
      this.settings.auto = this.auto;
      saveSettings(this.settings);
    });
    controls.append(this.status, speedBox, this.autoBtn, this.fightBtn);
    head.append(titles, controls);

    const boardWrap = el('div', 'board-wrap');
    this.board = el('div', 'board');
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const c = el('div', `cell ${(x + y) % 2 ? 'dark' : 'light'}`);
        c.addEventListener('click', () => this.onCell(x, y));
        this.board.append(c);
        this.cells.push(c);
      }
    }
    this.unitLayer = el('div', 'unit-layer');
    this.fxLayer = el('div', 'fx-layer');
    this.banner = el('div', 'banner');
    this.board.append(this.unitLayer, this.fxLayer, this.banner);
    boardWrap.append(this.board);

    const benchPanel = el('div', 'bench-panel');
    const benchHead = el('div', 'panel-head');
    this.benchTitle = el('span');
    benchHead.append(el('span', 'panel-title', 'Резерв'), this.benchTitle);
    this.bench = el('div', 'bench');
    benchPanel.append(benchHead, this.bench);
    benchPanel.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.bench-item')) this.toBench();
    });
    arena.append(head, boardWrap, benchPanel);

    // Side panel
    const side = el('aside', 'side card');
    const tabBar = el('nav', 'tabs');
    side.append(tabBar);
    const addTab = (label: string, panel: HTMLElement) => {
      const btn = el('button', 'tab', label);
      const index = this.tabs.length;
      btn.addEventListener('click', () => this.selectTab(index));
      tabBar.append(btn);
      panel.classList.add('tab-panel');
      side.append(panel);
      this.tabs.push({ btn, panel });
    };
    addTab('Армия', this.buildShop());
    addTab('Улучшения', this.buildUpgrades());
    addTab('Корона', this.buildPrestige());
    this.selectTab(0);

    const logBox = el('div', 'log-box');
    logBox.append(el('div', 'panel-title', 'Хроника'));
    this.logEl = el('ul', 'log');
    logBox.append(this.logEl);
    side.append(logBox);

    layout.append(arena, side);
    this.toastLayer = el('div', 'toast-layer');
    shell.append(top, layout, this.toastLayer);
    this.root.append(shell);
  }

  private selectTab(index: number): void {
    this.tabs.forEach((t, i) => {
      t.btn.classList.toggle('active', i === index);
      t.panel.hidden = i !== index;
    });
  }

  private buildShop(): HTMLElement {
    const panel = el('div');
    panel.append(el('p', 'hint', 'Три одинаковые фигуры сливаются в одну — со звездой и двойной силой.'));
    for (const kind of PIECE_ORDER) {
      const def = PIECES[kind];
      const root = el('div', 'row');
      const icon = el('img', 'row-icon');
      icon.src = spriteUrl(kind, 'ally');
      icon.alt = '';
      const body = el('div', 'row-body');
      const meta = el('div', 'row-meta');
      body.append(el('div', 'row-name', def.name), el('div', 'row-desc', def.description), meta);
      const btn = el('button', 'btn btn-buy');
      btn.addEventListener('click', () => this.onBuy(kind));
      root.append(icon, body, btn);
      panel.append(root);
      this.shopRows.push({ kind, root, meta, btn });
    }
    return panel;
  }

  private buildUpgrades(): HTMLElement {
    const panel = el('div');
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      const root = el('div', 'row');
      const body = el('div', 'row-body');
      const level = el('span', 'row-level');
      const name = el('div', 'row-name', def.name);
      name.append(' ', level);
      body.append(name, el('div', 'row-desc', def.description));
      const btn = el('button', 'btn btn-buy');
      btn.addEventListener('click', () => {
        if (buyUpgrade(this.state, id)) this.pulse(btn);
      });
      root.append(el('div', `row-badge badge-${id}`), body, btn);
      panel.append(root);
      this.upgradeRows.push({ id, root, level, btn });
    }
    return panel;
  }

  private buildPrestige(): HTMLElement {
    const panel = el('div', 'prestige');
    panel.append(el('p', 'hint',
      `Коронация сбрасывает золото, фигуры, улучшения и волны, но даёт короны. ` +
      `Каждая корона навсегда даёт +5% к атаке, здоровью и золоту. Доступна с ${PRESTIGE_MIN_WAVE}-й волны.`));
    this.prestigeInfo = el('div', 'prestige-info');
    this.prestigeBtn = el('button', 'btn btn-crown');
    this.prestigeBtn.addEventListener('click', () => this.onPrestige());
    const reset = el('button', 'btn btn-ghost', 'Сбросить весь прогресс');
    reset.addEventListener('click', () => this.onReset());
    panel.append(this.prestigeInfo, this.prestigeBtn, reset);
    return panel;
  }

  // ---------------- Interaction ----------------

  private onCell(x: number, y: number): void {
    if (this.phase !== 'setup') {
      this.toast('Расстановка — между боями. Нажмите «Отступить»');
      return;
    }
    const occupant = pieceAt(this.state, x, y);
    if (this.selected !== null) {
      if (occupant?.id === this.selected) {
        this.selected = null;
        return;
      }
      if (!isPlayerCell(x, y)) {
        this.toast('Свои фигуры ставятся в два нижних ряда');
        return;
      }
      if (movePiece(this.state, this.selected, { x, y })) this.selected = null;
      else this.toast(`Нет свободных мест в отряде (${maxSlots(this.state)}). Улучшите лагерь`);
      return;
    }
    if (occupant) this.selected = occupant.id;
  }

  private onBenchPiece(id: number): void {
    this.selected = this.selected === id ? null : id;
  }

  private toBench(): void {
    if (this.selected === null || this.phase !== 'setup') return;
    const piece = this.state.pieces.find((p) => p.id === this.selected);
    if (piece?.pos) movePiece(this.state, piece.id, null);
    this.selected = null;
  }

  private onBuy(kind: PieceKind): void {
    const countBefore = this.state.pieces.filter((p) => p.kind === kind).length;
    if (!buyPiece(this.state, kind)) return;
    const row = this.shopRows.find((r) => r.kind === kind);
    if (row) this.pulse(row.btn);
    const after = this.state.pieces.filter((p) => p.kind === kind);
    if (after.length <= countBefore) {
      const best = Math.max(...after.map((p) => p.stars));
      this.toast(`Слияние! ${PIECES[kind].name} ${stars(best)}`, 'good');
    }
  }

  private async onPrestige(): Promise<void> {
    if (!canPrestige(this.state)) return;
    const gain = crownsForWave(this.state.bestWave);
    const ok = await this.confirm('Коронация', `Начать заново и получить ${gain} корон?`);
    if (!ok) return;
    prestige(this.state);
    this.enterSetup();
    this.selected = null;
    saveGame(this.state);
    this.addLog(`Коронация! +${gain} корон`);
    this.toast(`+${gain} корон! Армия стала сильнее`, 'good');
  }

  private async onReset(): Promise<void> {
    const ok = await this.confirm('Сброс', 'Удалить сохранение полностью, включая короны?');
    if (!ok) return;
    clearSave();
    this.state = newGame();
    this.enterSetup();
    this.selected = null;
    this.log = [];
    this.addLog('Прогресс сброшен');
    if (this.screen === 'menu') this.showMenu();
  }

  // ---------------- Rendering ----------------

  private render(): void {
    const s = this.state;
    setText(this.chips.gold, fmt(s.gold));
    if (s.gold > this.lastGold && this.lastGold >= 0) this.pulse(this.chips.gold);
    this.lastGold = s.gold;
    setText(this.chips.wave, String(this.battle?.wave ?? s.wave));
    setText(this.chips.best, String(s.bestWave));
    setText(this.chips.crowns, String(s.crowns));

    this.renderArenaHead();
    this.renderBoard();
    this.renderBench();
    this.renderShop();
    this.renderUpgrades();
    this.renderPrestige();
    this.renderLog();
    this.flushFx();
  }

  private renderArenaHead(): void {
    const s = this.state;
    const wave = this.battle?.wave ?? s.wave;
    setText(this.waveTitle, `Волна ${wave}`);
    setText(this.waveSub, `Награда: ${fmt(waveReward(s, wave))} золота`);
    let status = 'Расстановка';
    if (this.phase === 'battle' && this.battle) status = `Бой · ${(this.battle.tick / 10).toFixed(1)} с`;
    if (this.phase === 'result') status = this.lastResult?.win ? 'Победа' : 'Поражение';
    setText(this.status, status);
    this.status.dataset.phase = this.phase;
    setText(this.fightBtn, this.phase === 'setup' ? '▶ В бой' : '■ Отступить');
    this.fightBtn.classList.toggle('btn-danger', this.phase !== 'setup');
    this.speedBtns.forEach((b, i) => b.classList.toggle('active', [1, 2, 4][i] === this.speed));
    setText(this.autoBtn, this.auto ? 'Авто: вкл' : 'Авто: выкл');
    this.autoBtn.classList.toggle('on', this.auto);
    this.board.style.setProperty('--step', `${Math.round(180 / this.speed)}ms`);

    const showBanner = this.phase === 'result' && this.lastResult;
    this.banner.classList.toggle('show', !!showBanner);
    if (showBanner && this.lastResult) {
      this.banner.classList.toggle('win', this.lastResult.win);
      setText(this.banner, this.lastResult.win ? `Победа  +${fmt(this.lastResult.reward)}` : 'Поражение');
    }
  }

  private collectUnits(): UnitView[] {
    const views: UnitView[] = [];
    if (this.battle) {
      for (const u of this.battle.units) views.push(this.unitView(u));
      return views;
    }
    for (const p of placedPieces(this.state)) {
      views.push({
        key: `p${p.id}`, team: 'ally', kind: p.kind, stars: p.stars, x: p.pos!.x, y: p.pos!.y,
        hp: 1, maxHp: 1, selected: p.id === this.selected,
      });
    }
    // Preview of the upcoming wave.
    for (const u of createBattle(this.state).units) {
      if (u.side === 'enemy') views.push({ ...this.unitView(u), key: `e${u.uid}`, preview: true });
    }
    return views;
  }

  private unitView(u: Unit): UnitView {
    return {
      key: `b${u.uid}`, team: u.side, kind: u.kind, stars: u.stars, x: u.x, y: u.y,
      hp: Math.max(0, u.hp), maxHp: u.maxHp, flash: u.flash > 0,
    };
  }

  private renderBoard(): void {
    const setup = this.phase === 'setup';
    const selected = this.selected !== null;
    this.board.classList.toggle('setup', setup);
    this.board.classList.toggle('placing', setup && selected);
    this.cells.forEach((c, i) => {
      const y = Math.floor(i / BOARD_SIZE);
      c.classList.toggle('deploy', setup && isPlayerCell(i % BOARD_SIZE, y));
    });

    const seen = new Set<string>();
    for (const v of this.collectUnits()) {
      seen.add(v.key);
      let node = this.unitEls.get(v.key);
      if (!node) {
        node = el('div', 'unit');
        const img = el('img', 'unit-sprite');
        img.alt = '';
        img.src = spriteUrl(v.kind, v.team);
        const hp = el('div', 'hp');
        hp.append(el('div', 'hp-fill'));
        node.append(img, el('div', 'unit-stars'), hp);
        node.classList.add(v.team);
        // Spawn at the right spot without sliding in from the corner.
        node.style.transform = `translate(${v.x * 100}%, ${v.y * 100}%)`;
        this.unitLayer.append(node);
        this.unitEls.set(v.key, node);
      }
      node.style.transform = `translate(${v.x * 100}%, ${v.y * 100}%)`;
      node.classList.toggle('preview', !!v.preview);
      node.classList.toggle('selected', !!v.selected);
      node.classList.toggle('flash', !!v.flash);
      node.classList.toggle('dead', v.hp <= 0 && !v.preview && this.battle !== null);
      setText(node.children[1] as HTMLElement, stars(v.stars));
      const fill = node.querySelector<HTMLElement>('.hp-fill')!;
      const pct = `${(v.hp / v.maxHp) * 100}%`;
      if (fill.style.width !== pct) fill.style.width = pct;
      node.classList.toggle('full-hp', v.hp >= v.maxHp);
    }
    for (const [key, node] of this.unitEls) {
      if (!seen.has(key)) {
        node.remove();
        this.unitEls.delete(key);
      }
    }
  }

  private renderBench(): void {
    const s = this.state;
    const bench = benchPieces(s);
    setText(this.benchTitle, `Отряд ${placedPieces(s).length}/${maxSlots(s)}`);
    const sig = `${bench.map((p) => `${p.id}:${p.stars}`).join(',')}|${this.selected}|${this.phase}`;
    if (sig === this.benchSig) return;
    this.benchSig = sig;
    this.bench.innerHTML = '';
    if (bench.length === 0) {
      const empty = el('div', 'bench-empty',
        this.selected !== null && this.phase === 'setup'
          ? 'Нажмите сюда, чтобы убрать фигуру в резерв'
          : 'Купленные фигуры без места на доске ждут здесь');
      this.bench.append(empty);
      return;
    }
    for (const p of bench) {
      const item = el('button', 'bench-item');
      item.classList.toggle('selected', p.id === this.selected);
      item.disabled = this.phase !== 'setup';
      const img = el('img');
      img.src = spriteUrl(p.kind, 'ally');
      img.alt = PIECES[p.kind].name;
      item.title = PIECES[p.kind].name;
      item.append(img, el('span', 'unit-stars', stars(p.stars)));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onBenchPiece(p.id);
      });
      this.bench.append(item);
    }
  }

  private renderShop(): void {
    const s = this.state;
    for (const row of this.shopRows) {
      const def = PIECES[row.kind];
      const unlocked = isUnlocked(s, row.kind);
      const cost = pieceCost(s, row.kind);
      row.root.classList.toggle('locked', !unlocked);
      if (unlocked) {
        const hp = Math.round(def.hp * hpMultiplier(s));
        const atk = Math.round(def.atk * atkMultiplier(s));
        const owned = s.pieces.filter((p) => p.kind === row.kind)
          .reduce((sum, p) => sum + 3 ** (p.stars - 1), 0);
        setText(row.meta, `❤ ${fmt(hp)}   ⚔ ${fmt(atk)}   ♟ ${owned}`);
        row.meta.title = 'Здоровье, атака и сколько таких фигур в армии (с учётом слияний)';
        setText(row.btn, `${fmt(cost)} з.`);
        row.btn.disabled = s.gold < cost;
      } else {
        setText(row.meta, `Откроется на ${def.unlockWave}-й волне`);
        setText(row.btn, '🔒');
        row.btn.disabled = true;
      }
    }
  }

  private renderUpgrades(): void {
    const s = this.state;
    for (const row of this.upgradeRows) {
      const def = UPGRADES[row.id];
      const lvl = s.upgrades[row.id];
      const maxed = lvl >= def.maxLevel;
      setText(row.level, Number.isFinite(def.maxLevel) ? `${lvl}/${def.maxLevel}` : `ур. ${lvl}`);
      const cost = upgradeCost(s, row.id);
      setText(row.btn, maxed ? 'Макс.' : `${fmt(cost)} з.`);
      row.btn.disabled = maxed || s.gold < cost;
    }
  }

  private renderPrestige(): void {
    const s = this.state;
    const gain = crownsForWave(s.bestWave);
    const bonus = Math.round((crownMultiplier(s) - 1) * 100);
    const lines = [
      `Корон: ${s.crowns} (бонус +${bonus}%)`,
      `Рекорд забега: волна ${s.bestWave}`,
      gain > 0 ? `Коронация даст: +${gain} корон` : `Дойдите до ${PRESTIGE_MIN_WAVE}-й волны`,
      `Коронаций: ${s.stats.prestiges} · Лучшая волна: ${s.stats.allTimeBestWave}`,
    ];
    setText(this.prestigeInfo, lines.join('\n'));
    setText(this.prestigeBtn, gain > 0 ? `👑 Короноваться (+${gain})` : '👑 Пока недоступно');
    this.prestigeBtn.disabled = gain <= 0;
  }

  private addLog(text: string): void {
    this.log.unshift(text);
    this.log.length = Math.min(this.log.length, 8);
    this.logDirty = true;
  }

  private renderLog(): void {
    if (!this.logDirty) return;
    this.logDirty = false;
    this.logEl.innerHTML = '';
    for (const line of this.log) this.logEl.append(el('li', '', line));
  }

  // ---------------- Effects ----------------

  private flushFx(): void {
    const events = this.pendingFx.splice(0);
    if (!this.liveFx || !this.settings.effects || events.length > 60) return;
    for (const e of events) {
      if (e.type === 'hit') {
        const dmg = el('div', `fx-dmg ${e.side}`, fmt(Math.round(e.amount)));
        this.placeFx(dmg, e.x, e.y);
        const dist = Math.max(Math.abs(e.x - e.fromX), Math.abs(e.y - e.fromY));
        if (dist > 1) this.bolt(e);
      } else {
        for (let i = 0; i < 10; i++) {
          const p = el('div', `fx-pixel ${e.side}`);
          const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
          const r = 30 + Math.random() * 30;
          p.style.setProperty('--dx', `${Math.cos(angle) * r}px`);
          p.style.setProperty('--dy', `${Math.sin(angle) * r}px`);
          this.placeFx(p, e.x, e.y);
        }
      }
    }
  }

  private placeFx(node: HTMLElement, x: number, y: number): void {
    node.style.left = `${(x + 0.5) * 12.5}%`;
    node.style.top = `${(y + 0.5) * 12.5}%`;
    node.addEventListener('animationend', () => node.remove());
    this.fxLayer.append(node);
  }

  private bolt(e: BattleEvent): void {
    const b = el('div', `fx-bolt ${e.side === 'ally' ? 'enemy' : 'ally'}`);
    // The bolt box is one cell in size, so translate % moves it cell by cell.
    b.style.left = `${e.fromX * 12.5}%`;
    b.style.top = `${e.fromY * 12.5}%`;
    b.style.setProperty('--tx', `${(e.x - e.fromX) * 100}%`);
    b.style.setProperty('--ty', `${(e.y - e.fromY) * 100}%`);
    b.addEventListener('animationend', () => b.remove());
    this.fxLayer.append(b);
  }

  private pulse(node: HTMLElement): void {
    node.classList.remove('pop');
    void node.offsetWidth;
    node.classList.add('pop');
  }

  private toast(text: string, kind: 'info' | 'good' = 'info'): void {
    const t = el('div', `toast ${kind}`, text);
    this.toastLayer.append(t);
    while (this.toastLayer.children.length > 3) this.toastLayer.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  private confirm(title: string, text: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = el('div', 'modal-overlay');
      const box = el('div', 'modal card');
      const actions = el('div', 'modal-actions');
      const no = el('button', 'btn btn-ghost', 'Отмена');
      const yes = el('button', 'btn btn-primary', 'Да');
      const close = (v: boolean) => {
        overlay.remove();
        resolve(v);
      };
      no.addEventListener('click', () => close(false));
      yes.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      actions.append(no, yes);
      box.append(el('h2', '', title), el('p', '', text), actions);
      overlay.append(box);
      document.body.append(overlay);
      yes.focus();
    });
  }
}
