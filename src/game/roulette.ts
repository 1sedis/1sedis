import type { PieceKind } from './pieces';

/**
 * Roulette of the Abyss: shards buy random permanent buffs. Commons drop often
 * and stack; legendaries are rare, unique and change how a piece fights.
 * Everything here survives a new game.
 */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type LegendId = 'phoenix' | 'chain' | 'beam' | 'ram' | 'double' | 'wrath' | 'bloodlust';

export interface BuffDef {
  id: string;
  rarity: Rarity;
  name: string;
  text: string;
  /** Icon: a piece kind, or a generic glyph for army-wide buffs. */
  icon: PieceKind | 'army' | 'gold';
  legend?: LegendId;
}

export const RARITY: Record<Rarity, { name: string; weight: number; color: string }> = {
  common: { name: 'Обычная', weight: 62, color: '#a8b0c8' },
  rare: { name: 'Редкая', weight: 26, color: '#4aa8ff' },
  epic: { name: 'Эпическая', weight: 10, color: '#b06bff' },
  legendary: { name: 'Легендарная', weight: 2, color: '#ffcf4a' },
};

export const SPIN_COST = 5;
/** An epic or better at least every N spins; a legendary at the latest on spin M. */
export const EPIC_PITY = 10;
export const LEGEND_PITY = 50;

const KINDS: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
const KIND_NAME: Record<PieceKind, string> = { king: 'короля', pawn: 'пешек', knight: 'коней', bishop: 'слонов', rook: 'ладей', queen: 'ферзей' };

export const BUFFS: BuffDef[] = [
  { id: 'c_atk', rarity: 'common', name: 'Осколок ярости', text: '+2% к атаке армии', icon: 'army' },
  { id: 'c_hp', rarity: 'common', name: 'Осколок камня', text: '+2% к здоровью армии', icon: 'army' },
  { id: 'c_gold', rarity: 'common', name: 'Тусклое золото', text: '+3% к золоту', icon: 'gold' },
  { id: 'c_king', rarity: 'common', name: 'Корона из тени', text: '+5% к здоровью короля', icon: 'king' },
  ...KINDS.map((k): BuffDef => ({ id: `r_atk_${k}`, rarity: 'rare', name: 'Клинок глубин', text: `+8% к атаке ${KIND_NAME[k]}`, icon: k })),
  ...KINDS.map((k): BuffDef => ({ id: `r_hp_${k}`, rarity: 'rare', name: 'Панцирь глубин', text: `+8% к здоровью ${KIND_NAME[k]}`, icon: k })),
  { id: 'r_army', rarity: 'rare', name: 'Знамя бездны', text: '+4% к атаке и здоровью армии', icon: 'army' },
  { id: 'e_shield', rarity: 'epic', name: 'Щиты глубин', text: 'Пешки начинают бой со щитом в 20% здоровья', icon: 'pawn' },
  { id: 'e_crit', rarity: 'epic', name: 'Глаз бездны', text: '+5% к шансу крита', icon: 'army' },
  { id: 'e_opening', rarity: 'epic', name: 'Рывок из тьмы', text: 'Первые 5 с боя армия бьёт на 25% сильнее', icon: 'army' },
  ...KINDS.map((k): BuffDef => ({ id: `e_power_${k}`, rarity: 'epic', name: 'Сила глубин', text: `+20% к атаке и здоровью ${KIND_NAME[k]}`, icon: k })),
  { id: 'l_phoenix', rarity: 'legendary', legend: 'phoenix', name: 'Пешки-фениксы', text: 'Павшая пешка один раз за бой возрождается в тылу с половиной здоровья', icon: 'pawn' },
  { id: 'l_chain', rarity: 'legendary', legend: 'chain', name: 'Цепной прыжок', text: 'Сразив врага, конь тут же прыгает и бьёт снова', icon: 'knight' },
  { id: 'l_beam', rarity: 'legendary', legend: 'beam', name: 'Пронзающий луч', text: 'Выстрел слона бьёт всех врагов на диагонали', icon: 'bishop' },
  { id: 'l_ram', rarity: 'legendary', legend: 'ram', name: 'Таран', text: 'Выстрел ладьи пробивает камни и бьёт ещё и врага за целью', icon: 'rook' },
  { id: 'l_double', rarity: 'legendary', legend: 'double', name: 'Теневой двойник', text: 'В начале боя рядом с ферзём встаёт его тень с половиной сил', icon: 'queen' },
  { id: 'l_wrath', rarity: 'legendary', legend: 'wrath', name: 'Гнев короля', text: 'Король бьёт вдвое сильнее и задевает всех соседних врагов', icon: 'king' },
  { id: 'l_bloodlust', rarity: 'legendary', legend: 'bloodlust', name: 'Кровожадность', text: 'Каждое убийство лечит убийцу на 30% здоровья', icon: 'army' },
];

export const BUFF_BY_ID: Record<string, BuffDef> = Object.fromEntries(BUFFS.map((b) => [b.id, b]));

export interface RouletteState {
  /** How many times each buff was rolled (stacks for non-legendaries). */
  owned: Record<string, number>;
  spins: number;
  /** Spins since the last epic-or-better and since the last legendary. */
  sinceEpic: number;
  sinceLegend: number;
}

export function emptyRoulette(): RouletteState {
  return { owned: {}, spins: 0, sinceEpic: 0, sinceLegend: 0 };
}

