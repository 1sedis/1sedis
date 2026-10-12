import { CHAPTERS, finaleId, enemyPlacements } from '../../game/levels';
import { MAP_ROWS, availableNodes, boonText, endRun, enterNode, runMap, type RunNode } from '../../game/run';
import { NODE_HELP, NODE_ICON, livesRow, nodeLabel, openBattlePreview, openNodeDialog, openRunEnd } from '../runNodes';
import { iconUrl } from '../icons';
import { ARMIES } from '../../game/armies';
import { bossArtUrl, hasBossArt } from '../bossArt';
import { bossFor } from '../../game/bosses';
import { RELIC_IDS } from '../../game/relics';
import {
  PRESTIGE_UNLOCK, canPrestige, crownsForPrestige, enemyLevel, gameNumber, isFinaleOpen,
} from '../../game/state';
import type { Ctx, Screen } from '../context';
import { confirmDialog, el, infoBtn, setText, toast } from '../dom';
import { audio } from '../audio';
import { openRelicPicker, relicStrip } from '../relics';
import { spriteUrl } from '../sprites';
import { drawChapterScene } from '../mapArt';
import { openCrownTree } from '../crownTree';
import { openWheel } from '../roulette';
import { openChronicle, playGameIntro, playReveal } from '../story';
import { playCredits } from '../finale';
import { handUrl } from '../handArt';
import { DISTORTIONS, distortionsFor } from '../../game/distortions';
import { featureOpen } from '../../game/features';
import { t } from '../../i18n';

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
  private relicList = el('div');
  private relicCount = el('span');
  private relicBtn = el('button', 'btn btn-up');
  private relicsCard!: HTMLElement;
  private prestigeCard = el('div', 'card prestige-card');
  /** Wide screens: the run at a glance beside the map. */
  private runCard = el('div', 'card run-card');
  private prestigeInfo = el('div', 'side-info');
  private prestigeBtn = el('button', 'btn btn-up', t('Новая партия'));
  private treeBtn = el('button', 'btn btn-buy tree-btn', t('♛ Древо короны'));
  private wheelBtn = el('button', 'btn btn-up wheel-btn', t('◎ Колесо короны'));
  private chronicleBtn = el('button', 'btn btn-small chronicle-btn', t('Летопись'));
  private distortionInfo = el('div', 'distortion-info side-info');
  private finaleCard = el('div', 'card finale-card');
  private finaleInfo = el('div', 'side-info');
  private finalePips = el('div', 'finale-pips');
  private finaleBtn = el('button', 'btn btn-danger finale-btn');
  private creditsBtn = el('button', 'btn btn-small', t('Титры'));

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
    const relics = el('div', 'card relics-card');
    this.relicsCard = relics;
    const rHead = el('div', 'panel-head');
    rHead.append(el('span', 'panel-title', t('Реликвии')), this.relicCount, infoBtn(t('Реликвии'),
      t('Бонусы, меняющие правила боя, до конца забега.\nЗа каждого босса и каждую элиту вы выбираете одну из трёх; ещё их продаёт торговец и дарят события. Наведите на значок или нажмите на него, чтобы прочитать описание.')));
    this.relicBtn.addEventListener('click', () => openRelicPicker(this.ctx, () => this.renderRelics()));
    relics.append(rHead, this.relicList, this.relicBtn);

    const pHead = el('div', 'panel-head');
    pHead.append(el('span', 'panel-title', t('Короны')), infoBtn(t('Короны и партии'),
      t('Каждый забег, даже проигранный, приносит короны: по 1 за босса и 2 за победу в партии; ещё их дают достижения.\nКороны тратятся в «Древе короны» на доктрины или в «Колесе короны» на вечные дары (2 ♛ за крутку).\nГлубокие ярусы Древа открываются в следующих партиях.\nПобеда над Чёрным ферзём выигрывает партию: следующая будет труднее, Чёрный король принесёт новое искажение. Проигранный забег повторяет ту же партию с 1-1.')));
    this.prestigeBtn.addEventListener('click', () => void this.onPrestige());
    this.treeBtn.addEventListener('click', () => openCrownTree(this.ctx));
    this.wheelBtn.addEventListener('click', () => openWheel(this.ctx, () => this.renderRelics()));
    this.chronicleBtn.addEventListener('click', () => openChronicle(this.ctx.state, () => this.ctx.save(),
      this.ctx.state.finale.beaten ? () => void playCredits(this.ctx.state) : undefined));
    this.prestigeCard.append(pHead, this.prestigeInfo, this.distortionInfo, this.prestigeBtn, this.treeBtn, this.wheelBtn, this.chronicleBtn);

    const fHead = el('div', 'panel-head');
    fHead.append(el('span', 'panel-title', t('Край доски')), infoBtn(t('Край доски'),
      t('Конец истории: три боя подряд, один страшнее другого.\nВраги подстраиваются под силу вашей армии — помогут кузница, реликвии, древо и рулетка. Выигранные бои сохраняются, а поражение здесь забег не заканчивает.')));
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

    side.append(this.runCard, this.prestigeCard, relics, this.finaleCard);
    this.root.append(main, side);
  }

  show(): void {
    this.chapter = this.ctx.state.run.chapter;
    this.renderChapter();
    this.renderRelics();
    if (this.ctx.state.run.over) this.showRunEnd();
  }

  private renderChapter(): void {
    const s = this.ctx.state;
    this.chapter = s.run.chapter;
    const chapter = CHAPTERS[this.chapter - 1];
    this.root.dataset.theme = String(chapter.id);
    document.body.dataset.chapter = String(chapter.id);
    const boss = chapter.levels[chapter.levels.length - 1];
    const art = bossFor(boss.id);
    this.chapterBoss.src = hasBossArt(art) ? bossArtUrl(art) : spriteUrl(enemyPlacements(boss).find((p) => p.boss)?.kind ?? 'king', 'enemy');
    this.chapterBoss.title = boss.boss ?? '';
    setText(this.chapterTitle, chapter.name);
    setText(this.chapterSub, t('{sub} · до {n} фигур в бою', { sub: chapter.subtitle, n: chapter.limit }));
    const info = el('span', 'run-chapter', s.run.complete
      ? t('Партия {g} · кампания пройдена', { g: s.prestige + 1 })
      : t('Партия {g} · {army}', { g: s.prestige + 1, army: ARMIES[s.run.army ?? 'guard'].name }));
    const help = infoBtn(t('Карта главы'),
      t('Каждая глава — карта с развилками. Выбирайте путь: от узла можно идти только по дорогам вниз.\n⚔ Бой — золото. ☠ Элита — враги сильнее, зато реликвия. ? Событие — выбор с последствиями. Торговец продаёт реликвии и запасное знамя, в лагере можно заточить оружие или потренировать фигуру. В конце — босс.\nЖизнь одна: поражение заканчивает забег, и новый начнётся с 1-1 — с новой армией, но с коронами за пройденный путь. Запасное знамя (реликвия) даёт вторую жизнь.'));
    const right = el('span', 'run-right');
    right.append(livesRow(s), help);
    this.runInfo.replaceChildren(info, right);
    const boons = s.run.boons ?? [];
    if (boons.length) {
      const row = el('div', 'boon-row');
      for (const x of boons) {
        const good = x.atk * x.hp >= 1 && (x.foe ?? 1) <= 1;
        row.append(el('span', `boon-chip ${good ? 'good' : 'bad'}`, `${x.name}: ${boonText(x)}`));
      }
      this.runInfo.append(row);
    }
    this.renderRunCard();
    this.renderPath();
  }

  private renderRunCard(): void {
    const s = this.ctx.state;
    const army = ARMIES[s.run.army ?? 'guard'];
    const threat = s.run.threat ?? 0;
    const rows: HTMLElement[] = [
      el('div', 'panel-title', t('Забег')),
      el('div', 'run-card-army', army.name),
      el('div', 'run-card-rule', army.rule),
      el('div', 'run-card-line', t('Побед: {w} · элит: {e} · боссов: {b}', { w: s.run.wins, e: s.run.elites, b: s.run.bosses })),
    ];
    if (threat) rows.push(el('div', 'run-card-threat', t('☠ Угроза {n}', { n: threat })));
    for (const x of s.run.boons ?? []) {
      const good = x.atk * x.hp >= 1 && (x.foe ?? 1) <= 1;
      rows.push(el('div', `boon-chip ${good ? 'good' : 'bad'}`, `${x.name}: ${boonText(x)}`));
    }
    this.runCard.replaceChildren(...rows);
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
    const ok = await confirmDialog(t('Новая партия'),
      t('Забег закончится победой: вы получите {gain} ♛. Следующая партия начнётся с 1-1 с новой армией, враги станут сильнее, Чёрный король принесёт новое искажение. Финал этой армией будет недоступен.', { gain }), t('Начать'));
    if (!ok) return;
    endRun(s, true, PRESTIGE_UNLOCK);
    this.ctx.save();
    this.showRunEnd();
  }

  /** The run is over: its summary, then the next run (with the new game's chapter of the Chronicle after a win). */
  private showRunEnd(): void {
    if (document.querySelector('.run-end-modal')) return;
    const won = this.ctx.state.run.over?.won;
    openRunEnd(this.ctx, () => {
      this.show();
      if (won) {
        toast(t('Партия {g}', { g: this.ctx.state.prestige + 1 }), 'good');
        void playGameIntro(this.ctx.state, () => this.ctx.save());
      }
    });
  }

  private renderRelics(): void {
    const s = this.ctx.state;
    setText(this.relicCount, `${s.relics.length}/${RELIC_IDS.length}`);
    this.relicList.replaceChildren(s.relics.length
      ? relicStrip(s.relics)
      : el('p', 'hint', t('Пока нет. Их дают элита, боссы, торговцы и события. Действуют до конца забега.')));
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
        const art = bossFor(node.level!);
        img.src = hasBossArt(art) ? bossArtUrl(art) : spriteUrl(enemyPlacements(CHAPTERS[this.chapter - 1].levels[8]).find((p) => p.boss)?.kind ?? 'king', 'enemy');
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
      // How strong the enemies of a fight ahead are.
      if (node.level && !done) tile.append(el('span', 'node-lv', t('ур. {lv}', { lv: enemyLevel(s, node.level, node.kind === 'elite') })));
      btn.append(tile, el('div', 'level-name', nodeLabel(node)));
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
      // The rows you can step on now are brought to the middle of the screen.
      const cur = this.path.querySelector<HTMLElement>('.run-node.current');
      if (cur && cur.getBoundingClientRect().top > window.innerHeight * 0.6) cur.scrollIntoView({ block: 'center' });
    });
  }

  private onNode(node: RunNode): void {
    const s = this.ctx.state;
    // A fight is looked at before it is chosen: stepping on a node is final.
    if (node.level && s.run.at !== node.id) {
      audio.play('select');
      openBattlePreview(this.ctx, node, () => this.enter(node));
      return;
    }
    this.enter(node);
  }

  private enter(node: RunNode): void {
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
    this.relicsCard.hidden = !featureOpen(s, 'relics');
    this.relicBtn.hidden = s.relicPicks <= 0;
    // The edge of the board is a secret until it opens with the Hand's own entrance.
    const fOpen = isFinaleOpen(s);
    const revealed = s.tutorial.includes(REVEAL_KEY) || s.finale.phase > 0 || s.finale.beaten;
    if (fOpen && !revealed) void this.reveal();
    this.finaleCard.hidden = !fOpen || !revealed;
    this.finaleCard.classList.toggle('beaten', s.finale.beaten);
    setText(this.finaleInfo, s.finale.beaten
      ? t('Рука опущена. Доска больше не переворачивается.')
      : t('Над доской кто-то есть… Пройдено боёв: {n} из 3', { n: s.finale.phase }));
    [...this.finalePips.children].forEach((p, i) => p.classList.toggle('on', s.finale.beaten || i < s.finale.phase));
    setText(this.finaleBtn, s.finale.beaten ? t('Сразиться снова') : s.finale.phase ? t('Фаза {n}', { n: s.finale.phase + 1 }) : t('Подняться к краю'));
    this.creditsBtn.hidden = !s.finale.beaten;
    const ready = canPrestige(s);
    setText(this.prestigeInfo, ready
      ? t('Получите +{gain} ♛ · свободно {crowns} ♛', { gain: crownsForPrestige(s), crowns: s.crowns })
      : t('Свободно {crowns} ♛ · партия {g}', { crowns: s.crowns, g: s.prestige + 1 }));
    this.prestigeBtn.hidden = !ready;
    this.treeBtn.hidden = s.prestige === 0 && s.crowns === 0 && s.crownTree.length === 0;
    this.wheelBtn.hidden = this.treeBtn.hidden && s.roulette.spins === 0;
    setText(this.wheelBtn, s.roulette.offer ? t('◎ Колесо: выберите дар!') : s.roulette.free ? t('◎ Колесо: бесплатная крутка!') : t('◎ Колесо короны'));
    this.wheelBtn.classList.toggle('just-opened', !!s.roulette.offer || s.roulette.free > 0);
    // Not shown until there is something to say: the final boss is beaten or the tree is in play.
    this.prestigeCard.hidden = !ready && this.treeBtn.hidden;
    // Distortions of this game: the first chapters' ones, and those that join from chapter 3.
    const early = distortionsFor(gameNumber(s), 1);
    const late = distortionsFor(gameNumber(s), 3).filter((id) => !early.includes(id));
    this.distortionInfo.hidden = early.length + late.length === 0;
    setText(this.distortionInfo, [...early.map((id) => `◆ ${DISTORTIONS[id].name}`), ...late.map((id) => t('◆ {name} (с 3-й главы)', { name: DISTORTIONS[id].name }))].join('\n'));
    this.chronicleBtn.hidden = !s.tutorial.some((k) => /^lore_\d+$/.test(k));
    const forks = this.path.querySelectorAll<HTMLElement>('.run-node.current');
    void (forks.length > 1 && this.ctx.tip('t_fork', forks[0],
      t('Развилка! Выберите, куда вести армию: бой, элита с реликвией, событие, торговец или лагерь. Назад пути нет.')));
    void this.ctx.tip('t_relic', this.relicBtn, t('Вы заслужили реликвию! Выберите один из трёх бонусов до конца забега.'));
    setText(this.relicBtn, t('Выбрать реликвию ({n})', { n: s.relicPicks }));
  }
}
