import { test } from 'vitest';
import { createBattle, simulate, MAX_TICKS } from '../src/game/battle';
import { autoFormation, bestFormation } from '../src/game/autoformation';
import { ALL_LEVELS, chapterOf } from '../src/game/levels';
import { PIECES, type PieceKind } from '../src/game/pieces';
import {
  BUILDINGS, accrue, battleSetup, buildingCost, buyBuilding, chooseRelic, collectTreasury, commandLimit,
  incomePerMinute, isUnlocked, newGame, recordResult, recruit, recruitCost, relicOffer, upgradeCost, upgradePiece,
  type BuildingId,
} from '../src/game/state';

const CONSOLATION = process.env.NOCONS ? false : true;

test('campaign bot', () => {
  const s = newGame(0);
  // GAME=N runs the campaign as the N-th game (enemy bonus and distortion), without crowns or the tree.
  s.prestige = Number(process.env.GAME ?? 1) - 1;
  let t = 0; // seconds
  const chapterTime: Record<number, number> = {};
  const attempts: Record<string, number> = {};
  let timeouts = 0;
  const timeoutAt: Record<string, number> = {};
  const kinds = Object.keys(PIECES) as PieceKind[];
  const options = (limit: number) => {
    const out: { cost: number; buy: () => boolean }[] = [];
    const total = kinds.filter((k) => k !== 'king').reduce((n, k) => n + s.army[k], 0);
    for (const k of kinds) {
      if (!isUnlocked(s, k)) continue;
      if (k === 'king' || s.army[k] > 0) out.push({ cost: upgradeCost(s, k), buy: () => upgradePiece(s, k) });
      if (k !== 'king' && total < limit + 1 && !(k === 'queen' && s.army.queen >= 1)) {
        const weight = k === 'pawn' ? 1 : 0.6; // prefer strong pieces slightly
        out.push({ cost: recruitCost(s, k) * weight, buy: () => recruit(s, k) });
      }
    }
    for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
      if (s.buildings[id] < BUILDINGS[id].maxLevel) out.push({ cost: buildingCost(s, id) * 1.3, buy: () => buyBuilding(s, id) });
    }
    return out.sort((a, b) => a.cost - b.cost);
  };
  for (const level of ALL_LEVELS) {
    const start = t;
    attempts[level.id] = 0;
    for (;;) {
      accrue(s, t * 1000); collectTreasury(s);
      for (let offer = relicOffer(s); offer; offer = relicOffer(s)) chooseRelic(s, offer[0]);
      const limit = commandLimit(s, level.id);
      for (let i = 0; i < 200; i++) { const o = options(limit)[0]; if (!o || s.gold < o.cost || !o.buy()) break; }
      if (process.env.PLAIN) autoFormation(s, limit, undefined, level.id); else bestFormation(s, level.id, limit);
      const b = createBattle(battleSetup(s, level.id));
      simulate(b);
      attempts[level.id]++;
      if (b.tick >= MAX_TICKS && process.env.DUMP && !timeoutAt[level.id]) {
        const g = [...Array(8)].map(() => [...'........']);
        for (const u of b.units) if (u.hp > 0) g[u.y][u.x] = u.side === 'ally' ? u.kind[0].toUpperCase() : u.kind[0];
        console.log(level.id, 'timeout\n' + g.map((r) => r.join('')).join('\n'));
      }
      if (b.tick >= MAX_TICKS) { timeouts++; timeoutAt[level.id] = (timeoutAt[level.id] ?? 0) + 1; }
      const out = recordResult(s, level.id, b);
      if (!out.win && !CONSOLATION) s.gold -= out.reward;
      t += (b.tick * 0.1) / 2 + 10;
      if (out.win) break;
      // Wait for the next purchase if nothing is affordable.
      const next = options(limit)[0];
      if (next && s.gold < next.cost) {
        accrue(s, t * 1000);
        const need = next.cost - s.gold - s.treasury;
        if (need > 0) t += (need / Math.max(0.01, incomePerMinute(s))) * 60;
      }
      if (attempts[level.id] > 400) break;
    }
    if (process.env.TRACE) console.log(level.id, (t/60).toFixed(1), attempts[level.id], Math.round(s.stats.goldEarned), Math.round(incomePerMinute(s)), JSON.stringify(s.levels));
    const ch = chapterOf(level.id).id;
    chapterTime[ch] = (chapterTime[ch] ?? 0) + (t - start);
  }
  const total = t / 60;
  const lines = Object.entries(chapterTime).map(([c, v]) => `ch${c}: ${(v / 60).toFixed(0)} min (${((v / t) * 100).toFixed(0)}%)`);
  console.log(`consolation=${CONSOLATION} total ${(total / 60).toFixed(1)} h, timeouts ${timeouts}\n${lines.join('\n')}`);
  console.log(Object.entries(attempts).filter(([, n]) => n > 5).map(([id, n]) => `${id}:${n}`).join(' '));
  if (timeouts) console.log('timeouts at', JSON.stringify(timeoutAt));
  console.log('levels', JSON.stringify(s.levels), 'army', JSON.stringify(s.army));
}, 600_000);
