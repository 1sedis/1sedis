import type { PieceKind } from '../game/pieces';
import type { Settings } from './settings';
import { spriteUrl } from './sprites';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface MenuOptions {
  hasSave: boolean;
  summary: string;
  onContinue: () => void;
  onNewGame: () => void;
  onSettings: () => void;
}

export function buildMenu(o: MenuOptions): HTMLElement {
  const root = el('div', 'menu');
  root.append(el('div', 'menu-floor'));

  const card = el('div', 'menu-card');
  const pieces = el('div', 'menu-pieces');
  const lineup: [PieceKind, 'ally' | 'enemy'][] = [
    ['pawn', 'ally'], ['knight', 'ally'], ['king', 'ally'], ['queen', 'enemy'], ['rook', 'enemy'], ['pawn', 'enemy'],
  ];
  lineup.forEach(([kind, team], i) => {
    const img = el('img');
    img.src = spriteUrl(kind, team);
    img.alt = '';
    img.style.animationDelay = `${-i * 0.2}s`;
    pieces.append(img);
  });

  const title = el('h1', 'menu-title');
  title.append(el('span', '', 'Пиксельный'), el('span', 'menu-title-accent', 'гамбит'));

  const buttons = el('div', 'menu-buttons');
  if (o.hasSave) {
    const cont = el('button', 'btn btn-primary menu-main');
    cont.append(el('span', '', '▶ Продолжить'), el('small', '', o.summary));
    cont.addEventListener('click', o.onContinue);
    buttons.append(cont);
  }
  const fresh = el('button', `btn ${o.hasSave ? '' : 'btn-primary menu-main'}`, 'Новая игра');
  fresh.addEventListener('click', o.onNewGame);
  const settings = el('button', 'btn', 'Настройки');
  settings.addEventListener('click', o.onSettings);
  buttons.append(fresh, settings);

  card.append(pieces, title, el('p', 'menu-tag', 'Шахматная кампания'), buttons);
  root.append(card, el('div', 'menu-foot', 'v0.3 · прогресс сохраняется в браузере'));
  return root;
}

/** Settings dialog. Changes apply immediately through onChange. */
export function openSettings(current: Settings, onChange: (s: Settings) => void, onReset: () => void, onResetTips?: () => void): void {
  const s = { ...current };
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal card settings');
  box.append(el('h2', '', 'Настройки'));

  const row = (label: string, control: HTMLElement) => {
    const r = el('div', 'setting-row');
    r.append(el('span', '', label), control);
    box.append(r);
  };

  const seg = el('div', 'seg');
  const segBtns = ([1, 2, 4] as const).map((sp) => {
    const b = el('button', 'seg-btn', `×${sp}`);
    b.addEventListener('click', () => {
      s.speed = sp;
      sync();
    });
    seg.append(b);
    return { b, sp };
  });
  row('Скорость боя', seg);

  const toggle = (key: 'effects' | 'sound' | 'music' | 'hints') => {
    const b = el('button', 'toggle');
    b.addEventListener('click', () => {
      s[key] = !s[key];
      sync();
    });
    return b;
  };
  const soundBtn = toggle('sound');
  const musicBtn = toggle('music');
  const fxBtn = toggle('effects');
  const hintsBtn = toggle('hints');
  const slider = (key: 'soundVolume' | 'musicVolume') => {
    const input = el('input', 'volume');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.id = `setting-${key}`;
    input.value = String(Math.round(s[key] * 100));
    input.addEventListener('input', () => {
      s[key] = Number(input.value) / 100;
      sync();
    });
    return input;
  };
  const volumeRow = (toggleBtn: HTMLElement, range: HTMLElement) => {
    const box = el('div', 'volume-row');
    box.append(range, toggleBtn);
    return box;
  };
  row('Звуки', volumeRow(soundBtn, slider('soundVolume')));
  row('Музыка', volumeRow(musicBtn, slider('musicVolume')));
  row('Цифры урона и частицы', fxBtn);
  row('Подсказки обучения', hintsBtn);
  if (onResetTips) {
    const again = el('button', 'btn btn-small', 'Заново');
    again.addEventListener('click', () => {
      onResetTips();
      again.textContent = 'Готово';
      again.disabled = true;
    });
    row('Показать подсказки снова', again);
  }

  const sync = () => {
    segBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === s.speed));
    for (const [b, on] of [[soundBtn, s.sound], [musicBtn, s.music], [fxBtn, s.effects], [hintsBtn, s.hints]] as const) {
      b.textContent = on ? 'Вкл' : 'Выкл';
      b.classList.toggle('on', on);
    }
    onChange({ ...s });
  };
  sync();

  const actions = el('div', 'modal-actions');
  const reset = el('button', 'btn btn-ghost', 'Сбросить прогресс');
  reset.addEventListener('click', () => {
    overlay.remove();
    onReset();
  });
  const close = el('button', 'btn btn-primary', 'Готово');
  close.addEventListener('click', () => overlay.remove());
  actions.append(reset, close);
  box.append(actions);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.append(box);
  document.body.append(overlay);
}
