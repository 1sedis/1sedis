import { test } from 'vitest';
import { createBattle, simulate } from '../src/game/battle';
import { bestFormation } from '../src/game/autoformation';
import { RELIC_IDS } from '../src/game/relics';
import { battleSetup, commandLimit, newGame, type GameState } from '../src/game/state';

/** An army at the end of a long run: every piece type at `lv`, a full HQ and forge share, some relics. */
function veteran(lv: number, forge: number, relics: number, tree: string[]): GameState {
  const s = newGame(0);
  s.prestige = 5;
  s.army = { ...s.army, pawn: 6, knight: 2, bishop: 2, rook: 2, queen: 1 };
  for (const k of Object.keys(s.levels) as (keyof typeof s.levels)[]) s.levels[k] = lv;
  s.buildings = { treasury: 10, hq: 3, forge };
  s.relics = RELIC_IDS.slice(0, relics);
  s.crownTree = tree as GameState['crownTree'];
  return s;
}

test('finale sim', () => {
  const profiles: [string, GameState][] = [
    ['bare lv20', veteran(20, 0, 0, [])],
    ['mid lv20 forge10 relics6', veteran(20, 10, 6, ['doubleStep', 'fork', 'twoQueens'])],
    ['strong lv25 forge20 relics12', veteran(25, 20, 12, ['doubleStep', 'fork', 'heralds', 'twoQueens', 'shadowReserve'])],
  ];
  for (const [name, s] of profiles) {
    const line: string[] = [];
    for (const id of ['final-1', 'final-2', 'final-3']) {
      bestFormation(s, id, commandLimit(s, id));
      const b = createBattle(battleSetup(s, id));
      simulate(b);
      const boss = b.units.find((u) => u.side === 'enemy' && u.boss);
      const left = b.units.filter((u) => u.side === 'ally' && u.hp > 0).length;
      line.push(`${id}: ${b.result} t=${(b.tick / 10).toFixed(0)}s allies=${left} boss=${boss ? Math.round((100 * boss.hp) / boss.maxHp) : 0}%`);
    }
    console.log(name, '\n  ' + line.join('\n  '));
  }
}, 600_000);
