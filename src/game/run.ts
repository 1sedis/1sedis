/**
 * The run: a game (партия) is played chapter by chapter on a branching map,
 * like a roguelite. Every chapter starts at its first level, forks into lanes
 * of battles, elites, events, merchants and camps, and ends at the boss.
 *
 * Banners are the stake: a lost battle costs one. Without banners the chapter
 * starts over on a new map with the army the player entered it with.
 *
 * The map itself is never stored: it is rebuilt from the seed and the chapter.
 */
import { CHAPTERS } from './levels';
import type { PieceKind } from './pieces';
import { RELIC_IDS, rollOffer, type RelicId } from './relics';
import type { BuildingId, FormationSlot, GameState } from './state';
import type { Branch } from './abilities';

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
  next: string[];
}

export interface RunMap {
  chapter: number;
  rows: number;
  nodes: RunNode[];
}

/** What the player had on entering the chapter: a restart puts it all back. */
export interface RunSnapshot {
  gold: number;
  army: Record<PieceKind, number>;
  levels: Record<PieceKind, number>;
  buildings: Record<BuildingId, number>;
  relics: RelicId[];
  relicPicks: number;
  formation: FormationSlot[];
  abilityBranch: Record<PieceKind, Branch>;
}

export interface RunState {
  chapter: number;
  seed: number;
  banners: number;
  /** Nodes finished in this chapter, in the order they were taken. */
  done: string[];
  /** The node entered and not finished yet (a battle being fought, an open merchant). */
  at: string | null;
  /** Merchant goods already bought, as "node:item". */
  bought: string[];
  /** The whole story of this game is won (the fourth boss fell). */
  complete: boolean;
  snapshot: RunSnapshot | null;
  /** Chapters started over in this game. */
  restarts: number;
  /** Banners lost in the current chapter (for "a clean chapter"). */
  lost: number;
  /** Gold earned off the map in this chapter (treasury, Abyss, achievements): a restart keeps it. */
  kept: number;
}

export const BANNERS = 3;
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
  const events = [...EVENT_IDS].sort(() => rand() - 0.5);
  let e = 0;
  for (const nodes of rows) for (const n of nodes) if (n.kind === 'event') n.event = events[e++ % events.length];
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
    const nearest = (a: RunNode) => [...to].sort((x, y) => Math.abs(x.lane - a.lane) - Math.abs(y.lane - a.lane) || rand() - 0.5);
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
  return { chapter: 1, seed, banners: BANNERS, done: [], at: null, bought: [], complete: false, snapshot: null, restarts: 0, lost: 0, kept: 0 };
}

export function takeSnapshot(s: GameState): RunSnapshot {
  return structuredClone({
    gold: s.gold, army: s.army, levels: s.levels, buildings: s.buildings, relics: s.relics,
    relicPicks: s.relicPicks, formation: s.formation, abilityBranch: s.abilityBranch,
  });
}

/** Start a chapter: a fresh map, full banners, and a snapshot to fall back to. */
export function startChapter(s: GameState, chapter: number, seed = s.run.seed): void {
  s.run = { ...s.run, chapter, seed, banners: BANNERS, done: [], at: null, bought: [], lost: 0, kept: 0, snapshot: takeSnapshot(s) };
}

/**
 * Out of banners: back to the start of the chapter on a new map, with the army,
 * gold and relics as they were. Gold earned off the map stays.
 */
export function restartChapter(s: GameState): void {
  const snap = s.run.snapshot;
  const kept = s.run.kept;
  if (snap) Object.assign(s, structuredClone(snap));
  s.gold += kept;
  s.relicOffer = null;
  s.run.restarts++;
  startChapter(s, s.run.chapter, (s.run.seed * 31 + 17) >>> 0);
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
  if (node.kind === 'elite') s.stats.elites++;
  finishNode(s);
  if (node.kind !== 'boss') return;
  if (s.run.lost === 0) s.stats.cleanChapters++;
  if (s.run.chapter >= CHAPTERS.length) {
    s.run.complete = true;
    return;
  }
  startChapter(s, s.run.chapter + 1, (s.run.seed * 7 + s.run.chapter * 101) >>> 0);
}

