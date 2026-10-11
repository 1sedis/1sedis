import { installIconVars } from './icons';
import { offlineDescent, type OfflineDescent } from '../game/offline';
import { ALL_LEVELS, chapterOf } from '../game/levels';
import {
  accrue, canAffordUpgrade, checkAchievements, claimableAchievements, clearSave, currentLevelId, exportSave, hasSave, importSave, incomePerMinute, loadGame, newGame, saveGame, totalStars,
  type GameState,
} from '../game/state';
import { audio } from './audio';
import type { Ctx, Screen, ScreenId } from './context';
import { confirmDialog, el, openModal, pulse, setText, toast } from './dom';
import { fmt } from './format';
import { buildMenu, openSettings } from './menu';
import { getAchievement } from '../game/achievements';
import { AchievementsScreen } from './screens/achievements';
import { ArenaScreen } from './screens/arena';
import { CampScreen } from './screens/camp';
import { MapScreen } from './screens/map';
import { loadSettings, saveSettings, type Settings } from './settings';
import { spriteUrl } from './sprites';
import { Tutorial } from './tutorial';

export class App implements Ctx {
  state: GameState;
  settings: Settings = loadSettings();
  private offlineGold: number;
  private descent: OfflineDescent | null = null;
  private screenId: ScreenId = 'menu';
  private screens!: Record<Exclude<ScreenId, 'menu'>, Screen>;
  private menuEl: HTMLElement = el('div');
  private shell = el('div', 'shell');
  private content = el('main', 'content');
  private chips!: { gold: HTMLElement; stars: HTMLElement; income: HTMLElement };
  private navMap!: HTMLButtonElement;
  private navCamp!: HTMLButtonElement;
  private navBadge = el('span', 'nav-badge');
  private navAch!: HTMLButtonElement;
  private achBadge = el('span', 'nav-badge');
  private tutorial!: Tutorial;
  private soundBtn!: HTMLButtonElement;
  private lastAchCheck = 0;
  private lastFrame = performance.now();
  private lastGold = -1;

  constructor(private root: HTMLElement) {
    const loaded = loadGame();
    this.state = loaded.state;
    this.offlineGold = loaded.offlineGold;
    this.descent = offlineDescent(this.state, loaded.offlineMs);
  }

