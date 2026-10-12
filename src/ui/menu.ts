import type { PieceKind } from '../game/pieces';
import type { Settings } from './settings';
import { spriteUrl } from './sprites';
import { el } from './dom';
import { LANGS, getLang, switchLang, t } from '../i18n';

/** Two little armies walking across the checkered floor behind the menu. */
function marchingArmies(peace: boolean): HTMLElement {
  const layer = el('div', 'menu-march');
  // After the finale both armies walk the same way: the war is over.
  const rows: { team: 'ally' | 'enemy'; kinds: PieceKind[]; dir: 'right' | 'left' }[] = [
    { team: 'ally', kinds: ['pawn', 'pawn', 'knight', 'king', 'bishop', 'rook', 'pawn'], dir: 'right' },
    { team: 'enemy', kinds: ['pawn', 'rook', peace ? 'king' : 'queen', 'knight', 'pawn', 'bishop', 'pawn'], dir: peace ? 'right' : 'left' },
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
  /** The Hand is beaten: the menu tells a different story. */
  peace?: boolean;
}

export function buildMenu(o: MenuOptions): HTMLElement {
  const root = el('div', 'menu');
  root.append(el('div', 'menu-floor'), marchingArmies(!!o.peace), el('div', 'menu-stars'));
  root.classList.toggle('peace', !!o.peace);

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
  title.append(el('span', '', t('Пиксельный')), el('span', 'menu-title-accent', t('гамбит')));

  const buttons = el('div', 'menu-buttons');
  if (o.hasSave) {
    const cont = el('button', 'btn btn-primary menu-main');
    cont.append(el('span', '', t('▶ Продолжить')), el('small', '', o.summary));
    cont.addEventListener('click', o.onContinue);
    buttons.append(cont);
  }
  const fresh = el('button', `btn ${o.hasSave ? '' : 'btn-primary menu-main'}`, t('Новая игра'));
  fresh.addEventListener('click', o.onNewGame);
  const settings = el('button', 'btn', t('Настройки'));
  settings.addEventListener('click', o.onSettings);
  buttons.append(fresh, settings);

  card.append(pieces, title, el('p', 'menu-tag', o.peace ? t('Доска больше не переворачивается') : t('Шахматная кампания')), buttons);
  root.append(card, el('div', 'menu-foot', t('v0.3 · прогресс сохраняется в браузере')));
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
  box.append(el('h2', '', t('Настройки')));

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
  row(t('Скорость боя'), seg);

  const langSeg = el('div', 'seg');
  for (const l of LANGS) {
    const b = el('button', 'seg-btn', l.name);
    b.classList.toggle('active', l.id === getLang());
    b.addEventListener('click', () => {
      if (l.id !== getLang()) switchLang(l.id);
    });
    langSeg.append(b);
  }
  row(t('Язык'), langSeg);

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
  row(t('Звуки'), volumeRow(soundBtn, slider('soundVolume')));
  row(t('Музыка'), volumeRow(musicBtn, slider('musicVolume')));
  row(t('Цифры урона и частицы'), fxBtn);
  row(t('Подсказки обучения'), hintsBtn);
  if (onResetTips) {
    const again = el('button', 'btn btn-small', t('Заново'));
    again.addEventListener('click', () => {
      onResetTips();
      again.textContent = t('Готово');
      again.disabled = true;
    });
    row(t('Показать подсказки снова'), again);
  }

  if (transfer) {
    const box2 = el('div', 'volume-row');
    const exp = el('button', 'btn btn-small', t('Экспорт'));
    const imp = el('button', 'btn btn-small', t('Импорт'));
    exp.addEventListener('click', () => saveDialog('export', transfer));
    imp.addEventListener('click', () => {
      overlay.remove();
      saveDialog('import', transfer);
    });
    box2.append(exp, imp);
    row(t('Сохранение'), box2);
  }

  const sync = () => {
    segBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === s.speed));
    for (const [b, on] of [[soundBtn, s.sound], [musicBtn, s.music], [fxBtn, s.effects], [hintsBtn, s.hints]] as const) {
      b.textContent = on ? t('Вкл') : t('Выкл');
      b.classList.toggle('on', on);
    }
    onChange({ ...s });
  };
  sync();

  const actions = el('div', 'modal-actions');
  const reset = el('button', 'btn btn-danger-ghost settings-reset', t('⚠ Сбросить прогресс'));
  reset.addEventListener('click', () => {
    overlay.remove();
    onReset();
  });
  const close = el('button', 'btn btn-primary', t('Готово'));
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
function saveDialog(mode: 'export' | 'import', tr: SaveTransfer): void {
  const overlay = el('div', 'modal-overlay save-overlay');
  const box = el('div', 'modal card save-dialog');
  const area = el('textarea', 'save-code');
  area.spellcheck = false;
  const status = el('p', 'hint');
  const actions = el('div', 'modal-actions');
  const close = el('button', 'btn btn-ghost', mode === 'export' ? t('Готово') : t('Отмена'));
  close.addEventListener('click', () => overlay.remove());
  if (mode === 'export') {
    box.append(el('h2', '', t('Экспорт')));
    status.textContent = t('Скопируйте код и вставьте его через «Импорт» на другом устройстве.');
    area.value = tr.exportCode();
    area.readOnly = true;
    const copy = el('button', 'btn btn-primary', t('Скопировать'));
    copy.addEventListener('click', async () => {
      area.select();
      let ok = false;
      try {
        await navigator.clipboard.writeText(area.value);
        ok = true;
      } catch {
        ok = document.execCommand?.('copy') ?? false;
      }
      copy.textContent = ok ? t('Скопировано') : t('Выделено — Ctrl+C');
    });
    actions.append(close, copy);
  } else {
    box.append(el('h2', '', t('Импорт')));
    status.textContent = t('Вставьте код сохранения. Текущий прогресс будет заменён.');
    area.placeholder = 'PG2:...';
    const load = el('button', 'btn btn-primary', t('Загрузить'));
    load.addEventListener('click', () => {
      if (tr.importCode(area.value)) {
        overlay.remove();
      } else {
        status.textContent = t('Код не подошёл: проверьте, что он скопирован целиком.');
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
