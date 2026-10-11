import type { GameState } from '../game/state';
import { el } from './dom';

/**
 * One-time contextual tips: a pulsing ring around a target element and a
 * speech bubble next to it. Tips never block input; each is shown once per
 * save and marked done when dismissed or when its target is pressed.
 */
export class Tutorial {
  private ring = el('div', 'tip-ring');
  private bubble = el('div', 'tip-bubble');
  private text = el('p', 'tip-text');
  private activeId: string | null = null;
  private target: HTMLElement | null = null;
  private onTargetPress = () => this.dismiss();

  constructor(
    private getState: () => GameState,
    private enabled: () => boolean,
    private save: () => void,
  ) {
    const ok = el('button', 'btn btn-small btn-primary', 'Понятно');
    ok.addEventListener('click', () => this.dismiss());
    this.bubble.append(this.text, ok);
    this.ring.hidden = this.bubble.hidden = true;
    document.body.append(this.ring, this.bubble);
  }

  /** Show a tip unless it was seen, another tip is open, or a dialog is up. Returns true while it is visible. */
  tip(id: string, target: HTMLElement | null | undefined, text: string): boolean {
    if (this.activeId === id) return true;
    if (this.activeId || !target || !this.enabled() || this.getState().tutorial.includes(id)) return false;
    if (document.querySelector('.modal-overlay') || !isVisible(target)) return false;
    this.activeId = id;
    this.target = target;
    this.text.textContent = text;
    this.ring.hidden = this.bubble.hidden = false;
    target.addEventListener('pointerdown', this.onTargetPress, { once: true });
    this.position();
    return true;
  }

  /** Keep the tip attached to its target; hide it when the target goes away. */
  frame(): void {
    if (!this.activeId || !this.target) return;
    if (!isVisible(this.target) || document.querySelector('.modal-overlay')) {
      this.hide(false);
      return;
    }
    this.position();
  }

  private position(): void {
    const r = this.target!.getBoundingClientRect();
    const pad = 6;
    Object.assign(this.ring.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
    const bw = Math.min(300, window.innerWidth - 24);
    this.bubble.style.width = `${bw}px`;
    const bh = this.bubble.offsetHeight;
    const below = r.bottom + 14 + bh < window.innerHeight || r.top < bh + 20;
    const left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = `${below ? r.bottom + 14 : r.top - bh - 14}px`;
    this.bubble.classList.toggle('below', below);
    this.bubble.style.setProperty('--arrow-x', `${Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - left))}px`);
  }

  private dismiss(): void {
    this.hide(true);
  }

  private hide(done: boolean): void {
    if (done && this.activeId) {
      const s = this.getState();
      if (!s.tutorial.includes(this.activeId)) s.tutorial.push(this.activeId);
      this.save();
    }
    this.target?.removeEventListener('pointerdown', this.onTargetPress);
    this.activeId = null;
    this.target = null;
    this.ring.hidden = this.bubble.hidden = true;
  }

  /** Forget the open tip without marking it seen (e.g. on screen change). */
  reset(): void {
    this.hide(false);
  }
}

function isVisible(node: HTMLElement): boolean {
  if (!node.isConnected || node.closest('[hidden]')) return false;
  const r = node.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
