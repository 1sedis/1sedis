/**
 * The run: a roguelite. A game (партия) is played chapter by chapter on a
 * branching map: every chapter starts at its first level, forks into lanes of
 * battles, elites, events, merchants and camps, and ends at the boss.
 *
 * One life: a lost battle ends the run, unless a spare banner (a relic) burns
 * in its place. A dead run pays crowns for how far it got, and the next one
 * starts at 1-1 with a new army. Beating the fourth boss wins the game.
 *
 * The map itself is never stored: it is rebuilt from the seed and the chapter.
 */
import { CHAPTERS } from './levels';
import type { PieceKind } from './pieces';
import { RELIC_IDS, rollOffer, type RelicId } from './relics';
import type { GameState } from './state';
import type { EliteRule } from './battle';
import { ARMY_ORDER, ARMIES, type ArmyId } from './armies';
import { MAX_THREAT, threatMods } from './ascension';
import { plural, t } from '../i18n';

const RULES: EliteRule[] = ['undying', 'frenzy', 'waves', 'darkness', 'mirror'];

export type NodeKind = 'battle' | 'elite' | 'event' | 'shop' | 'camp' | 'boss';

export interface RunNode {
  id: string;
  row: number;
  /** 0..2, left to right. */
  lane: number;
  kind: NodeKind;
  /** The level fought here (battle, elite, boss). */
  level?: string;
  event?: EventId;
  /** The special rule of an elite battle. */
  rule?: EliteRule;
  next: string[];
}

export interface RunMap {
  chapter: number;
  rows: number;
  nodes: RunNode[];
}

/** How a run ended, kept until the player starts the next one. */
export interface RunOver {
  won: boolean;
  chapter: number;
  /** Where it ended: the level of the lost battle. */
  at: string;
  wins: number;
  elites: number;
  bosses: number;
  crowns: number;
}

export interface RunState {
  chapter: number;
  seed: number;
  /** Nodes finished in this chapter, in the order they were taken. */
  done: string[];
  /** The node entered and not finished yet (a battle being fought, an open merchant). */
  at: string | null;
  /** Merchant goods already bought, as "node:item". */
  bought: string[];
  /** The whole story of this game is won (the fourth boss fell). */
  complete: boolean;
  /** The run is over (died, or ended after the story): the summary to show. */
  over: RunOver | null;
  /** Battles, elites and bosses won in this run. */
  wins: number;
  elites: number;
  bosses: number;
  /** The last boss beaten in this run ("Страж на службе" brings it along). */
  guardian?: PieceKind;
  /** The starting army of this run. */
  army?: ArmyId;
  /** The threat level this run is played at (0: none). */
  threat?: number;
  /** Pieces lost in this chapter so far. */
  chapterLosses?: number;
  /** Blessings and curses from events that last a few battles. */
  boons?: Boon[];
}

/**
 * A blessing (or a curse) from an event: multipliers for the next few battles.
 * `boss` ones wait for the chapter's boss and work only there.
 */
export interface Boon {
  name: string;
  /** Your army's attack and health. */
  atk: number;
  hp: number;
  /** Enemy health. */
  foe?: number;
  /** Battles left. */
  left: number;
  boss?: boolean;
}

/** Boons working in a battle (boss ones only at the boss). */
export function activeBoons(run: RunState, boss: boolean): Boon[] {
  return (run.boons ?? []).filter((x) => x.left > 0 && (!x.boss || boss));
}

/** A battle was fought: every boon working in it wears down by one. */
export function wearBoons(run: RunState, boss: boolean): void {
  if (!run.boons) return;
  for (const x of activeBoons(run, boss)) x.left--;
  run.boons = run.boons.filter((x) => x.left > 0);
}

function addBoon(s: GameState, boon: Boon): void {
  s.run.boons = [...(s.run.boons ?? []), boon];
}

/** A short line for a boon: "+20% атаки · 2 боя". */
export function boonText(x: Boon): string {
  const pct = (v: number) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
  const parts: string[] = [];
  if (x.atk !== 1) parts.push(t('{pct} атаки', { pct: pct(x.atk) }));
  if (x.hp !== 1) parts.push(t('{pct} здоровья', { pct: pct(x.hp) }));
  if (x.foe && x.foe !== 1) parts.push(x.boss ? t('босс {pct} здоровья', { pct: pct(x.foe) }) : t('враги {pct} здоровья', { pct: pct(x.foe) }));
  const left = x.boss ? t('на босса') : `${x.left} ${plural(x.left, ['бой', 'боя', 'боёв'], ['battle', 'battles'])}`;
  return `${parts.join(', ')} · ${left}`;
}

/** Rows of a chapter map, the boss row included. */
export const MAP_ROWS = 10;

// ---------- Random numbers ----------

function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A die for one node: the same node always rolls the same, so reloading changes nothing. */
export function nodeRoll(run: RunState, nodeId: string, salt = ''): number {
  return rng(hashText(`${run.seed}:${run.chapter}:${nodeId}:${salt}`))();
}

// ---------- The map ----------

