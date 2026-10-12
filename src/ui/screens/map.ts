import { ABYSS_UNLOCK, CHAPTERS, abyssId, finaleId, enemyPlacements } from '../../game/levels';
import { MAP_ROWS, availableNodes, enterNode, runMap, type RunNode } from '../../game/run';
import { NODE_HELP, NODE_ICON, bannerRow, nodeLabel, openNodeDialog } from '../runNodes';
import { iconUrl } from '../icons';
import { RELIC_IDS } from '../../game/relics';
import {
  canPrestige, crownsForPrestige, gameNumber, isAbyssOpen, prestige, isFinaleOpen,
  collectTreasury, incomePerMinute, treasuryCap, treasuryCapHours,
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
import { DISTORTIONS, distortionsFor } from '../../game/distortions';
import { featureOpen } from '../../game/features';

const REVEAL_KEY = 'story_final_reveal';


export class MapScreen implements Screen {
  readonly root = el('section', 'map-screen');
  private chapter = 1;
  private runInfo = el('div', 'run-info');
  private edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
  private relicsCard!: HTMLElement;
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
    this.edges.classList.add('run-edges');
    main.append(this.runInfo, head, this.path);
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
    this.relicsCard = relics;
    const rHead = el('div', 'panel-head');
    rHead.append(el('span', 'panel-title', 'Реликвии'), this.relicCount, infoBtn('Реликвии',
      'Бонусы, меняющие правила боя, до конца партии.\nЗа каждого босса и каждую элиту вы выбираете одну из трёх; ещё их продаёт торговец и дарят события. Наведите на значок или нажмите на него, чтобы прочитать описание.'));
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
    this.chronicleBtn.addEventListener('click', () => openChronicle(this.ctx.state, () => this.ctx.save(),
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
    this.chapter = this.ctx.state.run.chapter;
    this.renderChapter();
    this.renderRelics();
  }

  private renderChapter(): void {
    const s = this.ctx.state;
    this.chapter = s.run.chapter;
    const chapter = CHAPTERS[this.chapter - 1];
    this.root.dataset.theme = String(chapter.id);
    document.body.dataset.chapter = String(chapter.id);
    const boss = chapter.levels[chapter.levels.length - 1];
    this.chapterBoss.src = spriteUrl(enemyPlacements(boss).find((p) => p.boss)?.kind ?? 'king', 'enemy');
    this.chapterBoss.title = boss.boss ?? '';
    setText(this.chapterTitle, chapter.name);
    setText(this.chapterSub, `${chapter.subtitle} · до ${chapter.limit} фигур в бою`);
    const info = el('span', 'run-chapter', s.run.complete
      ? `Партия ${s.prestige + 1} · кампания пройдена`
      : `Партия ${s.prestige + 1} · глава ${chapter.id} из ${CHAPTERS.length}`);
    const help = infoBtn('Карта главы',
      'Каждая глава — карта с развилками. Выбирайте путь: от узла можно идти только по дорогам вниз.\n'
      + '⚔ Бой — золото и звёзды. ☠ Элита — враги сильнее, зато реликвия. ? Событие — выбор с последствиями. '
      + 'Торговец продаёт реликвии, в лагере можно вернуть знамя или потренировать фигуру. В конце — босс.\n'
      + 'Знамёна: поражение снимает одно, бой можно переиграть. Без знамён глава начнётся заново на новой карте — '
      + 'с армией, золотом и реликвиями, как в начале главы.');
    const right = el('span', 'run-right');
    right.append(bannerRow(s.run.banners), help);
    this.runInfo.replaceChildren(info, right);
    this.renderPath();
  }

  private revealing = false;

  /** The Hand's first appearance: a scene on its own board, once per save, then the card shows up. */
  private async reveal(): Promise<void> {
    if (this.revealing || document.querySelector('.stage-overlay, .modal-overlay')) return;
    this.revealing = true;
    try {
      await playReveal(this.ctx.state, () => this.ctx.save());
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
    await playGameIntro(s, () => this.ctx.save());
  }

  private renderRelics(): void {
    const s = this.ctx.state;
    setText(this.relicCount, `${s.relics.length}/${RELIC_IDS.length}`);
    this.relicList.replaceChildren(s.relics.length
      ? relicStrip(s.relics)
      : el('p', 'hint', 'Пока нет. Их дают элита, боссы, торговцы и события.'));
  }

  private renderPath(): void {
    const s = this.ctx.state;
    const map = runMap(s.run);
    const open = new Set(availableNodes(s.run).map((n) => n.id));
    const last = s.run.at ?? s.run.done[s.run.done.length - 1];
    this.path.replaceChildren(this.scene, this.edges);
    this.path.style.gridTemplateRows = `repeat(${MAP_ROWS}, auto)`;
    this.path.classList.add('run-path');
    for (const node of map.nodes) {
      const done = s.run.done.includes(node.id);
      const can = open.has(node.id);
      const btn = el('button', `level-node run-node kind-${node.kind}`);
      btn.dataset.node = node.id;
      btn.style.gridColumn = String(node.lane + 1);
      btn.style.gridRow = String(node.row + 1);
      btn.classList.toggle('cleared', done);
      btn.classList.toggle('current', can);
      btn.classList.toggle('locked', !done && !can);
      btn.classList.toggle('boss', node.kind === 'boss');
      btn.disabled = !can;
      const tile = el('div', 'level-tile');
      if (node.kind === 'boss') {
        const img = el('img');
        img.src = spriteUrl(enemyPlacements(CHAPTERS[this.chapter - 1].levels[8]).find((p) => p.boss)?.kind ?? 'king', 'enemy');
        img.alt = '';
        tile.append(img);
      } else if (node.kind === 'battle') {
        tile.append(el('span', 'level-num', node.level!));
      } else {
        const img = el('img', 'node-icon');
        img.src = iconUrl(NODE_ICON[node.kind]);
        img.alt = '';
        tile.append(img);
      }
      const got = node.level ? s.stars[node.level] ?? 0 : 0;
      btn.append(tile, el('div', 'level-name', nodeLabel(node)), el('div', 'level-stars', done && node.level ? stars(got) : ''));
      if (node.id === last || (!last && node.row === 0)) {
        const king = el('img', 'map-king');
        king.src = spriteUrl('king', 'ally');
        king.alt = '';
        tile.append(king);
      }
      btn.title = NODE_HELP[node.kind];
      btn.addEventListener('click', () => this.onNode(node));
      this.path.append(btn);
    }
    this.sceneSig = '';
    requestAnimationFrame(() => {
      this.drawScene();
      this.drawEdges();
      this.path.querySelector<HTMLElement>('.run-node.current')?.scrollIntoView({ block: 'nearest' });
    });
  }

  private onNode(node: RunNode): void {
    const s = this.ctx.state;
    if (s.run.at !== node.id && !enterNode(s, node.id)) return;
    this.ctx.save();
    audio.play('select');
    if (node.level) {
      this.ctx.go('arena', node.level);
      return;
    }
    this.renderChapter();
    openNodeDialog(this.ctx, node, () => {
      this.renderChapter();
      this.renderRelics();
    });
  }

  /** Centre of a node tile inside the map. */
  private centre(id: string): [number, number] | null {
    const tile = this.path.querySelector<HTMLElement>(`[data-node="${id}"] .level-tile`);
    if (!tile) return null;
    const box = this.path.getBoundingClientRect();
    const r = tile.getBoundingClientRect();
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
  }

  /** Paths over the roads: the way already taken, and where the army can go next. */
  private drawEdges(): void {
    const s = this.ctx.state;
    const map = runMap(s.run);
    const w = this.path.clientWidth;
    const h = this.path.clientHeight;
    this.edges.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.edges.setAttribute('width', String(w));
    this.edges.setAttribute('height', String(h));
    const taken = new Set<string>();
    s.run.done.forEach((id, i) => { if (i > 0) taken.add(`${s.run.done[i - 1]}>${id}`); });
    if (s.run.at && s.run.done.length) taken.add(`${s.run.done[s.run.done.length - 1]}>${s.run.at}`);
    const lastDone = s.run.done[s.run.done.length - 1];
    const lines: string[] = [];
    for (const a of map.nodes) {
      for (const id of a.next) {
        const p = this.centre(a.id);
        const q = this.centre(id);
        if (!p || !q) continue;
        const cls = taken.has(`${a.id}>${id}`) ? 'taken' : !s.run.at && a.id === lastDone ? 'next' : '';
        if (cls) lines.push(`<line class="${cls}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`);
      }
    }
    this.edges.innerHTML = lines.join('');
  }

  /** Paint the chapter landscape with a road through the level tiles. */
  private drawScene(): void {
    const w = this.path.clientWidth;
    const h = this.path.clientHeight;
    if (!w || !h) return;
    const run = this.ctx.state.run;
    const sig = `${run.chapter}|${run.seed}|${w}|${h}`;
    if (sig === this.sceneSig) return;
    this.sceneSig = sig;
    const map = runMap(run);
    const centres = map.nodes.map((n) => this.centre(n.id)).filter((c): c is [number, number] => !!c);
    const edges: [[number, number], [number, number]][] = [];
    for (const a of map.nodes) {
      for (const id of a.next) {
        const p = this.centre(a.id);
        const q = this.centre(id);
        if (p && q) edges.push([p, q]);
      }
    }
    drawChapterScene(this.scene, this.chapter, w, h, centres, edges);
    this.drawEdges();
  }

  frame(): void {
    const s = this.ctx.state;
    this.treasuryCard.hidden = !featureOpen(s, 'treasury');
    this.relicsCard.hidden = !featureOpen(s, 'relics');
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
    // Distortions of this game: the first chapters' ones, and those that join from chapter 3.
    const early = distortionsFor(gameNumber(s), 1);
    const late = distortionsFor(gameNumber(s), 3).filter((id) => !early.includes(id));
    this.distortionInfo.hidden = early.length + late.length === 0;
    setText(this.distortionInfo, [...early.map((id) => `◆ ${DISTORTIONS[id].name}`), ...late.map((id) => `◆ ${DISTORTIONS[id].name} (с 3-й главы)`)].join('\n'));
    this.chronicleBtn.hidden = !s.tutorial.some((k) => /^lore_\d+$/.test(k));
    const forks = this.path.querySelectorAll<HTMLElement>('.run-node.current');
    void (forks.length > 1 && this.ctx.tip('t_fork', forks[0],
      'Развилка! Выберите, куда вести армию: бой, элита с реликвией, событие, торговец или лагерь. Назад пути нет.'));
    void (abyssOpen && this.ctx.tip('t_abyss', this.abyssBtn,
      'Открыта Бездна! Бесконечные этажи с наградами. Включите авто-спуск, чтобы армия спускалась сама.'));
    void (this.ctx.tip('t_relic', this.relicBtn, 'Вы заслужили реликвию! Выберите один из трёх постоянных бонусов.')
      || (rate > 0 && this.ctx.tip('t_treasury', this.treasuryCard,
        'Захваченные земли приносят золото в казну, даже когда игра закрыта. Забирайте его здесь.')));
    setText(this.relicBtn, `Выбрать реликвию (${s.relicPicks})`);
  }
}
