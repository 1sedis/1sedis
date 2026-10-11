import { ABYSS_UNLOCK, CHAPTERS, abyssId, enemyPlacements, getLevel, levelIncome, type ChapterDef } from '../../game/levels';
import { RELIC_IDS } from '../../game/relics';
import {
  PRESTIGE_UNLOCK, canPrestige, crownsForPrestige, isAbyssOpen, prestige,
  collectTreasury, currentLevelId, incomePerMinute, isLevelOpen, treasuryCap, treasuryCapHours,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { confirmDialog, el, pulse, setText, stars, toast } from '../dom';
import { fmt } from '../format';
import { audio } from '../audio';
import { openRelicPicker, relicStrip } from '../relics';
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
  private chapterBoss = el('img', 'chapter-boss');
  private path = el('div', 'level-path');
  private treasuryAmount = el('b');
  private treasuryFill = el('div', 'bar-fill');
  private treasuryInfo = el('div', 'treasury-info');
  private collectBtn = el('button', 'btn btn-buy', 'Забрать');
  private relicList = el('div');
  private relicCount = el('span');
  private relicBtn = el('button', 'btn btn-up');
  private treasuryCard!: HTMLElement;
  private abyssCard = el('div', 'card abyss-card');
  private abyssInfo = el('div', 'treasury-info');
  private abyssBtn = el('button', 'btn btn-primary', 'Спуститься');
  private prestigeCard = el('div', 'card prestige-card');
  private prestigeInfo = el('div', 'treasury-info');
  private prestigeBtn = el('button', 'btn btn-up', 'Новая партия');

  constructor(private ctx: Ctx) {
    const main = el('div', 'map-main card');
    const head = el('div', 'map-head chapter-banner');
    const titles = el('div');
    titles.append(this.chapterTitle, this.chapterSub);
    this.chapterBoss.alt = '';
    head.append(titles, el('div', 'chapter-strip'), this.chapterBoss);
    main.append(this.tabs, head, this.path);

    const side = el('aside', 'map-side');
    const treasury = el('div', 'card treasury');
    this.treasuryCard = treasury;
    const tHead = el('div', 'panel-head');
    tHead.append(el('span', 'panel-title', 'Казна'));
    const amountRow = el('div', 'treasury-amount');
    amountRow.append(this.treasuryAmount, el('span', '', ' золота'));
    const bar = el('div', 'bar');
    bar.append(this.treasuryFill);
    this.collectBtn.addEventListener('click', () => {
      const got = collectTreasury(this.ctx.state);
      if (got > 0) {
        audio.play('coins');
        toast(`+${fmt(got)} золота из казны`, 'good');
        this.ctx.save();
      }
    });
    treasury.append(tHead, amountRow, bar, this.treasuryInfo, this.collectBtn);

    const camp = el('button', 'card camp-link');
    camp.append(el('img'), el('span', 'camp-title', 'Улучшения'), el('span', 'camp-sub', 'Нанять фигуры, повысить уровень, постройки'));
    (camp.firstElementChild as HTMLImageElement).src = spriteUrl('rook', 'ally');
    camp.addEventListener('click', () => this.ctx.go('camp'));

    const relics = el('div', 'card relics-card');
    const rHead = el('div', 'panel-head');
    rHead.append(el('span', 'panel-title', 'Реликвии'), this.relicCount);
    this.relicBtn.addEventListener('click', () => openRelicPicker(this.ctx, () => this.renderRelics()));
    relics.append(rHead, this.relicList, this.relicBtn);

    const aHead = el('div', 'panel-head');
    aHead.append(el('span', 'panel-title', 'Бездна'));
    const aImg = el('img', 'abyss-img');
    aImg.src = spriteUrl('king', 'enemy', 2);
    aImg.alt = '';
    this.abyssBtn.addEventListener('click', () => this.ctx.go('arena', abyssId(this.ctx.state.abyss.floor)));
    this.abyssCard.append(aHead, aImg, this.abyssInfo, this.abyssBtn);

    const pHead = el('div', 'panel-head');
    pHead.append(el('span', 'panel-title', 'Новая партия'));
    this.prestigeBtn.addEventListener('click', () => void this.onPrestige());
    this.prestigeCard.append(pHead, this.prestigeInfo, this.prestigeBtn);

    side.append(treasury, this.abyssCard, relics, this.prestigeCard, camp);
    this.root.append(main, side);
  }

  show(): void {
    const current = CHAPTERS.find((c) => c.levels.some((l) => l.id === currentLevelId(this.ctx.state)));
    this.chapter = current?.id ?? 1;
    this.renderChapter();
    this.renderRelics();
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
    this.root.dataset.theme = String(chapter.id);
    const boss = chapter.levels[chapter.levels.length - 1];
    this.chapterBoss.src = spriteUrl(enemyPlacements(boss).find((p) => p.boss)?.kind ?? 'king', 'enemy');
    this.chapterBoss.title = boss.boss ?? '';
    setText(this.chapterTitle, chapter.name);
    setText(this.chapterSub, `${chapter.subtitle} · до ${chapter.limit} фигур в бою`);
    this.renderPath(chapter);
  }

  private async onPrestige(): Promise<void> {
    const s = this.ctx.state;
    if (!canPrestige(s)) return;
    const gain = crownsForPrestige(s);
    const ok = await confirmDialog('Новая партия',
      `Кампания, армия, уровни, постройки и реликвии начнутся заново, враги станут на 2 уровня сильнее, `
      + `а награды вырастут. Вы получите ${gain} корон: каждая навсегда даёт +2% к атаке и здоровью и +4% к золоту. `
      + `Короны, достижения и рекорд Бездны сохранятся.`, 'Начать');
    if (!ok) return;
    const got = prestige(s);
    this.ctx.save();
    audio.play('achievement');
    toast(`Партия ${s.prestige + 1}: +${got} корон!`, 'good');
    this.show();
  }

  private renderRelics(): void {
    const s = this.ctx.state;
    setText(this.relicCount, `${s.relics.length}/${RELIC_IDS.length}`);
    this.relicList.replaceChildren(s.relics.length
      ? relicStrip(s.relics)
      : el('p', 'hint', 'Побеждайте боссов и собирайте звёзды: за босса и каждые 12 звёзд — выбор реликвии.'));
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
    this.relicBtn.hidden = s.relicPicks <= 0;
    const abyssOpen = isAbyssOpen(s);
    setText(this.abyssInfo, abyssOpen
      ? `Этаж ${s.abyss.floor} · рекорд ${s.abyss.best} · ◆ ${fmt(s.shards)} осколков. Осколки дают вечные улучшения в Алтаре бездны; каждые 10 этажей — страж и реликвия.`
      : `Откроется после победы над боссом «${getLevel(ABYSS_UNLOCK).boss}» (${ABYSS_UNLOCK}).`);
    this.abyssBtn.hidden = !abyssOpen;
    this.abyssCard.classList.toggle('locked', !abyssOpen);
    const ready = canPrestige(s);
    setText(this.prestigeInfo, ready
      ? `Сбросьте кампанию ради корон: сейчас +${crownsForPrestige(s)}. Корон: ${s.crowns} (+${s.crowns * 2}% к силе, +${s.crowns * 4}% к золоту).`
      : s.crowns
        ? `Корон: ${s.crowns} (+${s.crowns * 2}% к силе, +${s.crowns * 4}% к золоту). Партия ${s.prestige + 1}. Следующая — после победы над финальным боссом.`
        : `Откроется после победы над финальным боссом (${PRESTIGE_UNLOCK}).`);
    this.prestigeBtn.hidden = !ready;
    this.prestigeCard.hidden = !ready && s.crowns === 0 && !isAbyssOpen(s);
    void (abyssOpen && this.ctx.tip('t_abyss', this.abyssBtn,
      'Открыта Бездна! Бесконечные этажи с наградами. Включите авто-спуск, чтобы армия спускалась сама.'));
    void (this.ctx.tip('t_relic', this.relicBtn, 'Вы заслужили реликвию! Выберите один из трёх постоянных бонусов.')
      || (rate > 0 && this.ctx.tip('t_treasury', this.treasuryCard,
        'Захваченные земли приносят золото в казну, даже когда игра закрыта. Забирайте его здесь.')));
    setText(this.relicBtn, `Выбрать реликвию (${s.relicPicks})`);
  }
}