/** Node kinds a row may hold (chapter 1 opens with three fixed lessons). */
function rowKinds(chapter: number, row: number): NodeKind[] {
  if (row === MAP_ROWS - 1) return ['boss'];
  if (row === MAP_ROWS - 2) return ['camp'];
  if (chapter === 1) {
    if (row <= 2) return ['battle'];
    switch (row) {
      case 3: return ['battle', 'event'];
      case 4: return ['battle', 'elite', 'shop'];
      case 5: return ['camp', 'shop', 'event'];
      case 6: return ['battle', 'elite', 'event'];
      default: return ['battle', 'elite', 'shop'];
    }
  }
  switch (row) {
    case 0: return ['battle'];
    case 1: return ['battle', 'event'];
    case 2: return ['battle', 'elite', 'shop', 'event'];
    case 3: return ['battle', 'elite', 'event'];
    case 4: return ['camp', 'shop', 'event'];
    case 5: return ['battle', 'elite', 'event'];
    case 6: return ['battle', 'elite', 'shop'];
    default: return ['battle', 'elite', 'event'];
  }
}

/** Rows with a single node in the middle lane: the fixed openings and the boss. */
function singleRow(chapter: number, row: number): boolean {
  return row === MAP_ROWS - 1 || row === 0 || (chapter === 1 && row <= 2);
}

export function buildMap(chapter: number, seed: number): RunMap {
  const rand = rng(hashText(`map:${seed}:${chapter}`));
  const levels = CHAPTERS[chapter - 1].levels;
  const fixed = chapter === 1 ? 3 : 1;
  const boss = levels[levels.length - 1].id;
  // The pool between the opening and the boss, easiest first; each battle row takes its own slice.
  const pool = levels.slice(fixed, -1).map((l) => l.id);
  const rows: RunNode[][] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const shapes = [[0, 1, 2], [0, 1, 2], [0, 2], [0, 1], [1, 2]];
    const lanes = singleRow(chapter, row) ? [1] : shapes[Math.floor(rand() * shapes.length)];
    const kinds = rowKinds(chapter, row);
    const nodes: RunNode[] = lanes.map((lane) => ({ id: `${row}-${lane}`, row, lane, kind: kinds[0], next: [] }));
    if (kinds.length > 1) {
      // Every battle row keeps at least one plain battle; no more than one elite or merchant per row.
      const used = new Set<NodeKind>();
      nodes.forEach((n, i) => {
        let kind = kinds[Math.floor(rand() * kinds.length)];
        if ((kind === 'elite' || kind === 'shop') && used.has(kind)) kind = kinds[0];
        if (i === nodes.length - 1 && kinds[0] === 'battle' && !nodes.some((m, j) => j < i && m.kind === 'battle')) kind = 'battle';
        used.add(kind);
        n.kind = kind;
      });
    }
    rows.push(nodes);
  }
  // Levels: the fixed openings, then the pool split in slices by row, the boss last.
  const battleRows = rows.map((_, i) => i).filter((i) => i >= fixed && i < MAP_ROWS - 1 && rows[i].some((n) => n.kind === 'battle' || n.kind === 'elite'));
  rows.forEach((nodes, row) => {
    for (const n of nodes) {
      if (n.kind === 'boss') n.level = boss;
      else if (row < fixed) n.level = levels[row].id;
      else if (n.kind === 'battle' || n.kind === 'elite') {
        const k = battleRows.indexOf(row);
        const from = Math.floor((k * pool.length) / battleRows.length);
        const to = Math.max(from + 1, Math.floor(((k + 1) * pool.length) / battleRows.length));
        // Elites take the hardest level of their slice.
        n.level = pool[n.kind === 'elite' ? to - 1 : from + Math.floor(rand() * (to - from))];
      }
    }
  });
  // Events: different ones on one map.
  const shuffle = <T>(list: T[]): T[] => {
    // Fisher–Yates with the map's own dice: the same map in every browser.
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const events = shuffle(EVENT_IDS.filter((id) => eventFits(id, chapter)));
  let e = 0;
  for (const nodes of rows) for (const n of nodes) if (n.kind === 'event') n.event = events[e++ % events.length];
  // Elites: a different rule each, where the map has room for it.
  const rules = shuffle(RULES);
  let r = 0;
  for (const nodes of rows) for (const n of nodes) if (n.kind === 'elite') n.rule = rules[r++ % rules.length];
  // Paths: each node leads to the nearest nodes of the next row; nothing is left unreachable.
  for (let row = 0; row < MAP_ROWS - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];
    const crosses = (a: RunNode, b: RunNode) => from.some((x) => x.next.some((id) => {
      const y = to.find((n) => n.id === id)!;
      return (x.lane < a.lane && y.lane > b.lane) || (x.lane > a.lane && y.lane < b.lane);
    }));
    const link = (a: RunNode, b: RunNode) => {
      if (!a.next.includes(b.id) && !crosses(a, b)) a.next.push(b.id);
    };
    const nearest = (a: RunNode) => {
      // Ties go left or right by one coin toss, not by the sort's own order.
      const coin = rand() < 0.5 ? 1 : -1;
      return [...to].sort((x, y) => Math.abs(x.lane - a.lane) - Math.abs(y.lane - a.lane) || (x.lane - y.lane) * coin);
    };
    for (const a of from) {
      const near = nearest(a);
      link(a, near[0]);
      if (near[1] && Math.abs(near[1].lane - a.lane) <= 1 && rand() < 0.45) link(a, near[1]);
    }
    for (const b of to) {
      if (from.some((a) => a.next.includes(b.id))) continue;
      const a = [...from].sort((x, y) => Math.abs(x.lane - b.lane) - Math.abs(y.lane - b.lane))[0];
      a.next.push(b.id);
    }
  }
  return { chapter, rows: MAP_ROWS, nodes: rows.flat() };
}

