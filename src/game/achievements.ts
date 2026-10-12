import { t } from '../i18n';
import { RELIC_IDS } from './relics';
import type { GameState } from './state';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  goal: number;
  reward: number;
  /** Current progress towards `goal`. */
  progress: (s: GameState) => number;
}

const cleared = (id: string) => (s: GameState) => ((s.stars[id] ?? 0) > 0 ? 1 : 0);

const A = (id: string, name: string, description: string, goal: number, reward: number, progress: (s: GameState) => number): AchievementDef =>
  ({ id, name, description, goal, reward, progress });

export const ACHIEVEMENTS: AchievementDef[] = [
  A('first_win', t('Первая кровь'), t('Выиграйте бой'), 1, 50, (s) => s.stats.wins),
  A('wins_25', t('Ветеран'), t('Выиграйте 25 боёв'), 25, 500, (s) => s.stats.wins),
  A('wins_100', t('Полководец'), t('Выиграйте 100 боёв'), 100, 5000, (s) => s.stats.wins),
  A('flawless_1', t('Без потерь'), t('Победите, не потеряв ни одной фигуры'), 1, 150, (s) => s.stats.flawless),
  A('flawless_20', t('Безупречная тактика'), t('20 побед без потерь'), 20, 3000, (s) => s.stats.flawless),
  A('promote_1', t('Из пешек в ферзи'), t('Превратите пешку в ферзя'), 1, 100, (s) => s.stats.promotions),
  A('promote_25', t('Коронационный парад'), t('25 превращений пешек'), 25, 2000, (s) => s.stats.promotions),
  A('kills_100', t('Сотня'), t('Сразите 100 вражеских фигур'), 100, 400, (s) => s.stats.kills),
  A('kills_1000', t('Тысяча'), t('Сразите 1000 вражеских фигур'), 1000, 6000, (s) => s.stats.kills),
  A('crits_50', t('Меткий глаз'), t('Нанесите 50 критических ударов'), 50, 600, (s) => s.stats.crits),
  A('ability_1', t('Первый приём'), t('Примените способность фигуры'), 1, 200, (s) => s.stats.abilities),
  A('ability_200', t('Мастер приёмов'), t('Примените 200 способностей'), 200, 4000, (s) => s.stats.abilities),
  A('boss_1', t('Капитан повержен'), t('Победите Пешечного капитана'), 1, 300, cleared('1-9')),
  A('boss_2', t('Укротитель'), t('Победите Чёрного всадника'), 1, 1500, cleared('2-9')),
  A('boss_3', t('Штурм крепости'), t('Победите Башню-крепость'), 1, 5000, cleared('3-9')),
  A('boss_4', t('Шах и мат'), t('Победите Чёрного ферзя'), 1, 20000, cleared('4-9')),
  A('clean_chapter', t('Ни шагу назад'), t('Пройдите главу, не потеряв ни одного знамени'), 1, 1000, (s) => s.stats.cleanChapters),
  A('run_wins_15', t('Неудержимый'), t('Победите в 15 боях за один забег'), 15, 3000, (s) => s.run.wins),
  A('elites_10', t('Гроза элиты'), t('Победите 10 элитных отрядов'), 10, 8000, (s) => s.stats.elites),
  A('events_10', t('Странник'), t('Пройдите 10 событий на карте'), 10, 1500, (s) => s.stats.events),
  A('relics_5', t('Коллекционер'), t('Соберите 5 реликвий'), 5, 2500, (s) => s.relics.length),
  A('relics_all', t('Хранитель сокровищ'), t('Соберите все реликвии'), RELIC_IDS.length, 25000, (s) => s.relics.length),
  A('level_10', t('Мастер своего дела'), t('Улучшите любую фигуру до 10 уровня'), 10, 3000, (s) => Math.max(...Object.values(s.levels))),
  A('full_set', t('Полный набор'), t('Соберите в армии все 6 видов фигур'), 6, 1500,
    (s) => Object.values(s.army).filter((n) => n > 0).length),
  A('runs_5', t('Упорство'), t('Начните шестой забег'), 5, 2000, (s) => s.stats.runs),
  A('architect', t('Архитектор'), t('Достройте Штаб до максимума'), 3, 4000, (s) => s.buildings.hq),
  A('gifts_5', t('Щедрость короны'), t('Соберите 5 даров Колеса короны'), 5, 2000, (s) => Object.keys(s.roulette.owned).length),
  A('legend_1', t('Легенда'), t('Получите легендарный дар'), 1, 15000, (s) => Object.keys(s.roulette.owned).filter((id) => id.startsWith('l_')).length),
  A('prestige_1', t('Новая партия'), t('Начните новую партию с коронами'), 1, 10000, (s) => s.prestige),
  A('finale', t('Доска не перевернётся'), t('Дойдите до конца истории'), 1, 50000, (s) => (s.finale?.beaten ? 1 : 0)),
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
