import {
  createBattle, legalMoves, playMove, resolveDecision, stepBattle, threatMap,
  type Battle, type BattleEvent, type Decision, type PlayerMove, type Unit,
} from '../../game/battle';
import { adviceLabel, adviseUpgrade } from '../../game/advice';
import { bestFormation } from '../../game/autoformation';
import { SYNERGIES, synergyProgress } from '../../game/synergies';
import { BOSSES, bossFor } from '../../game/bosses';
import { TERRAIN_INFO } from '../../game/terrain';
import { DISTORTIONS } from '../../game/distortions';
import { terrainUrl } from '../terrainArt';
import { traitUrl } from '../traitIcons';
import { TRAITS, traitAdjective } from '../../game/elites';
import { buildReport, pieceName } from '../../game/report';
import {
  CHAPTERS, UNLOCKED_BY, abyssFloor, abyssReward, chapterOf, finalePhase, firstReward, getLevel, isAbyss, isFinale,
  nextLevelId,
} from '../../game/levels';
import { ELITE_GOLD, RUN_GOLD, availableNodes, enterNode, lives } from '../../game/run';
import { ELITE_RULES } from '../../game/battle';
import { livesRow, openRunEnd } from '../runNodes';
import { bossArtUrl, hasBossArt } from '../bossArt';
import { ABILITIES, abilityTier } from '../../game/abilities';
import { shardsForFloor } from '../../game/altar';
import { PIECES, type PieceKind } from '../../game/pieces';
import {
  available, battleSetup, clearFormation, goldMultiplier, isEliteBattle, playerMoves, levelDistortions, terrainFor, commandLimit, fieldedCount, isLevelOpen, isPlayerCell,
  moveSlot, placeFromReserve, recordResult, removeSlot, sanitizeFormation, slotAt, upgradePiece, type BattleOutcome,
  type FormationSlot,
} from '../../game/state';
import { audio } from '../audio';
import { BoardView, type UnitView } from '../board';
import { openRelicPicker, relicStrip } from '../relics';
import { playLevelLore, playStory } from '../story';
import { playEnding, playFinaleScene } from '../finale';
import { skipScenes } from '../cutscene';
import { handUrl } from '../handArt';
import { openCodex } from '../codex';
import type { Ctx, Screen } from '../context';
import { el, infoBtn, openModal, setDisabled, setHidden, setText, toast } from '../dom';
import { fmt } from '../format';
import { saveSettings, type Settings } from '../settings';
import { FINALE_CROWNS } from '../../game/state';
import { featureOpen } from '../../game/features';
import { spriteUrl, type Tier } from '../sprites';

const TICK_MS = 100;
/** More pending ticks than this means we are catching up: skip effects. */
const LIVE_FX_LIMIT = 20;
const TRAY_ORDER: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];

type Phase = 'prep' | 'battle' | 'result';
type Selection = { kind: PieceKind; from: { x: number; y: number } | null } | null;

export class ArenaScreen implements Screen {
  readonly root = el('section', 'arena-screen');
  private board: BoardView;
  private levelId = '1-1';
  private phase: Phase = 'prep';
  private battle: Battle | null = null;
  private acc = 0;
  private selection: Selection = null;
  private slotKeys = new WeakMap<FormationSlot, string>();
  private nextSlotKey = 1;

  private title = el('h1', 'arena-title');
  private subtitle = el('div', 'arena-sub');
  private fightBtn = el('button', 'btn btn-primary');
  private speedBtns: { b: HTMLButtonElement; sp: Settings['speed'] }[] = [];
  /** The player's moves left this battle, as chess-clock tokens. */
  private movesEl = el('div', 'moves-tokens');
  /** The piece picked for a move (the battle is frozen meanwhile) and where it may go. */
  private movePick: number | null = null;
  private moveTargets: PlayerMove[] = [];
  /** The decision on screen: its deadline and how to close it. */
  private decisionUi: { decision: Decision; deadline: number; close: () => void } | null = null;
  /** Events from the player's own actions, shown on the next frame. */
  private pendingEvents: BattleEvent[] = [];
  private tray = el('div', 'tray');
  private trayItems = new Map<PieceKind, { btn: HTMLButtonElement; count: HTMLElement; img: HTMLImageElement }>();
  private trayTitle = el('span');
  private prepTools = el('div', 'tray-tools');
  private speedSeg = el('div', 'seg');
  private synergyRow = el('div', 'synergy-row');
  private bossBar = el('div', 'boss-bar');
  private bossName = el('span', 'boss-bar-name');
  private bossPhase = el('span', 'boss-bar-phase');
  private bossFill = el('div', 'boss-bar-fill');
  private bossInfo = el('div', 'boss-info');
  private distortionRow = el('div', 'boss-info distortion-info');
  /** performance.now() until which the boss intro plays and the battle waits. */
  private introUntil = 0;
  private terrainRow = el('div', 'terrain-row');
  private eliteRow = el('div', 'terrain-row elite-row');
  private synergySig = '';
  private autoBtn!: HTMLButtonElement;
  private threatSig = '';
  private infoPanel = el('div', 'side-stack');
  private battlePanel = el('div', 'side-stack');
  private limitText = el('b');
  private enemyText = el('div', 'info-line');
  private conditions = el('ul', 'conditions');
  private rewardText = el('div', 'info-line');
  private hintText = el('p', 'hint-text');
  private relicCard = el('div', 'task-relics');
  private relicSlot = el('div');
  private kingBars: Record<'ally' | 'enemy', { fill: HTMLElement; text: HTMLElement; name: HTMLElement }>;
  private battleTime = el('div', 'battle-time');
  private autoBtn2 = el('button', 'toggle');
  private autoDescend = false;
  private autoTimer: number | null = null;

