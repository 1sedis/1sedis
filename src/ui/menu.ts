import type { PieceKind } from '../game/pieces';
import type { Settings } from './settings';
import { spriteUrl } from './sprites';
import { el } from './dom';

/** Two little armies walking across the checkered floor behind the menu. */
function marchingArmies(): HTMLElement {
  const layer = el('div', 'menu-march');
  const rows: { team: 'ally' | 'enemy'; kinds: PieceKind[]; dir: 'right' | 'left' }[] = [
    { team: 'ally', kinds: ['pawn', 'pawn', 'knight', 'king', 'bishop', 'rook', 'pawn'], dir: 'right' },
    { team: 'enemy', kinds: ['pawn', 'rook', 'queen', 'knight', 'pawn', 'bishop', 'pawn'], dir: 'left' },
  ];
  rows.forEach((row, r) => {
    const line = el('div', `march-line march-${row.dir}`);
    line.style.animationDelay = `${-r * 9}s`;
    row.kinds.forEach((kind, i) => {
      const img = el('img', 'march-piece');
      img.src = spriteUrl(kind, row.team);
      img.alt = '';
      img.style.animationDelay = `${-i * 0.18}s`;
      line.append(img);
    });
    layer.append(line);
  });
  return layer;
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
  root.append(el('div', 'menu-floor'), marchingArmies(), el('div', 'menu-stars'));

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
export interface SaveTransfer { exportCode: () => string; importCode: (code: string) => boolean }

export function openSettings(
  current: Settings, onChange: (s: Settings) => void, onReset: () => void, onResetTips?: () => void, transfer?: SaveTransfer,
): void {
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

  if (transfer) {
    const box2 = el('div', 'volume-row');
    const exp = el('button', 'btn btn-small', 'Экспорт');
    const imp = el('button', 'btn btn-small', 'Импорт');
    exp.addEventListener('click', () => saveDialog('export', transfer));
    imp.addEventListener('click', () => {
      overlay.remove();
      saveDialog('import', transfer);
    });
    box2.append(exp, imp);
    row('Сохранение', box2);
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

/** Export: show the code to copy. Import: paste a code to replace the current progress. */
function saveDialog(mode: 'export' | 'import', t: SaveTransfer): void {
  const overlay = el('div', 'modal-overlay save-overlay');
  const box = el('div', 'modal card save-dialog');
  const area = el('textarea', 'save-code');
  area.spellcheck = false;
  const status = el('p', 'hint');
  const actions = el('div', 'modal-actions');
  const close = el('button', 'btn btn-ghost', mode === 'export' ? 'Готово' : 'Отмена');
  close.addEventListener('click', () => overlay.remove());
  if (mode === 'export') {
    box.append(el('h2', '', 'Экспорт'));
    status.textContent = 'Скопируйте код и вставьте его через «Импорт» на другом устройстве.';
    area.value = t.exportCode();
    area.readOnly = true;
    const copy = el('button', 'btn btn-primary', 'Скопировать');
    copy.addEventListener('click', async () => {
      area.select();
      let ok = false;
      try {
        await navigator.clipboard.writeText(area.value);
        ok = true;
      } catch {
        ok = document.execCommand?.('copy') ?? false;
      }
      copy.textContent = ok ? 'Скопировано' : 'Выделено — Ctrl+C';
    });
    actions.append(close, copy);
  } else {
    box.append(el('h2', '', 'Импорт'));
    status.textContent = 'Вставьте код сохранения. Текущий прогресс будет заменён.';
    area.placeholder = 'PG2:...';
    const load = el('button', 'btn btn-primary', 'Загрузить');
    load.addEventListener('click', () => {
      if (t.importCode(area.value)) {
        overlay.remove();
      } else {
        status.textContent = 'Код не подошёл: проверьте, что он скопирован целиком.';
        status.classList.add('save-error');
      }
    });
    actions.append(close, load);
  }
  box.append(status, area, actions);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.append(box);
  document.body.append(overlay);
  if (mode === 'export') area.select();
  else area.focus();
}
