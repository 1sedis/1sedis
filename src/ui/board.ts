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
  boss?: boolean;
  selected?: boolean;
  flash?: boolean;
  dead?: boolean;
}

export class BoardView {
  readonly root: HTMLElement;
  private cells: HTMLElement[] = [];
  private unitLayer: HTMLElement;
  private fxLayer: HTMLElement;
  private banner: HTMLElement;
  private units = new Map<string, { node: HTMLElement; img: HTMLImageElement; fill: HTMLElement; kind: PieceKind }>();

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
        const img = el('img', 'unit-sprite');
        img.alt = '';
        const hp = el('div', 'hp');
        const fill = el('div', 'hp-fill');
        hp.append(fill);
        node.append(img, hp);
        node.style.transform = `translate(${v.x * 100}%, ${v.y * 100}%)`;
        this.unitLayer.append(node);
        u = { node, img, fill, kind: v.kind };
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
      u.node.classList.toggle('flash', !!v.flash);
      u.node.classList.toggle('dead', !!v.dead);
      u.node.classList.toggle('full-hp', v.hp >= v.maxHp);
      const pct = `${Math.max(0, v.hp / v.maxHp) * 100}%`;
      if (u.fill.style.width !== pct) u.fill.style.width = pct;
    }
    for (const [key, u] of this.units) {
      if (!seen.has(key)) {
        u.node.remove();
        this.units.delete(key);
      }
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
        this.place(el('div', `fx-dmg ${e.side}`, fmt(Math.round(e.amount))), e.x, e.y);
        if (Math.max(Math.abs(e.x - e.fromX), Math.abs(e.y - e.fromY)) > 1) this.bolt(e);
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
      const p = el('div', `fx-pixel ${e.type === 'promote' ? 'gold' : e.side}`);
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
    const b = el('div', `fx-bolt ${e.side === 'ally' ? 'enemy' : 'ally'}`);
    // The bolt box is one cell in size, so translate % moves it cell by cell.
    b.style.left = `${e.fromX * 12.5}%`;
    b.style.top = `${e.fromY * 12.5}%`;
    b.style.setProperty('--tx', `${(e.x - e.fromX) * 100}%`);
    b.style.setProperty('--ty', `${(e.y - e.fromY) * 100}%`);
    b.addEventListener('animationend', () => b.remove());
    this.fxLayer.append(b);
  }
}
