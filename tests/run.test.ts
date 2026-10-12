import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/game/battle';
import { CHAPTERS } from '../src/game/levels';
import {
  BANNERS, EVENTS, EVENT_IDS, MAP_ROWS, availableNodes, buildMap, buyItem, campRest, campTrain, chooseEvent, currentNode,
  enterNode, shopItems, type RunNode,
} from '../src/game/run';
import { battleSetup, collectTreasury, isEliteBattle, isLevelOpen, newGame, parseSave, recordResult, type GameState } from '../src/game/state';

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
    expect(s.run.banners).toBe(BANNERS);
    expect(isLevelOpen(s, '2-1')).toBe(true);
    expect(s.stats.cleanChapters).toBe(1);
  });

  it('losing costs a banner; the last one starts the chapter over with the old army', () => {
    const s = newGame(0);
    const node = availableNodes(s.run)[0];
    s.gold = 999; // gold earned after the chapter began is lost on a restart
    expect(fight(s, node, false)).toMatchObject({ win: false, banners: 2, restarted: false });
    expect(currentNode(s.run)?.id).toBe(node.id);
    fight(s, node, false);
    const seed = s.run.seed;
    const last = fight(s, node, false);
    expect(last.restarted).toBe(true);
    expect(s.run.banners).toBe(BANNERS);
    expect(s.run.seed).not.toBe(seed);
    expect(s.run.restarts).toBe(1);
    expect(s.gold).toBe(newGame(0).gold);
  });

  it('a restart keeps gold earned off the map', () => {
    const s = newGame(0);
    const node = availableNodes(s.run)[0];
    s.treasury = 300;
    collectTreasury(s);
    for (let i = 0; i < BANNERS; i++) fight(s, node, false);
    expect(s.run.restarts).toBe(1);
    expect(s.gold).toBe(newGame(0).gold + 300);
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

  it('a camp gives back a banner or trains a piece', () => {
    const { s } = at('camp');
    expect(campRest(s)).toBe(false); // banners are full
    s.run.banners = 1;
    expect(campRest(s)).toBe(true);
    expect(s.run.banners).toBe(2);
    expect(s.run.at).toBeNull();
    const again = at('camp').s;
    const before = again.levels.pawn;
    expect(campTrain(again, 'knight')).toBe(false); // no knights yet
    expect(campTrain(again, 'pawn')).toBe(true);
    expect(again.levels.pawn).toBe(before + 1);
  });

  it('the merchant sells relics once', () => {
    const { s, node } = at('shop');
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
        s.run.chapter = 2;
        const seed = [...Array(400).keys()].find((n) => buildMap(2, n).nodes.some((x) => x.event === id))!;
        s.run.seed = seed;
        s.run.at = buildMap(2, seed).nodes.find((x) => x.event === id)!.id;
        s.army.pawn = 4;
        s.gold = 500;
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

describe('old saves', () => {
  it('start the run at the first chapter whose boss still stands', () => {
    const old = { ...newGame(0), stars: { '1-9': 3, '2-1': 2 } } as Partial<GameState>;
    delete old.run;
    const s = parseSave(JSON.stringify(old))!;
    expect(s.run.chapter).toBe(2);
    expect(isLevelOpen(s, '2-1')).toBe(true);
    expect(s.run.snapshot).not.toBeNull();
  });
});
