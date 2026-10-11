import type { PieceKind } from '../game/pieces';
import type { Trait } from '../game/elites';
import { BoardView, type UnitView } from './board';
import { el } from './dom';
import { audio, type Sfx, type TrackId } from './audio';
import { handUrl } from './handArt';
import { spriteUrl, type Team, type Tier } from './sprites';
import { terrainUrl } from './terrainArt';
import { traitUrl } from './traitIcons';

/**
 * Scenes acted out on the board: pieces walk, speak in typed-out bubbles with
 * an 8-bit voice, the board cracks and turns over, the Hand comes down from
 * above. A script is a list of steps run one after another; a step with
 * `par: true` starts and lets the next one begin at once.
 */
export type Voice = 'black' | 'white' | 'hand' | 'soft';

export type Step = { par?: boolean } & (
  | { t: 'spawn'; id: string; kind: PieceKind | 'hand'; team: Team; x: number; y: number; tier?: Tier; hidden?: boolean }
  | { t: 'move'; id: string; x: number; y: number; ms?: number }
  | { t: 'place'; id: string; x: number; y: number }
  | { t: 'say'; id: string; text: string; name?: string; voice?: Voice }
  | { t: 'caption'; text: string }
  | { t: 'title'; text: string; sub?: string; accent?: boolean }
  | { t: 'wait'; ms: number }
  | { t: 'hop'; id: string }
  | { t: 'teamHop'; team: Team; kinds?: PieceKind[] }
  | { t: 'roar'; id: string }
  | { t: 'shake'; big?: boolean }
  | { t: 'flash'; color?: string }
  | { t: 'crack' }
  | { t: 'flip'; mirror?: boolean }
  | { t: 'dark'; cells: number[] }
  | { t: 'shatter'; id: string }
  | { t: 'fade'; id: string; to: number; ms?: number }
  | { t: 'team'; team: Team; show: boolean; except?: string[] }
  | { t: 'glow'; id: string; color: string | null }
  | { t: 'badge'; id: string; trait: Trait }
  | { t: 'grow'; id: string; scale: number }
  | { t: 'morph'; id: string; kind: PieceKind; team: Team; tier?: Tier }
  | { t: 'crown'; id: string }
  | { t: 'handIn'; ms?: number }
  | { t: 'freeze' }
  | { t: 'shadow' }
  | { t: 'sweep' }
  | { t: 'handOut' }
  | { t: 'glitch'; ms: number }
  | { t: 'sfx'; name: Sfx }
  /** Cinema bars above and below the screen. */
  | { t: 'cinema'; on: boolean }
  /** Move the camera: zoom the board towards a square (x/y) or back (scale 1). */
  | { t: 'camera'; scale: number; x?: number; y?: number; ms?: number }
  | { t: 'music'; track: TrackId }
  /** A lightning flash with a rumble; the screen goes dark a moment. */
  | { t: 'thunder' }
  /** Falling embers over the whole screen. */
  | { t: 'embers'; on: boolean }
  /** One piece charges another: sparks, a damage number, the target breaks. */
  | { t: 'clash'; id: string; target: string; ms?: number }
  /** The game's name slammed onto the screen. */
  | { t: 'bigTitle'; text: string; sub?: string }
);

interface Actor {
  id: string;
  node: HTMLElement;
  img: HTMLImageElement;
  kind: PieceKind | 'hand';
  team: Team;
  x: number;
  y: number;
}

const NAMES: Partial<Record<string, string>> = { hand: 'Рука над доской', 'giant-hand': 'Рука над доской' };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Scenes now playing, so leaving a screen can end them. */
const active = new Set<Stage>();

export function skipScenes(): void {
  for (const stage of active) stage.skip();
}

/** Pieces beyond the top edge of the board loom out of the dark: the further away, the fainter. */
const presence = (y: number) => (y >= 0 ? 1 : Math.max(0.15, 1 + y * 0.3));

export class Stage {
  private layer = el('div', 'scene-layer');
  private actors = new Map<string, Actor>();
  private skipped = false;
  private tap: (() => void) | null = null;
  private pending: Promise<unknown>[] = [];
  private skipBtn: HTMLElement;

