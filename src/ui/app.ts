import { installIconVars } from './icons';
import { chapterOf } from '../game/levels';
import {
  canAffordUpgrade, checkAchievements, claimableAchievements, clearSave, currentLevelId, exportSave, hasSave, importSave, loadGame, newGame, saveGame,
  type GameState,
} from '../game/state';
import { audio } from './audio';
import type { Ctx, Screen, ScreenId } from './context';
import { confirmDialog, el, pulse, setHidden, setText, toast, wipe } from './dom';
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
import { playOpening } from './story';
import { FEATURES, acknowledgeOpen, featureOpen, newlyOpened, openKey } from '../game/features';
import { lives } from '../game/run';
import { t } from '../i18n';

export class App implements Ctx {
  state: GameState;
  settings: Settings = loadSettings();
  private screenId: ScreenId = 'menu';
  private screens!: Record<Exclude<ScreenId, 'menu'>, Screen>;
  private menuEl: HTMLElement = el('div');
  private shell = el('div', 'shell');
  private content = el('main', 'content');
  private chips!: { gold: HTMLElement; stars: HTMLElement; lives: HTMLElement; crowns: HTMLElement; crownChip: HTMLElement };
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
    this.state = loadGame();
    // Saves from before the step-by-step opening already know everything they have reached.
    if (!this.state.tutorial.includes('features_v1')) {
      acknowledgeOpen(this.state);
      this.state.tutorial.push('features_v1');
    }
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

  tip(id: string, target: HTMLElement | null | undefined, text: string, then?: HTMLElement | null): boolean {
    return this.tutorial.tip(id, target, text, then);
  }

  save(): void {
    saveGame(this.state);
  }

  go(screen: ScreenId, levelId?: string): void {
    if (this.screenId !== screen || levelId) wipe();
    this.tutorial.reset();
    this.screenId = screen;
    // The arena switches to battle music itself when a fight starts.
    audio.setTrack(screen === 'menu' ? 'menu' : 'map', this.state.run.chapter);
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
  }

  // ---------------- Build ----------------

  private build(): void {
    this.root.innerHTML = '';
    this.tutorial = new Tutorial(() => this.state, () => this.settings.hints, () => this.save());

    const top = el('header', 'topbar');
    const menuBtn = el('button', 'btn btn-ghost menu-btn', t('☰ Меню'));
    menuBtn.addEventListener('click', () => {
      this.save();
      this.go('menu');
    });
    const brand = el('div', 'brand');
    const logo = el('img', 'brand-logo');
    logo.src = spriteUrl('knight', 'ally');
    logo.alt = '';
    brand.append(logo, el('span', '', t('Пиксельный гамбит')));
    const chipBox = el('div', 'chips');
    // Every chip says what it is: a label on wide screens, an icon and a tap-to-explain on phones.
    const chip = (cls: string, label: string, help: string, short = '') => {
      const c = el('div', `chip ${cls}`);
      const value = el('b');
      c.title = help;
      c.append(el('span', 'chip-label', label));
      if (short) c.append(el('span', 'chip-short', short));
      c.append(value);
      c.addEventListener('click', () => toast(help));
      chipBox.append(c);
      return value;
    };
    this.chips = {
      gold: chip('chip-gold', t('Золото'), t('Золото забега: найм и улучшения фигур, торговцы. Сгорает, когда забег кончается.')),
      stars: chip('chip-wave', t('Глава'), t('Глава забега из четырёх. В конце каждой — босс.'), t('Гл.')),
      lives: chip('chip-best', t('Жизни'), t('Жизни: поражение заканчивает забег. Запасное знамя даёт вторую.')),
      crowns: chip('chip-crowns', t('Короны'), t('Короны остаются навсегда: тратьте их в Древе и Колесе короны.')),
      crownChip: undefined as unknown as HTMLElement,
    };
    this.chips.crownChip = this.chips.crowns.parentElement!;
    const nav = el('nav', 'topnav');
    this.navMap = el('button', 'nav-btn', t('Карта'));
    this.navMap.addEventListener('click', () => this.go('map'));
    this.navCamp = el('button', 'nav-btn', t('Улучшения'));
    this.navCamp.append(this.navBadge);
    this.navCamp.title = t('Лагерь: найм фигур, их уровни и постройки');
    this.navCamp.addEventListener('click', () => this.go('camp'));
    this.navAch = el('button', 'nav-btn', t('Достижения'));
    this.navAch.append(this.achBadge);
    this.navAch.addEventListener('click', () => this.go('achievements'));
    nav.append(this.navMap, this.navCamp, this.navAch);
    this.soundBtn = el('button', 'btn btn-ghost sound-btn');
    this.soundBtn.title = t('Звук и музыка');
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
    const summary = t('Партия {g} · глава {ch} · {gold} золота', { g: s.prestige + 1, ch: chapterOf(id).id, gold: fmt(s.gold) })
      + (s.crowns ? ` · ♛ ${s.crowns}` : '');
    const menu = buildMenu({
      hasSave: hasSave(),
      summary,
      onContinue: () => this.go('map'),
      onNewGame: () => this.newGame(),
      onSettings: () => this.openSettings(),
      peace: this.state.finale.beaten,
    });
    this.menuEl.replaceWith(menu);
    this.menuEl = menu;
  }