const mapCache = new Map<string, RunMap>();

export function runMap(run: RunState): RunMap {
  const key = `${run.chapter}:${run.seed}`;
  let map = mapCache.get(key);
  if (!map) {
    map = buildMap(run.chapter, run.seed);
    mapCache.set(key, map);
  }
  return map;
}

export function nodeById(run: RunState, id: string | null): RunNode | undefined {
  return id ? runMap(run).nodes.find((n) => n.id === id) : undefined;
}

/** Nodes the player may enter now: the start of the chapter, or what the last finished node leads to. */
export function availableNodes(run: RunState): RunNode[] {
  if (run.complete) return [];
  const map = runMap(run);
  if (run.at) return [nodeById(run, run.at)!];
  const last = nodeById(run, run.done[run.done.length - 1] ?? null);
  return last ? last.next.map((id) => nodeById(run, id)!) : map.nodes.filter((n) => n.row === 0);
}

/** The node being played (entered, not finished). */
export function currentNode(run: RunState): RunNode | undefined {
  return nodeById(run, run.at);
}

// ---------- Life cycle ----------

export function newRun(seed: number): RunState {
  return { chapter: 1, seed, done: [], at: null, bought: [], complete: false, over: null, wins: 0, elites: 0, bosses: 0 };
}

/** Start a chapter on a fresh map. */
export function startChapter(s: GameState, chapter: number, seed = s.run.seed): void {
  s.run = { ...s.run, chapter, seed, done: [], at: null, bought: [], chapterLosses: 0 };
}

/** Enter a node. Battles then go to the arena; events, merchants and camps open their dialog. */
export function enterNode(s: GameState, id: string): RunNode | null {
  const node = availableNodes(s.run).find((n) => n.id === id);
  if (!node) return null;
  s.run.at = node.id;
  return node;
}

export function finishNode(s: GameState): void {
  if (!s.run.at) return;
  s.run.done.push(s.run.at);
  s.run.at = null;
}

/** A won battle at the current node. The boss moves the story on. */
export function winNode(s: GameState): void {
  const node = currentNode(s.run);
  if (!node) return;
  s.run.wins++;
  if (node.kind === 'elite') {
    s.run.elites++;
    s.stats.elites++;
  }
  finishNode(s);
  if (node.kind !== 'boss') return;
  s.run.bosses++;
  // Beaten bosses open starting armies; a won game opens the warrior king.
  for (const id of ARMY_ORDER) {
    const opens = ARMIES[id].unlockedBy === node.level || (id === 'warrior' && s.run.chapter >= CHAPTERS.length);
    if (opens && !s.armies.includes(id)) s.armies.push(id);
  }
  if (s.run.chapter >= CHAPTERS.length) {
    s.run.complete = true;
    return;
  }
  startChapter(s, s.run.chapter + 1, (s.run.seed * 7 + s.run.chapter * 101) >>> 0);
}

export const SPARE: RelicId = 'spareBanner';

/** Lives left: the one every run has, plus a spare banner. */
export function lives(s: GameState): number {
  return 1 + (s.relics.includes(SPARE) ? 1 : 0);
}

/** A lost battle: a spare banner burns and the battle can be fought again, or the run is over. */
export function loseNode(s: GameState, at: string): 'spared' | 'over' {
  if (s.relics.includes(SPARE)) {
    s.relics = s.relics.filter((id) => id !== SPARE);
    return 'spared';
  }
  endRun(s, false, at);
  return 'over';
}

/** Crowns a run pays: one for every boss, two for the victory and one more per threat level. */
export function crownsForRun(s: GameState, won: boolean): number {
  return s.run.bosses + (won ? 2 + (s.run.threat ?? 0) : 0);
}

/** Close the run: pay its crowns and keep a summary for the end screen. */
export function endRun(s: GameState, won: boolean, at: string): RunOver {
  const crowns = crownsForRun(s, won);
  s.crowns += crowns;
  // A won game at the highest threat opens the next one.
  const threat = s.run.threat ?? 0;
  if (won && threat >= s.threatMax) s.threatMax = Math.min(MAX_THREAT, threat + 1);
  if (won) s.stats.bestThreat = Math.max(s.stats.bestThreat ?? -1, threat);
  s.stats.runs++;
  s.run.over = {
    won, chapter: s.run.chapter, at, wins: s.run.wins, elites: s.run.elites, bosses: s.run.bosses, crowns,
  };
  s.run.at = null;
  return s.run.over;
}