  constructor(private board: BoardView, cast: UnitView[] = []) {
    this.layer.addEventListener('click', () => this.tap?.());
    const skip = el('button', 'scene-skip', 'Пропустить ▶▶');
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    this.layer.append(skip);
    this.skipBtn = skip;
    const aliases: [string, (v: UnitView) => boolean][] = [
      ['bk', (v) => v.team === 'enemy' && v.kind === 'king' && v.skin !== 'hand'],
      ['wk', (v) => v.team === 'ally' && v.kind === 'king' && !v.skin],
      ['boss', (v) => v.team === 'enemy' && !!v.boss && v.kind !== 'king'],
      ['hand', (v) => v.skin === 'hand'],
      ['ally-bk', (v) => v.skin === 'blackKing'],
    ];
    for (const v of cast) {
      if (v.dead) continue;
      const kind = v.skin === 'hand' ? 'hand' : v.kind;
      const team = v.skin === 'blackKing' ? 'enemy' : v.team;
      const a = this.add(v.key, kind, team, v.x, v.y, v.skin === 'blackKing' ? 2 : v.tier ?? 0);
      if (v.boss && kind !== 'hand') a.node.classList.add('boss');
      for (const [alias, test] of aliases) if (!this.actors.has(alias) && test(v)) this.actors.set(alias, a);
    }
  }

  skip(): void {
    this.skipped = true;
    this.tap?.();
  }

  /** Play a script on the board. Real pieces are hidden while it runs. */
  async run(steps: Step[]): Promise<void> {
    this.board.root.classList.add('in-scene');
    this.board.root.append(this.layer);
    // On its own screen the skip button sits in the corner of the screen, clear of the board.
    const overlay = this.board.frame.closest('.stage-overlay');
    if (overlay) {
      overlay.append(this.skipBtn);
      overlay.addEventListener('click', (e) => {
        if (!this.layer.contains(e.target as Node)) this.tap?.();
      });
    }
    active.add(this);
    try {
      for (const step of steps) {
        if (this.skipped) break;
        const p = this.exec(step);
        if (step.par) this.pending.push(p);
        else await p;
      }
      if (!this.skipped) await Promise.all(this.pending);
    } finally {
      active.delete(this);
      this.layer.remove();
      this.skipBtn.remove();
      this.board.root.classList.remove('in-scene');
      document.body.classList.remove('glitch');
      for (const extra of this.extras) extra.remove();
      this.board.frame.style.transform = '';
    }
  }

  /** Screen-wide elements of this scene (cinema bars, embers), removed when it ends. */
  private extras: HTMLElement[] = [];

  private extra(cls: string): HTMLElement {
    const node = el('div', cls);
    document.body.append(node);
    this.extras.push(node);
    return node;
  }

  private add(id: string, kind: PieceKind | 'hand', team: Team, x: number, y: number, tier: Tier = 0): Actor {
    const node = el('div', `actor ${team}${kind === 'hand' ? ' actor-hand' : ''}${kind === 'king' ? ' king' : ''}`);
    const img = el('img', 'actor-sprite');
    img.alt = '';
    img.src = kind === 'hand' ? handUrl() : spriteUrl(kind, team, tier);
    node.append(img);
    node.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    this.layer.append(node);
    const a: Actor = { id, node, img, kind, team, x, y };
    this.actors.set(id, a);
    return a;
  }