/** A lost battle costs a banner. Returns true when that was the last one and the chapter started over. */
export function loseNode(s: GameState): boolean {
  s.run.banners--;
  s.run.lost++;
  if (s.run.banners > 0) return false;
  restartChapter(s);
  return true;
}

/** Gold that came from outside the map (treasury, Abyss, achievements). */
export function keepGold(s: GameState, amount: number): void {
  s.run.kept += Math.max(0, amount);
}

/** Is this campaign level the one at the current (or an enterable) battle node? */
export function runLevelOpen(run: RunState, levelId: string): boolean {
  return availableNodes(run).some((n) => n.level === levelId);
}

// ---------- Gold ----------

/** Gold scale of a chapter: what an ordinary battle in its middle pays. */
export function chapterGold(chapter: number): number {
  return Math.round(30 * 1.15 ** ((chapter - 1) * 9 + 4) * RUN_GOLD);
}

/** Battles of a run pay more than the old single level did: there are no replays to farm. */
export const RUN_GOLD = 3;
export const ELITE_GOLD = 1.6;
/** Elite enemies are this many levels stronger. */
export const ELITE_LEVELS = 1;

// ---------- Camp ----------

export function campRest(s: GameState): boolean {
  if (s.run.banners >= BANNERS) return false;
  s.run.banners++;
  finishNode(s);
  return true;
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
  const relics = rollOffer(s.relics, hashText(`${s.run.seed}:${node.id}:${s.run.chapter}`));
  const items: ShopItem[] = relics.map((id) => ({ id: `relic:${id}`, name: '', text: '', cost: Math.round(g * 2.5), relic: id }));
  items.push({ id: 'banner', name: 'Знамя', text: '+1 знамя (не больше трёх)', cost: Math.round(g * 1.2) });
  items.push({ id: 'forge', name: 'Заточка', text: '+1 уровень Кузницы', cost: Math.round(g * 1.5) });
  return items;
}

export function canBuy(s: GameState, node: RunNode, item: ShopItem): string | null {
  if (s.run.bought.includes(`${node.id}:${item.id}`)) return 'Куплено';
  if (item.relic && s.relics.includes(item.relic)) return 'Уже есть';
  if (item.id === 'banner' && s.run.banners >= BANNERS) return 'Знамёна полны';
  if (s.gold < item.cost) return 'Не хватает золота';
  return null;
}

export function buyItem(s: GameState, node: RunNode, item: ShopItem): boolean {
  if (canBuy(s, node, item)) return false;
  s.gold -= item.cost;
  s.run.bought.push(`${node.id}:${item.id}`);
  if (item.relic) s.relics.push(item.relic);
  if (item.id === 'banner') s.run.banners++;
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
  const pool = RELIC_IDS.filter((id) => !s.relics.includes(id));
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
      { label: 'Принять', hint: '+1 конь в армию', apply: (s) => { s.army.knight++; return 'Конь встал в строй.'; } },
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
        label: 'Попросить благословения', hint: '+1 знамя',
        blocked: (s) => (s.run.banners < BANNERS ? null : 'Знамёна полны'),
        apply: (s) => { s.run.banners++; return 'Отшельник вышил новое знамя.'; },
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
    text: 'На пне лежит корона Чёрного короля. Она сильна — но тот, кто её возьмёт, потеряет знамя.',
    choices: [
      {
        label: 'Взять корону', hint: 'Реликвия, но −1 знамя',
        blocked: (s) => (s.run.banners > 1 ? null : 'Последнее знамя не отдать'),
        apply: (s, roll) => {
          s.run.banners--;
          s.run.lost++;
          const id = giftRelic(s, roll);
          return id ? 'Корона стала реликвией, а знамя истлело.' : 'Корона рассыпалась в прах вместе со знаменем.';
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
