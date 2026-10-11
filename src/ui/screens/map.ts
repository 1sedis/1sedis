import { CHAPTERS, enemyPlacements, levelIncome, type ChapterDef } from '../../game/levels';
import {
  collectTreasury, currentLevelId, incomePerMinute, isLevelOpen, treasuryCap, treasuryCapHours,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { el, pulse, setText, stars, toast } from '../dom';
import { fmt } from '../format';
import { spriteUrl } from '../sprites';

// Snake layout of the nine nodes on a 3x3 grid: row 1 left→right, row 2 right→left, row 3 left→right.
const GRID_POS = [[1, 1], [2, 1], [3, 1], [3, 2], [2, 2], [1, 2], [1, 3], [2, 3], [3, 3]];
// Direction of the connector leaving each node towards the next one.
const LINK = ['right', 'right', 'down', 'left', 'left', 'down', 'right', 'right', ''];

export class MapScreen implements Screen {
  readonly root = el('section', 'map-screen');
  private chapter = 1;
  private tabs = el('nav', 'chapter-tabs');
  private chapterTitle = el('h1', 'chapter-title');
  private chapterSub = el('div', 'chapter-sub');
  private path = el('div', 'level-path');
  private treasuryAmount = el('b');
  private treasuryFill = el('div', 'bar-fill');
  private treasuryInfo = el('div', 'treasury-info');
  private collectBtn = el('button', 'btn btn-buy', 'Забрать');

  constructor(private ctx: Ctx) {
    const main = el('div', 'map-main card');
    const head = el('div', 'map-head');
    const titles = el('div');
    titles.append(this.chapterTitle, this.chapterSub);
    head.append(titles);
    main.append(this.tabs, head, this.path);

    const side = el('aside', 'map-side');
    const treasury = el('div', 'card treasury');
    const tHead = el('div', 'panel-head');
    tHead.append(el('span', 'panel-title', 'Казна'));
    const amountRow = el('div', 'treasury-amount');
    amountRow.append(this.treasuryAmount, el('span', '', ' золота'));
    const bar = el('div', 'bar');
    bar.append(this.treasuryFill);
    this.collectBtn.addEventListener('click', () => {
      const got = collectTreasury(this.ctx.state);
      if (got > 0) {
        toast(`+${fmt(got)} золота из казны`, 'good');
        this.ctx.save();
      }
    });
    treasury.append(tHead, amountRow, bar, this.treasuryInfo, this.collectBtn);

    const camp = el('button', 'card camp-link');
    camp.append(el('img'), el('span', 'camp-title', 'Улучшения'), el('span', 'camp-sub', 'Нанять фигуры, повысить уровень, постройки'));
    (camp.firstElementChild as HTMLImageElement).src = spriteUrl('rook', 'ally');
    camp.addEventListener('click', () => this.ctx.go('camp'));

    side.append(treasury, camp);
    this.root.append(main, side);
  }

  show(): void {
    const current = CHAPTERS.find((c) => c.levels.some((l) => l.id === currentLevelId(this.ctx.state)));
    this.chapter = current?.id ?? 1;
    this.renderChapter();
  }

  private renderChapter(): void {
    const s = this.ctx.state;
    this.tabs.innerHTML = '';
    for (const c of CHAPTERS) {
      const open = isLevelOpen(s, c.levels[0].id);
      const got = c.levels.reduce((sum, l) => sum + (s.stars[l.id] ?? 0), 0);
      const tab = el('button', 'chapter-tab');
      tab.classList.toggle('active', c.id === this.chapter);
      tab.disabled = !open;
      tab.append(el('span', 'chapter-tab-num', open ? `Глава ${c.id}` : '🔒'), el('span', 'chapter-tab-stars', `★ ${got}/27`));
      tab.title = c.name;
      tab.addEventListener('click', () => {
        this.chapter = c.id;
        this.renderChapter();
      });
      this.tabs.append(tab);
    }
    const chapter = CHAPTERS[this.chapter - 1];
    setText(this.chapterTitle, chapter.name);
    setText(this.chapterSub, `${chapter.subtitle} · до ${chapter.limit} фигур в бою`);
    this.renderPath(chapter);
  }

  private renderPath(chapter: ChapterDef): void {
    const s = this.ctx.state;
    const currentId = currentLevelId(s);
    this.path.innerHTML = '';
    chapter.levels.forEach((level, i) => {
      const open = isLevelOpen(s, level.id);
      const got = s.stars[level.id] ?? 0;
      const node = el('button', 'level-node');
      const [col, row] = GRID_POS[i];
      node.style.gridColumn = String(col);
      node.style.gridRow = String(row);
      if (LINK[i]) node.dataset.link = LINK[i];
      node.classList.toggle('locked', !open);
      node.classList.toggle('cleared', got > 0);
      node.classList.toggle('current', level.id === currentId && open);
      node.classList.toggle('boss', !!level.boss);
      node.disabled = !open;

      const tile = el('div', 'level-tile');
      if (level.boss) {
        const bossPiece = enemyPlacements(level).find((p) => p.boss);
        const img = el('img');
        img.src = spriteUrl(bossPiece?.kind ?? 'king', 'enemy');
        img.alt = '';
        tile.append(img);
      } else {
        tile.append(el('span', 'level-num', open ? level.id : '🔒'));
      }
      node.append(tile, el('div', 'level-name', level.name), el('div', 'level-stars', open ? stars(got) : ''));
      node.title = open ? `${level.name}: +${levelIncome(level.id)} золота/мин после победы` : 'Сначала пройдите предыдущий бой';
      node.addEventListener('click', () => this.ctx.go('arena', level.id));
      this.path.append(node);
    });
  }

  frame(): void {
    const s = this.ctx.state;
    const cap = treasuryCap(s);
    const rate = incomePerMinute(s);
    const amount = Math.floor(s.treasury);
    const before = this.treasuryAmount.textContent;
    setText(this.treasuryAmount, fmt(amount));
    if (before !== this.treasuryAmount.textContent && amount > 0 && before !== '') pulse(this.treasuryAmount);
    this.treasuryFill.style.width = `${cap > 0 ? Math.min(100, (s.treasury / cap) * 100) : 0}%`;
    setText(this.treasuryInfo, rate > 0
      ? `+${rate < 100 ? Math.round(rate * 10) / 10 : fmt(rate)} в минуту · копится до ${treasuryCapHours(s)} ч, даже когда игра закрыта`
      : 'Побеждайте в боях — захваченные земли начнут приносить золото');
    this.collectBtn.disabled = amount < 1;
  }
}
