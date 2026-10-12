import { t } from '../i18n';
import type { GameState } from './state';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  goal: number;
  /** Crowns it pays when claimed. */
  crowns: number;
  /** Current progress towards `goal`. */
  progress: (s: GameState) => number;
}

const cleared = (id: string) => (s: GameState) => ((s.stars[id] ?? 0) > 0 ? 1 : 0);

const A = (id: string, name: string, description: string, goal: number, crowns: number, progress: (s: GameState) => number): AchievementDef =>
  ({ id, name, description, goal, crowns, progress });

/** The best threat level a game was won at (-1: no win yet). */
const threatWon = (s: GameState) => s.stats.bestThreat ?? -1;

export const ACHIEVEMENTS: AchievementDef[] = [
  A('first_win', t('Первая кровь'), t('Выиграйте бой'), 1, 1, (s) => s.stats.wins),
  A('wins_25', t('Ветеран'), t('Выиграйте 25 боёв'), 25, 1, (s) => s.stats.wins),
  A('wins_100', t('Полководец'), t('Выиграйте 100 боёв'), 100, 2, (s) => s.stats.wins),
  A('flawless_1', t('Без потерь'), t('Победите, не потеряв ни одной фигуры'), 1, 1, (s) => s.stats.flawless),
  A('flawless_20', t('Безупречная тактика'), t('20 побед без потерь'), 20, 2, (s) => s.stats.flawless),
  A('promote_1', t('Из пешек в ферзи'), t('Превратите пешку в ферзя'), 1, 1, (s) => s.stats.promotions),
  A('promote_25', t('Коронационный парад'), t('25 превращений пешек'), 25, 2, (s) => s.stats.promotions),
  A('kills_100', t('Сотня'), t('Сразите 100 вражеских фигур'), 100, 1, (s) => s.stats.kills),
  A('kills_1000', t('Тысяча'), t('Сразите 1000 вражеских фигур'), 1000, 2, (s) => s.stats.kills),
  A('crits_50', t('Меткий глаз'), t('Нанесите 50 критических ударов'), 50, 1, (s) => s.stats.crits),
  A('ability_1', t('Первый приём'), t('Примените способность фигуры'), 1, 1, (s) => s.stats.abilities),
  A('ability_200', t('Мастер приёмов'), t('Примените 200 способностей'), 200, 2, (s) => s.stats.abilities),
  A('boss_1', t('Капитан повержен'), t('Победите Пешечного капитана'), 1, 1, cleared('1-9')),
  A('boss_2', t('Укротитель'), t('Победите Чёрного всадника'), 1, 1, cleared('2-9')),
  A('boss_3', t('Штурм крепости'), t('Победите Башню-крепость'), 1, 2, cleared('3-9')),
  A('boss_4', t('Шах и мат'), t('Победите Чёрного ферзя'), 1, 3, cleared('4-9')),
  A('clean_chapter', t('Ни шагу назад'), t('Пройдите главу, не потеряв ни одной фигуры'), 1, 2, (s) => s.stats.cleanChapters),
  A('run_wins_15', t('Неудержимый'), t('Победите в 15 боях за один забег'), 15, 2, (s) => s.run.wins),
  A('elites_10', t('Гроза элиты'), t('Победите 10 элитных отрядов'), 10, 2, (s) => s.stats.elites),
  A('events_10', t('Странник'), t('Пройдите 10 событий на карте'), 10, 1, (s) => s.stats.events),
  A('relics_5', t('Коллекционер'), t('Соберите 5 реликвий за один забег'), 5, 1, (s) => s.relics.length),
  A('relics_12', t('Хранитель сокровищ'), t('Соберите 12 реликвий за один забег'), 12, 3, (s) => s.relics.length),
  A('level_10', t('Мастер своего дела'), t('Улучшите любую фигуру до 10 уровня'), 10, 1, (s) => Math.max(...Object.values(s.levels))),
  A('full_set', t('Полный набор'), t('Соберите в армии все 6 видов фигур'), 6, 2,
    (s) => Object.values(s.army).filter((n) => n > 0).length),
  A('armies_all', t('Пять знамён'), t('Откройте все стартовые армии'), 5, 2, (s) => s.armies.length),
  A('runs_5', t('Упорство'), t('Начните шестой забег'), 5, 1, (s) => s.stats.runs),
  A('architect', t('Архитектор'), t('Достройте Штаб до максимума'), 3, 1, (s) => s.buildings.hq),
  A('gifts_5', t('Щедрость короны'), t('Соберите 5 даров Колеса короны'), 5, 1, (s) => Object.keys(s.roulette.owned).length),
  A('legend_1', t('Легенда'), t('Получите легендарный дар'), 1, 2, (s) => Object.keys(s.roulette.owned).filter((id) => id.startsWith('l_')).length),
  A('prestige_1', t('Партия за вами'), t('Выиграйте партию'), 1, 2, (s) => s.prestige),
  A('threat_1', t('Под угрозой'), t('Выиграйте партию на Угрозе 1'), 1, 2, (s) => (threatWon(s) >= 1 ? 1 : 0)),
  A('threat_5', t('Выше страха'), t('Выиграйте партию на Угрозе 5'), 1, 3, (s) => (threatWon(s) >= 5 ? 1 : 0)),
  A('threat_10', t('Рука дрогнула'), t('Выиграйте партию на Угрозе 10'), 1, 3, (s) => (threatWon(s) >= 10 ? 1 : 0)),
  A('finale', t('Доска не перевернётся'), t('Дойдите до конца истории'), 1, 3, (s) => (s.finale?.beaten ? 1 : 0)),
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
