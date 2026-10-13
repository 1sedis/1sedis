import {
  createBattle, legalMoves, moveMoment, playMove, resolveDecision, stepBattle, threatMap,
  type Battle, type BattleEvent, type Decision, type PlayerMove, type Unit,
} from '../../game/battle';
import { accentFor } from '../accents';
import { adviceLabel, adviseUpgrade } from '../../game/advice';
import { bestFormation, fillFormation } from '../../game/autoformation';
import { SYNERGIES, synergyProgress } from '../../game/synergies';
import { BOSSES, bossFor } from '../../game/bosses';
import { TERRAIN_INFO } from '../../game/terrain';
import { DISTORTIONS } from '../../game/distortions';
import { terrainUrl } from '../terrainArt';
import { traitUrl } from '../traitIcons';
import { TRAITS, traitAdjective } from '../../game/elites';
import { buildReport, pieceName, type BattleReport } from '../../game/report';
import {
  CHAPTERS, UNLOCKED_BY, chapterOf, finalePhase, getLevel, isFinale,
  nextLevelId,
} from '../../game/levels';
import { activeBoons, availableNodes, boonText, enterNode, lives } from '../../game/run';
import { ELITE_RULES } from '../../game/battle';
import { livesRow, openRunEnd } from '../runNodes';
import { bossArtUrl, hasBossArt } from '../bossArt';
import { ABILITIES, abilityTier } from '../../game/abilities';
import { PIECES, type PieceKind } from '../../game/pieces';
import {
  available, battleGold, battleSetup, clearFormation, isEliteBattle, playerMoves, levelDistortions, terrainFor, commandLimit, fieldedCount, isLevelOpen, isPlayerCell,
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
import { el, infoBtn, openModal, setDisabled, setHidden, setText, toast, wipe } from '../dom';
import { fmt } from '../format';
import { saveSettings, type Settings } from '../settings';
import { FINALE_CROWNS, canAffordUpgrade, finaleEase, levelFormation } from '../../game/state';
import { FORMATION_NAMES } from '../../game/formations';
import { featureOpen } from '../../game/features';
import { spriteUrl, type Tier } from '../sprites';
import { plural, t } from '../../i18n';

const TICK_MS = 100;
/** The first guided move holds the battle only this long if the player does nothing. */
const GUIDE_WAIT_MS = 8000;
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
  /** performance.now() until which a hit-stop holds the battle clock. */
  private stopUntil = 0;
  /** No new hit-stop before this moment, so a cascade of deaths never stalls the fight. */
  private stopReady = 0;
  private terrainRow = el('div', 'terrain-row');
  private eliteRow = el('div', 'terrain-row elite-row');
  private synergySig = '';
  private autoBtn!: HTMLButtonElement;
  private threatSig = '';
  private infoPanel = el('div', 'side-stack');
  private battlePanel = el('div', 'side-stack');
  private limitText = el('b');
  private enemyText = el('div', 'info-line');
  private rewardText = el('div', 'info-line');
  /** Phones: the key facts of the fight in one line above the board. */
  private strip = el('div', 'prep-strip');
  private hintText = el('p', 'hint-text');
  private relicCard = el('div', 'task-relics');
  private relicSlot = el('div');
  private kingBars: Record<'ally' | 'enemy', { fill: HTMLElement; text: HTMLElement; name: HTMLElement }>;
  private battleTime = el('div', 'battle-time');

  constructor(private ctx: Ctx) {
    this.board = new BoardView((x, y) => this.onCell(x, y));

    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', t('← Карта'));
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
    this.movesEl.title = t('Ваши ходы в этом бою: нажмите на свою фигуру во время боя');
    controls.append(this.movesEl, seg, this.fightBtn);
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
    boardCol.append(this.strip, this.bossBar);
    const trayPanel = el('div', 'bench-panel');
    const trayHead = el('div', 'panel-head');
    trayHead.append(el('span', 'panel-title', t('Резерв')), this.trayTitle);
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
    const autoBtn = el('button', 'btn btn-small', t('Авто'));
    this.autoBtn = autoBtn;
    autoBtn.title = t('Проверить 16 расстановок в симуляции и поставить лучшую');
    autoBtn.addEventListener('click', () => {
      bestFormation(this.ctx.state, this.levelId, this.limit());
      toast(t('Подобрана лучшая из 16 расстановок'));
      this.selection = null;
    });
    const clearBtn = el('button', 'btn btn-small btn-ghost', t('Очистить'));
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
    const codexBtn = el('button', 'btn btn-ghost btn-small', t('Фигуры'));
    codexBtn.addEventListener('click', () => openCodex(this.ctx.state));
    taskHead.append(el('span', 'panel-title', t('Задача')), codexBtn, infoBtn(t('Как играть'),
      t('Сразите вражеского короля. Если падёт ваш — бой проигран.\nВыберите фигуру в резерве и нажмите на клетку в трёх нижних рядах. Нажмите на свою фигуру, чтобы переставить её, или на резерв, чтобы убрать.') + '\n\n'
      + t('Словарь:\n• Бой — одна схватка на доске.\n• Глава — карта с развилками, в конце босс.\n• Забег — четыре главы на одну жизнь; поражение начинает новый забег.\n• Партия — выигранный забег; следующая партия труднее.\n• Угроза — усложнение, которое вы выбираете сами после победы.')));
    this.hintText.classList.add('task-hint');
    infoCard.append(taskHead, this.enemyText, this.distortionRow, this.bossInfo, this.eliteRow, this.rewardText, this.terrainRow, this.hintText, this.relicCard);
    this.infoPanel.append(infoCard);

    const kingsCard = el('div', 'card');
    kingsCard.append(el('div', 'panel-title', t('Короли')));
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
    this.kingBars = { ally: bar(t('Ваш король'), 'ally'), enemy: bar(t('Чёрный король'), 'enemy') };
    kingsCard.append(this.battleTime);
    this.battlePanel.append(kingsCard);
    side.append(this.infoPanel, this.battlePanel);

    const grid = el('div', 'arena-grid');
    grid.append(boardCol, side);
    // Wide screens keep the reserve beside the board, so placing pieces never needs a scroll.
    const wide = window.matchMedia('(min-width: 1001px)');
    const placeTray = () => (wide.matches ? side.prepend(trayPanel) : boardCol.append(trayPanel));
    placeTray();
    wide.addEventListener('change', placeTray);
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
    audio.setTrack('map', this.ctx.state.run.chapter);
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
    const finale = isFinale(this.levelId);
    const eliteTitle = isEliteBattle(s, this.levelId) ? t('Элита · ') : '';
    setText(this.title, finale ? t('Финал · {name}', { name: level.name }) : `${eliteTitle}${level.id} · ${level.name}`);
    setText(this.subtitle, finale
      ? t('{name} · фаза {n} из 3', { name: chapter.name, n: finalePhase(this.levelId) })
      : t('Глава {n}. {name}', { n: chapter.id, name: chapter.name }) + (s.prestige ? t(' · партия {n}', { n: s.prestige + 1 }) : ''));
    this.board.setTheme(chapter.id);
    this.board.setElite(isEliteBattle(s, this.levelId));
    this.root.dataset.theme = String(chapter.id);
    document.body.dataset.chapter = String(chapter.id);
    const terrain = terrainFor(s, this.levelId);
    this.board.setTerrain(terrain);
    const kinds = [...new Set(terrain)].filter((t) => t !== 'plain');
    const distortions = levelDistortions(s, this.levelId);
    this.distortionRow.hidden = distortions.length === 0;
    if (distortions.length) {
      this.distortionRow.replaceChildren(el('span', '', distortions.map((id) => `◆ ${DISTORTIONS[id].name}`).join('  ')),
        infoBtn(t('Искажения'), distortions.map((id) => `${DISTORTIONS[id].name}: ${DISTORTIONS[id].text}`).join('\n')));
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
    if (kinds.length) this.terrainRow.append(infoBtn(t('Ландшафт'), kinds.map((t) => `${TERRAIN_INFO[t].name}: ${TERRAIN_INFO[t].text}`).join('\n')));
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
      this.eliteRow.append(infoBtn(t('Элитные враги'), [...new Set(elites.map((p) => p.trait!))]
        .map((t) => `${TRAITS[t].name[0]}: ${TRAITS[t].text}.`).join('\n') + '\n' + t('Элиту видно по значку над фигурой.')));
    }
    if (!finale) {
      for (const x of activeBoons(s.run, !!level.boss)) {
        const good = x.atk * x.hp >= 1 && (x.foe ?? 1) <= 1;
        const chip = el('span', `terrain-chip boon-chip ${good ? 'good' : 'bad'}`, x.name);
        chip.title = boonText(x);
        this.eliteRow.append(chip);
      }
    }
    const bossId = bossFor(this.levelId);
    const rule = battleSetup(s, this.levelId).eliteRule;
    this.bossInfo.hidden = !bossId && !rule;
    if (bossId) {
      const d = BOSSES[bossId];
      this.bossInfo.replaceChildren(el('span', '', `${d.passive ? `◆ ${d.passive} · ` : ''}★ ${d.skill} · ☠ ${d.rage}`), infoBtn(getLevel(this.levelId).boss ?? t('Босс'),
        t('У босса в разы больше здоровья, чем у обычной фигуры.') + '\n' + (d.passive ? `◆ ${d.passive}: ${d.passiveText}.\n` : '') + `★ ${d.skill}: ${d.skillText}.\n`
        + t('☠ {rage} (ниже 50% здоровья): {text}.', { rage: d.rage, text: d.rageText })));
    } else if (rule) {
      const r = ELITE_RULES[rule];
      this.bossInfo.replaceChildren(el('span', 'elite-rule', t('☠ Элита: {name}', { name: r.name })), infoBtn(t('Элита: {name}', { name: r.name }),
        t('Правило этого боя: {text}.\nВраги на уровень сильнее, за победу — реликвия.', { text: r.text })));
    }
    const enemies = this.enemies();
    const formation = finale ? 'classic' : levelFormation(s, this.levelId).formation;
    setText(this.enemyText, t('Враги: {n} · ур. {lv}', { n: enemies.length, lv: enemies[0]?.level ?? level.level }) + (level.boss ? ` · ${level.boss}` : '')
      + (formation !== 'classic' ? ` · ${FORMATION_NAMES[formation]}` : ''));
    if (finale) {
      const phase = finalePhase(this.levelId);
      setText(this.rewardText, phase < 3
        ? t('Победа сохраняет прогресс финала')
        : s.finale.beaten ? t('Рука уже опущена — это бой на память') : t('Награда: +{n} ♛ и конец истории', { n: FINALE_CROWNS }));
      setText(this.hintText, level.hint);
      this.relicCard.hidden = s.relics.length === 0;
      this.relicSlot.replaceChildren(relicStrip(s.relics));
      return;
    }
    const elite = isEliteBattle(s, level.id);
    const gold = battleGold(s, level.id, elite);
    setText(this.rewardText, t('Награда: +{gold} золота', { gold: fmt(gold) }) + (elite || level.boss ? t(' · реликвия') : '')
      + ' · ' + (lives(s) > 1 ? t('жизней: 2') : t('одна жизнь')));
    setText(this.hintText, level.hint);
    this.relicCard.hidden = s.relics.length === 0;
    this.relicSlot.replaceChildren(relicStrip(s.relics));
    const traitIcons = [...new Set(this.enemies().filter((p) => p.trait).map((p) => p.trait!))].map((tr) => {
      const img = el('img', 'strip-trait');
      img.src = traitUrl(tr);
      img.alt = '';
      img.title = TRAITS[tr].text;
      return img;
    });
    this.strip.replaceChildren(el('span', '', t('⚔ {n} · ур. {lv}', { n: enemies.length, lv: enemies[0]?.level ?? level.level })),
      ...traitIcons, el('span', 'strip-gold', t('+{gold} золота', { gold: fmt(gold) })));
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
      } else toast(isPlayerCell(x, y) ? t('Сюда нельзя: камень или вода') : t('Свои фигуры ставятся в три нижних ряда'));
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
      const ability = tier ? t(' Приём «{name}»', { name: ABILITIES[enemy.kind].name }) + (tier === 2 ? t(' (усилен)') : '') + '.' : '';
      const elite = enemy.trait ? ` ${traitAdjective(enemy.trait, enemy.kind)}: ${TRAITS[enemy.trait].text}.` : '';
      toast(t('{name}, ур. {lv}.', { name: (enemy.boss ? getLevel(this.levelId).boss : def.name) ?? '', lv: enemy.level }) + `${elite} ${def.description}${ability}`);
      return;
    }
    const ter = terrainFor(this.ctx.state, this.levelId)[y * 8 + x];
    if (ter !== 'plain') toast(`${TERRAIN_INFO[ter].name}: ${TERRAIN_INFO[ter].text}`);
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
    if (own && b.movesLeft <= 0) toast(t('Ходы в этом бою кончились'));
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
      this.guideSince = performance.now();
    }
    const tg = this.guideTarget;
    // Nobody moved for a while: let the battle go on, the move can wait.
    if (tg && performance.now() - this.guideSince > GUIDE_WAIT_MS) {
      if (!s.tutorial.includes('t_moves')) s.tutorial.push('t_moves');
      this.cancelPick();
      toast(t('Бой продолжается. Ход можно сделать в любой момент: нажми на свою фигуру.'));
      return;
    }
    if (tg) {
      this.ctx.tip('t_moves', this.board.cellNode(tg.x, tg.y),
        tg.type === 'capture' ? t('Время замерло — твой ход! Нажми на клетку врага: взятие снимет его с доски.')
          : t('Время замерло — твой ход! Нажми на подсвеченную клетку.'));
    }
  }

  private guideTarget: PlayerMove | null = null;
  private guideSince = 0;

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
      toast(this.ctx.state.army[kind] === 0 ? t('{name}: наймите в лагере', { name: PIECES[kind].name }) : t('Все такие фигуры уже на доске'));
      return;
    }
    this.selection = { kind, from: null };
    audio.play('select');
  }

  private returnSelected(): void {
    const from = this.selection?.from;
    if (!from || this.phase !== 'prep') return;
    if (!removeSlot(this.ctx.state, from.x, from.y)) toast(t('Король всегда участвует в бою'));
    this.selection = null;
  }

  /** A scene playing on the board; the battle waits for it. */
  private scene: Promise<void> | null = null;

  private startBattle(): void {
    if (this.scene) return;
    const s = this.ctx.state;
    sanitizeFormation(s, this.limit(), this.levelId);
    // Pieces forgotten in the reserve join the line on free cells instead of sitting the battle out.
    const joined = fillFormation(s, this.limit(), this.levelId);
    if (joined > 0) toast(t('Из резерва в строй: {n} {pieces}', { n: joined, pieces: plural(joined, ['фигура', 'фигуры', 'фигур'], ['piece', 'pieces']) }));
    if (fieldedCount(s) === 0) {
      toast(t('Поставьте на доску хотя бы одну фигуру'));
      return;
    }
    this.selection = null;
    this.battle = createBattle({ ...battleSetup(s, this.levelId), playerMoves: playerMoves(s, this.levelId), decisions: true });
    this.cancelPick();
    this.phase = 'battle';
    audio.setTrack(getLevel(this.levelId).boss ? 'boss' : isEliteBattle(s, this.levelId) ? 'elite' : 'battle', chapterOf(this.levelId).id);
    this.acc = 0;
    const bossId = this.battle.bossId;
    if (bossId) {
      const boss = this.battle.units.find((u) => u.uid === this.battle!.bossUid)!;
      this.board.intro({
        name: getLevel(this.levelId).boss ?? t('Босс'),
        sprite: bossId === 'hand' ? handUrl() : hasBossArt(bossId) ? bossArtUrl(bossId) : spriteUrl(boss.kind, 'enemy', boss.tier as Tier),
        skill: BOSSES[bossId].skill, rage: BOSSES[bossId].rage,
      });
      this.introUntil = performance.now() + 2200;
      audio.play('roar');
    } else if (this.battle.eliteRule) {
      // Elites announce their rule and show their champion.
      const champ = this.battle.units.find((u) => u.champion);
      const r = ELITE_RULES[this.battle.eliteRule];
      this.board.intro({
        name: r.name, sprite: spriteUrl(champ?.kind ?? 'king', 'enemy', 2), skill: r.text, rage: '', elite: true,
      });
      this.introUntil = performance.now() + 2200;
      audio.play('warn');
    } else audio.play('start');
    document.body.classList.toggle('finale-hand', bossId === 'hand');
    this.ctx.save();
  }

  private retreat(): void {
    this.enterPrep();
    toast(t('Отступили. Бой не засчитан'));
  }

  private leave(): void {
    skipScenes();
    if (this.phase === 'battle') this.enterPrep();
    this.ctx.go('map');
  }

  private finish(): void {
    const b = this.battle!;
    const outcome = recordResult(this.ctx.state, this.levelId, b);
    this.ctx.save();
    this.phase = 'result';
    this.board.showBanner(outcome.win ? t('Победа') : t('Поражение'), outcome.win);
    audio.play(outcome.win ? 'win' : 'lose');
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
    const content = el('div', `result ${o.win ? 'is-win' : 'is-loss'}`);
    content.append(el('h2', `result-title ${o.win ? 'win' : 'loss'}`, o.win ? t('Победа!') : o.runOver ? t('Забег окончен') : t('Поражение')));
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
    // A strip under the title: losses and time, and where run news is put.
    const list = el('div', 'result-line',
      this.battle ? t('Потери: {n} · время боя: {s} с', { n: this.battle.allyLosses, s: Math.round(this.battle.tick / 10) }) : '');
    content.append(list);
    if (this.battle) {
      const report = buildReport(this.battle);
      if (!o.win && report.reasons.length) content.append(this.whyView(report));
      content.append(this.reportView(o.win, report));
    }

    if (o.relicsEarned > 0) content.append(el('div', 'result-unlock relic', t('Новая реликвия! Выберите одну из трёх.')));
    if (isFinale(this.levelId)) {
      if (o.ending) content.append(el('div', 'result-reward', t('+{n} ♛ · трофейная корона на вашем короле', { n: FINALE_CROWNS })));
      else if (o.win && nextLevelId(this.levelId)) content.append(el('div', 'result-unlock', t('Фаза пройдена — прогресс сохранён. Дальше будет хуже.')));
      else if (!o.win) {
        content.append(el('div', 'result-unlock', t('Рука ждёт. Улучшите армию — враги финала растут вместе с ней, но реликвии, кузница и древо — нет.')));
        const ease = finaleEase(this.ctx.state);
        content.append(el('div', 'result-reward small', ease > 0
          ? t('Рука устаёт: враги финала слабее на {n} ур.', { n: ease })
          : t('Каждые два поражения подряд Рука устаёт — враги финала слабеют.')));
      }
    } else if (o.win) {
      content.append(el('div', 'result-reward', t('+{gold} золота', { gold: fmt(o.reward) })));
      if (o.trophy) content.append(el('div', 'result-unlock relic', t('Трофей: бесплатная крутка Колеса короны')));
      if (o.firstClear) {
        const unlocked = (Object.keys(UNLOCKED_BY) as PieceKind[]).find((k) => UNLOCKED_BY[k] === this.levelId);
        if (unlocked) content.append(el('div', 'result-unlock', t('Новая фигура: {name}! Наймите в лагере.', { name: PIECES[unlocked].name })));
      }
      if (o.chapterDone) {
        const s = this.ctx.state;
        content.append(el('div', 'result-unlock', s.run.complete
          ? t('Чёрный ферзь пал — все четыре главы пройдены!')
          : t('Глава пройдена! Впереди глава {n}: {name}.', { n: s.run.chapter, name: CHAPTERS[s.run.chapter - 1].name })));
      }
    } else {
      if (o.reward > 0 && !o.runOver) {
        content.append(el('div', 'result-reward small',
          t('+{gold} золота за {p}% урона врагу', { gold: fmt(o.reward), p: Math.round(o.damageShare * 100) })));
      }
      // Right under the conditions, so it is seen before the long report.
      if (o.runOver) {
        list.after(el('div', 'result-unlock loss-banners run-over', t('Король пал — забег окончен.')));
      } else if (o.spared) {
        const line = el('div', 'result-unlock loss-banners', t('Запасное знамя сгорело вместо вас — бой можно переиграть. Осталась одна жизнь. '));
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
      return b;
    };
    const campaign = !isFinale(this.levelId);
    if (o.runOver) {
      // A dead run: one way on — the summary, then a new run from 1-1.
      button(t('Итоги забега ▶'), 'btn-primary', () => {
        this.enterPrep();
        openRunEnd(this.ctx, () => this.ctx.go('map'));
      });
      content.append(actions);
      return;
    }
    if (!campaign || (!o.win && !o.spared)) {
      button(t('Карта'), 'btn-ghost', () => {
        this.enterPrep();
        this.ctx.go('map');
      });
    }
    if (campaign) {
      // The run map decides where to go next; a loss saved by a spare banner retries the same battle.
      const s = this.ctx.state;
      // Until the player has visited the upgrades once, a win with gold to spend points there plainly.
      const nudge = o.win && !s.tutorial.includes('t_spend') && canAffordUpgrade(s);
      const up = button(t('Улучшения'), nudge ? 'btn-up btn-hot' : '', () => {
        if (!s.tutorial.includes('t_spend')) s.tutorial.push('t_spend');
        this.enterPrep();
        this.ctx.go('camp');
      });
      if (nudge) {
        content.append(el('div', 'result-unlock spend-nudge',
          t('У вас {gold} золота. Потратьте его до следующего боя: наймите фигуру или поднимите уровень — враги дальше сильнее.', { gold: fmt(s.gold) })));
        setText(up, t('Улучшения ★'));
      }
      const ahead = availableNodes(this.ctx.state.run);
      if (!o.win) button(t('Ещё раз'), 'btn-primary', () => this.enterPrep());
      else if (o.win && !o.chapterDone && ahead.length === 1 && ahead[0].level) {
        // No fork ahead (the first lessons): straight on to the next battle.
        button(t('Дальше ▶'), 'btn-primary', () => {
          enterNode(this.ctx.state, ahead[0].id);
          wipe();
          this.show(ahead[0].level!);
        });
      } else button(t('К карте ▶'), 'btn-primary', () => {
        this.enterPrep();
        this.ctx.go('map');
      });
    } else if (o.win) {
      button(t('Улучшения'), '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      button(t('Переиграть'), '', () => this.enterPrep());
      const next = nextLevelId(this.levelId);
      if (next) button(t('Дальше ▶'), 'btn-primary', () => {
        wipe();
        this.show(next);
      });
    } else {
      button(t('Улучшения'), '', () => {
        this.enterPrep();
        this.ctx.go('camp');
      });
      button(t('Ещё раз'), 'btn-primary', () => this.enterPrep());
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
    body.append(el('div', 'advice-title', t('Совет: {text}', { text: adviceLabel(a) })));
    body.append(el('div', 'advice-sub', a.wins
      ? t('С этим улучшением та же расстановка побеждает.')
      : t('Даст больше всего силы именно в этом бою.')));
    box.append(body);
    const affordable = s.gold >= a.cost;
    const buy = el('button', 'btn btn-up btn-small', affordable ? t('Улучшить · {cost}', { cost: fmt(a.cost) }) : t('Нужно {cost}', { cost: fmt(a.cost) }));
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
    if (!affordable) box.append(el('div', 'advice-sub advice-wide', t('Золото дают победы на карте — элита платит больше.')));
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
      const chip = el('button', `synergy${active ? ' active' : ''}`, active ? `✦ ${def.name}` : `${def.name} ${have}/${need}`);
      chip.dataset.id = def.id;
      chip.title = def.description;
      // A tap says what the bonus gives and how far it is.
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        toast(active ? t('✦ {name} действует: {text}', { name: def.name, text: def.description })
          : t('{name} ({have}/{need}): {text}', { name: def.name, have, need, text: def.description }));
      });
      if (active && !first && !wasActive.has(def.id)) chip.classList.add('pop');
      return chip;
    }), this.synergyInfo);
  }

  private synergyInfo = infoBtn(t('Синергии'), () => t('Бонусы за состав армии на доске:') + '\n' + SYNERGIES.map((d) => `${d.name}: ${d.description}.`).join('\n'));

  /** The first time an ally uses an ability, explain where abilities come from. */
  private firstAbility(events: BattleEvent[]): void {
    const s = this.ctx.state;
    if (s.tutorial.includes('t_ability_seen')) return;
    const e = events.find((ev) => ev.type === 'ability' && ev.side === 'ally');
    if (!e?.fromKind) return;
    s.tutorial.push('t_ability_seen');
    toast(t('{name}: приём «{label}»! На 5-м уровне фигура выбирает один из двух приёмов', { name: PIECES[e.fromKind].name, label: e.label ?? '' }), 'good');
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
    const now = performance.now();
    if (this.phase === 'battle' && b && !this.introUntil && !frozen && now >= this.stopUntil) {
      this.acc += dt * speed;
      const live = this.acc / TICK_MS < LIVE_FX_LIMIT;
      const accents = live && this.ctx.settings.effects;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < 2000 && this.phase === 'battle' && !b.decision) {
        this.acc -= TICK_MS;
        stepBattle(b);
        if (live) events.push(...b.events);
        if (b.result) this.finish();
        steps++;
        if (accents) {
          const accent = accentFor(b.events, b.bossUid, speed);
          if (accent.punch) this.board.punch(accent.punch);
          if (accent.stop && (now >= this.stopReady || b.result)) {
            // Hit-stop: hold the clock for a beat and drop the rest of this frame's time.
            this.stopUntil = now + accent.stop;
            this.stopReady = this.stopUntil + 250;
            this.acc = 0;
            break;
          }
        }
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
      this.movesEl.replaceChildren(el('span', 'moves-label', t('Ходы')),
        ...Array.from({ length: total }, (_, i) => el('span', `move-token${i < left ? ' on' : ''}`)));
    }
    this.movesEl.classList.toggle('active', !prep && left > 0);
    if (!prep && left > 0 && left < total && this.movePick === null) {
      void this.ctx.tip('t_tokens', this.movesEl, t('Это твои ходы: осталось {n}. Нажми на свою фигуру, когда захочешь сходить.', { n: left }));
    }
    setText(this.fightBtn, prep ? t('▶ В бой') : t('■ Отступить'));
    this.fightBtn.classList.toggle('btn-danger', !prep);
    setDisabled(this.fightBtn, this.phase === 'result');
    this.speedBtns.forEach(({ b, sp }) => b.classList.toggle('active', sp === speed));
    setHidden(this.infoPanel, !prep);
    setHidden(this.strip, !prep);
    setHidden(this.battlePanel, prep);
    setHidden(this.prepTools, !prep);
    // Parts of the screen a new player has not met yet stay out of the way.
    setHidden(this.speedSeg, !featureOpen(s, 'speed'));
    setHidden(this.autoBtn, !featureOpen(s, 'auto'));
    setHidden(this.movesEl, !featureOpen(s, 'moves'));

    const limit = this.limit();
    setText(this.limitText, `${fieldedCount(s)}/${limit}`);
    setText(this.trayTitle, prep ? t('На доске {n}/{limit} + король', { n: fieldedCount(s), limit }) : t('Идёт бой'));
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
      setText(this.kingBars.enemy.name, this.levelId === 'final-3' ? t('Рука над доской') : this.levelId === 'final-2' ? t('Тень полководца') : t('Чёрный король'));
      for (const side of ['ally', 'enemy'] as const) {
        const king = this.battle.units.find((u) => u.side === side && u.kind === 'king');
        const ratio = king ? Math.max(0, king.hp) / king.maxHp : 0;
        const w = `${ratio * 100}%`;
        if (this.kingBars[side].fill.style.width !== w) this.kingBars[side].fill.style.width = w;
        setText(this.kingBars[side].text, `${Math.round(ratio * 100)}%`);
      }
      setText(this.battleTime, t('Время боя: {s} с · потери: {n}', { s: Math.floor(this.battle.tick / 10), n: this.battle.allyLosses }));
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
    setText(this.bossName, getLevel(this.levelId).boss ?? t('Босс'));
    setText(this.bossPhase, ratio <= 0 ? t('Повержен') : b.bossPhase === 2 ? `☠ ${BOSSES[b.bossId!].rage}` : `${Math.ceil(ratio * 100)}%`);
    this.bossBar.classList.toggle('enraged', b.bossPhase === 2);
    this.board.setWarnings(b.warnings.flatMap((w) => w.cells));
  }

  private lastBark = 0;
  /** Move-moment hints shown this battle and when the last one was. */
  private momentHints = 0;
  private lastMoment = 0;
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
        shout('rage', e.x, e.y, RAGE_LINES[b.bossId] ?? t('Ярость!'), b.bossId === 'hand' ? 'hand' : 'enemy', true);
      } else if (e.type === 'boss' && b.bossId === 'hand' && e.label && HAND_LINES[e.label]) {
        shout(null, e.x, e.y, HAND_LINES[e.label]!, 'hand');
      } else if (e.type === 'promote' && e.side === 'ally') {
        shout('promote', e.x, e.y, t('Я — ферзь!'), 'ally');
      } else if (e.type === 'save' && e.side === 'ally') {
        shout('save', e.x, e.y, t('Ещё не конец!'), 'ally', true);
      }
    }
    // A move would pay off right now: the piece says so and the move tokens light up.
    // At most two such hints a battle, six seconds apart, each kind once: a nudge, not a nag.
    if (b.tick <= 3) this.momentHints = 0;
    if (this.ctx.settings.hints && this.movePick === null && b.movesLeft > 0 && b.tick % 5 === 0
      && this.momentHints < 2 && now - this.lastMoment > 6000) {
      const m = moveMoment(b);
      const u = m && b.units.find((x) => x.uid === m.uid);
      if (m && u && !this.barked.has(`moment-${m.kind}`)) {
        this.barked.add(`moment-${m.kind}`);
        this.momentHints++;
        this.lastMoment = now;
        shout(null, u.x, u.y, m.kind === 'promote' ? t('Мой ход — и я ферзь!')
          : m.kind === 'capture' ? t('Ход: {name} под боем — бери!', { name: PIECES[m.target!].name.toLowerCase() })
            : t('Ход: уведи меня из-под удара!'), 'ally', true);
        this.board.hintUnit(`b${m.uid}`, this.movesEl);
      }
    }
    for (const u of b.units) {
      if (u.kind !== 'king' || u.hp <= 0 || u.boss) continue;
      if (u.side === 'ally' && u.hp < u.maxHp * 0.3) shout('ally-king', u.x, u.y, t('Ко мне, стража!'), 'ally');
      if (u.side === 'enemy' && u.hp < u.maxHp * 0.3) shout('enemy-king', u.x, u.y, t('Нет… не сейчас!'), 'enemy');
    }
    if (this.levelId === 'final-2' && b.tick >= 20) {
      const bk = b.units.find((u) => u.side === 'ally' && u.boss && u.kind === 'king' && u.hp > 0);
      if (bk) shout('bk-ally', bk.x, bk.y, t('За Белого короля!'), 'enemy');
    }
  }

  /** The Hand moves pieces and turns the board over; its rage locks the speed. */
  private handEvents(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b) return;
    for (const e of events) {
      if (e.type === 'order' && e.label && e.label !== t('Ход')) this.board.callout(e.label, 'skill');
      if (e.type === 'overtime') this.board.callout(t('⌛ Время на исходе'), 'rage');
      if (e.type === 'hand') {
        this.board.handGrab(e.fromX, e.fromY, e.x, e.y);
        if (!b.bossId) this.board.callout(t('Рука переставляет фигуру!'), 'skill');
      } else if (e.type === 'flip') {
        this.board.flip();
        this.board.setTerrain(b.terrain);
      } else if (e.type === 'rage' && b.bossId === 'hand') {
        this.setTimeLock(true);
        toast(t('Рука держит время: ускорение недоступно'));
      }
    }
  }

  /** Callouts for boss skills, rage, new rocks and the boss falling. */
  private bossEvents(events: BattleEvent[]): void {
    const b = this.battle;
    if (!b?.bossId) return;
    for (const e of events) {
      if (e.type === 'boss') this.board.callout(`${e.label}!`, 'skill');
      else if (e.type === 'rage') this.board.callout(t('Ярость: {name}', { name: e.label ?? '' }), 'rage');
      else if (e.type === 'terrain') this.board.setTerrain(b.terrain);
      else if (e.type === 'death' && e.uid === b.bossUid) {
        this.board.callout(b.bossId === 'hand' ? t('Рука опущена!') : t('Босс повержен!'), 'down');
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
    const firstWin = !!s.cleared['1-1'];
    void ((freeReserve && spot && ctx.tip('t_reserve', freeReserve,
      t('Нажми на пешку в резерве, потом на клетку — поставь её в строй.'), board.cellNode(spot[0], spot[1])))
      || ctx.tip('t_fight', this.fightBtn, t('Армия готова. В бой!'))
      || (firstWin && ctx.tip('t_king', board.unitNode('ally', 'king'),
        t('Твой король. Падёт он — бой проигран. Фигуры рядом с ним бьют сильнее.')))
      || (firstWin && ctx.tip('t_enemy_king', board.unitNode('enemy', 'king'),
        t('Сразишь Чёрного короля — победа. Нажми на врага, чтобы узнать о нём.')))
      || (featureOpen(s, 'auto') && ctx.tip('t_move', this.autoBtn,
        t('«Авто» расставит армию сама. Переставить фигуру: нажми на неё, потом на клетку.')))
      || (!this.terrainRow.hidden && ctx.tip('t_terrain', this.terrainRow,
        t('Ландшафт! Лес защищает, с холма стрелки бьют сильнее, через камни и воду не пройти.')))
      || (this.board.root.querySelector('.cell.threat') && ctx.tip('t_threats', this.board.root.querySelector<HTMLElement>('.cell.threat'),
        t('Красные клетки простреливает враг. Не ставь туда короля, закрывай линии пешками.'))));
  }

  /** After-battle breakdown: loss reason, MVP, damage per piece and tips. */
  /** On a loss, first thing under the title: why it happened and what to do about it. */
  private whyView(r: BattleReport): HTMLElement {
    const box = el('div', 'loss-why');
    box.append(el('div', 'loss-why-title', t('Почему поражение')));
    const list = el('ul', 'loss-why-list');
    for (const reason of r.reasons) list.append(el('li', '', reason));
    box.append(list);
    if (r.tips[0]) box.append(el('p', 'loss-why-tip', t('Совет: {tip}', { tip: r.tips[0] })));
    return box;
  }

  private reportView(win: boolean, r: BattleReport): HTMLElement {
    const box = el('details', 'report');
    box.open = false;
    box.append(el('summary', 'report-title', t('Разбор боя')));
    if (r.mvp) {
      box.append(el('p', 'report-mvp',
        t('Лучшая фигура: {name} — {dmg} урона, сражено {n}', { name: pieceName(r.mvp), dmg: fmt(Math.round(r.mvp.dealt)), n: r.mvp.kills })));
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
    // On a loss the first tip is already shown above the report.
    const more = win ? r.tips : r.tips.slice(1);
    if (more.length) {
      const tips = el('ul', 'report-tips');
      for (const tip of more) tips.append(el('li', '', tip));
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
        key: `e${this.levelId}-${i}`, team: 'enemy', kind: p.kind, x: p.x, y: p.y, hp: 1, maxHp: 1, boss: p.boss, trait: p.trait, champion: p.champion,
        tier: abilityTier(p.level) as Tier, skin: p.boss ? this.bossSkin() : undefined,
      });
    });
    return views;
  }

  private unitView(u: Unit): UnitView {
    return {
      key: `b${u.uid}`, team: u.side, kind: u.kind, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp,
      shield: u.shield / u.maxHp, tier: abilityTier(u.level) as Tier,
      boss: u.boss, trait: u.trait, champion: u.champion, dead: u.hp <= 0, selected: u.uid === this.movePick,
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
    title: t('Шах! Король под ударом'), hint: t('Падёт король — бой проигран. Уведи его, закрой фигурой или спрячь рокировкой.'),
    options: { escape: t('Отступить'), block: t('Закрыться'), castle: t('Рокировка'), none: t('Стоять') },
  },
  boss: {
    title: t('Удар босса!'), hint: t('Красные клетки — сюда ударит босс. Уведи фигуры или подними щиты.'),
    options: { scatter: t('Разбежаться'), brace: t('Щиты'), none: t('Стоять') },
  },
};

const RAGE_LINES: Partial<Record<string, string>> = {
  captain: t('Сомкнуть ряды!'), rider: t('Ты не уйдёшь!'), fortress: t('Камень не сдаётся!'), queen: t('На колени!'),
  blackKing: t('Все искажения — сейчас!'), hand: t('ПЕРЕВЕРНУТЬ.'),
};

// Keyed by the boss skill label from the battle (translated the same way there).
const HAND_LINES: Partial<Record<string, string>> = {
  [t('Щелчок')]: t('Щёлк.'), [t('Перестановка')]: t('Не туда.'), [t('Тени партий')]: t('Встаньте.'),
};

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
