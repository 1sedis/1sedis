import { BOARD_SIZE, type BattleEvent } from '../game/battle';
import type { PieceKind } from '../game/pieces';
import { PLAYER_ROWS } from '../game/state';
import { el, setText } from './dom';
import { fmt } from './format';
import { spriteUrl, type Team, type Tier } from './sprites';
import { TERRAIN_INFO, walkable, type Terrain } from '../game/terrain';
import { terrainUrl } from './terrainArt';
import { traitUrl } from './traitIcons';
import { handUrl } from './handArt';
import type { Trait } from '../game/elites';

export interface UnitView {
  key: string;
  team: Team;
  kind: PieceKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Shield as a share of max HP (0 when none). */
  shield?: number;
  /** Visual tier from the piece level. */
  tier?: Tier;
  boss?: boolean;
  /** Elite trait badge. */
  trait?: Trait;
  selected?: boolean;
  dead?: boolean;
  /** Drawn as something other than a chess piece (the finale's Hand). */
  skin?: 'hand' | 'blackKing';
}

export class BoardView {
  /** The board with its coordinate frame; this is what screens insert. */
  readonly frame: HTMLElement;
  readonly root: HTMLElement;
  private stage: HTMLElement;
  private cells: HTMLElement[] = [];
  private unitLayer: HTMLElement;
  private fxLayer: HTMLElement;
  private banner: HTMLElement;
  private calloutEl: HTMLElement;
  private introEl: HTMLElement;
  private units = new Map<string, { node: HTMLElement; body: HTMLElement; img: HTMLImageElement; fill: HTMLElement; shield: HTMLElement; kind: PieceKind; team: Team; tier: Tier }>();

