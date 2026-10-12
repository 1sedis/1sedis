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

const stars = (s: GameState) => Object.values(s.stars).reduce((a, b) => a + b, 0);
const cleared = (id: string) => (s: GameState) => ((s.stars[id] ?? 0) > 0 ? 1 : 0);

const A = (id: string, name: string, description: string, goal: number, reward: number, progress: (s: GameState) => number): AchievementDef =>
  ({ id, name, description, goal, reward, progress });

export const ACHIEVEMENTS: AchievementDef[] = [
  A('first_win', 'Первая кровь', 'Выиграйте бой', 1, 50, (s) => s.stats.wins),
  A('wins_25', 'Ветеран', 'Выиграйте 25 боёв', 25, 500, (s) => s.stats.wins),
  A('wins_100', 'Полководец', 'Выиграйте 100 боёв', 100, 5000, (s) => s.stats.wins),
  A('flawless_1', 'Без потерь', 'Победите, не потеряв ни одной фигуры', 1, 150, (s) => s.stats.flawless),
  A('flawless_20', 'Безупречная тактика', '20 побед без потерь', 20, 3000, (s) => s.stats.flawless),
  A('promote_1', 'Из пешек в ферзи', 'Превратите пешку в ферзя', 1, 100, (s) => s.stats.promotions),
  A('promote_25', 'Коронационный парад', '25 превращений пешек', 25, 2000, (s) => s.stats.promotions),
  A('kills_100', 'Сотня', 'Сразите 100 вражеских фигур', 100, 400, (s) => s.stats.kills),
  A('kills_1000', 'Тысяча', 'Сразите 1000 вражеских фигур', 1000, 6000, (s) => s.stats.kills),
  A('crits_50', 'Меткий глаз', 'Нанесите 50 критических ударов', 50, 600, (s) => s.stats.crits),
  A('ability_1', 'Первый приём', 'Примените способность фигуры', 1, 200, (s) => s.stats.abilities),
  A('ability_200', 'Мастер приёмов', 'Примените 200 способностей', 200, 4000, (s) => s.stats.abilities),
  A('boss_1', 'Капитан повержен', 'Победите Пешечного капитана', 1, 300, cleared('1-9')),
  A('boss_2', 'Укротитель', 'Победите Чёрного всадника', 1, 1500, cleared('2-9')),
  A('boss_3', 'Штурм крепости', 'Победите Башню-крепость', 1, 5000, cleared('3-9')),
  A('boss_4', 'Шах и мат', 'Победите Чёрного ферзя', 1, 20000, cleared('4-9')),
  A('clean_chapter', 'Ни шагу назад', 'Пройдите главу, не потеряв ни одного знамени', 1, 1000, (s) => s.stats.cleanChapters),
  A('stars_54', 'Звездочёт', 'Соберите 54 звезды за партию', 54, 3000, stars),
  A('elites_10', 'Гроза элиты', 'Победите 10 элитных отрядов', 10, 8000, (s) => s.stats.elites),
  A('events_10', 'Странник', 'Пройдите 10 событий на карте', 10, 1500, (s) => s.stats.events),
  A('relics_5', 'Коллекционер', 'Соберите 5 реликвий', 5, 2500, (s) => s.relics.length),
  A('relics_all', 'Хранитель сокровищ', 'Соберите все реликвии', RELIC_IDS.length, 25000, (s) => s.relics.length),
  A('level_10', 'Мастер своего дела', 'Улучшите любую фигуру до 10 уровня', 10, 3000, (s) => Math.max(...Object.values(s.levels))),
  A('full_set', 'Полный набор', 'Соберите в армии все 6 видов фигур', 6, 1500,
    (s) => Object.values(s.army).filter((n) => n > 0).length),
  A('treasurer', 'Казначей', 'Заберите из казны 10 000 золота', 10000, 2000, (s) => s.stats.treasuryCollected),
  A('architect', 'Архитектор', 'Достройте Штаб до максимума', 3, 4000, (s) => s.buildings.hq),
  A('abyss_10', 'Глубины', 'Пройдите 10 этажей Бездны', 10, 2000, (s) => s.abyss.best),
  A('abyss_30', 'Бездонный', 'Пройдите 30 этажей Бездны', 30, 15000, (s) => s.abyss.best),
  A('prestige_1', 'Новая партия', 'Начните новую партию с коронами', 1, 10000, (s) => s.prestige),
  A('finale', 'Доска не перевернётся', 'Дойдите до конца истории', 1, 50000, (s) => (s.finale?.beaten ? 1 : 0)),
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
