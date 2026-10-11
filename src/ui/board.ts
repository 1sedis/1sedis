import { BOARD_SIZE, type BattleEvent } from '../game/battle';
import type { PieceKind } from '../game/pieces';
import { PLAYER_ROWS } from '../game/state';
import { el, setText } from './dom';
import { fmt } from './format';
import { spriteUrl, type Team } from './sprites';

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
  boss?: boolean;
  selected?: boolean;
  dead?: boolean;
}

export class BoardView {
  /** The board with its coordinate frame; this is what screens insert. */
  readonly frame: HTMLElement;
  readonly root: HTMLElement;
  private cells: HTMLElement[] = [];
  private unitLayer: HTMLElement;
  private fxLayer: HTMLElement;
  private banner: HTMLElement;
  private units = new Map<string, { node: HTMLElement; body: HTMLElement; img: HTMLImageElement; fill: HTMLElement; shield: HTMLElement; kind: PieceKind; team: Team }>();

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
    this.unitLayer = el('div', 'unit-layer');
    this.fxLayer = el('div', 'fx-layer');
    this.banner = el('div', 'banner');
    this.root.append(this.unitLayer, this.fxLayer, this.banner);

    // Chess notation around the board: ranks 8..1 on the left, files a..h below.
    this.frame = el('div', 'board-frame');
    const ranks = el('div', 'board-ranks');
    for (let r = BOARD_SIZE; r >= 1; r--) ranks.append(el('span', '', String(r)));
    const files = el('div', 'board-files');
    for (const f of 'abcdefgh') files.append(el('span', '', f));
    this.frame.append(ranks, this.root, el('span'), files);
  }

  /** The element of the first piece matching team and kind (for tutorial tips). */
  unitNode(team: Team, kind: PieceKind): HTMLElement | undefined {
    for (const u of this.units.values()) if (u.team === team && u.kind === kind) return u.node;
    return undefined;
  }

  /** Drop leftover effects (they never finish while the screen is hidden). */
  clearFx(): void {
    this.fxLayer.replaceChildren();
  }

  /** Colour the board for a chapter (1-4). */
  setTheme(chapter: number): void {
    this.frame.dataset.theme = String(chapter);
  }

  setMode(setup: boolean, placing: boolean): void {
    this.root.classList.toggle('setup', setup);
    this.root.classList.toggle('placing', setup && placing);
  }

  setStep(ms: number): void {
    this.root.style.setProperty('--step', `${Math.round(ms)}ms`);
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
        u = { node, body, img, fill, shield, kind: v.kind, team: v.team };
        img.src = spriteUrl(v.kind, v.team);
        this.units.set(v.key, u);
      }
      if (u.kind !== v.kind) {
        // Promotion swaps the sprite.
        u.kind = v.kind;
        u.img.src = spriteUrl(v.kind, v.team);
      }
      u.node.style.transform = `translate(${v.x * 100}%, ${v.y * 100}%)`;
      u.node.classList.toggle('boss', !!v.boss);
      u.node.classList.toggle('king', v.kind === 'king');
      u.node.classList.toggle('selected', !!v.selected);
      u.node.classList.toggle('dead', !!v.dead);
      u.node.classList.toggle('full-hp', v.hp >= v.maxHp);
      const pct = `${Math.max(0, v.hp / v.maxHp) * 100}%`;
      if (u.fill.style.width !== pct) u.fill.style.width = pct;
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
  react(events: BattleEvent[], keyOf: (uid: number) => string): void {
    let shake = 0;
    for (const e of events) {
      if (e.type === 'hit') {
        restart(this.units.get(keyOf(e.uid))?.node, 'hit');
        const dx = e.x - e.fromX;
        const dy = e.y - e.fromY;
        // Melee attackers (adjacent or a knight's jump) lunge at their target.
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 2) {
          const body = this.units.get(keyOf(e.fromUid))?.body;
          if (body) {
            const len = Math.hypot(dx, dy) || 1;
            body.style.setProperty('--lx', `${(dx / len) * 28}%`);
            body.style.setProperty('--ly', `${(dy / len) * 28}%`);
            restart(body, 'lunge');
          }
        }
        if (e.crit && e.big) shake = Math.max(shake, 1);
      } else if (e.type === 'death' && e.big) shake = 2;
      else if (e.type === 'save' || e.type === 'promote') shake = Math.max(shake, 1);
    }
    if (shake) {
      this.root.classList.toggle('shake-big', shake > 1);
      restart(this.root, 'shake');
    }
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
        const text = e.amount < 1 ? 'блок' : fmt(Math.round(e.amount)) + (e.crit ? '!' : '');
        this.place(el('div', `fx-dmg ${e.side}${e.crit ? ' crit' : ''}`, text), e.x, e.y);
        if (Math.max(Math.abs(e.x - e.fromX), Math.abs(e.y - e.fromY)) > 1) this.bolt(e);
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
      } else {
        this.burst(e, 10);
      }
    }
  }

  private burst(e: BattleEvent, count: number): void {
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
    const b = el('div', `fx-bolt ${e.side === 'ally' ? 'enemy' : 'ally'} from-${e.fromKind ?? 'pawn'}`);
    // The bolt box is one cell in size, so translate % moves it cell by cell.
    b.style.left = `${e.fromX * 12.5}%`;
    b.style.top = `${e.fromY * 12.5}%`;
    b.style.setProperty('--tx', `${(e.x - e.fromX) * 100}%`);
    b.style.setProperty('--ty', `${(e.y - e.fromY) * 100}%`);
    b.addEventListener('animationend', () => b.remove());
    this.fxLayer.append(b);
  }
}

/** Restart a one-shot CSS animation class. */
function restart(node: HTMLElement | undefined, cls: string): void {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}
