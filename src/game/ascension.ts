import { t } from '../i18n';

/**
 * Threat levels: after a won game the next run may be played under Threat 1,
 * then 2 and so on up to MAX_THREAT. Each level keeps the ones below it and
 * adds one rule; a won game pays one more crown per level.
 */
export const MAX_THREAT = 10;

export interface ThreatDef {
  level: number;
  name: string;
  text: string;
}

export const THREATS: ThreatDef[] = [
  { level: 1, name: t('Закалённая элита'), text: t('Элитные враги ещё на уровень сильнее.') },
  { level: 2, name: t('Чёрная армия крепнет'), text: t('Все враги на уровень сильнее.') },
  { level: 3, name: t('Скудная казна'), text: t('Победы приносят на 20% меньше золота.') },
  { level: 4, name: t('Голодные боссы'), text: t('У боссов на 30% больше здоровья.') },
  { level: 5, name: t('Жадный торговец'), text: t('Торговцы и кузнецы берут на 30% больше.') },
  { level: 6, name: t('Свирепые чемпионы'), text: t('Чемпионы элиты ещё в полтора раза крепче.') },
  { level: 7, name: t('Без знамён'), text: t('Запасное знамя нельзя купить или выпросить.') },
  { level: 8, name: t('Ранняя ярость'), text: t('Боссы впадают в ярость уже на 70% здоровья.') },
  { level: 9, name: t('Тесный строй'), text: t('В каждом бою на одну фигуру меньше.') },
  { level: 10, name: t('Рука над доской'), text: t('Враги ещё на два уровня сильнее, их короли вдвое крепче.') },
];

/** Rules in force at a threat level. */
export function activeThreats(level: number): ThreatDef[] {
  return THREATS.filter((d) => d.level <= level);
}

/** What a threat level changes, as numbers the game reads. */
export function threatMods(level: number) {
  const on = (n: number) => level >= n;
  return {
    eliteLevels: on(1) ? 1 : 0,
    enemyLevels: (on(2) ? 1 : 0) + (on(10) ? 2 : 0),
    gold: on(3) ? 0.8 : 1,
    bossHp: on(4) ? 1.3 : 1,
    prices: on(5) ? 1.3 : 1,
    championHp: on(6) ? 1.5 : 1,
    noBanner: on(7),
    rageAt: on(8) ? 0.7 : 0.5,
    limit: on(9) ? -1 : 0,
    enemyKingHp: on(10) ? 2 : 1,
  };
}

/** Everything a threat level adds up to, in a few short numbers ("враги +1 ур.", "золото −20%"). */
export function threatSummary(level: number): string[] {
  const m = threatMods(level);
  const out: string[] = [];
  if (m.enemyLevels) out.push(t('враги +{n} ур.', { n: m.enemyLevels }));
  if (m.eliteLevels) out.push(t('элита ещё +{n} ур.', { n: m.eliteLevels }));
  if (m.gold < 1) out.push(t('золото −{p}%', { p: Math.round((1 - m.gold) * 100) }));
  if (m.bossHp > 1) out.push(t('боссы +{p}% здоровья', { p: Math.round((m.bossHp - 1) * 100) }));
  if (m.prices > 1) out.push(t('цены +{p}%', { p: Math.round((m.prices - 1) * 100) }));
  if (m.championHp > 1) out.push(t('чемпионы ×1,5'));
  if (m.noBanner) out.push(t('без запасного знамени'));
  if (m.rageAt > 0.5) out.push(t('ярость боссов с {p}%', { p: Math.round(m.rageAt * 100) }));
  if (m.limit) out.push(t('фигур в бою {n}', { n: m.limit }));
  if (m.enemyKingHp > 1) out.push(t('короли врага ×{n}', { n: m.enemyKingHp }));
  return out;
}

