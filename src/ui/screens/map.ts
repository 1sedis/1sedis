import { ABYSS_UNLOCK, CHAPTERS, abyssId, finaleId, enemyPlacements, levelIncome, type ChapterDef } from '../../game/levels';
import { RELIC_IDS } from '../../game/relics';
import {
  canPrestige, crownsForPrestige, gameNumber, isAbyssOpen, prestige, isFinaleOpen,
  collectTreasury, currentLevelId, incomePerMinute, isLevelOpen, treasuryCap, treasuryCapHours,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { confirmDialog, el, infoBtn, pulse, setText, stars, toast } from '../dom';
import { fmt } from '../format';
import { audio } from '../audio';
import { openRelicPicker, relicStrip } from '../relics';
import { spriteUrl } from '../sprites';
import { drawChapterScene } from '../mapArt';
import { openCrownTree } from '../crownTree';
import { openChronicle, playGameIntro, playReveal } from '../story';
import { playCredits } from '../finale';
import { handUrl } from '../handArt';
import { DISTORTIONS, distortionFor } from '../../game/distortions';

const REVEAL_KEY = 'story_final_reveal';

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
  private scene = el('canvas', 'map-scene');
  private sceneSig = '';
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
  private treeBtn = el('button', 'btn btn-buy tree-btn', '♛ Древо короны');
  private chronicleBtn = el('button', 'btn btn-small chronicle-btn', 'Летопись');
  private distortionInfo = el('div', 'distortion-info treasury-info');
  private finaleCard = el('div', 'card finale-card');
  private finaleInfo = el('div', 'treasury-info');
  private finalePips = el('div', 'finale-pips');
  private finaleBtn = el('button', 'btn btn-danger finale-btn');
  private creditsBtn = el('button', 'btn btn-small', 'Титры');

  constructor(private ctx: Ctx) {
    const main = el('div', 'map-main card');
    const head = el('div', 'map-head chapter-banner');
    const titles = el('div');
    titles.append(this.chapterTitle, this.chapterSub);
    this.chapterBoss.alt = '';
    head.append(titles, el('div', 'chapter-strip'), this.chapterBoss);
    main.append(this.tabs, head, this.path);
    // Redraw the landscape when the map changes size (window resize, phone rotation).
    new ResizeObserver(() => this.drawScene()).observe(this.path);

    const side = el('aside', 'map-side');
    const treasury = el('div', 'card treasury');
    this.treasuryCard = treasury;
    const tHead = el('div', 'panel-head');
    tHead.append(el('span', 'panel-title', 'Казна'), infoBtn('Казна', () =>
      'Каждый пройденный бой приносит золото в минуту.\n'
      + `Казна копится до ${treasuryCapHours(this.ctx.state)} ч, даже когда игра закрыта. Постройка «Казна» увеличивает доход и запас.`));
    const amountRow = el('div', 'treasury-amount');
    amountRow.append(this.treasuryAmount);
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

    const relics = el('div', 'card relics-card');
    const rHead = el('div', 'panel-head');
    rHead.append(el('span', 'panel-title', 'Реликвии'), this.relicCount, infoBtn('Реликвии',
      'Постоянные бонусы, меняющие правила боя.\nЗа каждого босса и каждые 12 звёзд вы выбираете одну из трёх. Наведите на значок или нажмите на него, чтобы прочитать описание.'));
    this.relicBtn.addEventListener('click', () => openRelicPicker(this.ctx, () => this.renderRelics()));
    relics.append(rHead, this.relicList, this.relicBtn);

    const aHead = el('div', 'panel-head');
    aHead.append(el('span', 'panel-title', 'Бездна'), infoBtn('Бездна',
      'Бесконечные этажи: чем глубже, тем сильнее враги и богаче награда.\nТолько здесь добываются осколки ◆ — за них крутят «Рулетку бездны» с вечными улучшениями, вплоть до легендарных.\nКаждые 10 этажей — страж с тройным здоровьем и реликвия. Авто-спуск ведёт армию дальше сам.'));
    const aImg = el('img', 'abyss-img');
    aImg.src = spriteUrl('king', 'enemy', 2);
    aImg.alt = '';
    this.abyssBtn.addEventListener('click', () => this.ctx.go('arena', abyssId(this.ctx.state.abyss.floor)));
    this.abyssCard.append(aHead, aImg, this.abyssInfo, this.abyssBtn);

    const pHead = el('div', 'panel-head');
    pHead.append(el('span', 'panel-title', 'Новая партия'), infoBtn('Новая партия',
      'После финального босса можно начать кампанию заново ради корон.\nКороны тратятся в «Древе короны» на доктрины: новые шахматные приёмы, новые фигуры и силы Бездны. Глубокие ярусы древа открываются в следующих партиях.\nВраги становятся сильнее (в первой главе чуть-чуть, к Тронному залу на 2 уровня), награды растут. Каждая партия приносит искажение — Чёрный король меняет одно правило. Короны, древо, достижения, осколки и рекорд Бездны сохраняются.'));
    this.prestigeBtn.addEventListener('click', () => void this.onPrestige());
    this.treeBtn.addEventListener('click', () => openCrownTree(this.ctx));
    this.chronicleBtn.addEventListener('click', () => openChronicle(gameNumber(this.ctx.state),
      this.ctx.state.finale.beaten ? () => void playCredits(this.ctx.state) : undefined));
    this.prestigeCard.append(pHead, this.prestigeInfo, this.distortionInfo, this.prestigeBtn, this.treeBtn, this.chronicleBtn);

    const fHead = el('div', 'panel-head');
    fHead.append(el('span', 'panel-title', 'Край доски'), infoBtn('Край доски',
      'Конец истории: три боя подряд, один страшнее другого.\nВраги подстраиваются под силу вашей армии — помогут кузница, реликвии, древо и рулетка. Выигранные бои сохраняются.'));
    const fImg = el('img', 'finale-img');
    fImg.src = handUrl();
    fImg.alt = '';
    for (let i = 0; i < 3; i++) this.finalePips.append(el('span'));
    this.finaleBtn.addEventListener('click', () => {
      const f = this.ctx.state.finale;
      this.ctx.go('arena', finaleId(f.beaten ? 1 : f.phase + 1));
    });
    this.creditsBtn.addEventListener('click', () => void playCredits(this.ctx.state));
    this.finaleCard.append(fHead, fImg, this.finaleInfo, this.finalePips, this.finaleBtn, this.creditsBtn);

    side.append(treasury, this.abyssCard, relics, this.finaleCard, this.prestigeCard);
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
    document.body.dataset.chapter = String(chapter.id);
    const boss = chapter.levels[chapter.levels.length - 1];
    this.chapterBoss.src = spriteUrl(enemyPlacements(boss).find((p) => p.boss)?.kind ?? 'king', 'enemy');
    this.chapterBoss.title = boss.boss ?? '';
    setText(this.chapterTitle, chapter.name);
    setText(this.chapterSub, `${chapter.subtitle} · до ${chapter.limit} фигур в бою`);
    this.renderPath(chapter);
  }

  private revealing = false;

  /** The Hand's first appearance: a scene on its own board, once per save, then the card shows up. */
  private async reveal(): Promise<void> {
    if (this.revealing || document.querySelector('.stage-overlay, .modal-overlay')) return;
    this.revealing = true;
    try {
      await playReveal();
      this.ctx.state.tutorial.push(REVEAL_KEY);
      this.ctx.save();
      this.finaleCard.hidden = false;
      this.finaleCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.finaleCard.classList.add('just-opened');
    } finally {
      this.revealing = false;
    }
  }

  private async onPrestige(): Promise<void> {
    const s = this.ctx.state;
    if (!canPrestige(s)) return;
    const gain = crownsForPrestige(s);
    const ok = await confirmDialog('Новая партия',
      `Кампания, армия, уровни, постройки и реликвии начнутся заново, враги станут сильнее, Чёрный король принесёт новое искажение, `
      + `а награды вырастут. Вы получите ${gain} ♛ для Древа короны. `
      + `Короны, древо, рулетка, достижения и рекорд Бездны сохранятся.`, 'Начать');
    if (!ok) return;
    const got = prestige(s);
    this.ctx.save();
    audio.play('achievement');
    toast(`Партия ${s.prestige + 1}: +${got} корон!`, 'good');
    this.show();
    await playGameIntro(gameNumber(s));
  }

  private renderRelics(): void {
    const s = this.ctx.state;
    setText(this.relicCount, `${s.relics.length}/${RELIC_IDS.length}`);
    this.relicList.replaceChildren(s.relics.length
      ? relicStrip(s.relics)
      : el('p', 'hint', 'Пока нет. Первая — за босса главы.'));
  }

  private renderPath(chapter: ChapterDef): void {
    const s = this.ctx.state;
    const currentId = currentLevelId(s);
    this.path.replaceChildren(this.scene);
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
      if (level.id === currentId && open) {
        const king = el('img', 'map-king');
        king.src = spriteUrl('king', 'ally');
        king.alt = '';
        tile.append(king);
      }
      node.title = open ? `${level.name}: +${levelIncome(level.id)} золота/мин после победы` : 'Сначала пройдите предыдущий бой';
      node.addEventListener('click', () => this.ctx.go('arena', level.id));
      this.path.append(node);
    });
    this.sceneSig = '';
    requestAnimationFrame(() => this.drawScene());
  }

  /** Paint the chapter landscape with a road through the level tiles. */
  private drawScene(): void {
    const w = this.path.clientWidth;
    const h = this.path.clientHeight;
    if (!w || !h) return;
    const sig = `${this.chapter}|${w}|${h}`;
    if (sig === this.sceneSig) return;
    this.sceneSig = sig;
    const box = this.path.getBoundingClientRect();
    const centres = [...this.path.querySelectorAll<HTMLElement>('.level-tile')].map((t) => {
      const r = t.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2] as [number, number];
    });
    drawChapterScene(this.scene, this.chapter, w, h, centres);
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
      ? `+${rate < 100 ? Math.round(rate * 10) / 10 : fmt(rate)}/мин · до ${treasuryCapHours(s)} ч`
      : 'Пройдите бой, чтобы получать доход');
    this.collectBtn.disabled = amount < 1;
    this.relicBtn.hidden = s.relicPicks <= 0;
    const abyssOpen = isAbyssOpen(s);
    setText(this.abyssInfo, abyssOpen
      ? `Этаж ${s.abyss.floor} · рекорд ${s.abyss.best} · ◆ ${fmt(s.shards)}`
      : `🔒 После босса ${ABYSS_UNLOCK}`);
    this.abyssBtn.hidden = !abyssOpen;
    this.abyssCard.classList.toggle('locked', !abyssOpen);
    // The edge of the board is a secret until it opens with the Hand's own entrance.
    const fOpen = isFinaleOpen(s);
    const revealed = s.tutorial.includes(REVEAL_KEY) || s.finale.phase > 0 || s.finale.beaten;
    if (fOpen && !revealed) void this.reveal();
    this.finaleCard.hidden = !fOpen || !revealed;
    this.finaleCard.classList.toggle('beaten', s.finale.beaten);
    setText(this.finaleInfo, s.finale.beaten
      ? 'Рука опущена. Доска больше не переворачивается.'
      : `Над доской кто-то есть… Пройдено боёв: ${s.finale.phase} из 3`);
    [...this.finalePips.children].forEach((p, i) => p.classList.toggle('on', s.finale.beaten || i < s.finale.phase));
    setText(this.finaleBtn, s.finale.beaten ? 'Сразиться снова' : s.finale.phase ? `Фаза ${s.finale.phase + 1}` : 'Подняться к краю');
    this.creditsBtn.hidden = !s.finale.beaten;
    const ready = canPrestige(s);
    setText(this.prestigeInfo, ready
      ? `Получите +${crownsForPrestige(s)} ♛ · свободно ${s.crowns} ♛`
      : `Свободно ${s.crowns} ♛ · партия ${s.prestige + 1}`);
    this.prestigeBtn.hidden = !ready;
    this.treeBtn.hidden = s.prestige === 0 && s.crowns === 0 && s.crownTree.length === 0;
    // Not shown until there is something to say: the final boss is beaten or the tree is in play.
    this.prestigeCard.hidden = !ready && this.treeBtn.hidden;
    const distortion = distortionFor(gameNumber(s));
    this.distortionInfo.hidden = !distortion;
    if (distortion) setText(this.distortionInfo, `◆ ${DISTORTIONS[distortion].name}: ${DISTORTIONS[distortion].text}`);
    this.chronicleBtn.hidden = gameNumber(s) < 2;
    void (abyssOpen && this.ctx.tip('t_abyss', this.abyssBtn,
      'Открыта Бездна! Бесконечные этажи с наградами. Включите авто-спуск, чтобы армия спускалась сама.'));
    void (this.ctx.tip('t_relic', this.relicBtn, 'Вы заслужили реликвию! Выберите один из трёх постоянных бонусов.')
      || (rate > 0 && this.ctx.tip('t_treasury', this.treasuryCard,
        'Захваченные земли приносят золото в казну, даже когда игра закрыта. Забирайте его здесь.')));
    setText(this.relicBtn, `Выбрать реликвию (${s.relicPicks})`);
  }
}