  constructor(onCell: (x: number, y: number) => void) {
    this.root = el('div', 'board');
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const c = el('div', `cell ${(x + y) % 2 ? 'dark' : 'light'}`);
        if (PLAYER_ROWS.includes(y)) c.classList.add('deploy');
        c.addEventListener('click', () => onCell(x, y));
        this.root.append(c);
        this.cells.push(c);
      }
    }
    // Soft light from above over the cells, under the pieces.
    this.root.append(el('div', 'board-light'));
    this.unitLayer = el('div', 'unit-layer');
    this.fxLayer = el('div', 'fx-layer');
    this.banner = el('div', 'banner');
    this.calloutEl = el('div', 'boss-callout');
    this.introEl = el('div', 'boss-intro');
    this.root.append(this.unitLayer, this.fxLayer);
    // Overlays live outside the board in their own stage, so no piece layer
    // (Safari promotes animated pieces to separate layers) can ever cover them.
    this.stage = el('div', 'board-stage');
    this.stage.append(this.root, this.banner, this.calloutEl, this.introEl);
    // One-shot animations must drop their class when done: a hidden screen that is shown
    // again restarts every running CSS animation, which would replay old callouts.
    this.calloutEl.addEventListener('animationend', () => this.calloutEl.classList.remove('show'));
    // The Hand watches the cursor: its sprite leans towards the pointer.
    this.root.addEventListener('pointermove', (e) => {
      const r = this.root.getBoundingClientRect();
      const t = ((e.clientX - r.left) / r.width - 0.5) * 24;
      this.root.style.setProperty('--hand-tilt', `${t.toFixed(1)}deg`);
    });
    this.root.addEventListener('animationend', (e) => {
      if (e.target === this.root) this.root.classList.remove('shake', 'shake-big');
    });

    // Chess notation around the board: ranks 8..1 on the left, files a..h below.
    this.frame = el('div', 'board-frame');
    const ranks = el('div', 'board-ranks');
    for (let r = BOARD_SIZE; r >= 1; r--) ranks.append(el('span', '', String(r)));
    const files = el('div', 'board-files');
    for (const f of 'abcdefgh') files.append(el('span', '', f));
    this.frame.append(ranks, this.stage, el('span'), files);
  }

  /** The element of the first piece matching team and kind (for tutorial tips). */
  unitNode(team: Team, kind: PieceKind): HTMLElement | undefined {
    for (const u of this.units.values()) if (u.team === team && u.kind === kind) return u.node;
    return undefined;
  }

  /** Drop leftover effects (they never finish while the screen is hidden). */
  clearFx(): void {
    this.fxLayer.replaceChildren();
    this.calloutEl.classList.remove('show');
    this.root.classList.remove('shake', 'shake-big');
  }

  /** Colour the board for a chapter (1-4). */
  setTheme(chapter: number): void {
    this.frame.dataset.theme = String(chapter);
  }

  /** Draw terrain tiles; rock and water cells stop being deploy cells. */
  setTerrain(terrain: Terrain[]): void {
    this.cells.forEach((c, i) => {
      const t = terrain[i] ?? 'plain';
      const y = Math.floor(i / BOARD_SIZE);
      c.classList.toggle('deploy', PLAYER_ROWS.includes(y) && walkable(t));
      if (c.dataset.terrain === t) return;
      c.dataset.terrain = t;
      c.querySelector('.terrain-tile')?.remove();
      c.title = t === 'plain' ? '' : `${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`;
      if (t === 'plain') return;
      const img = el('img', `terrain-tile terrain-${t}`);
      img.src = terrainUrl(t);
      img.alt = '';
      c.append(img);
    });
  }

  /** Tint player cells by how many enemy pieces can hit them at the start (null hides it). */
  setThreats(counts: number[] | null): void {
    this.cells.forEach((c, i) => {
      const n = counts && PLAYER_ROWS.includes(Math.floor(i / BOARD_SIZE)) ? counts[i] : 0;
      c.classList.toggle('threat', n > 0);
      c.classList.toggle('threat-2', n > 1);
    });
  }

  setMode(setup: boolean, placing: boolean): void {
    this.root.classList.toggle('setup', setup);
    this.root.classList.toggle('placing', setup && placing);
  }

  private step = '';

  setStep(ms: number): void {
    const step = `${Math.round(ms)}ms`;
    if (step === this.step) return;
    this.step = step;
    this.root.style.setProperty('--step', step);
  }

  render(views: UnitView[]): void {
    const seen = new Set<string>();
    for (const v of views) {
      seen.add(v.key);
      let u = this.units.get(v.key);
      if (!u) {
        const node = el('div', `unit ${v.team}`);
        // The body lunges, the sprite inside it bobs, the node flashes.
        const body = el('div', 'unit-body');
        node.addEventListener('animationend', (e) => {
          if (e.target === node) node.classList.remove('hit');
          if (e.target === body) body.classList.remove('lunge');
        });
        const img = el('img', 'unit-sprite');
        img.alt = '';
        body.append(img);
        const hp = el('div', 'hp');
        const fill = el('div', 'hp-fill');
        const shield = el('div', 'hp-shield');
        hp.append(fill, shield);
        node.append(body, hp);
        node.style.transform = `translate(${v.x * 100}%, ${v.y * 100}%)`;
        this.unitLayer.append(node);
        u = { node, body, img, fill, shield, kind: v.kind, team: v.team, tier: v.tier ?? 0 };
        img.src = v.skin === 'hand' ? handUrl() : v.skin === 'blackKing' ? spriteUrl('king', 'enemy', 2) : spriteUrl(v.kind, v.team, u.tier);
        node.classList.toggle('hand-unit', v.skin === 'hand');
        this.units.set(v.key, u);
      }
      if (!v.skin && (u.kind !== v.kind || u.tier !== (v.tier ?? 0))) {
        // Promotion or a new level swaps the sprite.
        u.kind = v.kind;
        u.tier = v.tier ?? 0;
        u.img.src = spriteUrl(v.kind, v.team, u.tier);
      }
      u.node.classList.toggle('tier-1', u.tier === 1);
      u.node.classList.toggle('tier-2', u.tier === 2);
      const pos = `translate(${v.x * 100}%, ${v.y * 100}%)`;
      if (u.node.style.transform !== pos) u.node.style.transform = pos;
      u.node.classList.toggle('boss', !!v.boss);
      if (u.node.dataset.trait !== (v.trait ?? '')) {
        u.node.dataset.trait = v.trait ?? '';
        u.node.querySelector('.trait-badge')?.remove();
        u.node.classList.toggle('elite', !!v.trait);
        if (v.trait) {
          const badge = el('img', 'trait-badge');
          badge.src = traitUrl(v.trait);
          badge.alt = '';
          u.node.append(badge);
        }
      }
      u.node.classList.toggle('king', v.kind === 'king');
      u.node.classList.toggle('selected', !!v.selected);
      u.node.classList.toggle('dead', !!v.dead);
      u.node.classList.toggle('full-hp', v.hp >= v.maxHp);
      // scaleX instead of width: no layout work when health changes.
      const ratio = `scaleX(${Math.max(0, Math.min(1, v.hp / v.maxHp)).toFixed(3)})`;
      if (u.fill.style.transform !== ratio) u.fill.style.transform = ratio;
      const sh = `${Math.min(1, v.shield ?? 0) * 100}%`;
      if (u.shield.style.width !== sh) u.shield.style.width = sh;
    }
    for (const [key, u] of this.units) {
      if (!seen.has(key)) {
        u.node.remove();
        this.units.delete(key);
      }
    }
  }

  /**
   * Cheap reactions that run even with effects turned off: white hit flash,
   * attacker lunge and board shake. CSS animations always end on their own.
   */
  react(events: BattleEvent[], keyOf: (uid: number) => string, effects = true): void {
    let shake = 0;
    for (const e of events) {
      if (effects && e.type === 'death' && (e.big || this.room())) {
        const u = this.units.get(keyOf(e.uid));
        if (u) this.shatter(e.x, e.y, u.img.src);
      }
      if (effects && e.type === 'hit' && e.amount >= 1 && this.fxLevel > 0 && this.room()) {
        const spark = el('div', `fx-spark${e.crit ? ' crit' : ''}`);
        this.place(spark, e.x, e.y);
      }
      if (e.type === 'hit') {
        // Web Animations restart cleanly without forcing a layout like class toggling does.
        // The Hand is hit all the time: a white flash would keep it a blank silhouette, so it only flinches.
        const hit = this.units.get(keyOf(e.uid));
        if (hit?.node.classList.contains('hand-unit')) hit.body.animate(HAND_FLINCH, { duration: 160 });
        else hit?.img.animate(HIT_FLASH, { duration: 160, easing: 'steps(1, end)' });
        const dx = e.x - e.fromX;
        const dy = e.y - e.fromY;
        // Melee attackers (adjacent or a knight's jump) lunge at their target.
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 2) {
          const body = this.units.get(keyOf(e.fromUid))?.body;
          if (body) {
            const len = Math.hypot(dx, dy) || 1;
            const to = `${(dx / len) * 28}% ${(dy / len) * 28}%`;
            body.animate([{ translate: '0 0' }, { translate: to, offset: 0.45 }, { translate: '0 0' }], { duration: 160, easing: 'ease-out' });
          }
        }
        if (e.crit && e.big) shake = Math.max(shake, 1);
      } else if (e.type === 'death' && e.big) shake = 2;
      else if (e.type === 'blast' || e.type === 'rage') shake = 2;
      else if (e.type === 'summon' || e.type === 'terrain') shake = Math.max(shake, 1);
      else if (e.type === 'save' || e.type === 'promote') shake = Math.max(shake, 1);
    }
    if (shake && !REDUCED_MOTION) {
      const a = shake > 1 ? 6 : 3;
      this.root.animate([
        { translate: '0 0' }, { translate: `${a}px ${-a * 0.6}px` }, { translate: `${-a}px ${a * 0.5}px` },
        { translate: `${a * 0.6}px ${a * 0.4}px` }, { translate: '0 0' },
      ], { duration: shake > 1 ? 320 : 220, easing: 'steps(4, end)' });
    }
  }

  /** 2 = every effect, 1 = lighter, 0 = only what matters (used at high speeds). */
  private fxLevel: 0 | 1 | 2 = 2;

  setFxLevel(level: 0 | 1 | 2): void {
    this.fxLevel = level;
  }

  /** Optional effects are skipped once this many are on screen. */
  private room(): boolean {
    return this.fxLayer.childElementCount < [24, 45, 80][this.fxLevel];
  }

  /** Scale a particle count by the effect level. */
  private many(count: number): number {
    return this.fxLevel === 2 ? count : this.fxLevel === 1 ? Math.ceil(count / 2) : Math.ceil(count / 4);
  }

  /** The Hand lifts a piece and drops it elsewhere: a ghost hand travels between the cells. */
  handGrab(fromX: number, fromY: number, x: number, y: number): void {
    if (REDUCED_MOTION) return;
    const ghost = el('img', 'fx-hand');
    ghost.src = handUrl();
    ghost.alt = '';
    this.fxLayer.append(ghost);
    const at = (cx: number, cy: number) => `${cx * 100}% ${cy * 100}%`;
    ghost.animate([
      { translate: at(fromX, fromY - 1.6), opacity: 0 },
      { translate: at(fromX, fromY - 0.9), opacity: 1, offset: 0.25 },
      { translate: at(x, y - 0.9), opacity: 1, offset: 0.75 },
      { translate: at(x, y - 1.6), opacity: 0 },
    ], { duration: 700, easing: 'ease-in-out' }).onfinish = () => ghost.remove();
  }

  /** A short line shouted by a piece in battle. */
  bark(x: number, y: number, text: string, team: Team | 'hand'): void {
    const b = el('div', `bark ${team}${y < 2 ? ' below' : ''}${x <= 1 ? ' edge-left' : x >= 6 ? ' edge-right' : ''}`, text);
    b.style.left = `${(x + 0.5) * 12.5}%`;
    b.style.top = `${(y < 2 ? y + 1 : y) * 12.5}%`;
    b.addEventListener('animationend', () => b.remove());
    this.fxLayer.append(b);
  }

  /** "Переворот доски": the whole board turns over on its axis. */
  flip(): void {
    if (REDUCED_MOTION) return;
    this.root.animate([
      { transform: 'perspective(900px) rotateY(0deg)' },
      { transform: 'perspective(900px) rotateY(90deg)', offset: 0.5 },
      { transform: 'perspective(900px) rotateY(0deg)' },
    ], { duration: 800, easing: 'ease-in-out' });
  }

  /** The player's king wears the trophy crown after the finale. */
  setCrowned(on: boolean): void {
    this.root.classList.toggle('crowned', on);
  }

  /** Big centred text for boss skills, rage and defeat. */
  callout(text: string, kind: 'skill' | 'rage' | 'down'): void {
    this.calloutEl.className = `boss-callout ${kind}`;
    setText(this.calloutEl, text);
    restart(this.calloutEl, 'show');
  }

  /** Boss entrance card over the board; null hides it. */
  intro(info: { name: string; sprite: string; skill: string; rage: string } | null): void {
    this.introEl.classList.toggle('show', info !== null);
    if (!info) return;
    const img = el('img', 'boss-intro-img');
    img.src = info.sprite;
    img.alt = '';
    this.introEl.replaceChildren(
      el('div', 'boss-intro-tag', 'Босс'), img, el('div', 'boss-intro-name', info.name),
      el('div', 'boss-intro-skill', `★ ${info.skill}   ☠ ${info.rage}`),
    );
    restart(this.introEl, 'show');
  }

  /** Cells a boss is about to hit. */
  setWarnings(cells: number[]): void {
    const set = new Set(cells);
    this.cells.forEach((c, i) => c.classList.toggle('warn', set.has(i)));
  }

  showBanner(text: string | null, win = false): void {
    this.banner.classList.toggle('show', text !== null);
    if (text !== null) {
      this.banner.classList.toggle('win', win);
      setText(this.banner, text);
    }
  }

  fx(events: BattleEvent[]): void {
    for (const e of events) {
      if (e.type === 'hit') {
        // At high speed only crits and blows to kings and bosses get a number.
        if (this.fxLevel > 0 || e.crit || e.big) {
          if (e.crit || e.big || this.room()) {
            const text = e.amount < 1 ? 'блок' : fmt(Math.round(e.amount)) + (e.crit ? '!' : '');
            this.place(el('div', `fx-dmg ${e.side}${e.crit ? ' crit' : ''}`, text), e.x, e.y);
          }
        }
        if (Math.max(Math.abs(e.x - e.fromX), Math.abs(e.y - e.fromY)) > 1 && this.room()) this.bolt(e);
      } else if (e.type === 'ability') {
        this.place(el('div', 'fx-ability', `${e.label}!`), e.x, e.y);
      } else if (e.type === 'shieldBreak') {
        this.burst(e, 6);
      } else if (e.type === 'heal') {
        this.place(el('div', 'fx-dmg heal', `+${fmt(Math.round(e.amount))}`), e.x, e.y);
      } else if (e.type === 'save') {
        this.place(el('div', 'fx-promote', 'Вторая жизнь!'), e.x, e.y);
        this.burst(e, 14);
      } else if (e.type === 'promote') {
        this.place(el('div', 'fx-promote', 'Ферзь!'), e.x, e.y);
        this.burst(e, 14);
      } else if (e.type === 'blast' || e.type === 'terrain') {
        for (const i of e.cells ?? []) {
          const at = { ...e, x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) };
          this.place(el('div', 'fx-blast'), at.x, at.y);
          this.burst(at, 5);
        }
      } else if (e.type === 'summon') {
        this.place(el('div', 'fx-summon'), e.x, e.y);
        this.burst(e, 12);
      } else if (e.type === 'boss' || e.type === 'rage' || e.type === 'warn') {
        // Shown as a callout and as warning cells by the screen.
      } else {
        this.burst(e, 10);
      }
    }
  }

  private burst(e: BattleEvent, wanted: number): void {
    if (!this.room()) return;
    const count = this.many(wanted);
    for (let i = 0; i < count; i++) {
      const p = el('div', `fx-pixel ${e.type === 'promote' || e.type === 'save' ? 'gold' : e.side}`);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const r = 30 + Math.random() * 30;
      p.style.setProperty('--dx', `${Math.cos(angle) * r}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * r}px`);
      this.place(p, e.x, e.y);
    }
  }

  private place(node: HTMLElement, x: number, y: number): void {
    node.style.left = `${(x + 0.5) * 12.5}%`;
    node.style.top = `${(y + 0.5) * 12.5}%`;
    node.addEventListener('animationend', () => node.remove());
    this.fxLayer.append(node);
  }

  private bolt(e: BattleEvent): void {
    // The head plus fading ghosts behind it make a short trail (no ghosts at high speed).
    for (let i = 0; i < [1, 2, 3][this.fxLevel]; i++) {
      const b = el('div', `fx-bolt ${e.side === 'ally' ? 'enemy' : 'ally'} from-${e.fromKind ?? 'pawn'}${i ? ' ghost' : ''}`);
      // The bolt box is one cell in size, so translate % moves it cell by cell.
      b.style.left = `${e.fromX * 12.5}%`;
      b.style.top = `${e.fromY * 12.5}%`;
      b.style.setProperty('--tx', `${(e.x - e.fromX) * 100}%`);
      b.style.setProperty('--ty', `${(e.y - e.fromY) * 100}%`);
      if (i) {
        b.style.animationDelay = `${i * 30}ms`;
        b.style.opacity = String(0.55 / i);
      }
      b.addEventListener('animationend', () => b.remove());
      this.fxLayer.append(b);
    }
  }

  /** A dead piece breaks into four pieces of its own sprite that fly apart. */
  shatter(x: number, y: number, src: string): void {
    const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    dirs.forEach(([dx, dy], i) => {
      const s = el('div', 'fx-shard');
      s.style.backgroundImage = `url(${src})`;
      s.style.backgroundPosition = `${dx < 0 ? 0 : 100}% ${dy < 0 ? 0 : 100}%`;
      s.style.setProperty('--sx', `${dx * (24 + i * 4)}px`);
      s.style.setProperty('--sy', `${dy * 22 - 14}px`);
      s.style.setProperty('--rot', `${dx * 90}deg`);
      s.style.left = `${(x + 0.5 + dx * 0.18) * 12.5}%`;
      s.style.top = `${(y + 0.45 + dy * 0.18) * 12.5}%`;
      s.addEventListener('animationend', () => s.remove());
      this.fxLayer.append(s);
    });
  }

}

/** Restart a one-shot CSS animation class. */
const HIT_FLASH: Keyframe[] = [{ filter: 'brightness(0) invert(1)' }, { filter: 'none' }];
const HAND_FLINCH: Keyframe[] = [{ translate: '0 0' }, { translate: '0 -3%' }, { translate: '0 0' }];
const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function restart(node: HTMLElement | undefined, cls: string): void {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}
