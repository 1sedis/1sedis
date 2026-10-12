import { describe, expect, it } from 'vitest';
import { CHAMPION_HP, createBattle } from '../src/game/battle';
import { getAchievement } from '../src/game/achievements';
import { CHAPTERS } from '../src/game/levels';
import {
  EVENTS, EVENT_IDS, MAP_ROWS, activeBoons, eventFits, SPARE, availableNodes, buildMap, buyItem, campForge, campTrain, chooseEvent, currentNode,
  enterNode, lives, shopItems, type RunNode,
} from '../src/game/run';
import {
  battleSetup, claimAchievement, commandLimit, isEliteBattle, isLevelOpen, newGame, parseSave, prestige, recordResult, recruit, startNextRun, type GameState,
} from '../src/game/state';

/** Win or lose the battle at a node the quick way. */
function fight(s: GameState, node: RunNode, win: boolean) {
  enterNode(s, node.id);
  const b = createBattle(battleSetup(s, node.level!));
  b.result = win ? 'win' : 'loss';
  return recordResult(s, node.level!, b);
}

describe('run map', () => {
  it('every chapter map is fixed at the start, forks, and ends at the boss', () => {
    for (const chapter of CHAPTERS) {
      for (let seed = 1; seed < 40; seed++) {
        const map = buildMap(chapter.id, seed);
        const row = (r: number) => map.nodes.filter((n) => n.row === r);
        expect(map.rows).toBe(MAP_ROWS);
        expect(row(0)).toHaveLength(1);
        expect(row(0)[0].level).toBe(chapter.levels[0].id);
        expect(row(MAP_ROWS - 1)).toEqual([expect.objectContaining({ kind: 'boss', level: chapter.levels[8].id })]);
        expect(row(MAP_ROWS - 2).every((n) => n.kind === 'camp')).toBe(true);
        if (chapter.id === 1) expect([row(1)[0].level, row(2)[0].level]).toEqual(['1-2', '1-3']);
        // Every node can be reached and leads on to the boss.
        const reach = new Set([row(0)[0].id]);
        for (const n of [...map.nodes].sort((a, b) => a.row - b.row)) if (reach.has(n.id)) n.next.forEach((id) => reach.add(id));
        expect(reach.size).toBe(map.nodes.length);
        for (const n of map.nodes) if (n.row < MAP_ROWS - 1) expect(n.next.length).toBeGreaterThan(0);
        // Fights have levels of this chapter; events have an event.
        for (const n of map.nodes) {
          if (['battle', 'elite', 'boss'].includes(n.kind)) expect(chapter.levels.map((l) => l.id)).toContain(n.level);
          if (n.kind === 'event') expect(EVENT_IDS).toContain(n.event);
        }
      }
    }
  });

  it('is the same map for the same seed', () => {
    expect(buildMap(2, 77)).toEqual(buildMap(2, 77));
    expect(buildMap(2, 77)).not.toEqual(buildMap(2, 78));
  });
});

