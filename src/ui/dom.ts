import { hasGlyphs, renderRich } from './icons';
import { t } from '../i18n';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) setText(node, text);
  return node;
}

/** Set text, drawing glyphs like ★ or ❤ as pixel icons. Skips the DOM when nothing changed. */
export function setText(node: HTMLElement, text: string): void {
  if (node.dataset.text === text) return;
  if (hasGlyphs(text)) {
    node.dataset.text = text;
    renderRich(node, text);
  } else if (node.textContent !== text || node.dataset.text !== undefined) {
    delete node.dataset.text;
    node.textContent = text;
  }
}

/** Restart a short "pop" animation on an element. */
export function pulse(node: HTMLElement): void {
  node.classList.remove('pop');
  void node.offsetWidth;
  node.classList.add('pop');
}

let toastLayer: HTMLElement | null = null;

/** Toasts wait in line: at most two on screen, the rest follow, so news never piles over the game. */
const TOAST_MAX = 2;
const toastQueue: { text: string; kind: 'info' | 'good' }[] = [];

function showNextToast(): void {
  if (!toastLayer) {
    toastLayer = el('div', 'toast-layer');
    document.body.append(toastLayer);
  }
  while (toastQueue.length && toastLayer.querySelectorAll('.toast:not(.out)').length < TOAST_MAX) {
    const { text, kind } = toastQueue.shift()!;
    const node = el('div', `toast ${kind}`, text);
    toastLayer.append(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => {
        node.remove();
        showNextToast();
      }, 300);
    }, 2400);
  }
}

export function toast(text: string, kind: 'info' | 'good' = 'info'): void {
  // The same news twice in a row is said once.
  if (toastQueue.some((q) => q.text === text)) return;
  toastQueue.push({ text, kind });
  if (toastQueue.length > 6) toastQueue.shift();
  showNextToast();
}

/** Open a modal with arbitrary content. Returns a function that closes it. */
export function openModal(content: HTMLElement, opts: { dismissable?: boolean; cls?: string } = {}): () => void {
  const overlay = el('div', 'modal-overlay');
  const box = el('div', `modal card ${opts.cls ?? ''}`);
  box.append(content);
  overlay.append(box);
  const close = () => overlay.remove();
  if (opts.dismissable !== false) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
  document.body.append(overlay);
  return close;
}

export function confirmDialog(title: string, text: string, yesLabel = t('Да')): Promise<boolean> {
  return new Promise((resolve) => {
    const content = el('div');
    const actions = el('div', 'modal-actions');
    const no = el('button', 'btn btn-ghost', t('Отмена'));
    const yes = el('button', 'btn btn-primary', yesLabel);
    actions.append(no, yes);
    content.append(el('h2', '', title), el('p', '', text), actions);
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      close();
      resolve(v);
    };
    const close = openModal(content);
    no.addEventListener('click', () => finish(false));
    yes.addEventListener('click', () => finish(true));
    // Clicking the backdrop removes the overlay; treat it as "no".
    content.closest('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) finish(false);
    });
    yes.focus();
  });
}

/** A small "?" button that shows an explanation in a dialog, keeping panels free of long text. */
export function infoBtn(title: string, text: string | (() => string)): HTMLButtonElement {
  const b = el('button', 'info-btn', '?');
  b.type = 'button';
  b.title = title;
  b.setAttribute('aria-label', t('Подробнее: {title}', { title }));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const content = el('div', 'info-dialog');
    const ok = el('button', 'btn btn-primary', t('Понятно'));
    const actions = el('div', 'modal-actions');
    actions.append(ok);
    const body = el('div', 'info-text');
    for (const line of (typeof text === 'string' ? text : text()).split('\n')) body.append(el('p', '', line));
    content.append(el('h2', '', title), body, actions);
    const close = openModal(content);
    ok.addEventListener('click', close);
  });
  return b;
}

/** Change `hidden` only when it differs: re-setting attributes every frame costs style recalcs. */
export function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

export function setDisabled(node: HTMLButtonElement, disabled: boolean): void {
  if (node.disabled !== disabled) node.disabled = disabled;
}

let wipeEl: HTMLElement | null = null;

/** The pixel wipe between screens (also between battles). */
export function wipe(): void {
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

