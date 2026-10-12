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
  /** Where it ended: the level of the lost battle, or the Abyss floor. */
  at: string;
  wins: number;
  elites: number;
  bosses: number;
  abyss: number;
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
}

/** Rows of a chapter map, the boss row included. */
export const MAP_ROWS = 8;

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
    return row === 3 ? ['battle', 'event'] : row === 4 ? ['battle', 'elite', 'shop'] : ['battle', 'event', 'elite'];
  }
  switch (row) {
    case 0: return ['battle'];
    case 1: return ['battle', 'event'];
    case 2: return ['battle', 'elite', 'shop', 'event'];
    case 3: return ['camp', 'shop', 'event'];
    case 4: return ['battle', 'elite', 'event'];
    default: return ['battle', 'elite', 'shop'];
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
  const events = shuffle(EVENT_IDS);
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
  s.run = { ...s.run, chapter, seed, done: [], at: null, bought: [] };
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
export function loseNode(s: GameState, at: string, won = false): 'spared' | 'over' {
  if (s.relics.includes(SPARE)) {
    s.relics = s.relics.filter((id) => id !== SPARE);
    return 'spared';
  }
  endRun(s, won, at);
  return 'over';
}

/** Crowns a run pays: one for every boss, two for the victory, one for every ten Abyss floors. */
export function crownsForRun(s: GameState, won: boolean): number {
  return s.run.bosses + (won ? 2 : 0) + Math.floor(Math.max(0, s.abyss.floor - 1) / 10);
}

/** Close the run: pay its crowns and keep a summary for the end screen. */
export function endRun(s: GameState, won: boolean, at: string): RunOver {
  const crowns = crownsForRun(s, won);
  s.crowns += crowns;
  s.stats.runs++;
  s.run.over = {
    won, chapter: s.run.chapter, at, wins: s.run.wins, elites: s.run.elites, bosses: s.run.bosses,
    abyss: Math.max(0, s.abyss.floor - 1), crowns,
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
export const RECRUIT_GAP = 2;

/** The level the first piece of a kind would join at. */
export function recruitLevel(s: GameState, kind: PieceKind): number {
  if (s.army[kind] > 0) return s.levels[kind];
  const owned = (Object.keys(s.army) as PieceKind[]).filter((k) => k !== 'king' && s.army[k] > 0);
  const best = Math.max(1, ...owned.map((k) => s.levels[k]));
  return Math.max(s.levels[kind], best - RECRUIT_GAP);
}

// ---------- Gold ----------

/** Gold scale of a chapter: what an ordinary battle in its middle pays. */
export function chapterGold(chapter: number): number {
  return Math.round(30 * 1.15 ** ((chapter - 1) * 9 + 4) * RUN_GOLD);
}

/** Battles of a run pay more than the old single level did: there are no replays to farm. */
export const RUN_GOLD = 3.8;
export const ELITE_GOLD = 1.6;
/** Elite enemies are this many levels stronger. */
export const ELITE_LEVELS = 1;

// ---------- Camp ----------

export function campForge(s: GameState): void {
  s.buildings.forge++;
  finishNode(s);
}

export function campTrain(s: GameState, kind: PieceKind): boolean {
  if (s.army[kind] <= 0) return false;
  s.levels[kind]++;
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

export function shopItems(s: GameState, node: RunNode): ShopItem[] {
  const g = chapterGold(s.run.chapter);
  const relics = rollOffer([...s.relics, SPARE], hashText(`${s.run.seed}:${node.id}:${s.run.chapter}`));
  const items: ShopItem[] = relics.map((id) => ({ id: `relic:${id}`, name: '', text: '', cost: Math.round(g * 2.5), relic: id }));
  // The spare banner is always on sale, and dear: it is a second life.
  items.push({ id: `relic:${SPARE}`, name: '', text: '', cost: Math.round(g * 3.5), relic: SPARE });
  items.push({ id: 'forge', name: 'Заточка', text: '+1 уровень Кузницы', cost: Math.round(g * 1.5) });
  return items;
}

export function canBuy(s: GameState, node: RunNode, item: ShopItem): string | null {
  if (s.run.bought.includes(`${node.id}:${item.id}`)) return 'Куплено';
  if (item.relic && s.relics.includes(item.relic)) return 'Уже есть';
  if (s.gold < item.cost) return 'Не хватает золота';
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

export type EventId = 'wagon' | 'deserter' | 'shrine' | 'smith' | 'hermit' | 'dice' | 'militia' | 'crown';

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

export const EVENTS: Record<EventId, EventDef> = {
  wagon: {
    title: 'Брошенный обоз',
    text: 'На обочине перевёрнутая телега Чёрной армии. Сундук с монетами цел, а под мешками что-то блестит.',
    choices: [
      { label: 'Забрать монеты', hint: '+ золото', apply: (s) => { const g = chapterGold(s.run.chapter); s.gold += g; return `+${g} золота`; } },
      {
        label: 'Разобрать завал', hint: 'Реликвия или потеря пешки — пополам',
        apply: (s, roll) => {
          if (roll < 0.5) {
            const id = giftRelic(s, roll * 2);
            return id ? 'Под мешками нашлась реликвия!' : 'Пусто — всё уже растащили.';
          }
          if (s.army.pawn > 1) {
            s.army.pawn--;
            return 'Телега рухнула и придавила пешку.';
          }
          return 'Телега рухнула, но никто не пострадал.';
        },
      },
    ],
  },
  deserter: {
    title: 'Перебежчик',
    text: 'Чёрный конь бросил строй и просится под ваше знамя. Говорит, Чёрный король не прощает ошибок.',
    choices: [
      { label: 'Принять', hint: '+1 конь в армию', apply: (s) => { s.levels.knight = recruitLevel(s, 'knight'); s.army.knight++; return 'Конь встал в строй.'; } },
      { label: 'Взять выкуп', hint: '+ немного золота', apply: (s) => { const g = Math.round(chapterGold(s.run.chapter) * 0.6); s.gold += g; return `Конь откупился: +${g} золота`; } },
    ],
  },
  shrine: {
    title: 'Тёмный алтарь',
    text: 'Из трещины в доске сочится тьма. Говорят, она делает сильнее тех, кто готов чем-то пожертвовать.',
    choices: [
      {
        label: 'Пожертвовать пешку', hint: '−1 пешка, +1 уровень лучшей фигуре',
        blocked: (s) => (s.army.pawn > 1 ? null : 'Нужно хотя бы две пешки'),
        apply: (s) => {
          s.army.pawn--;
          const kind = ownedKinds(s).find((k) => k !== 'pawn') ?? 'king';
          s.levels[kind]++;
          return `Тьма приняла жертву. ${kind === 'king' ? 'Король' : 'Лучшая фигура'} стал сильнее.`;
        },
      },
      { label: 'Пройти мимо', hint: 'Ничего', apply: () => 'Вы обошли алтарь стороной.' },
    ],
  },
  smith: {
    title: 'Странствующий кузнец',
    text: 'Старый кузнец точит клинки у дороги. Возьмётся и за вашу армию, но не бесплатно.',
    choices: [
      {
        label: 'Заказать заточку', hint: '+1 уровень Кузницы за золото',
        blocked: (s) => (s.gold >= Math.round(chapterGold(s.run.chapter) * 0.8) ? null : 'Не хватает золота'),
        apply: (s) => { s.gold -= Math.round(chapterGold(s.run.chapter) * 0.8); s.buildings.forge++; return 'Клинки острее прежнего: +1 уровень Кузницы.'; },
      },
      { label: 'Отказаться', hint: 'Ничего', apply: () => 'Кузнец пожал плечами.' },
    ],
  },
  hermit: {
    title: 'Отшельник',
    text: 'В хижине у дороги живёт отшельник, когда-то служивший Белому королю.',
    choices: [
      {
        label: 'Попросить знамя', hint: 'Запасное знамя: вторая жизнь',
        blocked: (s) => (s.relics.includes(SPARE) ? 'Знамя уже есть' : null),
        apply: (s) => { s.relics.push(SPARE); return 'Отшельник вышил новое знамя. Одно поражение вам простится.'; },
      },
      { label: 'Учиться у него', hint: '+1 уровень короля', apply: (s) => { s.levels.king++; return 'Король вспомнил старые уроки: +1 уровень.'; } },
    ],
  },
  dice: {
    title: 'Кости наёмников',
    text: 'Наёмники у костра предлагают сыграть. Ставка — половина вашего золота.',
    choices: [
      {
        label: 'Сыграть', hint: 'Половина золота: удвоить или потерять',
        blocked: (s) => (s.gold >= 20 ? null : 'Нечего ставить'),
        apply: (s, roll) => {
          const stake = Math.floor(s.gold / 2);
          if (roll < 0.5) {
            s.gold += stake;
            return `Выпало две шестёрки! +${stake} золота`;
          }
          s.gold -= stake;
          return `Не повезло: −${stake} золота`;
        },
      },
      { label: 'Уйти', hint: 'Ничего', apply: () => 'Вы вежливо отказались.' },
    ],
  },
  militia: {
    title: 'Деревня ополченцев',
    text: 'Крестьяне устали от набегов Чёрной армии и готовы помочь — людьми или припасами.',
    choices: [
      {
        label: 'Взять людей', hint: '+2 пешки',
        blocked: (s) => (s.army.pawn < PAWN_CAP ? null : 'Пешек уже восемь'),
        apply: (s) => { const n = Math.min(2, PAWN_CAP - s.army.pawn); s.army.pawn += n; return `+${n} пешки в строю.`; },
      },
      { label: 'Взять припасы', hint: '+ золото', apply: (s) => { const g = Math.round(chapterGold(s.run.chapter) * 0.8); s.gold += g; return `+${g} золота`; } },
    ],
  },
  crown: {
    title: 'Проклятая корона',
    text: 'На пне лежит корона Чёрного короля. Она сильна — но заберёт с собой лучшего из ваших бойцов.',
    choices: [
      {
        label: 'Взять корону', hint: 'Реликвия, но −1 лучшая фигура',
        blocked: (s) => (ownedKinds(s).some((k) => k !== 'pawn') ? null : 'Нужна фигура сильнее пешки'),
        apply: (s, roll) => {
          const kind = ownedKinds(s).find((k) => k !== 'pawn')!;
          s.army[kind]--;
          s.formation = s.formation.filter((f, _, all) => f.kind !== kind || all.filter((g) => g.kind === kind).indexOf(f) < s.army[kind]);
          const id = giftRelic(s, roll);
          return id ? 'Корона стала реликвией, а лучший боец ушёл во тьму.' : 'Корона рассыпалась в прах.';
        },
      },
      { label: 'Оставить', hint: 'Ничего', apply: () => 'Пусть лежит.' },
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
