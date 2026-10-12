import { t } from '../i18n';
import type { PieceKind } from './pieces';

/**
 * The Crown Wheel: crowns buy a spin, the wheel decides the rarity, and the
 * player picks one of three gifts of that rarity. Gifts are kept forever and
 * each one is felt in play: a piece to start the run with, an extra move
 * against bosses, shields, gold, legendary fighting styles. Taking a gift
 * again raises its rank (up to III); legendaries come once.
 */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type LegendId = 'phoenix' | 'chain' | 'beam' | 'ram' | 'double' | 'wrath' | 'bloodlust';

export interface BuffDef {
  id: string;
  rarity: Rarity;
  name: string;
  /** What one rank does. */
  text: string;
  /** Icon: a piece kind, or a generic glyph for army-wide gifts. */
  icon: PieceKind | 'army' | 'gold';
  legend?: LegendId;
  /** Highest rank (1 for legendaries). */
  max: number;
}

export const RARITY: Record<Rarity, { name: string; weight: number; color: string }> = {
  common: { name: t('Обычный'), weight: 55, color: '#a8b0c8' },
  rare: { name: t('Редкий'), weight: 30, color: '#4aa8ff' },
  epic: { name: t('Эпический'), weight: 12, color: '#b06bff' },
  legendary: { name: t('Легендарный'), weight: 3, color: '#ffcf4a' },
};

/** Crowns per spin. */
export const SPIN_COST = 2;
/** An epic or better at least every N spins; a legendary at the latest on spin M. */
export const EPIC_PITY = 5;
export const LEGEND_PITY = 12;