describe('run progress', () => {
  it('a won boss opens the next chapter with full banners', () => {
    const s = newGame(0);
    for (let guard = 0; s.run.chapter === 1 && guard < 20; guard++) {
      const node = availableNodes(s.run)[0];
      if (node.level) fight(s, node, true);
      else {
        enterNode(s, node.id);
        if (node.kind === 'camp') campTrain(s, 'pawn');
        else if (node.kind === 'event') chooseEvent(s, EVENTS[node.event!].choices.length - 1);
        else {
          s.run.done.push(s.run.at!);
          s.run.at = null;
        }
      }
    }
    expect(s.run.chapter).toBe(2);
    expect(s.run.bosses).toBe(1);
    expect(isLevelOpen(s, '2-1')).toBe(true);
  });

  it('one loss ends the run; the next starts at 1-1 with a new army and keeps the meta', () => {
    const s = newGame(0);
    s.crowns = 4;
    s.roulette.owned = { c_steel: 1 };
    s.crownTree = ['doubleStep'];
    s.run.bosses = 1;
    s.run.elites = 2;
    s.army.knight = 3;
    const node = availableNodes(s.run)[0];
    const out = fight(s, node, false);
    expect(out).toMatchObject({ win: false, runOver: true, spared: false });
    expect(s.run.over).toMatchObject({ won: false, bosses: 1, elites: 2, crowns: 1 });
    expect(s.crowns).toBe(5);
    expect(availableNodes(s.run)).toHaveLength(1); // the map waits behind the end screen
    startNextRun(s, 0);
    expect(s.run.over).toBeNull();
    expect(s.prestige).toBe(0); // the same game again
    expect(s.army.knight).toBe(0);
    expect(s.crowns).toBe(5);
    expect(s.roulette.owned).toEqual({ c_steel: 1 });
    expect(s.crownTree).toEqual(['doubleStep']);
    expect(isLevelOpen(s, '1-1')).toBe(true);
    expect(s.stats.runs).toBe(1);
  });

  it('a spare banner burns instead of the run', () => {
    const s = newGame(0);
    s.relics = [SPARE];
    expect(lives(s)).toBe(2);
    const node = availableNodes(s.run)[0];
    expect(fight(s, node, false)).toMatchObject({ spared: true, runOver: false });
    expect(s.relics).toEqual([]);
    expect(currentNode(s.run)?.id).toBe(node.id);
    expect(fight(s, node, false).runOver).toBe(true);
  });

  it('a won game moves on to the next game', () => {
    const s = newGame(0);
    s.run.complete = true;
    s.run.bosses = 4;
    expect(prestige(s, 0)).toBe(4 + 2);
    expect(s.prestige).toBe(1);
    expect(s.run.complete).toBe(false);
  });

  it('elites are stronger and grant a relic', () => {
    const s = newGame(0);
    s.run.chapter = 2;
    for (let seed = 1; seed < 200; seed++) {
      s.run.seed = seed;
      s.run.done = [];
      const map = buildMap(2, seed);
      const elite = map.nodes.find((n) => n.kind === 'elite' && n.row === 2);
      if (!elite) continue;
      s.run.done = [map.nodes.find((n) => n.row === 0)!.id, map.nodes.find((n) => n.next.includes(elite.id) && n.row === 1)!.id];
      const plain = battleSetup(s, elite.level!).enemies;
      enterNode(s, elite.id);
      expect(isEliteBattle(s, elite.level!)).toBe(true);
      const strong = battleSetup(s, elite.level!).enemies;
      expect(strong[0].level).toBeGreaterThan(plain[0].level);
      const b = createBattle(battleSetup(s, elite.level!));
      b.result = 'win';
      expect(recordResult(s, elite.level!, b).relicsEarned).toBe(1);
      return;
    }
    throw new Error('no elite in row 2 found');
  });
});

describe('camp, merchant, events', () => {
  const at = (kind: RunNode['kind']) => {
    const s = newGame(0);
    s.run.chapter = 2;
    for (let seed = 1; seed < 300; seed++) {
      const node = buildMap(2, seed).nodes.find((n) => n.kind === kind);
      if (node) {
        s.run.seed = seed;
        s.run.at = node.id;
        return { s, node };
      }
    }
    throw new Error(`no ${kind}`);
  };

  it('a camp sharpens the forge or trains a piece', () => {
    const { s } = at('camp');
    campForge(s);
    expect(s.buildings.forge).toBe(1);
    expect(s.run.at).toBeNull();
    const again = at('camp').s;
    const before = again.levels.pawn;
    expect(campTrain(again, 'knight')).toBe(false); // no knights yet
    expect(campTrain(again, 'pawn')).toBe(true);
    expect(again.levels.pawn).toBe(before + 1);
  });

  it('the merchant sells relics once, the spare banner always', () => {
    const { s, node } = at('shop');
    expect(shopItems(s, node).filter((i) => i.relic === SPARE)).toHaveLength(1);
    const relic = shopItems(s, node).find((i) => i.relic)!;
    s.gold = 0;
    expect(buyItem(s, node, relic)).toBe(false);
    s.gold = relic.cost * 2;
    expect(buyItem(s, node, relic)).toBe(true);
    expect(s.relics).toContain(relic.relic);
    expect(buyItem(s, node, relic)).toBe(false);
  });

  it('every event choice resolves (or is blocked) and closes the node', () => {
    for (const id of EVENT_IDS) {
      EVENTS[id].choices.forEach((c, i) => {
        const s = newGame(0);
        const ch = [2, 4, 1].find((n) => eventFits(id, n))!;
        s.run.chapter = ch;
        const seed = [...Array(800).keys()].find((n) => buildMap(ch, n).nodes.some((x) => x.event === id))!;
        s.run.seed = seed;
        s.run.at = buildMap(ch, seed).nodes.find((x) => x.event === id)!.id;
        s.army.pawn = 4;
        s.army.knight = 1;
        s.relics = ['chainmail', SPARE];
        s.gold = 5000;
        const blocked = c.blocked?.(s);
        const line = chooseEvent(s, i);
        if (blocked) expect(line).toBeNull();
        else {
          expect(line).toBeTruthy();
          expect(s.run.at).toBeNull();
        }
      });
    }
  });
});

