import { t } from '../i18n';
import { MAX_TICKS, type Battle, type UnitReport } from './battle';
import { traitAdjective, type Trait } from './elites';
import { PIECES, RANGED } from './pieces';

/** Chess notation for a board cell: x 0..7 → a..h, y 0..7 → 8..1. */
export function square(x: number, y: number): string {
  return `${'abcdefgh'[x]}${8 - y}`;
}

export function pieceName(r: Pick<UnitReport, 'kind' | 'promoted'> & { trait?: Trait }): string {
  if (r.promoted) return t('Ферзь из пешки');
  return r.trait
    ? t('{adj} {piece}', { adj: traitAdjective(r.trait, r.kind), piece: PIECES[r.kind].name.toLowerCase() })
    : PIECES[r.kind].name;
}

export interface BattleReport {
  /** The player's piece with the most damage dealt. */
  mvp: UnitReport | null;
  /** The player's pieces, most damage first. */
  allies: UnitReport[];
  /** Why the battle was lost, or null on a win. */
  lossReason: string | null;
  /** Up to two concrete suggestions. */
  tips: string[];
}

/** The line along which a ranged piece hit a target. */
function lineBetween(fromX: number, fromY: number, toX: number, toY: number): string {
  if (fromX === toX) return t('вертикаль {file}', { file: 'abcdefgh'[toX] });
  if (fromY === toY) return t('горизонталь {rank}', { rank: 8 - toY });
  return t('диагональ {from}–{to}', { from: square(fromX, fromY), to: square(toX, toY) });
}

function kingTip(king: UnitReport): string | null {
  const k = king.killedBy;
  if (!k) return null;
  if (RANGED.has(k.kind)) {
    return t('Стрелок бил по королю через {line}. Закройте эту линию пешкой или поставьте короля под прикрытие своих фигур.',
      { line: lineBetween(k.x, k.y, k.atX, k.atY) });
  }
  if (k.kind === 'knight') {
    return t('Конь прорвался к королю. Окружите короля своими фигурами: на занятые клетки конь не прыгнет.');
  }
  return t('Враг дошёл до короля вплотную. Держите перед королём строй пешек и не оставляйте его на краю.');
}

export function buildReport(b: Battle): BattleReport {
  const all = Object.values(b.report);
  const allies = all.filter((r) => r.side === 'ally').sort((a, c) => c.dealt - a.dealt);
  const enemies = all.filter((r) => r.side === 'enemy');
  const mvp = allies.find((r) => r.dealt > 0) ?? null;
  const tips: string[] = [];
  let lossReason: string | null = null;

  if (b.result !== 'win') {
    const king = allies.find((r) => r.kind === 'king');
    const killer = king?.killedBy;
    if (king && killer) {
      const name = pieceName(b.report[killer.uid] ?? { kind: killer.kind, promoted: false });
      lossReason = t('Короля сразил враг: {name} с {sq}.', { name: name.toLowerCase(), sq: square(killer.x, killer.y) });
      tips.push(kingTip(king)!);
    } else if (b.tick >= MAX_TICKS) {
      lossReason = t('Время вышло: армия не успела пробиться к вражескому королю.');
      tips.push(t('Нужно больше урона по королю: кони прыгают в тыл, ладья на открытой линии бьёт через всю доску.'));
    } else {
      lossReason = t('Ваша армия пала.');
    }
    // The enemy piece that caused the most losses.
    const butcher = [...enemies].sort((a, c) => c.kills - a.kills)[0];
    if (butcher && butcher.kills >= 2) {
      tips.push(t('Больше всего ваших фигур сразил враг: {name} с {sq}. Займитесь им первым: конём или стрелком на его линии.',
        { name: pieceName(butcher).toLowerCase(), sq: square(butcher.startX, butcher.startY) }));
    }
  }

  // A piece that survived without dealing damage stands in the wrong place.
  const idle = allies.find((r) => r.kind !== 'king' && r.dealt === 0 && !r.killedBy);
  if (idle) {
    tips.push(t('{name} с {sq} не нанёс(ла) урона. Поставьте эту фигуру ближе к врагу или на открытую линию.',
      { name: pieceName(idle), sq: square(idle.startX, idle.startY) }));
  }
  return { mvp, allies, lossReason, tips: tips.slice(0, 2) };
}
