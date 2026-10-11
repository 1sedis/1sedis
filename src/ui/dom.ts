export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Restart a short "pop" animation on an element. */
export function pulse(node: HTMLElement): void {
  node.classList.remove('pop');
  void node.offsetWidth;
  node.classList.add('pop');
}

let toastLayer: HTMLElement | null = null;

export function toast(text: string, kind: 'info' | 'good' = 'info'): void {
  if (!toastLayer) {
    toastLayer = el('div', 'toast-layer');
    document.body.append(toastLayer);
  }
  const t = el('div', `toast ${kind}`, text);
  toastLayer.append(t);
  while (toastLayer.children.length > 3) toastLayer.firstElementChild?.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, 2400);
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

export function confirmDialog(title: string, text: string, yesLabel = 'Да'): Promise<boolean> {
  return new Promise((resolve) => {
    const content = el('div');
    const actions = el('div', 'modal-actions');
    const no = el('button', 'btn btn-ghost', 'Отмена');
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

export function stars(n: number, max = 3): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
}