describe('events by chapter and boons', () => {
  it('maps only hold events of their chapter', () => {
    for (let ch = 1; ch <= 4; ch++) {
      for (let seed = 0; seed < 60; seed++) {
        for (const n of buildMap(ch, seed).nodes) if (n.event) expect(eventFits(n.event, ch)).toBe(true);
      }
    }
    expect(EVENT_IDS.length).toBeGreaterThanOrEqual(20);
  });

  it('a blessing works for its battles and wears off; a boss one waits for the boss', () => {
    const s = newGame(0);
    s.run.boons = [{ name: 'Баллада', atk: 1.2, hp: 1, left: 1 }, { name: 'Пророчество', atk: 1, hp: 1, foe: 0.8, left: 1, boss: true }];
    const node = availableNodes(s.run)[0];
    enterNode(s, node.id);
    const plain = battleSetup(s, node.level!);
    expect(plain.enemyHpMult).toBe(1);
    const before = plain.allyAtkMult!;
    s.run.boons = [];
    expect(battleSetup(s, node.level!).allyAtkMult!).toBeCloseTo(before / 1.2);
    s.run.boons = [{ name: 'Баллада', atk: 1.2, hp: 1, left: 1 }, { name: 'Пророчество', atk: 1, hp: 1, foe: 0.8, left: 1, boss: true }];
    fight(s, node, true);
    expect(s.run.boons.map((x) => x.name)).toEqual(['Пророчество']);
    expect(activeBoons(s.run, true)).toHaveLength(1);
    expect(battleSetup(s, '1-9').enemyHpMult).toBeCloseTo(0.8);
  });
});

describe('old saves', () => {
  it('start the run at the first chapter whose boss still stands', () => {
    const old = { ...newGame(0), stars: { '1-9': 3, '2-1': 2 } } as Partial<GameState>;
    delete old.run;
    const s = parseSave(JSON.stringify(old))!;
    expect(s.run.chapter).toBe(2);
    expect(isLevelOpen(s, '2-1')).toBe(true);
    expect(s.run.over).toBeNull();
  });
});

describe('starting armies', () => {
  it('open with bosses and shape the next run', () => {
    const s = newGame(0);
    expect(s.armies).toEqual(['guard']);
    s.run.chapter = 1;
    const boss = buildMap(1, s.run.seed).nodes.find((n) => n.kind === 'boss')!;
    s.run.done = buildMap(1, s.run.seed).nodes.filter((n) => n.next.includes(boss.id)).slice(0, 1).map((n) => n.id);
    enterNode(s, boss.id);
    const b = createBattle(battleSetup(s, '1-9'));
    b.result = 'win';
    recordResult(s, '1-9', b);
    expect(s.armies).toContain('cavalry');
    s.run.over = { won: false, chapter: 2, at: '2-1', wins: 0, elites: 0, bosses: 1, crowns: 1 };
    startNextRun(s, 0, 'cavalry');
    expect(s.run.army).toBe('cavalry');
    expect(s.army.knight).toBe(2);
    expect(s.formation.filter((f) => f.kind === 'knight')).toHaveLength(2);
    const setup = battleSetup(s, '1-1');
    expect(setup.allyKind?.knight?.atk).toBeCloseTo(1.25);
  });

  it('a locked army cannot be chosen', () => {
    const s = newGame(0);
    s.run.over = { won: false, chapter: 1, at: '1-1', wins: 0, elites: 0, bosses: 0, crowns: 0 };
    startNextRun(s, 0, 'warrior');
    expect(s.run.army).toBe('guard');
  });
});