  constructor(private ctx: Ctx) {
    this.board = new BoardView((x, y) => this.onCell(x, y));

    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', '← Карта');
    back.addEventListener('click', () => this.leave());
    const titles = el('div', 'arena-titles');
    titles.append(this.title, this.subtitle);
    const controls = el('div', 'controls');
    const seg = this.speedSeg;
    for (const sp of [1, 2, 4] as const) {
      const b = el('button', 'seg-btn', `×${sp}`);
      b.addEventListener('click', () => {
        this.ctx.settings.speed = sp;
        saveSettings(this.ctx.settings);
      });
      seg.append(b);
      this.speedBtns.push({ b, sp });
    }
    this.fightBtn.addEventListener('click', () => (this.phase === 'prep' ? this.startBattle() : this.retreat()));
    this.autoBtn2.title = 'После победы сразу спускаться на следующий этаж';
    this.autoBtn2.addEventListener('click', () => {
      this.autoDescend = !this.autoDescend;
    });
    this.movesEl.title = 'Ваши ходы в этом бою: нажмите на свою фигуру во время боя';
    controls.append(this.movesEl, seg, this.autoBtn2, this.fightBtn);
    top.append(back, titles, controls);

    // Board column with the reserve tray.
    const boardCol = el('div', 'board-col');
    const boardWrap = el('div', 'board-wrap');
    // Drifting motes around the board, styled per chapter.
    const ambient = el('div', 'ambient');
    for (let i = 0; i < 14; i++) {
      const m = el('span', 'mote');
      m.style.left = `${(i * 53) % 100}%`;
      m.style.animationDelay = `${-(i * 1.7) % 12}s`;
      m.style.animationDuration = `${9 + (i % 5) * 2}s`;
      m.style.setProperty('--drift', `${((i * 37) % 60) - 30}px`);
      ambient.append(m);
    }
    boardWrap.append(ambient, this.board.frame);
    const bossHead = el('div', 'boss-bar-head');
    bossHead.append(this.bossName, this.bossPhase);
    const bossTrack = el('div', 'boss-bar-track');
    bossTrack.append(this.bossFill, el('span', 'boss-bar-notch'));
    this.bossBar.append(bossHead, bossTrack);
    boardCol.append(this.bossBar);
    const trayPanel = el('div', 'bench-panel');
    const trayHead = el('div', 'panel-head');
    trayHead.append(el('span', 'panel-title', 'Резерв'), this.trayTitle);
    for (const kind of TRAY_ORDER) {
      const btn = el('button', 'bench-item');
      const img = el('img');
      img.src = spriteUrl(kind, 'ally');
      img.alt = PIECES[kind].name;
      const count = el('span', 'tray-count');
      btn.append(img, count);
      btn.title = `${PIECES[kind].name} — ${PIECES[kind].role}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTray(kind);
      });
      this.tray.append(btn);
      this.trayItems.set(kind, { btn, count, img });
    }
    const autoBtn = el('button', 'btn btn-small', 'Авто');
    this.autoBtn = autoBtn;
    autoBtn.title = 'Проверить 16 расстановок в симуляции и поставить лучшую';
    autoBtn.addEventListener('click', () => {
      bestFormation(this.ctx.state, this.levelId, this.limit());
      toast('Подобрана лучшая из 16 расстановок');
      this.selection = null;
    });
    const clearBtn = el('button', 'btn btn-small btn-ghost', 'Очистить');
    clearBtn.addEventListener('click', () => {
      clearFormation(this.ctx.state);
      this.selection = null;
    });
    this.prepTools.append(autoBtn, clearBtn);
    trayPanel.append(trayHead, this.tray, this.synergyRow, this.prepTools);
    trayPanel.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('button')) this.returnSelected();
    });
    boardCol.append(boardWrap, trayPanel);

    // Side: level info during prep, kings during battle.
    const side = el('aside', 'arena-side');
    const infoCard = el('div', 'card task-card');
    const taskHead = el('div', 'panel-head');
    const codexBtn = el('button', 'btn btn-ghost btn-small', 'Фигуры');
    codexBtn.addEventListener('click', () => openCodex(this.ctx.state));
    taskHead.append(el('span', 'panel-title', 'Задача'), codexBtn, infoBtn('Как играть',
      'Сразите вражеского короля. Если падёт ваш — бой проигран.\n'
      + 'Выберите фигуру в резерве и нажмите на клетку в трёх нижних рядах. Нажмите на свою фигуру, чтобы переставить её, или на резерв, чтобы убрать.\n'
      + 'Звёзды: победа, король сохранил не меньше 50% здоровья, потери не больше указанного.'));
    this.hintText.classList.add('task-hint');
    infoCard.append(taskHead, this.enemyText, this.distortionRow, this.bossInfo, this.eliteRow, this.conditions, this.rewardText, this.terrainRow, this.hintText, this.relicCard);
    this.infoPanel.append(infoCard);

    const kingsCard = el('div', 'card');
    kingsCard.append(el('div', 'panel-title', 'Короли'));
    const bar = (label: string, team: 'ally' | 'enemy') => {
      const row = el('div', `king-row ${team}`);
      const img = el('img');
      img.src = spriteUrl('king', team);
      const body = el('div', 'king-body');
      const head = el('div', 'king-head');
      const text = el('span');
      const name = el('span', '', label);
      head.append(name, text);
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      track.append(fill);
      body.append(head, track);
      row.append(img, body);
      kingsCard.append(row);
      return { fill, text, name };
    };
    this.kingBars = { ally: bar('Ваш король', 'ally'), enemy: bar('Чёрный король', 'enemy') };
    kingsCard.append(this.battleTime);
    this.battlePanel.append(kingsCard);
    side.append(this.infoPanel, this.battlePanel);

    const grid = el('div', 'arena-grid');
    grid.append(boardCol, side);
    this.root.append(top, grid);
  }

  private limit(): number {
    return commandLimit(this.ctx.state, this.levelId);
  }

  show(levelId?: string): void {
    if (levelId) this.levelId = levelId;
    if (!isLevelOpen(this.ctx.state, this.levelId)) {
      this.ctx.go('map');
      return;
    }
    this.enterPrep();
    const save = () => this.ctx.save();
    const cast = this.collectUnits();
    const s = this.ctx.state;
    const id = this.levelId;
    this.scene = isFinale(id)
      ? playFinaleScene(s, finalePhase(id), save, this.board, cast)
      // A chapter of the Chronicle (on its own board) comes before the Black King's lines.
      : playLevelLore(s, id, save).then(() => playStory(s, id, save, this.board, cast));
    const scene = this.scene;
    void scene.then(() => {
      if (this.scene === scene) this.scene = null;
    });
  }

  private enterPrep(): void {
    audio.setTrack('map');
    this.phase = 'prep';
    this.battle = null;
    this.cancelPick();
    this.decisionUi?.close();
    this.decisionUi = null;
    this.pendingEvents = [];
    this.selection = null;
    this.board.showBanner(null);
    this.board.clearFx();
    this.introUntil = 0;
    this.board.intro(null);
    this.board.setWarnings([]);
    this.setTimeLock(false);
    document.body.classList.remove('finale-hand');
    this.board.setCrowned(this.ctx.state.finale.beaten);
    sanitizeFormation(this.ctx.state, this.limit(), this.levelId);
    this.renderInfo();
  }

  /** Enemy placements as they will fight, including the new-game level bonus. */
  private enemies() {
    return battleSetup(this.ctx.state, this.levelId).enemies;
  }

  private renderInfo(): void {
    const s = this.ctx.state;
    const level = getLevel(this.levelId);
    const chapter = chapterOf(this.levelId);
    const abyss = isAbyss(this.levelId);
    const finale = isFinale(this.levelId);
    const eliteTitle = isEliteBattle(s, this.levelId) ? 'Элита · ' : '';
    setText(this.title, abyss ? `Бездна · ${level.name}` : finale ? `Финал · ${level.name}` : `${eliteTitle}${level.id} · ${level.name}`);
    setText(this.subtitle, abyss
      ? `Рекорд: этаж ${s.abyss.best}`
      : finale
        ? `${chapter.name} · фаза ${finalePhase(this.levelId)} из 3`
        : `Глава ${chapter.id}. ${chapter.name}${s.prestige ? ` · партия ${s.prestige + 1}` : ''}`);
    this.board.setTheme(chapter.id);
    this.root.dataset.theme = String(chapter.id);
    document.body.dataset.chapter = String(chapter.id);
    const terrain = terrainFor(s, this.levelId);
    this.board.setTerrain(terrain);
    const kinds = [...new Set(terrain)].filter((t) => t !== 'plain');
    const distortions = levelDistortions(s, this.levelId);
    this.distortionRow.hidden = distortions.length === 0;
    if (distortions.length) {
      this.distortionRow.replaceChildren(el('span', '', distortions.map((id) => `◆ ${DISTORTIONS[id].name}`).join('  ')),
        infoBtn('Искажения', distortions.map((id) => `${DISTORTIONS[id].name}: ${DISTORTIONS[id].text}`).join('\n')));
    }
    this.terrainRow.replaceChildren(...kinds.map((t) => {
      const chip = el('span', 'terrain-chip');
      const img = el('img');
      img.src = terrainUrl(t);
      img.alt = '';
      chip.append(img, TERRAIN_INFO[t].name);
      chip.title = TERRAIN_INFO[t].text;
      return chip;
    }));
    if (kinds.length) this.terrainRow.append(infoBtn('Ландшафт', kinds.map((t) => `${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`).join('\n')));
    this.terrainRow.hidden = kinds.length === 0;
    const elites = this.enemies().filter((p) => p.trait);
    this.eliteRow.hidden = elites.length === 0;
    this.eliteRow.replaceChildren(...elites.map((p) => {
      const chip = el('span', 'terrain-chip');
      const img = el('img');
      img.src = traitUrl(p.trait!);
      img.alt = '';
      chip.append(img, `${traitAdjective(p.trait!, p.kind)} ${PIECES[p.kind].name.toLowerCase()}`);
      chip.title = TRAITS[p.trait!].text;
      return chip;
    }));
    if (elites.length) {
      this.eliteRow.append(infoBtn('Элитные враги', [...new Set(elites.map((p) => p.trait!))]
        .map((t) => `${TRAITS[t].name[0]}: ${TRAITS[t].text}.`).join('\n') + '\nЭлиту видно по значку над фигурой.'));
    }
    const bossId = bossFor(this.levelId);
    const rule = battleSetup(s, this.levelId).eliteRule;
    this.bossInfo.hidden = !bossId && !rule;
    if (bossId) {
      const d = BOSSES[bossId];
      this.bossInfo.replaceChildren(el('span', '', `${d.passive ? `◆ ${d.passive} · ` : ''}★ ${d.skill} · ☠ ${d.rage}`), infoBtn(getLevel(this.levelId).boss ?? 'Босс',
        `У босса втрое больше здоровья.\n${d.passive ? `◆ ${d.passive}: ${d.passiveText}.\n` : ''}★ ${d.skill}: ${d.skillText}.\n☠ ${d.rage} (ниже 50% здоровья): ${d.rageText}.`));
    } else if (rule) {
      const r = ELITE_RULES[rule];
      this.bossInfo.replaceChildren(el('span', 'elite-rule', `☠ Элита: ${r.name}`), infoBtn(`Элита: ${r.name}`,
        `Правило этого боя: ${r.text}.\nВраги на уровень сильнее, за победу — реликвия.`));
    }
    const enemies = this.enemies();
    setText(this.enemyText, `Враги: ${enemies.length} · ур. ${enemies[0]?.level ?? level.level}${level.boss ? ` · ${level.boss}` : ''}`);
    const best = s.stars[level.id] ?? 0;
    this.conditions.innerHTML = '';
    this.conditions.hidden = abyss || finale;
    this.autoBtn2.hidden = !abyss;
    if (finale) {
      const phase = finalePhase(this.levelId);
      setText(this.rewardText, phase < 3
        ? 'Победа сохраняет прогресс финала'
        : s.finale.beaten ? 'Рука уже опущена — это бой на память' : `Награда: +${FINALE_CROWNS} ♛ и конец истории`);
      setText(this.hintText, level.hint);
      this.relicCard.hidden = s.relics.length === 0;
      this.relicSlot.replaceChildren(relicStrip(s.relics));
      return;
    }
    if (abyss) {
      const floor = abyssFloor(this.levelId);
      setText(this.rewardText, `Награда: +${fmt(Math.round(abyssReward(floor)))} золота · +${shardsForFloor(floor)} ◆`);
      setText(this.hintText, level.hint);
      this.relicCard.hidden = s.relics.length === 0;
      this.relicSlot.replaceChildren(relicStrip(s.relics));
      return;
    }
    for (const [i, text] of [
      'Победа',
      'Король ≥ 50%',
      `Потери ≤ ${level.maxLosses}`,
    ].entries()) {
      const li = el('li', best > i ? 'done' : '', `★ ${text}`);
      this.conditions.append(li);
    }
    const elite = isEliteBattle(s, level.id);
    const gold = Math.round(firstReward(level.id) * RUN_GOLD * (elite ? ELITE_GOLD : 1) * goldMultiplier(s) * (s.relics.includes('plunder') ? 1.3 : 1));
    setText(this.rewardText, `Награда: +${fmt(gold)} золота${elite || level.boss ? ' · реликвия' : ''}`
      + ` · ${lives(s) > 1 ? 'жизней: 2' : 'одна жизнь'}`);
    setText(this.hintText, level.hint);
    this.relicCard.hidden = s.relics.length === 0;
    this.relicSlot.replaceChildren(relicStrip(s.relics));
  }

  // ---------- Interaction ----------

  private onCell(x: number, y: number): void {
    if (this.phase === 'battle') {
      this.onBattleCell(x, y);
      return;
    }
    if (this.phase !== 'prep') return;
    const s = this.ctx.state;
    const slot = slotAt(s, x, y);
    const sel = this.selection;
    if (sel?.from) {
      if (sel.from.x === x && sel.from.y === y) this.selection = null;
      else if (isPlayerCell(x, y, this.levelId)) {
        moveSlot(s, sel.from.x, sel.from.y, x, y, this.levelId);
        this.selection = null;
      } else toast(isPlayerCell(x, y) ? 'Сюда нельзя: камень или вода' : 'Свои фигуры ставятся в три нижних ряда');
      return;
    }
    if (sel) {
      const err = placeFromReserve(s, sel.kind, x, y, this.limit(), this.levelId);
      if (err) toast(err);
      else if (available(s, sel.kind) <= 0) this.selection = null;
      return;
    }
    if (slot) {
      this.selection = { kind: slot.kind, from: { x, y } };
      return;
    }
    const enemy = this.enemies().find((p) => p.x === x && p.y === y);
    if (enemy) {
      const def = PIECES[enemy.kind];
      const tier = abilityTier(enemy.level + (battleSetup(this.ctx.state, this.levelId).enemyAbilityShift ?? 0));
      const ability = tier ? ` Приём «${ABILITIES[enemy.kind].name}»${tier === 2 ? ' (усилен)' : ''}.` : '';
      const elite = enemy.trait ? ` ${traitAdjective(enemy.trait, enemy.kind)}: ${TRAITS[enemy.trait].text}.` : '';
      toast(`${enemy.boss ? getLevel(this.levelId).boss : def.name}, ур. ${enemy.level}.${elite} ${def.description}${ability}`);
      return;
    }
    const t = terrainFor(this.ctx.state, this.levelId)[y * 8 + x];
    if (t !== 'plain') toast(`${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`);
  }

  // ---------- The player's moves in battle ----------

  /** Tap a piece of yours to freeze time and see its moves; tap a lit square to move there. */
  private onBattleCell(x: number, y: number): void {
    const b = this.battle;
    if (!b || b.result || b.decision || this.introUntil) return;
    const target = this.moveTargets.find((m) => m.x === x && m.y === y);
    if (this.movePick !== null && target) {
      const capture = target.type === 'capture';
      if (playMove(b, this.movePick, x, y)) {
        this.pendingEvents.push(...b.events);
        b.events = [];
        if (!this.ctx.state.tutorial.includes('t_moves')) this.ctx.state.tutorial.push('t_moves');
        this.guideTarget = null;
        audio.play(capture ? 'crit' : 'select');
        this.ctx.save();
      }
      this.cancelPick();
      return;
    }
    const own = b.units.find((u) => u.hp > 0 && u.side === 'ally' && u.x === x && u.y === y);
    if (own && b.movesLeft > 0 && own.uid !== this.movePick) {
      const moves = legalMoves(b, own.uid);
      if (moves.length) {
        this.movePick = own.uid;
        this.moveTargets = moves;
        this.board.setMoveTargets(moves);
        audio.play('click');
        return;
      }
    }
    if (own && b.movesLeft <= 0) toast('Ходы в этом бою кончились');
    this.cancelPick();
  }

  /**
   * The first battle with moves stops by itself a moment in, picks a piece
   * and lights its best square: the player only has to tap it.
   */
  private guideFirstMove(b: Battle): void {
    const s = this.ctx.state;
    if (s.tutorial.includes('t_moves') || b.result || b.decision || this.introUntil || b.movesLeft <= 0 || b.tick < 25) return;
    if (this.movePick === null) {
      const options = b.units.filter((u) => u.side === 'ally' && u.hp > 0).flatMap((u) => legalMoves(b, u.uid));
      const best = options.find((m) => m.type === 'capture')
        ?? options.filter((m) => b.units.find((u) => u.uid === m.uid)?.kind !== 'king').sort((p, q) => p.y - q.y)[0];
      if (!best) return;
      this.movePick = best.uid;
      this.moveTargets = legalMoves(b, best.uid);
      this.board.setMoveTargets(this.moveTargets);
      this.guideTarget = best;
    }
    const t = this.guideTarget;
    if (t) {
      this.ctx.tip('t_moves', this.board.cellNode(t.x, t.y),
        t.type === 'capture' ? 'Время замерло — твой ход! Нажми на клетку врага: взятие снимет его с доски.'
          : 'Время замерло — твой ход! Нажми на подсвеченную клетку.');
    }
  }

  private guideTarget: PlayerMove | null = null;

  private cancelPick(): void {
    this.guideTarget = null;
    if (this.movePick === null && !this.moveTargets.length) return;
    this.movePick = null;
    this.moveTargets = [];
    this.board.setMoveTargets(null);
  }

  /** Put the battle's pending decision on screen with a three-second timer. */
  private showDecision(d: Decision): void {
    const b = this.battle!;
    const text = DECISION_TEXT[d.kind];
    const options = d.options.map((id) => ({
      id,
      label: text.options[id] ?? id,
    }));
    // The first time each kind of decision comes up, say what the choice means.
    const key = `t_dec_${d.kind}`;
    const first = !this.ctx.state.tutorial.includes(key);
    if (first) this.ctx.state.tutorial.push(key);
    const close = this.board.showDecision(text.title, options, first ? DECISION_MS * 2 : DECISION_MS, (id) => this.answer(id), first ? text.hint : undefined);
    this.decisionUi = { decision: d, deadline: performance.now() + (first ? DECISION_MS * 2 : DECISION_MS), close };
    if (d.kind !== 'boss' || b.bossAsks <= 1) audio.play('warn');
  }

  private answer(id?: string): void {
    const b = this.battle;
    const ui = this.decisionUi;
    if (!b || !ui) return;
    ui.close();
    this.decisionUi = null;
    resolveDecision(b, id);
    this.pendingEvents.push(...b.events);
    b.events = [];
    if (id) audio.play('select');
  }

  private onTray(kind: PieceKind): void {
    if (this.phase !== 'prep') return;
    if (this.selection?.from) {
      this.returnSelected();
      return;
    }
    if (this.selection?.kind === kind) {
      this.selection = null;
      return;
    }
    if (available(this.ctx.state, kind) <= 0) {
      toast(this.ctx.state.army[kind] === 0 ? `${PIECES[kind].name}: наймите в лагере` : 'Все такие фигуры уже на доске');
      return;
    }
    this.selection = { kind, from: null };
    audio.play('select');
  }

  private returnSelected(): void {
    const from = this.selection?.from;
    if (!from || this.phase !== 'prep') return;
    if (!removeSlot(this.ctx.state, from.x, from.y)) toast('Король всегда участвует в бою');
    this.selection = null;
  }

  /** A scene playing on the board; the battle waits for it. */
  private scene: Promise<void> | null = null;

  private startBattle(): void {
    if (this.scene) return;
    const s = this.ctx.state;
    sanitizeFormation(s, this.limit(), this.levelId);
    if (fieldedCount(s) === 0) {
      toast('Поставьте на доску хотя бы одну фигуру');
      return;
    }
    this.selection = null;
    this.battle = createBattle({ ...battleSetup(s, this.levelId), playerMoves: playerMoves(s, this.levelId), decisions: true });
    this.cancelPick();
    this.phase = 'battle';
    audio.setTrack(getLevel(this.levelId).boss ? 'boss' : 'battle');
    this.acc = 0;
    const bossId = this.battle.bossId;
    if (bossId && !(isAbyss(this.levelId) && this.autoDescend)) {
      const boss = this.battle.units.find((u) => u.uid === this.battle!.bossUid)!;
      this.board.intro({
        name: getLevel(this.levelId).boss ?? 'Босс',
        sprite: bossId === 'hand' ? handUrl() : hasBossArt(bossId) ? bossArtUrl(bossId) : spriteUrl(boss.kind, 'enemy', boss.tier as Tier),
        skill: BOSSES[bossId].skill, rage: BOSSES[bossId].rage,
      });
      this.introUntil = performance.now() + 2200;
      audio.play('roar');
    } else if (this.battle.eliteRule) {
      // Elites announce their rule.
      this.board.callout(`☠ ${ELITE_RULES[this.battle.eliteRule].name}`, 'rage');
      audio.play('warn');
    } else audio.play('start');
    document.body.classList.toggle('finale-hand', bossId === 'hand');
    this.ctx.save();
  }

  private retreat(): void {
    this.enterPrep();
    toast('Отступили. Бой не засчитан');
  }

  private leave(): void {
    skipScenes();
    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    if (this.phase === 'battle' || isAbyss(this.levelId)) this.enterPrep();
    this.ctx.go('map');
  }

  private finish(): void {
    const b = this.battle!;
    const outcome = recordResult(this.ctx.state, this.levelId, b);
    this.ctx.save();
    this.phase = 'result';
    this.board.showBanner(outcome.win ? 'Победа' : 'Поражение', outcome.win);
    audio.play(outcome.win ? 'win' : 'lose');
    // Auto-descent: skip the dialog and go straight to the next floor.
    if (outcome.win && isAbyss(this.levelId) && this.autoDescend && outcome.relicsEarned === 0) {
      toast(`Этаж ${abyssFloor(this.levelId)}: +${fmt(outcome.reward)} золота, +${outcome.shards} ◆`, 'good');
      this.autoTimer = window.setTimeout(() => {
        this.autoTimer = null;
        if (!this.root.isConnected || this.root.closest('[hidden]') || this.phase !== 'result') return;
        this.show(nextLevelId(this.levelId)!);
        this.startBattle();
      }, 1300);
      return;
    }
    if (outcome.ending) {
      this.setTimeLock(false);
      setTimeout(() => {
        this.board.showBanner(null);
        void playEnding(this.ctx.state, this.board, this.collectUnits()).then(() => this.showResult(outcome));
      }, 1400);
      return;
    }
    setTimeout(() => {
      this.showResult(outcome);
      if (outcome.relicsEarned > 0) setTimeout(() => openRelicPicker(this.ctx), 500);
    }, 700);
  }

  /** "Рука держит время": during the Hand's rage the speed cannot be raised. */
  private timeLocked = false;

  private setTimeLock(on: boolean): void {
    if (this.timeLocked === on) return;
    this.timeLocked = on;
    document.body.classList.toggle('glitch', on);
    for (const { b } of this.speedBtns) b.classList.toggle('locked', on);
  }

  private showResult(o: BattleOutcome): void {
    const level = getLevel(this.levelId);
    const content = el('div', `result ${o.win ? 'is-win' : 'is-loss'}`);
    content.append(el('h2', `result-title ${o.win ? 'win' : 'loss'}`, o.win ? 'Победа!' : o.runOver ? 'Забег окончен' : 'Поражение'));
    if (o.win) {
      // Falling pixel confetti over the dialog.
      const confetti = el('div', 'confetti');
      const colours = ['#3ee6c1', '#ffcf4a', '#ff5d85', '#9b6bff', '#ffffff'];
      for (let i = 0; i < 36; i++) {
        const c = el('span');
        c.style.left = `${(i * 29) % 100}%`;
        c.style.background = colours[i % colours.length];
        c.style.animationDelay = `${(i % 12) * 0.08}s`;
        c.style.animationDuration = `${1.4 + (i % 5) * 0.25}s`;
        c.style.setProperty('--sway', `${((i * 17) % 40) - 20}px`);
        confetti.append(c);
      }
      content.append(confetti);
    }
    const starRow = el('div', 'result-stars');
    if (o.win) starRow.append(el('div', 'result-rays'));
    for (let i = 0; i < 3; i++) {
      const st = el('span', i < o.stars ? 'on' : '', '★');
      st.style.animationDelay = `${0.15 + i * 0.2}s`;
      if (i < o.stars) audio.play('star', 0.15 + i * 0.2);
      starRow.append(st);
    }
    content.append(starRow);
    const list = el('ul', 'conditions');
    const items: [boolean, string][] = [
      [o.conditions.win, 'Победа'],
      [o.conditions.king, 'Король ≥ 50%'],
      [o.conditions.losses, `Потери ${this.battle?.allyLosses ?? 0} из ${level.maxLosses}`],
    ];
    for (const [ok, text] of items) list.append(el('li', ok ? 'done' : 'fail', `${ok ? '✓' : '✗'} ${text}`));
    content.append(list);
    if (this.battle) content.append(this.reportView(o.win));

    if (o.relicsEarned > 0) content.append(el('div', 'result-unlock relic', 'Новая реликвия! Выберите одну из трёх.'));
    if (isFinale(this.levelId)) {
      if (o.ending) content.append(el('div', 'result-reward', `+${FINALE_CROWNS} ♛ · трофейная корона на вашем короле`));
      else if (o.win && nextLevelId(this.levelId)) content.append(el('div', 'result-unlock', 'Фаза пройдена — прогресс сохранён. Дальше будет хуже.'));
      else if (!o.win) content.append(el('div', 'result-unlock', 'Рука ждёт. Улучшите армию — враги финала растут вместе с ней, но реликвии, кузница и древо — нет.'));
    } else if (o.win) {
      content.append(el('div', 'result-reward', `+${fmt(o.reward)} золота`));
      if (o.trophy) content.append(el('div', 'result-unlock relic', 'Трофей: бесплатная крутка Колеса короны'));
      if (o.firstClear) {
        const unlocked = (Object.keys(UNLOCKED_BY) as PieceKind[]).find((k) => UNLOCKED_BY[k] === this.levelId);
        if (unlocked) content.append(el('div', 'result-unlock', `Новая фигура: ${PIECES[unlocked].name}! Наймите в лагере.`));
      }
      if (o.chapterDone) {
        const s = this.ctx.state;
        content.append(el('div', 'result-unlock', s.run.complete
          ? 'Чёрный ферзь пал — кампания этой партии пройдена!'
          : `Глава пройдена! Впереди глава ${s.run.chapter}: ${CHAPTERS[s.run.chapter - 1].name}.`));
      }
    } else {
      if (o.reward > 0 && !o.runOver) {
        content.append(el('div', 'result-reward small',
          `+${fmt(o.reward)} золота за ${Math.round(o.damageShare * 100)}% урона врагу`));
      }
      // Right under the conditions, so it is seen before the long report.
      if (o.runOver) {
        list.after(el('div', 'result-unlock loss-banners run-over', 'Король пал — забег окончен.'));
      } else if (o.spared) {
        const line = el('div', 'result-unlock loss-banners', 'Запасное знамя сгорело вместо вас — бой можно переиграть. Осталась одна жизнь. ');
        line.append(livesRow(this.ctx.state));
        list.after(line);
      }
    }

    const actions = el('div', 'modal-actions result-actions');
    const close = openModal(content, { dismissable: false, cls: 'result-modal' });
    if (!o.win && !o.runOver) content.append(this.adviceView(close));
    const button = (label: string, cls: string, fn: () => void) => {
      const b = el('button', `btn ${cls}`, label);
      b.addEventListener('click', () => {
        close();
        fn();
      });
      actions.append(b);
    };
    const campaign = !isAbyss(this.levelId) && !isFinale(this.levelId);
    if (o.runOver) {
      // A dead run: one way on — the summary, then a new run from 1-1.
      button('Итоги забега ▶', 'btn-primary', () => {
        this.enterPrep();
        openRunEnd(this.ctx, () => this.ctx.go('map'));
      });
      content.append(actions);
      return;
    }
    if (!campaign || (!o.win && !o.spared)) {
      button('Карта', 'btn-ghost', () => {
        this.enterPrep();
        this.ctx.go('map');
      });
    }
    if (campaign) {
      // The run map decides where to go next; a loss saved by a spare banner retries the same battle.
      button('Улучшения', '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      const ahead = availableNodes(this.ctx.state.run);
      if (!o.win) button('Ещё раз', 'btn-primary', () => this.enterPrep());
      else if (o.win && !o.chapterDone && ahead.length === 1 && ahead[0].level) {
        // No fork ahead (the first lessons): straight on to the next battle.
        button('Дальше ▶', 'btn-primary', () => {
          enterNode(this.ctx.state, ahead[0].id);
          this.show(ahead[0].level!);
        });
      } else button('К карте ▶', 'btn-primary', () => {
        this.enterPrep();
        this.ctx.go('map');
      });
    } else if (o.win) {
      button('Улучшения', '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      if (!isAbyss(this.levelId)) button('Переиграть', '', () => this.enterPrep());
      const next = nextLevelId(this.levelId);
      if (next) button('Дальше ▶', 'btn-primary', () => this.show(next));
    } else {
      button('Улучшения', '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      button('Ещё раз', 'btn-primary', () => this.enterPrep());
    }
    content.append(actions);
  }

  /** On a loss: the upgrade that helps most here, found by simulation, with a buy button. */
  private adviceView(close: () => void): HTMLElement {
    const s = this.ctx.state;
    const box = el('div', 'advice');
    const a = adviseUpgrade(s, this.levelId);
    if (!a) return box;
    box.append(el('img', 'advice-icon'));
    (box.firstChild as HTMLImageElement).src = spriteUrl(a.kind, 'ally');
    const body = el('div', 'advice-body');
    body.append(el('div', 'advice-title', `Совет: ${adviceLabel(a)}`));
    body.append(el('div', 'advice-sub', a.wins
      ? 'С этим улучшением та же расстановка побеждает.'
      : 'Даст больше всего силы именно в этом бою.'));
    box.append(body);
    const affordable = s.gold >= a.cost;
    const buy = el('button', 'btn btn-up btn-small', affordable ? `Улучшить · ${fmt(a.cost)}` : `Нужно ${fmt(a.cost)}`);
    buy.disabled = !affordable;
    buy.addEventListener('click', () => {
      if (!upgradePiece(s, a.kind)) return;
      audio.play('levelup');
      this.ctx.save();
      toast(`${adviceLabel(a)}`, 'good');
      close();
      this.enterPrep();
    });
    box.append(buy);
    if (!affordable) box.append(el('div', 'advice-sub advice-wide', 'Золото дают победы на карте — элита платит больше.'));
    return box;
  }

  /** Composition bonuses: active ones lit, the rest dim with progress. */
  private renderSynergies(prep: boolean): void {
    this.synergyRow.hidden = !prep || !featureOpen(this.ctx.state, 'synergies');
    if (!prep) return;
    const kinds = this.ctx.state.formation.map((f) => f.kind);
    const progress = synergyProgress(kinds, this.ctx.state.crownTree.includes('heralds') ? 1 : 0);
    const sig = progress.map((p) => p.have).join(',');
    if (sig === this.synergySig) return;
    const wasActive = new Set([...this.synergyRow.querySelectorAll<HTMLElement>('.synergy.active')].map((n) => n.dataset.id));
    const first = this.synergySig === '';
    this.synergySig = sig;
    this.synergyRow.replaceChildren(...progress.map(({ def, have, need, active }) => {
      const chip = el('span', `synergy${active ? ' active' : ''}`, active ? `✦ ${def.name}` : `${def.name} ${have}/${need}`);
      chip.dataset.id = def.id;
      chip.title = def.description;
      if (active && !first && !wasActive.has(def.id)) chip.classList.add('pop');
      return chip;
    }), this.synergyInfo);
  }

  private synergyInfo = infoBtn('Синергии', () => `Бонусы за состав армии на доске:\n${SYNERGIES.map((d) => `${d.name}: ${d.description}.`).join('\n')}`);

  /** The first time an ally uses an ability, explain where abilities come from. */
  private firstAbility(events: BattleEvent[]): void {
    const s = this.ctx.state;
    if (s.tutorial.includes('t_ability_seen')) return;
    const e = events.find((ev) => ev.type === 'ability' && ev.side === 'ally');
    if (!e?.fromKind) return;
    s.tutorial.push('t_ability_seen');
    toast(`${PIECES[e.fromKind].name}: приём «${e.label}»! На 5-м уровне фигура выбирает один из двух приёмов`, 'good');
  }

  // ---------- Frame ----------

  frame(dt: number): void {
    const speed = this.timeLocked ? 1 : this.ctx.settings.speed;
    let events: BattleEvent[] = [];
    if (this.introUntil && performance.now() >= this.introUntil) {
      this.introUntil = 0;
      this.board.intro(null);
      audio.play('start');
    }
    const b = this.battle;
    if (this.phase === 'battle' && b && this.decisionUi && performance.now() >= this.decisionUi.deadline) this.answer();
    if (this.phase === 'battle' && b) this.guideFirstMove(b);
    // Time stands still while the player picks a move or decides.
    const frozen = this.movePick !== null || !!b?.decision;
    if (this.phase === 'battle' && b && !this.introUntil && !frozen) {
      this.acc += dt * speed;
      const live = this.acc / TICK_MS < LIVE_FX_LIMIT;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < 2000 && this.phase === 'battle' && !b.decision) {
        this.acc -= TICK_MS;
        stepBattle(b);
        if (live) events.push(...b.events);
        if (b.result) this.finish();
        steps++;
      }
      if (!live) events = [];
      if (b.decision) this.acc = 0;
    }
    if (this.phase === 'battle' && this.battle?.decision && !this.decisionUi) this.showDecision(this.battle.decision);
    if (this.pendingEvents.length) {
      events = [...this.pendingEvents, ...events];
      this.pendingEvents = [];
    }
    this.render(events, speed);
  }

  private render(events: BattleEvent[], speed: number): void {
    const s = this.ctx.state;
    const prep = this.phase === 'prep';
    this.board.setMode(prep, this.selection !== null);
    this.board.setStep(180 / speed);
    this.board.setFxLevel(speed >= 4 ? 0 : speed >= 2 ? 1 : 2);
    this.board.render(this.collectUnits());
    if (events.length) {
      this.barks(events);
      this.handEvents(events);
      this.bossEvents(events);
      this.firstAbility(events);
      this.board.react(events, (uid) => `b${uid}`, this.ctx.settings.effects && events.length <= 60);
      playBattleSounds(events);
    }
    if (events.length && this.ctx.settings.effects && events.length <= 60) this.board.fx(events);

    const total = playerMoves(s, this.levelId);
    const left = this.battle && !prep ? this.battle.movesLeft : total;
    const tokens = `${left}/${total}`;
    if (this.movesEl.dataset.left !== tokens) {
      this.movesEl.dataset.left = tokens;
      this.movesEl.replaceChildren(el('span', 'moves-label', 'Ходы'),
        ...Array.from({ length: total }, (_, i) => el('span', `move-token${i < left ? ' on' : ''}`)));
    }
    this.movesEl.classList.toggle('active', !prep && left > 0);
    if (!prep && left > 0 && left < total && this.movePick === null) {
      void this.ctx.tip('t_tokens', this.movesEl, `Это твои ходы: осталось ${left}. Нажми на свою фигуру, когда захочешь сходить.`);
    }
    setText(this.fightBtn, prep ? '▶ В бой' : '■ Отступить');
    setText(this.autoBtn2, `Авто-спуск: ${this.autoDescend ? 'вкл' : 'выкл'}`);
    this.autoBtn2.classList.toggle('on', this.autoDescend);
    this.fightBtn.classList.toggle('btn-danger', !prep);
    setDisabled(this.fightBtn, this.phase === 'result');
    this.speedBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === speed));
    setHidden(this.infoPanel, !prep);
    setHidden(this.battlePanel, prep);
    setHidden(this.prepTools, !prep);
    // Parts of the screen a new player has not met yet stay out of the way.
    setHidden(this.speedSeg, !featureOpen(s, 'speed'));
    setHidden(this.autoBtn, !featureOpen(s, 'auto'));
    setHidden(this.movesEl, !featureOpen(s, 'moves'));

    const limit = this.limit();
    setText(this.limitText, `${fieldedCount(s)}/${limit}`);
    setText(this.trayTitle, prep ? `На доске ${fieldedCount(s)}/${limit} + король` : 'Идёт бой');
    this.renderSynergies(prep);
    for (const [kind, item] of this.trayItems) {
      const avail = available(s, kind);
      const src = spriteUrl(kind, 'ally', abilityTier(s.levels[kind]) as Tier);
      if (item.img.src !== src) item.img.src = src;
      setText(item.count, `×${avail}`);
      setHidden(item.btn, s.army[kind] === 0);
      setDisabled(item.btn, !prep);
      item.btn.classList.toggle('selected', this.selection?.kind === kind && !this.selection.from);
      item.btn.classList.toggle('empty', avail <= 0);
    }

    if (prep) {
      this.updateThreats();
      this.tips();
    } else if (this.threatSig) {
      this.threatSig = '';
      this.board.setThreats(null);
    }

    if (this.battle) {
      setText(this.kingBars.enemy.name, this.levelId === 'final-3' ? 'Рука над доской' : this.levelId === 'final-2' ? 'Тень полководца' : 'Чёрный король');
      for (const side of ['ally', 'enemy'] as const) {
        const king = this.battle.units.find((u) => u.side === side && u.kind === 'king');
        const ratio = king ? Math.max(0, king.hp) / king.maxHp : 0;
        const w = `${ratio * 100}%`;
        if (this.kingBars[side].fill.style.width !== w) this.kingBars[side].fill.style.width = w;
        setText(this.kingBars[side].text, `${Math.round(ratio * 100)}%`);
      }
      setText(this.battleTime, `Время боя: ${Math.floor(this.battle.tick / 10)} с · потери: ${this.battle.allyLosses}`);
    }
    this.renderBossBar();
  }

  private renderBossBar(): void {
    const b = this.battle;
    const boss = b?.units.find((u) => u.uid === b.bossUid);
    setHidden(this.bossBar, !b?.bossId || this.phase === 'prep');
    if (this.bossBar.hidden || !b) return;
    const ratio = boss ? Math.max(0, boss.hp) / boss.maxHp : 0;
    const bw = `${ratio * 100}%`;
    if (this.bossFill.style.width !== bw) this.bossFill.style.width = bw;
    setText(this.bossName, getLevel(this.levelId).boss ?? 'Босс');
    setText(this.bossPhase, ratio <= 0 ? 'Повержен' : b.bossPhase === 2 ? `☠ ${BOSSES[b.bossId!].rage}` : `${Math.ceil(ratio * 100)}%`);
    this.bossBar.classList.toggle('enraged', b.bossPhase === 2);
    this.board.setWarnings(b.warnings.flatMap((w) => w.cells));
  }

  private lastBark = 0;
  private barked = new Set<string>();

  /** Short lines the pieces shout in battle: bosses in rage, kings in danger, the Hand at work. */
  private barks(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b) return;
    const now = performance.now();
    if (b.tick <= 3) this.barked.clear();
    const shout = (key: string | null, x: number, y: number, text: string, team: 'ally' | 'enemy' | 'hand', force = false) => {
      if (key && this.barked.has(key)) return;
      if (!force && now - this.lastBark < 2500) return;
      if (key) this.barked.add(key);
      this.lastBark = now;
      this.board.bark(x, y, text, team);
    };
    for (const e of events) {
      if (e.type === 'rage' && b.bossId) {
        shout('rage', e.x, e.y, RAGE_LINES[b.bossId] ?? 'Ярость!', b.bossId === 'hand' ? 'hand' : 'enemy', true);
      } else if (e.type === 'boss' && b.bossId === 'hand' && e.label && HAND_LINES[e.label]) {
        shout(null, e.x, e.y, HAND_LINES[e.label]!, 'hand');
      } else if (e.type === 'promote' && e.side === 'ally') {
        shout('promote', e.x, e.y, 'Я — ферзь!', 'ally');
      } else if (e.type === 'save' && e.side === 'ally') {
        shout('save', e.x, e.y, 'Ещё не конец!', 'ally', true);
      }
    }
    for (const u of b.units) {
      if (u.kind !== 'king' || u.hp <= 0 || u.boss) continue;
      if (u.side === 'ally' && u.hp < u.maxHp * 0.3) shout('ally-king', u.x, u.y, 'Ко мне, стража!', 'ally');
      if (u.side === 'enemy' && u.hp < u.maxHp * 0.3) shout('enemy-king', u.x, u.y, 'Нет… не сейчас!', 'enemy');
    }
    if (this.levelId === 'final-2' && b.tick >= 20) {
      const bk = b.units.find((u) => u.side === 'ally' && u.boss && u.kind === 'king' && u.hp > 0);
      if (bk) shout('bk-ally', bk.x, bk.y, 'За Белого короля!', 'enemy');
    }
  }

  /** The Hand moves pieces and turns the board over; its rage locks the speed. */
  private handEvents(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b) return;
    for (const e of events) {
      if (e.type === 'order' && e.label && e.label !== 'Ход') this.board.callout(e.label, 'skill');
      if (e.type === 'hand') {
        this.board.handGrab(e.fromX, e.fromY, e.x, e.y);
        if (!b.bossId) this.board.callout('Рука переставляет фигуру!', 'skill');
      } else if (e.type === 'flip') {
        this.board.flip();
        this.board.setTerrain(b.terrain);
      } else if (e.type === 'rage' && b.bossId === 'hand') {
        this.setTimeLock(true);
        toast('Рука держит время: ускорение недоступно');
      }
    }
  }

  /** Callouts for boss skills, rage, new rocks and the boss falling. */
  private bossEvents(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b?.bossId) return;
    for (const e of events) {
      if (e.type === 'boss') this.board.callout(`${e.label}!`, 'skill');
      else if (e.type === 'rage') this.board.callout(`Ярость: ${e.label}`, 'rage');
      else if (e.type === 'terrain') this.board.setTerrain(b.terrain);
      else if (e.type === 'death' && e.uid === b.bossUid) {
        this.board.callout(b.bossId === 'hand' ? 'Рука опущена!' : 'Босс повержен!', 'down');
        audio.play('bossDown');
      }
    }
  }

  /** Recompute the threat overlay only when the formation or level changes. */
  private updateThreats(): void {
    const sig = `${this.levelId}|${this.ctx.state.formation.map((f) => `${f.kind}${f.x}${f.y}`).join()}`;
    if (sig === this.threatSig) return;
    this.threatSig = sig;
    this.board.setThreats(threatMap(battleSetup(this.ctx.state, this.levelId)));
  }

  /** Lessons while setting up, one at a time, in the order a new player needs them. */
  private tips(): void {
    const { ctx, board } = this;
    const s = ctx.state;
    const freeReserve = [...this.trayItems.values()].find((i) => !i.btn.hidden && !i.btn.classList.contains('empty'))?.btn;
    // A free square in the front row, as close to the centre as possible, for the first placement.
    const spot = [3, 4, 2, 5, 1, 6].map((x) => [x, 5] as const).find(([x, y]) => isPlayerCell(x, y, this.levelId) && !slotAt(s, x, y));
    const firstWin = (s.stars['1-1'] ?? 0) > 0;
    void ((freeReserve && spot && ctx.tip('t_reserve', freeReserve,
      'Нажми на пешку в резерве, потом на клетку — поставь её в строй.', board.cellNode(spot[0], spot[1])))
      || ctx.tip('t_fight', this.fightBtn, 'Армия готова. В бой!')
      || (firstWin && ctx.tip('t_king', board.unitNode('ally', 'king'),
        'Твой король. Падёт он — бой проигран. Фигуры рядом с ним бьют сильнее.'))
      || (firstWin && ctx.tip('t_enemy_king', board.unitNode('enemy', 'king'),
        'Сразишь Чёрного короля — победа. Нажми на врага, чтобы узнать о нём.'))
      || (featureOpen(s, 'auto') && ctx.tip('t_move', this.autoBtn,
        '«Авто» расставит армию сама. Переставить фигуру: нажми на неё, потом на клетку.'))
      || (!this.terrainRow.hidden && ctx.tip('t_terrain', this.terrainRow,
        'Ландшафт! Лес защищает, с холма стрелки бьют сильнее, через камни и воду не пройти.'))
      || (this.board.root.querySelector('.cell.threat') && ctx.tip('t_threats', this.board.root.querySelector<HTMLElement>('.cell.threat'),
        'Красные клетки простреливает враг. Не ставь туда короля, закрывай линии пешками.')));
  }

  /** After-battle breakdown: loss reason, MVP, damage per piece and tips. */
  private reportView(win: boolean): HTMLElement {
    const r = buildReport(this.battle!);
    const box = el('details', 'report');
    box.open = !win;
    box.append(el('summary', 'report-title', 'Разбор боя'));
    if (r.lossReason) box.append(el('p', 'report-reason', r.lossReason));
    if (r.mvp) {
      box.append(el('p', 'report-mvp',
        `Лучшая фигура: ${pieceName(r.mvp)} — ${fmt(Math.round(r.mvp.dealt))} урона, сражено ${r.mvp.kills}`));
    }
    const max = Math.max(1, ...r.allies.map((a) => a.dealt));
    const table = el('div', 'report-table');
    for (const a of r.allies.slice(0, 10)) {
      const row = el('div', `report-row${a.killedBy ? ' fallen' : ''}`);
      const img = el('img');
      img.src = spriteUrl(a.kind, 'ally', abilityTier(this.ctx.state.levels[a.promoted ? 'pawn' : a.kind]) as Tier);
      img.alt = '';
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${(a.dealt / max) * 100}%`;
      track.append(fill);
      row.append(img, el('span', 'report-name', pieceName(a)), track,
        el('span', 'report-num', `${fmt(Math.round(a.dealt))}${a.killedBy ? ' ✝' : ''}`));
      table.append(row);
    }
    box.append(table);
    if (r.tips.length) {
      const tips = el('ul', 'report-tips');
      for (const t of r.tips) tips.append(el('li', '', t));
      box.append(tips);
    }
    return box;
  }

  private collectUnits(): UnitView[] {
    if (this.battle) return this.battle.units.map((u) => this.unitView(u));
    const s = this.ctx.state;
    const views: UnitView[] = s.formation.map((f) => {
      let key = this.slotKeys.get(f);
      if (!key) {
        key = `f${this.nextSlotKey++}`;
        this.slotKeys.set(f, key);
      }
      const from = this.selection?.from;
      return {
        key, team: 'ally', kind: f.kind, x: f.x, y: f.y, hp: 1, maxHp: 1, tier: abilityTier(s.levels[f.kind]) as Tier,
        selected: !!from && from.x === f.x && from.y === f.y,
      };
    });
    // "Зеркало": the Black King stands beside your king (placed for you).
    if (this.levelId === 'final-2') {
      const bk = battleSetup(s, this.levelId).allies.find((a) => a.boss);
      if (bk) views.push({ key: 'black-king', team: 'ally', kind: 'king', x: bk.x, y: bk.y, hp: 1, maxHp: 1, boss: true, tier: 2, skin: 'blackKing' });
    }
    this.enemies().forEach((p, i) => {
      views.push({
        key: `e${this.levelId}-${i}`, team: 'enemy', kind: p.kind, x: p.x, y: p.y, hp: 1, maxHp: 1, boss: p.boss, trait: p.trait,
        tier: abilityTier(p.level) as Tier, skin: p.boss ? this.bossSkin() : undefined,
      });
    });
    return views;
  }

  private unitView(u: Unit): UnitView {
    return {
      key: `b${u.uid}`, team: u.side, kind: u.kind, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp,
      shield: u.shield / u.maxHp, tier: abilityTier(u.level) as Tier,
      boss: u.boss, trait: u.trait, dead: u.hp <= 0, selected: u.uid === this.movePick,
      skin: u.uid === this.battle?.bossUid ? this.bossSkin()
        : u.side === 'ally' && u.boss && u.kind === 'king' ? 'blackKing' : undefined,
    };
  }

  /** How the boss of this level is drawn: the Hand, a giant portrait, or a plain piece. */
  private bossSkin(): UnitView['skin'] {
    const id = bossFor(this.levelId);
    return id === 'hand' ? 'hand' : hasBossArt(id) ? id : undefined;
  }
}

/** How long a decision waits for the player. */
const DECISION_MS = 3000;

const DECISION_TEXT: Record<Decision['kind'], { title: string; hint: string; options: Record<string, string> }> = {
  check: {
    title: 'Шах! Король под ударом', hint: 'Падёт король — бой проигран. Уведи его, закрой фигурой или спрячь рокировкой.',
    options: { escape: 'Отступить', block: 'Закрыться', castle: 'Рокировка', none: 'Стоять' },
  },
  boss: {
    title: 'Удар босса!', hint: 'Красные клетки — сюда ударит босс. Уведи фигуры или подними щиты.',
    options: { scatter: 'Разбежаться', brace: 'Щиты', none: 'Стоять' },
  },
};

const RAGE_LINES: Partial<Record<string, string>> = {
  captain: 'Сомкнуть ряды!', rider: 'Ты не уйдёшь!', fortress: 'Камень не сдаётся!', queen: 'На колени!',
  guardian: 'Бездна голодна!', blackKing: 'Все искажения — сейчас!', hand: 'ПЕРЕВЕРНУТЬ.',
};

const HAND_LINES: Partial<Record<string, string>> = { 'Щелчок': 'Щёлк.', 'Перестановка': 'Не туда.', 'Тени партий': 'Встаньте.' };

function hitSound(e: BattleEvent): 'crit' | 'shot' | 'hit' {
  if (e.crit) return 'crit';
  const dx = Math.abs(e.x - e.fromX);
  const dy = Math.abs(e.y - e.fromY);
  const knightJump = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  return Math.max(dx, dy) > 1 && !knightJump ? 'shot' : 'hit';
}

/** One sound per kind per frame keeps big fights readable. */
function playBattleSounds(events: BattleEvent[]): void {
  const types = new Set<string>(events.map((e) => (e.type === 'hit' ? hitSound(e) : e.type)));
  if (types.has('save')) audio.play('save');
  if (types.has('promote')) audio.play('promote');
  if (types.has('death')) audio.play('death');
  if (types.has('crit')) audio.play('crit');
  else if (types.has('hit')) audio.play('hit');
  else if (types.has('shot')) audio.play('shot');
  if (types.has('heal')) audio.play('heal');
  if (types.has('ability')) audio.play('ability');
  if (types.has('shieldBreak')) audio.play('shieldBreak');
  if (types.has('rage')) audio.play('roar');
  if (types.has('warn')) audio.play('warn');
  if (types.has('blast') || types.has('terrain')) audio.play('quake');
  if (types.has('summon') || types.has('boss')) audio.play('ability');
}