  private actor(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  /** Wait for a tap or the timeout, whichever comes first (a skip ends it at once). */
  private waitTap(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.tap = null;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.tap = done;
    });
  }

  private wait(ms: number): Promise<void> {
    return this.skipped ? Promise.resolve() : sleep(ms);
  }

  /** Type text into an element with a voice; a tap completes it. Resolves when all of it shows. */
  private type(target: HTMLElement, text: string, voice: Voice | null): Promise<void> {
    return new Promise((resolve) => {
      let i = 0;
      const finish = () => {
        clearInterval(timer);
        target.textContent = text;
        this.tap = null;
        resolve();
      };
      const timer = setInterval(() => {
        i++;
        target.textContent = text.slice(0, i);
        const ch = text[i - 1];
        if (voice && i % 2 === 1 && ch && ch.trim() && /[\p{L}\d]/u.test(ch)) audio.blip(voice);
        if (i >= text.length) finish();
      }, 32);
      this.tap = finish;
      if (this.skipped) finish();
    });
  }

  private readTime(text: string): number {
    return 1400 + text.length * 45;
  }

  private voiceOf(a: Actor): Voice {
    if (a.kind === 'hand') return 'hand';
    return a.team === 'enemy' ? 'black' : 'white';
  }

  private nameOf(a: Actor): string {
    if (NAMES[a.id]) return NAMES[a.id]!;
    if (a.kind === 'hand') return 'Рука над доской';
    if (a.kind === 'king') return a.team === 'enemy' ? 'Чёрный король' : 'Белый король';
    return '';
  }

  private async exec(s: Step): Promise<void> {
    const a = 'id' in s ? this.actor(s.id) : undefined;
    switch (s.t) {
      case 'spawn': {
        const n = this.add(s.id, s.kind, s.team, s.x, s.y, s.tier ?? 0);
        if (s.hidden) n.node.style.opacity = '0';
        return;
      }
      case 'move': {
        if (!a) return;
        const ms = s.ms ?? 450;
        a.node.style.transition = `transform ${ms}ms cubic-bezier(0.3, 0.7, 0.2, 1), opacity ${ms}ms`;
        a.x = s.x;
        a.y = s.y;
        a.node.style.transform = `translate(${s.x * 100}%, ${s.y * 100}%)`;
        if (a.node.style.opacity !== '0') a.node.style.opacity = String(presence(s.y));
        audio.play('select');
        return this.wait(ms);
      }
      case 'place': {
        if (!a) return;
        a.node.style.transition = 'none';
        a.x = s.x;
        a.y = s.y;
        a.node.style.transform = `translate(${s.x * 100}%, ${s.y * 100}%)`;
        return;
      }
      case 'say': {
        if (!a) return;
        const bubble = el('div', `scene-bubble ${a.kind === 'hand' ? 'hand' : a.team}`);
        const name = s.name ?? this.nameOf(a);
        if (name) bubble.append(el('div', 'scene-bubble-name', name));
        const text = el('div', 'scene-bubble-text');
        bubble.append(text);
        const hand = a.id === 'giant-hand';
        bubble.style.left = `${(a.x + 0.5) * 12.5}%`;
        bubble.style.top = hand ? '18%' : `${a.y * 12.5}%`;
        bubble.classList.toggle('below', hand || a.y < 2);
        if (!hand && a.y < 2) bubble.style.top = `${(a.y + 1) * 12.5}%`;
        bubble.classList.toggle('edge-left', a.x <= 1);
        bubble.classList.toggle('edge-right', a.x >= 6);
        this.layer.append(bubble);
        a.img.animate([{ translate: '0 0' }, { translate: '0 -10%' }, { translate: '0 0' }], { duration: 260 });
        await this.type(text, s.text, s.voice ?? this.voiceOf(a));
        await this.waitTap(this.readTime(s.text));
        bubble.remove();
        return;
      }
      case 'caption': {
        const bar = el('div', 'scene-caption');
        const text = el('div');
        bar.append(text);
        // On its own screen the caption stays put under the board while the camera moves.
        (this.board.frame.closest('.stage-overlay') ?? this.layer).append(bar);
        await this.type(text, s.text, 'soft');
        await this.waitTap(this.readTime(s.text));
        bar.remove();
        return;
      }
      case 'title': {
        const card = el('div', `scene-title${s.accent ? ' accent' : ''}`);
        card.append(el('div', 'scene-title-main', s.text));
        if (s.sub) card.append(el('div', 'scene-title-sub', s.sub));
        this.layer.append(card);
        audio.play(s.accent ? 'warn' : 'start');
        await this.waitTap(s.sub ? 2600 + s.sub.length * 35 : 1800);
        card.classList.add('out');
        await this.wait(250);
        card.remove();
        return;
      }
      case 'wait':
        return this.wait(s.ms);
      case 'hop':
        if (!a) return;
        a.img.animate([{ translate: '0 0' }, { translate: '0 -28%' }, { translate: '0 0' }], { duration: 320, easing: 'ease-out' });
        return this.wait(320);
      case 'teamHop': {
        const list = [...new Set(this.actors.values())]
          .filter((x) => x.team === s.team && x.kind !== 'hand' && (!s.kinds || s.kinds.includes(x.kind as PieceKind)));
        list.forEach((x, i) => x.img.animate([{ translate: '0 0' }, { translate: '0 -28%' }, { translate: '0 0' }],
          { duration: 320, delay: i * 60, easing: 'ease-out' }));
        audio.play('select');
        return this.wait(320 + list.length * 60);
      }
      case 'roar':
        if (!a) return;
        audio.play('roar');
        a.node.classList.add('roaring');
        a.img.animate([{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { duration: 500, easing: 'ease-out' });
        this.shake(true);
        await this.wait(600);
        a.node.classList.remove('roaring');
        return;
      case 'shake':
        this.shake(!!s.big);
        if (s.big) audio.play('quake');
        return this.wait(s.big ? 340 : 220);
      case 'flash': {
        const f = el('div', 'scene-flash');
        f.style.background = s.color ?? '#fff';
        this.layer.append(f);
        f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 600 }).onfinish = () => f.remove();
        return this.wait(250);
      }
      case 'crack': {
        audio.play('quake');
        this.shake(true);
        const crack = el('div', 'scene-crack');
        // A jagged line of short bars across the middle of the board.
        let x = 0;
        let y = 46 + Math.random() * 6;
        for (let i = 0; i < 9; i++) {
          const len = 10 + Math.random() * 6;
          const angle = (Math.random() - 0.5) * 50;
          const bar = el('span');
          bar.style.left = `${x}%`;
          bar.style.top = `${y}%`;
          bar.style.width = `${len}%`;
          bar.style.rotate = `${angle}deg`;
          bar.style.animationDelay = `${i * 40}ms`;
          crack.append(bar);
          x += len * Math.cos((angle * Math.PI) / 180);
          y += len * Math.sin((angle * Math.PI) / 180);
        }
        this.layer.append(crack);
        return this.wait(500);
      }
      case 'flip': {
        this.board.flip();
        audio.play('quake');
        await this.wait(400);
        if (s.mirror) {
          for (const actor of new Set(this.actors.values())) {
            actor.x = 7 - actor.x;
            actor.node.style.transition = 'none';
            actor.node.style.transform = `translate(${actor.x * 100}%, ${actor.y * 100}%)`;
          }
        }
        return this.wait(400);
      }
      case 'dark': {
        audio.play('quake');
        s.cells.forEach((c, i) => {
          const d = el('img', 'scene-dark');
          d.src = terrainUrl('dark');
          d.alt = '';
          d.style.left = `${(c % 8) * 12.5}%`;
          d.style.top = `${Math.floor(c / 8) * 12.5}%`;
          d.style.animationDelay = `${i * 90}ms`;
          this.layer.prepend(d);
        });
        return this.wait(300 + s.cells.length * 90);
      }
      case 'shatter':
        if (!a) return;
        this.board.shatter(a.x, a.y, a.img.src);
        audio.play('death');
        a.node.remove();
        this.actors.delete(s.id);
        return this.wait(350);
      case 'fade':
        if (!a) return;
        a.node.style.transition = `opacity ${s.ms ?? 400}ms`;
        a.node.style.opacity = String(s.to);
        return this.wait(s.ms ?? 400);
      case 'team': {
        const list = [...new Set(this.actors.values())].filter((x) => x.team === s.team && !s.except?.includes(x.id));
        list.forEach((x, i) => {
          x.node.style.transition = `opacity 300ms ${s.show ? i * 70 : 0}ms`;
          x.node.style.opacity = s.show ? String(presence(x.y)) : '0';
        });
        return this.wait(s.show ? 300 + list.length * 70 : 0);
      }
      case 'glow':
        if (!a) return;
        a.node.style.setProperty('--actor-glow', s.color ?? 'transparent');
        a.node.classList.toggle('glowing', !!s.color);
        return;
      case 'badge': {
        if (!a) return;
        const b = el('img', 'trait-badge');
        b.src = traitUrl(s.trait);
        b.alt = '';
        a.node.append(b);
        audio.play('ability');
        a.img.animate([{ filter: 'brightness(3)' }, { filter: 'none' }], { duration: 300 });
        return this.wait(260);
      }
      case 'grow':
        if (!a) return;
        a.img.style.transition = 'scale 500ms cubic-bezier(0.3, 0.7, 0.2, 1.4)';
        a.img.style.scale = String(s.scale);
        return this.wait(500);
      case 'morph':
        if (!a) return;
        a.img.animate([{ filter: 'brightness(4)' }, { filter: 'none' }], { duration: 400 });
        a.img.src = spriteUrl(s.kind, s.team, s.tier ?? 2);
        audio.play('ability');
        return this.wait(400);
      case 'crown': {
        if (!a) return;
        a.node.append(el('div', 'actor-crown'));
        audio.play('relic');
        return this.wait(500);
      }
      case 'handIn': {
        const hand = el('img', 'scene-giant-hand');
        hand.src = handUrl();
        hand.alt = '';
        this.layer.append(hand);
        const node = el('div');
        this.actors.set('giant-hand', { id: 'giant-hand', node, img: hand, kind: 'hand', team: 'enemy', x: 3.5, y: 0 });
        const ms = s.ms ?? 1100;
        audio.play(ms > 1500 ? 'doom' : 'roar');
        hand.animate([{ translate: '0 -120%', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
        await this.wait(ms);
        this.shake(true);
        return;
      }
      case 'handOut': {
        const hand = this.actors.get('giant-hand');
        if (!hand) return;
        hand.img.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 -120%', opacity: 0 }], { duration: 1200, easing: 'ease-in', fill: 'forwards' });
        await this.wait(1200);
        hand.img.remove();
        this.actors.delete('giant-hand');
        return;
      }
      case 'freeze':
        // Every piece stops breathing.
        this.layer.classList.add('frozen');
        audio.play('warn');
        return this.wait(500);
      case 'shadow': {
        const shade = el('div', 'scene-shadow');
        this.layer.prepend(shade);
        // On its own screen the darkness covers the whole screen, not a patch above the board.
        const overlay = this.board.frame.closest('.stage-overlay');
        if (overlay) {
          shade.classList.add('on-board');
          overlay.prepend(el('div', 'scene-fog'));
        }
        audio.play('doom');
        return this.wait(1800);
      }
      case 'sweep': {
        // The Hand clears the board: every piece flies off, the nearest first.
        const hand = this.actors.get('giant-hand');
        hand?.img.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '-30% 25%', rotate: '-18deg' }, { translate: '35% 25%', rotate: '14deg' }, { translate: '0 0', rotate: '0deg' }],
          { duration: 900, easing: 'ease-in-out' });
        this.shake(true);
        audio.play('quake');
        const list = [...new Set(this.actors.values())].filter((x) => x.id !== 'giant-hand').sort((p, q) => p.y - q.y || p.x - q.x);
        list.forEach((x, i) => {
          const dir = x.x < 4 ? -1 : 1;
          x.node.animate([{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: `${dir * (500 + i * 40)}% ${-200 - (i % 3) * 120}%`, rotate: `${dir * 540}deg`, opacity: 0 }],
            { duration: 900, delay: 150 + i * 35, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
        });
        await this.wait(1100 + list.length * 35);
        for (const x of list) {
          x.node.remove();
          this.actors.delete(x.id);
        }
        return;
      }
      case 'glitch':
        document.body.classList.add('glitch');
        audio.blip('hand');
        await this.wait(s.ms);
        document.body.classList.remove('glitch');
        return;
      case 'sfx':
        audio.play(s.name);
        return;
      case 'cinema': {
        let bars = this.extras.find((e) => e.classList.contains('cinema-bars'));
        if (!bars) bars = this.extra('cinema-bars');
        bars.classList.toggle('on', s.on);
        return this.wait(500);
      }
      case 'camera': {
        const ms = s.ms ?? 1200;
        const f = this.board.frame;
        f.style.transition = `transform ${ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        // A gentle zoom: a big scaled board is a heavy layer on phones.
        // On a phone the board already fills the width: barely zoom, or it leaves the screen.
        const scale = Math.min(s.scale, window.innerWidth < 600 ? 1.08 : 1.2);
        // Zoom around the chosen square: shift it towards the middle of the board.
        const dx = s.x === undefined ? 0 : (3.5 - s.x) * 12.5 * (scale - 1) / scale;
        const dy = s.y === undefined ? 0 : (3.5 - s.y) * 12.5 * (scale - 1) / scale;
        f.style.transform = scale === 1 ? '' : `scale(${scale}) translate(${dx}%, ${dy}%)`;
        return this.wait(ms);
      }
      case 'music':
        audio.setTrack(s.track);
        return;
      case 'thunder': {
        const flash = this.extra('scene-thunder');
        audio.play('quake');
        this.shake(true);
        flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.05 }, { opacity: 0.2, offset: 0.2 }, { opacity: 0.8, offset: 0.28 }, { opacity: 0 }],
          { duration: 900 }).onfinish = () => flash.remove();
        return this.wait(500);
      }
      case 'embers': {
        let field = this.extras.find((e) => e.classList.contains('scene-embers'));
        // A dozen embers moved by the GPU alone (transform only): nothing gets repainted per frame.
        if (s.on && !field) {
          field = this.extra('scene-embers');
          for (let i = 0; i < 12; i++) {
            const e = el('span');
            e.style.left = `${(i * 41 + 7) % 100}%`;
            e.style.animationDelay = `${-(i % 6) * 0.9}s`;
            e.style.animationDuration = `${5 + (i % 4)}s`;
            field.append(e);
          }
        }
        field?.classList.toggle('on', s.on);
        return;
      }
      case 'clash': {
        const target = this.actor(s.target);
        if (!a || !target) return;
        const ms = s.ms ?? 260;
        a.node.style.transition = `transform ${ms}ms cubic-bezier(0.5, 0, 0.9, 0.6)`;
        a.node.style.transform = `translate(${target.x * 100}%, ${target.y * 100}%)`;
        await this.wait(ms);
        a.x = target.x;
        a.y = target.y;
        const spark = el('div', 'scene-spark');
        spark.style.left = `${(target.x + 0.5) * 12.5}%`;
        spark.style.top = `${(target.y + 0.5) * 12.5}%`;
        this.layer.append(spark);
        spark.addEventListener('animationend', () => spark.remove());
        audio.play('crit');
        this.board.shatter(target.x, target.y, target.img.src);
        target.node.remove();
        this.actors.delete(s.target);
        this.shake(false);
        return this.wait(120);
      }
      case 'bigTitle': {
        const card = this.extra('scene-big-title');
        card.append(el('div', 'scene-big-title-main', s.text));
        if (s.sub) card.append(el('div', 'scene-big-title-sub', s.sub));
        audio.play('bossDown');
        await this.wait(350);
        this.shake(true);
        await this.waitTap(3200);
        card.classList.add('out');
        return this.wait(400);
      }
    }
  }

  private shake(big: boolean): void {
    const a = big ? 7 : 3;
    this.board.root.animate([
      { translate: '0 0' }, { translate: `${a}px ${-a * 0.6}px` }, { translate: `${-a}px ${a * 0.5}px` },
      { translate: `${a * 0.6}px ${a * 0.4}px` }, { translate: '0 0' },
    ], { duration: big ? 340 : 220, easing: 'steps(4, end)' });
  }
}

/** Play a scene on its own board in a full-screen overlay (outside battles: new games, the Chronicle). */
export async function playStageOverlay(steps: Step[], theme = 4): Promise<void> {
  const overlay = el('div', 'stage-overlay');
  const board = new BoardView(() => {});
  // Nothing underneath keeps drawing while a scene plays (Safari drops layers when there are too many).
  document.body.classList.add('staging');
  board.setTheme(theme);
  board.setMode(false, false);
  overlay.append(board.frame);
  document.body.append(overlay);
  try {
    await new Stage(board).run(steps);
  } finally {
    document.body.classList.remove('staging');
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => overlay.remove();
  }
}