describe('difficulty', () => {
  it('a new kind of piece joins at its own level, not trained up', () => {
    const s = newGame(0);
    s.levels.pawn = 12;
    s.gold = 10_000;
    s.cleared['1-2'] = s.cleared['1-3'] = s.cleared['1-4'] = true;
    expect(recruit(s, 'knight')).toBe(true);
    expect(s.levels.knight).toBe(1);
  });

  it('an elite battle has one champion, far tougher than its plain self', () => {
    const s = newGame(0);
    s.run.chapter = 2;
    for (let seed = 1; seed < 300; seed++) {
      const map = buildMap(2, seed);
      const elite = map.nodes.find((n) => n.kind === 'elite' && n.rule !== 'mirror');
      if (!elite) continue;
      s.run.seed = seed;
      s.run.at = elite.id;
      const setup = battleSetup(s, elite.level!);
      const champs = setup.enemies.filter((p) => p.champion);
      expect(champs).toHaveLength(1);
      expect(champs[0].trait).toBeTruthy();
      const b = createBattle(setup);
      const champ = b.units.find((u) => u.champion)!;
      const twin = createBattle({ ...setup, enemies: [{ ...champs[0], champion: false }] }).units.find((u) => u.side === 'enemy')!;
      expect(champ.maxHp / twin.maxHp).toBeCloseTo(CHAMPION_HP, 1);
      return;
    }
    throw new Error('no elite found');
  });
});

describe('threat levels', () => {
  it('a won game opens the next threat level, which then pays more crowns', () => {
    const s = newGame(0);
    expect(s.threatMax).toBe(0);
    s.run.bosses = 4;
    s.run.complete = true;
    prestige(s, 0);
    expect(s.threatMax).toBe(1);
    s.run.over = { won: false, chapter: 1, at: '1-1', wins: 0, elites: 0, bosses: 0, crowns: 0 };
    startNextRun(s, 0, 'guard', 1);
    expect(s.run.threat).toBe(1);
    s.run.bosses = 4;
    s.run.complete = true;
    const crowns = prestige(s, 0);
    expect(crowns).toBe(4 + 2 + 1);
    expect(s.threatMax).toBe(2);
  });

  it('a threat cannot be picked above the one opened, and its rules bite', () => {
    const s = newGame(0);
    s.threatMax = 3;
    s.run.over = { won: false, chapter: 1, at: '1-1', wins: 0, elites: 0, bosses: 0, crowns: 0 };
    startNextRun(s, 0, 'guard', 9);
    expect(s.run.threat).toBe(3);
    const node = availableNodes(s.run)[0];
    const plain = newGame(0);
    expect(battleSetup(s, node.level!).enemies[0].level).toBe(battleSetup(plain, node.level!).enemies[0].level + 1);
    s.run.threat = 10;
    s.threatMax = 10;
    expect(shopItems(s, { id: 'x', row: 0, lane: 0, kind: 'shop', next: [] }).some((i) => i.relic === SPARE)).toBe(false);
    expect(commandLimit(s, node.level!)).toBe(commandLimit(plain, node.level!) - 1);
  });
});

describe('achievements pay crowns', () => {
  it('a claim pays exactly the crowns the card shows', () => {
    const s = newGame(0);
    s.achievements = ['boss_4', 'first_win'];
    const before = s.crowns;
    expect(claimAchievement(s, 'boss_4')).toBe(getAchievement('boss_4')!.crowns);
    expect(claimAchievement(s, 'first_win')).toBe(1);
    expect(s.crowns).toBe(before + getAchievement('boss_4')!.crowns + 1);
    expect(claimAchievement(s, 'boss_4')).toBe(0);
  });

  it('a chapter without losses counts as clean', () => {
    const s = newGame(0);
    const map = buildMap(1, s.run.seed);
    const boss = map.nodes.find((n) => n.kind === 'boss')!;
    s.run.done = map.nodes.filter((n) => n.next.includes(boss.id)).slice(0, 1).map((n) => n.id);
    enterNode(s, boss.id);
    const b = createBattle(battleSetup(s, '1-9'));
    b.result = 'win';
    recordResult(s, '1-9', b);
    expect(s.stats.cleanChapters).toBe(1);
  });
});