/** Is this campaign level the one at the current (or an enterable) battle node? */
export function runLevelOpen(run: RunState, levelId: string): boolean {
  return availableNodes(run).some((n) => n.level === levelId);
}

// ---------- Recruits ----------

/** A new kind of piece joins trained: at most this many levels below the army's best. */
/** The level a new piece of a kind joins at: a new kind starts raw, at its own level (1 at first). */
export function recruitLevel(s: GameState, kind: PieceKind): number {
  return s.levels[kind];
}

// ---------- Gold ----------

/** Gold scale of a chapter: what an ordinary battle in its middle pays. */
export function chapterGold(chapter: number): number {
  return Math.round(30 * 1.15 ** ((chapter - 1) * 9 + 4) * RUN_GOLD);
}

/** Battles of a run pay more than the old single level did: there are no replays to farm. */
export const RUN_GOLD = 3.2;
export const ELITE_GOLD = 1.6;
/** Elite enemies are this many levels stronger. */
export const ELITE_LEVELS = 2;

// ---------- Camp ----------

/** Levels a camp gives ("Походный котёл" doubles them). */
export function campGain(s: GameState): number {
  return s.relics.includes('campfire') ? 2 : 1;
}

export function campForge(s: GameState): void {
  s.buildings.forge += campGain(s);
  finishNode(s);
}

export function campTrain(s: GameState, kind: PieceKind): boolean {
  if (s.army[kind] <= 0) return false;
  s.levels[kind] += campGain(s);
  finishNode(s);
  return true;
}

// ---------- Merchant ----------

export interface ShopItem {
  id: string;
  name: string;
  text: string;
  cost: number;
  relic?: RelicId;
}

/** Merchant and smith prices ("Торговая грамота" cuts them). */
export function price(s: GameState, gold: number): number {
  return Math.round(gold * (s.relics.includes('charter') ? 0.6 : 1) * threatMods(s.run.threat ?? 0).prices);
}

export function shopItems(s: GameState, node: RunNode): ShopItem[] {
  const g = price(s, chapterGold(s.run.chapter));
  const relics = rollOffer([...s.relics, SPARE], hashText(`${s.run.seed}:${node.id}:${s.run.chapter}`));
  const items: ShopItem[] = relics.map((id) => ({ id: `relic:${id}`, name: '', text: '', cost: Math.round(g * 2.5), relic: id }));
  // The spare banner is always on sale, and dear: it is a second life.
  if (!threatMods(s.run.threat ?? 0).noBanner) items.push({ id: `relic:${SPARE}`, name: '', text: '', cost: Math.round(g * 3.5), relic: SPARE });
  items.push({ id: 'forge', name: t('Заточка'), text: t('+1 уровень Кузницы'), cost: Math.round(g * 1.5) });
  return items;
}

export function canBuy(s: GameState, node: RunNode, item: ShopItem): string | null {
  if (s.run.bought.includes(`${node.id}:${item.id}`)) return t('Куплено');
  if (item.relic && s.relics.includes(item.relic)) return t('Уже есть');
  if (s.gold < item.cost) return t('Не хватает золота');
  return null;
}

export function buyItem(s: GameState, node: RunNode, item: ShopItem): boolean {
  if (canBuy(s, node, item)) return false;
  s.gold -= item.cost;
  s.run.bought.push(`${node.id}:${item.id}`);
  if (item.relic) s.relics.push(item.relic);
  if (item.id === 'forge') s.buildings.forge++;
  return true;
}

// ---------- Events ----------

export type EventId =
  | 'wagon' | 'deserter' | 'shrine' | 'smith' | 'hermit' | 'dice' | 'militia' | 'crown'
  | 'well' | 'bard' | 'oracle' | 'outpost' | 'refugees' | 'ambush' | 'gravedigger' | 'library'
  | 'lake' | 'witch' | 'anvil' | 'tournament';

export interface EventChoice {
  label: string;
  /** What the choice does, shown under the button. */
  hint: string;
  /** Why it cannot be taken now, if so. */
  blocked?: (s: GameState) => string | null;
  /** Apply the choice; returns the line that tells what happened. */
  apply: (s: GameState, roll: number) => string;
}

export interface EventDef {
  title: string;
  text: string;
  choices: EventChoice[];
  /** Chapters it can turn up in (all when omitted). */
  from?: number;
  to?: number;
}

export function eventFits(id: EventId, chapter: number): boolean {
  const e = EVENTS[id];
  return chapter >= (e.from ?? 1) && chapter <= (e.to ?? 99);
}

/** Non-king piece kinds the army has, the most valuable first. */
function ownedKinds(s: GameState): PieceKind[] {
  const order: PieceKind[] = ['queen', 'chancellor', 'archbishop', 'rook', 'ghost', 'bishop', 'knight', 'pawn'];
  return order.filter((k) => s.army[k] > 0);
}

/** The relic the player is given by an event (a pick of three is too much for a roll). */
function giftRelic(s: GameState, roll: number): RelicId | null {
  const pool = RELIC_IDS.filter((id) => !s.relics.includes(id) && id !== SPARE);
  if (!pool.length) return null;
  const id = pool[Math.floor(roll * pool.length) % pool.length];
  s.relics.push(id);
  return id;
}