const KINDS: PieceKind[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
const KIND_NAME: Record<PieceKind, string> = { king: t('короля'), pawn: t('пешек'), knight: t('коней'), bishop: t('слонов'), rook: t('ладей'), queen: t('ферзей'),
  archbishop: t('архиепископов'), chancellor: t('канцлеров'), ghost: t('призраков') };

const B = (id: string, rarity: Rarity, name: string, text: string, icon: BuffDef['icon'], max = 3, legend?: LegendId): BuffDef =>
  ({ id, rarity, name, text, icon, max, legend });

export const BUFFS: BuffDef[] = [
  B('c_steel', 'common', t('Острая сталь'), t('+8% к атаке армии'), 'army'),
  B('c_mail', 'common', t('Крепкие латы'), t('+8% к здоровью армии'), 'army'),
  B('c_purse', 'common', t('Кошель короны'), t('забег начинается с +60 золота'), 'gold'),
  B('c_horn', 'common', t('Боевой рог'), t('первые 5 с боя армия бьёт на 20% сильнее'), 'army'),
  B('c_levy', 'common', t('Ополчение'), t('забег начинается с лишней пешкой'), 'pawn'),
  B('r_knight', 'rare', t('Рыцарь в запасе'), t('забег начинается с конём'), 'knight'),
  B('r_shield', 'rare', t('Щиты пешек'), t('пешки начинают бой со щитом в 15% здоровья'), 'pawn'),
  B('r_eye', 'rare', t('Глаз сокола'), t('+6% к шансу крита'), 'army'),
  B('r_loot', 'rare', t('Трофеи'), t('элита и боссы платят на 40% больше золота'), 'gold'),
  B('r_crown', 'rare', t('Корона из тени'), t('+25% к здоровью короля'), 'king'),
  B('e_tempo', 'epic', t('Лишний ход'), t('+1 ход в боях с элитой и боссами'), 'army', 2),
  B('e_chest', 'epic', t('Сундук'), t('забег начинается с выбора реликвии'), 'gold', 2),
  B('e_forge', 'epic', t('Горн'), t('забег начинается с Кузницей +2'), 'army'),
  ...KINDS.map((k) => B(`e_power_${k}`, 'epic', t('Сила короны'), t('+25% к атаке и здоровью {kinds}', { kinds: KIND_NAME[k] }), k)),
  B('l_phoenix', 'legendary', t('Пешки-фениксы'), t('павшая пешка один раз за бой возрождается в тылу с половиной здоровья'), 'pawn', 1, 'phoenix'),
  B('l_chain', 'legendary', t('Цепной прыжок'), t('сразив врага, конь тут же прыгает и бьёт снова'), 'knight', 1, 'chain'),
  B('l_beam', 'legendary', t('Пронзающий луч'), t('выстрел слона бьёт всех врагов на диагонали'), 'bishop', 1, 'beam'),
  B('l_ram', 'legendary', t('Таран'), t('выстрел ладьи пробивает камни и бьёт ещё и врага за целью'), 'rook', 1, 'ram'),
  B('l_double', 'legendary', t('Теневой двойник'), t('в начале боя рядом с ферзём встаёт его тень с половиной сил'), 'queen', 1, 'double'),
  B('l_wrath', 'legendary', t('Гнев короля'), t('король бьёт вдвое сильнее и задевает всех соседних врагов'), 'king', 1, 'wrath'),
  B('l_bloodlust', 'legendary', t('Кровожадность'), t('каждое убийство лечит убийцу на 30% здоровья'), 'army', 1, 'bloodlust'),
];

export const BUFF_BY_ID: Record<string, BuffDef> = Object.fromEntries(BUFFS.map((b) => [b.id, b]));

export interface RouletteState {
  /** Rank of every gift taken. */
  owned: Record<string, number>;
  spins: number;
  /** Spins since the last epic-or-better and since the last legendary. */
  sinceEpic: number;
  sinceLegend: number;
  /** A spin that has landed and waits for the player's pick (kept so a reload does not reroll it). */
  offer: string[] | null;
  /** Free spins waiting ("Голод", "Трофеи"). */
  free: number;
}

export function emptyRoulette(): RouletteState {
  return { owned: {}, spins: 0, sinceEpic: 0, sinceLegend: 0, offer: null, free: 0 };
}

export function rank(r: RouletteState, id: string): number {
  return r.owned[id] ?? 0;
}

/** Gifts that can still be taken (not at their highest rank). */
function open(r: RouletteState, rarity: Rarity): BuffDef[] {
  return BUFFS.filter((b) => b.rarity === rarity && rank(r, b.id) < b.max);
}

function pickRarity(r: RouletteState, rand: () => number, legendMult = 1): Rarity {
  if (r.sinceLegend + 1 >= LEGEND_PITY && open(r, 'legendary').length) return 'legendary';
  const pool: Rarity[] = r.sinceEpic + 1 >= EPIC_PITY ? ['epic', 'legendary'] : ['common', 'rare', 'epic', 'legendary'];
  const weight = (k: Rarity) => (open(r, k).length ? RARITY[k].weight * (k === 'legendary' ? legendMult : 1) : 0);
  const total = pool.reduce((n, k) => n + weight(k), 0);
  if (!total) return 'common';
  let roll = rand() * total;
  for (const k of pool) if ((roll -= weight(k)) < 0) return k;
  return pool[pool.length - 1];
}

/**
 * Spin the wheel: pick a rarity and offer `choices` distinct gifts of it (fewer
 * when fewer are left). The offer waits in the state until one is taken.
 */
export function spinWheel(r: RouletteState, rand: () => number = Math.random, legendMult = 1, choices = 3): BuffDef[] {
  let rarity = pickRarity(r, rand, legendMult);
  let pool = open(r, rarity);
  for (const fallback of ['epic', 'rare', 'common', 'legendary'] as Rarity[]) {
    if (pool.length) break;
    rarity = fallback;
    pool = open(r, rarity);
  }
  if (!pool.length) {
    // Everything is at its highest rank (and every legend owned): nothing left to give.
    r.offer = null;
    return [];
  }
  const offer: BuffDef[] = [];
  const rest = [...pool];
  while (offer.length < choices && rest.length) offer.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  r.spins++;
  r.sinceEpic = rarity === 'epic' || rarity === 'legendary' ? 0 : r.sinceEpic + 1;
  r.sinceLegend = rarity === 'legendary' ? 0 : r.sinceLegend + 1;
  r.offer = offer.map((b) => b.id);
  return offer;
}

/** Every gift at its highest rank: the wheel has nothing left. */
export function wheelExhausted(r: RouletteState): boolean {
  return BUFFS.every((b) => rank(r, b.id) >= b.max);
}

/** Take one gift of the waiting offer. */
export function takeGift(r: RouletteState, id: string): BuffDef | null {
  if (!r.offer?.includes(id)) return null;
  const def = BUFF_BY_ID[id];
  r.owned[id] = Math.min(def.max, rank(r, id) + 1);
  r.offer = null;
  return def;
}

/** A gift given outright ("Трофеи" of the Crown Tree): the next rank of a random open gift of a rarity. */
export function grantGift(r: RouletteState, rarity: Rarity, rand: () => number = Math.random): BuffDef | null {
  const pool = open(r, rarity);
  if (!pool.length) return null;
  const def = pool[Math.floor(rand() * pool.length)];
  r.owned[def.id] = rank(r, def.id) + 1;
  return def;
}

/** A random gift for the spinning strip (does not change state). */
export function randomBuff(rand: () => number = Math.random): BuffDef {
  return BUFFS[Math.floor(rand() * BUFFS.length)];
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
  /** Extra moves in elite and boss battles. */
  bigMoves: number;
  /** Elite and boss gold multiplier. */
  loot: number;
}

/** Sum everything owned into multipliers for battles and the economy. */
export function rouletteBonuses(r: RouletteState): RouletteBonuses {
  const n = (id: string) => rank(r, id);
  const kind: RouletteBonuses['kind'] = {};
  for (const k of KINDS) {
    const m = 1 + 0.25 * n(`e_power_${k}`);
    if (m !== 1) kind[k] = { atk: m, hp: m };
  }
  return {
    atk: 1 + 0.08 * n('c_steel'),
    hp: 1 + 0.08 * n('c_mail'),
    gold: 1,
    kingHp: 1 + 0.25 * n('r_crown'),
    kind,
    pawnShield: 0.15 * n('r_shield'),
    crit: 0.06 * n('r_eye'),
    opening: 1 + 0.2 * n('c_horn'),
    legends: BUFFS.filter((b) => b.legend && n(b.id)).map((b) => b.legend!),
    bigMoves: n('e_tempo'),
    loot: 1 + 0.4 * n('r_loot'),
  };
}

/** What the gifts give a new run: gold, pieces, forge levels, relic picks. */
export function runStartGifts(r: RouletteState): { gold: number; pawns: number; knights: number; forge: number; relicPicks: number } {
  return {
    gold: 60 * rank(r, 'c_purse'),
    pawns: rank(r, 'c_levy'),
    knights: rank(r, 'r_knight'),
    forge: 2 * rank(r, 'e_forge'),
    relicPicks: rank(r, 'e_chest'),
  };
}

/** Owned gifts with their ranks, the rarest first, for the camp card. */
export function ownedGifts(r: RouletteState): { def: BuffDef; rank: number }[] {
  const order: Rarity[] = ['legendary', 'epic', 'rare', 'common'];
  return BUFFS.filter((b) => rank(r, b.id) > 0)
    .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
    .map((def) => ({ def, rank: rank(r, def.id) }));
}

/** Old roulette saves: legendaries carry over, everything else is paid back in crowns. */
export function migrateRoulette(old: Partial<RouletteState> | undefined): { roulette: RouletteState; crowns: number } {
  const roulette = emptyRoulette();
  let crowns = 0;
  for (const [id, count] of Object.entries(old?.owned ?? {})) {
    if (BUFF_BY_ID[id]?.legend) roulette.owned[id] = 1;
    else crowns += Math.ceil(count / 4);
  }
  roulette.spins = old?.spins ?? 0;
  return { roulette, crowns };
}

export const ROMAN = ['', 'I', 'II', 'III'];