  start(): void {
    installIconVars();
    audio.configure(this.settings);
    // A soft click on every button press.
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn && !btn.disabled) audio.play('click');
    });
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

  tip(id: string, target: HTMLElement | null | undefined, text: string): boolean {
    return this.tutorial.tip(id, target, text);
  }

  save(): void {
    saveGame(this.state);
  }

  go(screen: ScreenId, levelId?: string): void {
    const fromMenu = this.screenId === 'menu';
    if (this.screenId !== screen || levelId) wipe();
    this.tutorial.reset();
    this.screenId = screen;
    // The arena switches to battle music itself when a fight starts.
    audio.setTrack(screen === 'menu' ? 'menu' : 'map');
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
    if (fromMenu && (this.offlineGold >= 1 || this.descent?.floors)) this.showOfflineGains();
  }

  // ---------------- Build ----------------

  private build(): void {
    this.root.innerHTML = '';
    this.tutorial = new Tutorial(() => this.state, () => this.settings.hints, () => this.save());

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
      income: chip('chip-best', 'Доход'),
    };
    const nav = el('nav', 'topnav');
    this.navMap = el('button', 'nav-btn', 'Карта');
    this.navMap.addEventListener('click', () => this.go('map'));
    this.navCamp = el('button', 'nav-btn', 'Улучшения');
    this.navCamp.append(this.navBadge);
    this.navCamp.title = 'Лагерь: найм фигур, их уровни и постройки';
    this.navCamp.addEventListener('click', () => this.go('camp'));
    this.navAch = el('button', 'nav-btn', 'Достижения');
    this.navAch.append(this.achBadge);
    this.navAch.addEventListener('click', () => this.go('achievements'));
    nav.append(this.navMap, this.navCamp, this.navAch);
    this.soundBtn = el('button', 'btn btn-ghost sound-btn');
    this.soundBtn.title = 'Звук и музыка';
    this.soundBtn.addEventListener('click', () => {
      const on = !(this.settings.sound || this.settings.music);
      this.settings = { ...this.settings, sound: on, music: on };
      saveSettings(this.settings);
      audio.configure(this.settings);
    });
    top.append(menuBtn, this.soundBtn, brand, nav, chipBox);

    this.screens = {
      map: new MapScreen(this),
      arena: new ArenaScreen(this),
      camp: new CampScreen(this),
      achievements: new AchievementsScreen(this),
    };
    for (const s of Object.values(this.screens)) this.content.append(s.root);
    this.shell.append(top, this.content);
    this.root.append(this.menuEl, this.shell);
  }

  private renderMenu(): void {
    const s = this.state;
    const id = currentLevelId(s);
    const summary = `Глава ${chapterOf(id).id} · ★ ${totalStars(s)}/${ALL_LEVELS.length * 3} · ${fmt(s.gold)} золота`
      + (s.crowns ? ` · ♛ ${s.crowns}` : '');
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
      audio.configure(next);
    }, async () => {
      const ok = await confirmDialog('Сброс', 'Удалить сохранение полностью?', 'Удалить');
      if (!ok) return;
      clearSave();
      this.state = newGame();
      this.renderMenu();
    }, () => {
      this.state.tutorial = [];
      this.save();
    }, {
      exportCode: () => {
        this.save();
        return exportSave(this.state);
      },
      importCode: (code) => {
        const next = importSave(code);
        if (!next) return false;
        this.state = next;
        this.offlineGold = 0;
        this.descent = null;
        this.save();
        this.renderMenu();
        return true;
      },
    });
  }

  private showOfflineGains(): void {
    const gold = Math.floor(this.offlineGold);
    const d = this.descent;
    this.offlineGold = 0;
    this.descent = null;
    const content = el('div', 'offline');
    content.append(el('h2', '', 'С возвращением!'));
    if (gold >= 1) content.append(el('div', 'result-reward', `Казна: +${fmt(gold)} золота`));
    if (d && d.floors > 0) {
      content.append(el('div', 'result-unlock shard',
        `Армия прошла в Бездне ${d.floors} эт.: +${fmt(d.gold)} золота, +${d.shards} ◆`));
      if (d.relics > 0) content.append(el('div', 'result-unlock relic', 'Страж повержен — ждёт новая реликвия!'));
      if (d.stoppedAt) content.append(el('p', 'hint', `Остановились на этаже ${d.stoppedAt}: нужна сила посерьёзнее.`));
    }
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
      if (now - this.lastAchCheck > 1000) {
        this.lastAchCheck = now;
        this.checkAchievements();
      }
      this.globalTips();
      this.tutorial.frame();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  private renderTop(): void {
    const s = this.state;
    setText(this.chips.gold, fmt(s.gold));
    if (s.gold > this.lastGold && this.lastGold >= 0) pulse(this.chips.gold);
    this.lastGold = s.gold;
    setText(this.chips.stars, `${totalStars(s)}/${ALL_LEVELS.length * 3}`);
    this.navMap.classList.toggle('active', this.screenId === 'map');
    this.navCamp.classList.toggle('active', this.screenId === 'camp');
    this.navBadge.hidden = this.screenId === 'camp' || !canAffordUpgrade(s);
    this.navAch.classList.toggle('active', this.screenId === 'achievements');
    this.achBadge.hidden = claimableAchievements(s) === 0;
    const on = this.settings.sound || this.settings.music;
    setText(this.soundBtn, on ? '♪ Звук' : '♪ Тихо');
    this.soundBtn.classList.toggle('muted', !on);
    const rate = incomePerMinute(s);
    setText(this.chips.income, `${rate < 100 ? Math.round(rate * 10) / 10 : fmt(rate)}/мин`);
  }

  private checkAchievements(): void {
    const fresh = checkAchievements(this.state);
    if (!fresh.length) return;
    this.save();
    audio.play('achievement');
    for (const id of fresh) toast(`Достижение: «${getAchievement(id)?.name}»`, 'good');
  }

  /** Tips that are not tied to one screen. */
  private globalTips(): void {
    const s = this.state;
    if (claimableAchievements(s) > 0 && this.screenId !== 'achievements') {
      this.tip('t_achievements', this.navAch, 'Открыто достижение! Загляните сюда, чтобы забрать награду.');
    }
    if (s.shards >= 5 && s.roulette.spins === 0 && this.screenId !== 'camp') {
      this.tip('t_altar', this.navCamp, 'У вас есть осколки бездны! Крутите за них «Рулетку бездны» здесь: случайные вечные улучшения, вплоть до легендарных.');
    }
    if (s.stats.wins >= 2 && canAffordUpgrade(s) && this.screenId !== 'camp') {
      this.tip('t_upgrades', this.navCamp, 'Золота хватает на улучшения. Здесь нанимают фигуры и повышают их уровень.');
    }
  }
}

let wipeEl: HTMLElement | null = null;

/** A pixel-block reveal over the new screen. */
function wipe(): void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (!wipeEl) {
    wipeEl = el('div', 'wipe');
    const cols = 12;
    const rows = 8;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const b = el('span');
        b.style.animationDelay = `${(x + y) * 12}ms`;
        wipeEl.append(b);
      }
    }
    wipeEl.addEventListener('animationend', (e) => {
      if ((e.target as HTMLElement) === wipeEl!.lastElementChild) wipeEl!.classList.remove('run');
    });
    document.body.append(wipeEl);
  }
  wipeEl.classList.remove('run');
  void wipeEl.offsetWidth;
  wipeEl.classList.add('run');
}