const PAWN_CAP = 8;

/** Gold of this chapter times `share`. */
const gold = (s: GameState, share: number) => Math.round(chapterGold(s.run.chapter) * share);
const afford = (cost: (s: GameState) => number) => (s: GameState) => (s.gold >= cost(s) ? null : t('Не хватает золота'));

/** A new piece of a kind, trained up like a recruit; it waits in the reserve. */
function recruit(s: GameState, kind: PieceKind): void {
  s.levels[kind] = recruitLevel(s, kind);
  s.army[kind]++;
}

export const EVENTS: Record<EventId, EventDef> = {
  wagon: {
    title: t('Брошенный обоз'),
    text: t('На обочине перевёрнутая телега Чёрной армии. Сундук с монетами цел, а под мешками что-то блестит.'),
    choices: [
      { label: t('Забрать монеты'), hint: t('+ золото'), apply: (s) => { const g = chapterGold(s.run.chapter); s.gold += g; return t('+{g} золота', { g }); } },
      {
        label: t('Разобрать завал'), hint: t('Реликвия или потеря пешки — пополам'),
        apply: (s, roll) => {
          if (roll < 0.5) {
            const id = giftRelic(s, roll * 2);
            return id ? t('Под мешками нашлась реликвия!') : t('Пусто — всё уже растащили.');
          }
          if (s.army.pawn > 1) {
            s.army.pawn--;
            return t('Телега рухнула и придавила пешку.');
          }
          return t('Телега рухнула, но никто не пострадал.');
        },
      },
    ],
  },
  deserter: {
    title: t('Перебежчик'),
    text: t('Чёрный конь бросил строй и просится под ваше знамя. Говорит, Чёрный король не прощает ошибок.'),
    choices: [
      { label: t('Принять'), hint: t('+1 конь в армию'), apply: (s) => { s.levels.knight = recruitLevel(s, 'knight'); s.army.knight++; return t('Конь встал в строй.'); } },
      { label: t('Взять выкуп'), hint: t('+ немного золота'), apply: (s) => { const g = Math.round(chapterGold(s.run.chapter) * 0.6); s.gold += g; return t('Конь откупился: +{g} золота', { g }); } },
    ],
  },
  shrine: {
    title: t('Тёмный алтарь'),
    text: t('Из трещины в доске сочится тьма. Говорят, она делает сильнее тех, кто готов чем-то пожертвовать.'),
    choices: [
      {
        label: t('Пожертвовать пешку'), hint: t('−1 пешка, +1 уровень лучшей фигуре'),
        blocked: (s) => (s.army.pawn > 1 ? null : t('Нужно хотя бы две пешки')),
        apply: (s) => {
          s.army.pawn--;
          const kind = ownedKinds(s).find((k) => k !== 'pawn') ?? 'king';
          s.levels[kind]++;
          return kind === 'king' ? t('Тьма приняла жертву. Король стал сильнее.') : t('Тьма приняла жертву. Лучшая фигура стал сильнее.');
        },
      },
      { label: t('Пройти мимо'), hint: t('Ничего'), apply: () => t('Вы обошли алтарь стороной.') },
    ],
  },
  smith: {
    title: t('Странствующий кузнец'),
    text: t('Старый кузнец точит клинки у дороги. Возьмётся и за вашу армию, но не бесплатно.'),
    choices: [
      {
        label: t('Заказать заточку'), hint: t('+1 уровень Кузницы за золото'),
        blocked: afford((s) => price(s, gold(s, 0.8))),
        apply: (s) => { s.gold -= price(s, gold(s, 0.8)); s.buildings.forge++; return t('Клинки острее прежнего: +1 уровень Кузницы.'); },
      },
      { label: t('Отказаться'), hint: t('Ничего'), apply: () => t('Кузнец пожал плечами.') },
    ],
  },
  hermit: {
    title: t('Отшельник'),
    text: t('В хижине у дороги живёт отшельник, когда-то служивший Белому королю.'),
    choices: [
      {
        label: t('Попросить знамя'), hint: t('Запасное знамя: вторая жизнь'),
        blocked: (s) => (s.relics.includes(SPARE) ? t('Знамя уже есть') : threatMods(s.run.threat ?? 0).noBanner ? t('Угроза: без знамён') : null),
        apply: (s) => { s.relics.push(SPARE); return t('Отшельник вышил новое знамя. Одно поражение вам простится.'); },
      },
      { label: t('Учиться у него'), hint: t('+1 уровень короля'), apply: (s) => { s.levels.king++; return t('Король вспомнил старые уроки: +1 уровень.'); } },
    ],
  },
  dice: {
    title: t('Кости наёмников'),
    text: t('Наёмники у костра предлагают сыграть. Ставка — половина вашего золота.'),
    choices: [
      {
        label: t('Сыграть'), hint: t('Половина золота: удвоить или потерять'),
        blocked: (s) => (s.gold >= 20 ? null : t('Нечего ставить')),
        apply: (s, roll) => {
          const stake = Math.floor(s.gold / 2);
          if (roll < 0.5) {
            s.gold += stake;
            return t('Выпало две шестёрки! +{stake} золота', { stake });
          }
          s.gold -= stake;
          return t('Не повезло: −{stake} золота', { stake });
        },
      },
      { label: t('Уйти'), hint: t('Ничего'), apply: () => t('Вы вежливо отказались.') },
    ],
  },
  militia: {
    title: t('Деревня ополченцев'),
    text: t('Крестьяне устали от набегов Чёрной армии и готовы помочь — людьми или припасами.'),
    choices: [
      {
        label: t('Взять людей'), hint: t('+2 пешки'),
        blocked: (s) => (s.army.pawn < PAWN_CAP ? null : t('Пешек уже восемь')),
        apply: (s) => { const n = Math.min(2, PAWN_CAP - s.army.pawn); s.army.pawn += n; return t('+{n} пешки в строю.', { n }); },
      },
      { label: t('Взять припасы'), hint: t('+ золото'), apply: (s) => { const g = Math.round(chapterGold(s.run.chapter) * 0.8); s.gold += g; return t('+{g} золота', { g }); } },
    ],
  },
  crown: {
    title: t('Проклятая корона'),
    text: t('На пне лежит корона Чёрного короля. Она сильна — но заберёт с собой лучшего из ваших бойцов.'),
    choices: [
      {
        label: t('Взять корону'), hint: t('Реликвия, но −1 лучшая фигура'),
        blocked: (s) => (ownedKinds(s).some((k) => k !== 'pawn') ? null : t('Нужна фигура сильнее пешки')),
        apply: (s, roll) => {
          const kind = ownedKinds(s).find((k) => k !== 'pawn')!;
          s.army[kind]--;
          s.formation = s.formation.filter((f, _, all) => f.kind !== kind || all.filter((g) => g.kind === kind).indexOf(f) < s.army[kind]);
          const id = giftRelic(s, roll);
          return id ? t('Корона стала реликвией, а лучший боец ушёл во тьму.') : t('Корона рассыпалась в прах.');
        },
      },
      { label: t('Оставить'), hint: t('Ничего'), apply: () => t('Пусть лежит.') },
    ],
  },
  well: {
    title: t('Колодец желаний'),
    text: t('Старый колодец на перекрёстке. Говорят, он исполняет желания тех, кто не жалеет монет.'),
    choices: [
      {
        label: t('Бросить монету'), hint: t('Немного золота: может, +20% атаки на 3 боя'),
        blocked: afford((s) => gold(s, 0.3)),
        apply: (s, roll) => {
          s.gold -= gold(s, 0.3);
          if (roll < 0.65) {
            addBoon(s, { name: t('Желание'), atk: 1.2, hp: 1, left: 3 });
            return t('Вода засветилась: желание сбудется. +20% атаки на 3 боя.');
          }
          return t('Монета булькнула — и всё.');
        },
      },
      { label: t('Уйти'), hint: t('Ничего'), apply: () => t('Вы не верите в сказки.') },
    ],
  },
  bard: {
    title: t('Бродячий менестрель'),
    text: t('Менестрель с лютней знает песни о каждой битве Белого королевства и готов сложить новую — о вас.'),
    choices: [
      {
        label: t('Заказать балладу'), hint: t('+15% атаки и здоровья на 2 боя'),
        blocked: afford((s) => gold(s, 0.5)),
        apply: (s) => {
          s.gold -= gold(s, 0.5);
          addBoon(s, { name: t('Баллада'), atk: 1.15, hp: 1.15, left: 2 });
          return t('Армия идёт в бой под новую песню: +15% атаки и здоровья на 2 боя.');
        },
      },
      {
        label: t('Подпеть самим'), hint: t('Бесплатно: +10% атаки на 1 бой'),
        apply: (s) => { addBoon(s, { name: t('Походная песня'), atk: 1.1, hp: 1, left: 1 }); return t('Вышло нестройно, но от души: +10% атаки на 1 бой.'); },
      },
    ],
  },
  oracle: {
    title: t('Слепой оракул'),
    text: t('Слепой старик видит доску лучше зрячих. Он ответит на один вопрос.'),
    choices: [
      {
        label: t('Спросить о боссе'), hint: t('Босс главы: −20% здоровья'),
        apply: (s) => { addBoon(s, { name: t('Пророчество'), atk: 1, hp: 1, foe: 0.8, left: 1, boss: true }); return t('Оракул назвал слабое место босса: у него будет на 20% меньше здоровья.'); },
      },
      {
        label: t('Спросить о пути'), hint: t('+25% здоровья на 2 боя'),
        apply: (s) => { addBoon(s, { name: t('Верный путь'), atk: 1, hp: 1.25, left: 2 }); return t('Вы знаете, где ждут засады: +25% здоровья на 2 боя.'); },
      },
    ],
  },
  outpost: {
    title: t('Брошенная застава'),
    text: t('Белая сторожевая башня пуста, но ладья на её стене ещё цела и готова служить.'),
    to: 2,
    choices: [
      {
        label: t('Поднять ладью'), hint: t('+1 ладья в армию'),
        blocked: (s) => (s.army.rook < 2 ? null : t('Ладей уже две')),
        apply: (s) => { recruit(s, 'rook'); return t('Ладья спустилась со стены и встала в резерв.'); },
      },
      { label: t('Обыскать склад'), hint: t('+ золото'), apply: (s) => { const g = gold(s, 0.7); s.gold += g; return t('+{g} золота', { g }); } },
    ],
  },
  refugees: {
    title: t('Беженцы'),
    text: t('По дороге бредут крестьяне из сожжённой деревни. Им нечего есть.'),
    choices: [
      {
        label: t('Накормить'), hint: t('+1 пешка и +10% здоровья на 3 боя'),
        blocked: afford((s) => gold(s, 0.4)),
        apply: (s) => {
          s.gold -= gold(s, 0.4);
          if (s.army.pawn < PAWN_CAP) s.army.pawn++;
          addBoon(s, { name: t('Благодарность'), atk: 1, hp: 1.1, left: 3 });
          return t('Один из беженцев взял копьё, а армия воспряла духом.');
        },
      },
      { label: t('Пройти мимо'), hint: t('Ничего'), apply: () => t('Война не ждёт.') },
    ],
  },
  ambush: {
    title: t('Засада на перевале'),
    text: t('На узкой тропе вас поджидают чёрные пехотинцы. Их вожак насмешливо машет вам рукой.'),
    from: 2,
    choices: [
      {
        label: t('Прорваться'), hint: t('−1 пешка, + много золота из их обоза'),
        apply: (s) => {
          const g = gold(s, 1.1);
          s.gold += g;
          if (s.army.pawn > 1) {
            s.army.pawn--;
            return t('Прорвались, потеряв пешку. Обоз ваш: +{g} золота.', { g });
          }
          return t('Прорвались без потерь! +{g} золота.', { g });
        },
      },
      {
        label: t('Вызвать вожака'), hint: t('Реликвия или −20% атаки на 2 боя — пополам'),
        apply: (s, roll) => {
          if (roll < 0.5) return giftRelic(s, roll * 2) ? t('Вожак повержен, его трофей — ваш!') : t('Вожак повержен, но у него ничего не было.');
          addBoon(s, { name: t('Рана короля'), atk: 0.8, hp: 1, left: 2 });
          return t('Вожак ранил вашего короля и скрылся. −20% атаки на 2 боя.');
        },
      },
      {
        label: t('Обойти горами'), hint: t('−15% здоровья на 2 боя'),
        apply: (s) => { addBoon(s, { name: t('Усталость'), atk: 1, hp: 0.85, left: 2 }); return t('Горная тропа вымотала армию: −15% здоровья на 2 боя.'); },
      },
    ],
  },
  gravedigger: {
    title: t('Могильщик'),
    text: t('Могильщик на старом поле боя скупает трофеи и знает, где лежат герои.'),
    from: 2,
    choices: [
      {
        label: t('Продать реликвию'), hint: t('Случайная реликвия → много золота'),
        blocked: (s) => (s.relics.some((id) => id !== SPARE) ? null : t('Нечего продать')),
        apply: (s, roll) => {
          const pool = s.relics.filter((id) => id !== SPARE);
          const id = pool[Math.floor(roll * pool.length) % pool.length];
          s.relics = s.relics.filter((r) => r !== id);
          const g = gold(s, 3);
          s.gold += g;
          return t('Могильщик унёс реликвию и отсыпал +{g} золота.', { g });
        },
      },
      {
        label: t('Раскопать могилу героя'), hint: t('+1 уровень лучшей фигуре или проклятие −10% атаки на 3 боя'),
        apply: (s, roll) => {
          if (roll < 0.6) {
            const kind = ownedKinds(s)[0] ?? 'king';
            s.levels[kind]++;
            return t('Меч героя достался лучшему бойцу: +1 уровень.');
          }
          addBoon(s, { name: t('Проклятие могилы'), atk: 0.9, hp: 1, left: 3 });
          return t('Из могилы потянуло холодом. −10% атаки на 3 боя.');
        },
      },
      { label: t('Уйти'), hint: t('Ничего'), apply: () => t('Пусть мёртвые спят.') },
    ],
  },
  library: {
    title: t('Заброшенная библиотека'),
    text: t('Среди обугленных полок уцелели два тома: трактат о тактике и карта тайных троп.'),
    from: 2,
    choices: [
      {
        label: t('Трактат о тактике'), hint: t('+1 уровень самой отстающей фигуре'),
        apply: (s) => {
          const kinds = ownedKinds(s);
          const kind = kinds.length ? kinds.reduce((a, k) => (s.levels[k] < s.levels[a] ? k : a)) : 'king';
          s.levels[kind]++;
          return t('Отстающие подтянулись: +1 уровень.');
        },
      },
      {
        label: t('Карта тайных троп'), hint: t('Враги −15% здоровья на 2 боя'),
        apply: (s) => { addBoon(s, { name: t('Тайные тропы'), atk: 1, hp: 1, foe: 0.85, left: 2 }); return t('Вы зайдёте врагу в тыл: −15% здоровья врагов на 2 боя.'); },
      },
    ],
  },
  lake: {
    title: t('Зеркальное озеро'),
    text: t('Гладь озера отражает не вас, а ваших бойцов — только чуть темнее. Отражение можно позвать с собой.'),
    from: 3,
    choices: [
      {
        label: t('Позвать отражение'), hint: t('Копия лучшей фигуры, но −15% здоровья на 3 боя'),
        blocked: (s) => (ownedKinds(s).some((k) => k !== 'pawn') ? null : t('Нужна фигура сильнее пешки')),
        apply: (s) => {
          const kind = ownedKinds(s).find((k) => k !== 'pawn')!;
          s.army[kind]++;
          addBoon(s, { name: t('Холод отражения'), atk: 1, hp: 0.85, left: 3 });
          return t('Отражение вышло на берег и встало в резерв. Армию знобит: −15% здоровья на 3 боя.');
        },
      },
      {
        label: t('Разбить гладь'), hint: t('+15% атаки на 2 боя'),
        apply: (s) => { addBoon(s, { name: t('Ярость'), atk: 1.15, hp: 1, left: 2 }); return t('Осколки отражений злят армию: +15% атаки на 2 боя.'); },
      },
    ],
  },
  witch: {
    title: t('Болотная ведьма'),
    text: t('Ведьма в тумане варит зелья. Ей нужно то, что дорого вам.'),
    from: 3,
    choices: [
      {
        label: t('Отдать знамя'), hint: t('Запасное знамя → две реликвии'),
        blocked: (s) => (s.relics.includes(SPARE) ? null : t('Нет запасного знамени')),
        apply: (s, roll) => {
          s.relics = s.relics.filter((id) => id !== SPARE);
          const got = [giftRelic(s, roll), giftRelic(s, (roll * 7) % 1)].filter(Boolean).length;
          if (!got) return t('Ведьма сожгла знамя, но реликвий у неё не нашлось.');
          return got === 2 ? t('Ведьма сожгла знамя и отдала две реликвии.') : t('Ведьма сожгла знамя и отдала реликвию.');
        },
      },
      {
        label: t('Выпить зелье'), hint: t('+2 уровня короля или −20% здоровья на 2 боя'),
        apply: (s, roll) => {
          if (roll < 0.55) {
            s.levels.king += 2;
            return t('Король помолодел: +2 уровня.');
          }
          addBoon(s, { name: t('Отрава'), atk: 1, hp: 0.8, left: 2 });
          return t('Зелье оказалось ядом. −20% здоровья на 2 боя.');
        },
      },
      { label: t('Уйти'), hint: t('Ничего'), apply: () => t('Ведьма хихикнула вслед.') },
    ],
  },
  anvil: {
    title: t('Древняя наковальня'),
    text: t('В руинах крепости — наковальня первых королей. На ней куют не клинки, а судьбы.'),
    from: 4,
    choices: [
      {
        label: t('Переплавить золото'), hint: t('+2 уровня Кузницы'),
        blocked: afford((s) => price(s, gold(s, 1.2))),
        apply: (s) => { s.gold -= price(s, gold(s, 1.2)); s.buildings.forge += 2; return t('Золото стало сталью: +2 уровня Кузницы.'); },
      },
      {
        label: t('Перековать короля'), hint: t('−1 пешка, +2 уровня короля'),
        blocked: (s) => (s.army.pawn > 1 ? null : t('Нужно хотя бы две пешки')),
        apply: (s) => { s.army.pawn--; s.levels.king += 2; return t('Пешка отдала свой щит королю: +2 уровня.'); },
      },
    ],
  },
  tournament: {
    title: t('Рыцарский турнир'),
    text: t('Вольные рыцари устроили турнир. Победителю — кошель золота и слава.'),
    from: 2,
    choices: [
      {
        label: t('Выставить чемпиона'), hint: t('Золото и +15% атаки на 2 боя или −15% атаки на 2 боя'),
        apply: (s, roll) => {
          if (roll < 0.55) {
            const g = gold(s, 1.2);
            s.gold += g;
            addBoon(s, { name: t('Слава'), atk: 1.15, hp: 1, left: 2 });
            return t('Ваш чемпион победил! +{g} золота и +15% атаки на 2 боя.', { g });
          }
          addBoon(s, { name: t('Позор'), atk: 0.85, hp: 1, left: 2 });
          return t('Чемпион вылетел из седла. Армия приуныла: −15% атаки на 2 боя.');
        },
      },
      { label: t('Смотреть с трибун'), hint: t('Ничего'), apply: () => t('Красивый был турнир.') },
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

/** Make a choice at the current event node. Returns the outcome line, or null if it cannot be taken. */
export function chooseEvent(s: GameState, choice: number): string | null {
  const node = currentNode(s.run);
  if (!node?.event) return null;
  const c = EVENTS[node.event].choices[choice];
  if (!c || c.blocked?.(s)) return null;
  const line = c.apply(s, nodeRoll(s.run, node.id, String(choice)));
  s.stats.events++;
  finishNode(s);
  return line;
}