function pickRarity(r: RouletteState, rand: () => number): Rarity {
  if (r.sinceLegend + 1 >= LEGEND_PITY) return 'legendary';
  const pool: Rarity[] = r.sinceEpic + 1 >= EPIC_PITY ? ['epic', 'legendary'] : ['common', 'rare', 'epic', 'legendary'];
  const total = pool.reduce((n, k) => n + RARITY[k].weight, 0);
  let roll = rand() * total;
  for (const k of pool) if ((roll -= RARITY[k].weight) < 0) return k;
  return pool[pool.length - 1];
}

/** Roll one buff and record it. Legendaries never repeat; once all are owned, an epic drops instead. */
export function rollBuff(r: RouletteState, rand: () => number = Math.random): BuffDef {
  let rarity = pickRarity(r, rand);
  let pool = BUFFS.filter((b) => b.rarity === rarity && !(b.legend && r.owned[b.id]));
  if (!pool.length) {
    rarity = 'epic';
    pool = BUFFS.filter((b) => b.rarity === 'epic');
  }
  const buff = pool[Math.floor(rand() * pool.length)];
  r.owned[buff.id] = (r.owned[buff.id] ?? 0) + 1;
  r.spins++;
  r.sinceEpic = rarity === 'epic' || rarity === 'legendary' ? 0 : r.sinceEpic + 1;
  r.sinceLegend = rarity === 'legendary' ? 0 : r.sinceLegend + 1;
  return buff;
}

/** A random buff for the spinning strip (does not change state). */
export function randomBuff(rand: () => number = Math.random): BuffDef {
  const fake: RouletteState = emptyRoulette();
  const rarity = pickRarity(fake, rand);
  const pool = BUFFS.filter((b) => b.rarity === rarity);
  return pool[Math.floor(rand() * pool.length)];
}

export interface RouletteBonuses {
  atk: number;
  hp: number;
  gold: number;
  kingHp: number;
  kind: Partial<Record<PieceKind, { atk: number; hp: number }>>;
  pawnShield: number;
  crit: number;
  opening: number;
  legends: LegendId[];
}

/** Sum everything owned into multipliers for battles and the economy. */
export function rouletteBonuses(r: RouletteState): RouletteBonuses {
  const n = (id: string) => r.owned[id] ?? 0;
  const kind: RouletteBonuses['kind'] = {};
  for (const k of KINDS) {
    const atk = 1 + 0.08 * n(`r_atk_${k}`) + 0.2 * n(`e_power_${k}`);
    const hp = 1 + 0.08 * n(`r_hp_${k}`) + 0.2 * n(`e_power_${k}`);
    if (atk !== 1 || hp !== 1) kind[k] = { atk, hp };
  }
  return {
    atk: 1 + 0.02 * n('c_atk') + 0.04 * n('r_army'),
    hp: 1 + 0.02 * n('c_hp') + 0.04 * n('r_army'),
    gold: 1 + 0.03 * n('c_gold'),
    kingHp: 1 + 0.05 * n('c_king'),
    kind,
    pawnShield: Math.min(0.6, 0.2 * n('e_shield')),
    crit: Math.min(0.25, 0.05 * n('e_crit')),
    opening: 1 + 0.25 * n('e_opening'),
    legends: BUFFS.filter((b) => b.legend && n(b.id)).map((b) => b.legend!),
  };
}

/** Short lines describing everything owned, for the camp card. */
export function ownedSummary(r: RouletteState): string[] {
  const b = rouletteBonuses(r);
  const pct = (m: number) => `+${Math.round((m - 1) * 100)}%`;
  const lines: string[] = [];
  if (b.atk > 1) lines.push(`Атака армии ${pct(b.atk)}`);
  if (b.hp > 1) lines.push(`Здоровье армии ${pct(b.hp)}`);
  if (b.kingHp > 1) lines.push(`Здоровье короля ${pct(b.kingHp)}`);
  if (b.gold > 1) lines.push(`Золото ${pct(b.gold)}`);
  for (const [k, v] of Object.entries(b.kind)) {
    const parts = [v!.atk > 1 ? `атака ${pct(v!.atk)}` : '', v!.hp > 1 ? `здоровье ${pct(v!.hp)}` : ''].filter(Boolean);
    const name = KIND_NAME[k as PieceKind];
    lines.push(`${name[0].toUpperCase()}${name.slice(1)}: ${parts.join(', ')}`);
  }
  if (b.pawnShield) lines.push(`Щит пешек ${Math.round(b.pawnShield * 100)}%`);
  if (b.crit) lines.push(`Шанс крита +${Math.round(b.crit * 100)}%`);
  if (b.opening > 1) lines.push(`Рывок из тьмы ${pct(b.opening)}`);
  return lines;
}

/** Shards the old Altar perks cost, refunded when the Altar became the roulette. */
export function altarRefund(altar: Partial<Record<string, number>> | undefined): number {
  if (!altar) return 0;
  const defs: Record<string, [number, number]> = {
    darkSteel: [5, 1.5], deepHide: [5, 1.5], mantle: [8, 1.7], voidGold: [6, 1.6], veterans: [25, 2.2], echo: [30, 2.5],
  };
  let total = 0;
  for (const [id, lvl] of Object.entries(altar)) {
    const d = defs[id];
    if (!d || !lvl) continue;
    for (let i = 0; i < lvl; i++) total += Math.round(d[0] * d[1] ** i);
  }
  return total;
}
