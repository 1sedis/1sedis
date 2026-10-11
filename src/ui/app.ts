import { ALL_LEVELS, chapterOf } from '../game/levels';
import {
  accrue, clearSave, currentLevelId, hasSave, incomePerMinute, loadGame, newGame, saveGame, totalStars,
  type GameState,
} from '../game/state';
import type { Ctx, Screen, ScreenId } from './context';
import { confirmDialog, el, openModal, pulse, setText } from './dom';
import { fmt } from './format';
import { buildMenu, openSettings } from './menu';
import { ArenaScreen } from './screens/arena';
import { CampScreen } from './screens/camp';
import { MapScreen } from './screens/map';
import { loadSettings, saveSettings, type Settings } from './settings';
import { spriteUrl } from './sprites';

export class App implements Ctx {
  state: GameState;
  settings: Settings = loadSettings();
  private offlineGold: number;
  private screenId: ScreenId = 'menu';
  private screens!: Record<Exclude<ScreenId, 'menu'>, Screen>;
  private menuEl: HTMLElement = el('div');
  private shell = el('div', 'shell');
  private content = el('main', 'content');
  private chips!: { gold: HTMLElement; stars: HTMLElement; income: HTMLElement };
  private lastFrame = performance.now();
  private lastGold = -1;

  constructor(private root: HTMLElement) {
    const loaded = loadGame();
    this.state = loaded.state;
    this.offlineGold = loaded.offlineGold;
  }

  start(): void {
    this.build();
    this.go('menu');
    // Persist only once a game is in progress, so the menu does not offer
    // "Continue" for an untouched new game.
    const persist = () => {
      if (this.screenId !== 'menu' || hasSave()) this.save();
    };
    setInterval(persist, 5000);
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persist();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  save(): void {
    saveGame(this.state);
  }

  go(screen: ScreenId, levelId?: string): void {
    const fromMenu = this.screenId === 'menu';
    this.screenId = screen;
    if (screen === 'menu') {
      this.renderMenu();
      this.menuEl.hidden = false;
      this.shell.hidden = true;
      return;
    }
    this.menuEl.hidden = true;
    this.shell.hidden = false;
    for (const [id, s] of Object.entries(this.screens)) s.root.hidden = id !== screen;
    this.screens[screen].show(levelId);
    window.scrollTo(0, 0);
    if (fromMenu && this.offlineGold >= 1) this.showOfflineGains();
  }

  // ---------------- Build ----------------

  private build(): void {
    this.root.innerHTML = '';

    const top = el('header', 'topbar');
    const menuBtn = el('button', 'btn btn-ghost menu-btn', '☰ Меню');
    menuBtn.addEventListener('click', () => {
      this.save();
      this.go('menu');
    });
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
      stars: chip('chip-wave', 'Звёзды'),
      income: chip('chip-best', 'Доход/мин'),
    };
    top.append(menuBtn, brand, chipBox);

    this.screens = {
      map: new MapScreen(this),
      arena: new ArenaScreen(this),
      camp: new CampScreen(this),
    };
    for (const s of Object.values(this.screens)) this.content.append(s.root);
    this.shell.append(top, this.content);
    this.root.append(this.menuEl, this.shell);
  }

  private renderMenu(): void {
    const s = this.state;
    const id = currentLevelId(s);
    const summary = `Глава ${chapterOf(id).id} · ★ ${totalStars(s)}/${ALL_LEVELS.length * 3} · ${fmt(s.gold)} золота`;
    const menu = buildMenu({
      hasSave: hasSave(),
      summary,
      onContinue: () => this.go('map'),
      onNewGame: () => this.newGame(),
      onSettings: () => this.openSettings(),
    });
    this.menuEl.replaceWith(menu);
    this.menuEl = menu;
  }

  private async newGame(): Promise<void> {
    if (hasSave()) {
      const ok = await confirmDialog('Новая игра', 'Текущий прогресс будет удалён. Начать заново?');
      if (!ok) return;
    }
    clearSave();
    this.state = newGame();
    this.offlineGold = 0;
    this.save();
    this.go('arena', '1-1');
  }

  private openSettings(): void {
    openSettings(this.settings, (next) => {
      this.settings = next;
      saveSettings(next);
    }, async () => {
      const ok = await confirmDialog('Сброс', 'Удалить сохранение полностью?', 'Удалить');
      if (!ok) return;
      clearSave();
      this.state = newGame();
      this.renderMenu();
    });
  }

  private showOfflineGains(): void {
    const gold = Math.floor(this.offlineGold);
    this.offlineGold = 0;
    const content = el('div', 'offline');
    content.append(
      el('h2', '', 'С возвращением!'),
      el('p', '', 'Пока вас не было, захваченные земли пополнили казну:'),
      el('div', 'result-reward', `+${fmt(gold)} золота`),
      el('p', 'hint', 'Заберите золото в казне на карте.'),
    );
    const actions = el('div', 'modal-actions');
    const ok = el('button', 'btn btn-primary', 'Отлично');
    actions.append(ok);
    content.append(actions);
    const close = openModal(content);
    ok.addEventListener('click', close);
  }

  // ---------------- Loop ----------------

  private frame(now: number): void {
    const dt = Math.min(now - this.lastFrame, 30 * 60 * 1000);
    this.lastFrame = now;
    if (this.screenId !== 'menu') {
      accrue(this.state);
      this.screens[this.screenId].frame(dt);
      this.renderTop();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private renderTop(): void {
    const s = this.state;
    setText(this.chips.gold, fmt(s.gold));
    if (s.gold > this.lastGold && this.lastGold >= 0) pulse(this.chips.gold);
    this.lastGold = s.gold;
    setText(this.chips.stars, `${totalStars(s)}/${ALL_LEVELS.length * 3}`);
    const rate = incomePerMinute(s);
    setText(this.chips.income, rate < 100 ? String(Math.round(rate * 10) / 10) : fmt(rate));
  }
}