  private async newGame(): Promise<void> {
    if (hasSave()) {
      const ok = await confirmDialog(t('Новая игра'), t('Текущий прогресс будет удалён. Начать заново?'));
      if (!ok) return;
    }
    clearSave();
    this.state = newGame();
    this.state.tutorial.push('features_v1');
    this.save();
    // The first minute: the kingdom falls, the king escapes with three pawns — then straight into 1-1.
    if (this.settings.hints) await playOpening();
    this.go('arena', '1-1');
  }

  private openSettings(): void {
    openSettings(this.settings, (next) => {
      this.settings = next;
      saveSettings(next);
      audio.configure(next);
    }, async () => {
      const ok = await confirmDialog(t('Сброс'), t('Удалить сохранение полностью?'), t('Удалить'));
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
        acknowledgeOpen(this.state);
        this.save();
        this.renderMenu();
        return true;
      },
    });
  }

  // ---------------- Loop ----------------


  private frame(now: number): void {
    const dt = Math.min(now - this.lastFrame, 30 * 60 * 1000);
    this.lastFrame = now;
    if (this.screenId !== 'menu') {
      this.screens[this.screenId].frame(dt);
      this.renderTop();
      if (now - this.lastAchCheck > 1000) {
        this.lastAchCheck = now;
        this.checkAchievements();
      }
      this.announceFeatures();
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
    setText(this.chips.stars, t('{n}/4', { n: s.run.chapter }));
    this.navMap.classList.toggle('active', this.screenId === 'map');
    this.navCamp.classList.toggle('active', this.screenId === 'camp');
    setHidden(this.navBadge, this.screenId === 'camp' || !canAffordUpgrade(s));
    this.navAch.classList.toggle('active', this.screenId === 'achievements');
    setHidden(this.navCamp, !featureOpen(s, 'camp'));
    setHidden(this.navAch, !featureOpen(s, 'achievements'));
    setHidden(this.achBadge, claimableAchievements(s) === 0);
    const on = this.settings.sound || this.settings.music;
    setText(this.soundBtn, on ? t('♪ Звук') : t('♪ Тихо'));
    this.soundBtn.classList.toggle('muted', !on);
    setText(this.chips.lives, String(lives(s)));
    setText(this.chips.crowns, fmt(s.crowns));
    setHidden(this.chips.crownChip, s.crowns === 0 && s.prestige === 0 && s.stats.runs === 0);
  }

  private checkAchievements(): void {
    // Achievements are counted from the start but announced only once their tab is open.
    if (!featureOpen(this.state, 'achievements')) return;
    const fresh = checkAchievements(this.state);
    if (!fresh.length) return;
    this.save();
    audio.play('achievement');
    if (fresh.length === 1) toast(t('🏆 Достижение: «{name}»', { name: String(getAchievement(fresh[0])?.name) }), 'good');
    else toast(t('🏆 Новых достижений: {n} — загляните в «Достижения»', { n: fresh.length }), 'good');
  }

  /** A part of the game just opened: say so, and make its button glow for a while. */
  private announceFeatures(): void {
    const s = this.state;
    const fresh = newlyOpened(s);
    if (!fresh.length || document.querySelector('.modal-overlay, .stage-overlay')) return;
    toast(t('Открыто: {name}!', { name: fresh.map((f) => FEATURES[f].name).join(', ') }), 'good');
    for (const f of fresh) {
      s.tutorial.push(openKey(f));
      const button = f === 'camp' ? this.navCamp : f === 'achievements' ? this.navAch : null;
      if (button) {
        button.classList.add('just-opened');
        setTimeout(() => button.classList.remove('just-opened'), 6000);
      }
    }
    audio.play('relic');
    this.save();
  }

  /** Tips that are not tied to one screen. */
  private globalTips(): void {
    const s = this.state;
    if (claimableAchievements(s) > 0 && this.screenId !== 'achievements') {
      this.tip('t_achievements', this.navAch, t('Открыто достижение! Загляните сюда, чтобы забрать награду.'));
    }
    if (s.stats.wins >= 2 && canAffordUpgrade(s) && this.screenId !== 'camp') {
      this.tip('t_upgrades', this.navCamp, t('Золота хватает на улучшения. Здесь нанимают фигуры и повышают их уровень.'));
    }
  }
}


/** A pixel-block reveal over the new screen. */
