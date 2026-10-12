// Relic audit: the story bot picks relics at random; for every pick we know the game, the chapter it came in
// and how the run ended. A relic's value is how much more often runs that took it went on to win, compared
// with every pick made at the same game and chapter. Writes docs/RELIC_AUDIT.md.
// Run: npm run bot:relics   (SEEDS=4 JOBS=4)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ARMIES = ['guard', 'cavalry', 'archers', 'fortress', 'warrior'];
const STRATS = ['swarm', 'chess', 'riders'];
const SEEDS = Number(process.env.SEEDS ?? 4);
const JOBS = Number(process.env.JOBS ?? 4);

const jobs = [];
for (const army of ARMIES) for (const strat of STRATS) for (let seed = 0; seed < SEEDS; seed++) jobs.push({ army, strat, seed });

function run(job) {
  return new Promise((resolve) => {
    const env = { ...process.env, ARMY: job.army, STRAT: job.strat, SEED: String(job.seed), MOVES: '1', BOLD: '1', RELICS: 'random' };
    const p = spawn('npx', ['vitest', 'run', 'scripts/story-bot.test.ts', '--silent=false'], { env });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', () => {
      const line = out.split('\n').find((l) => l.includes('RELICS ['));
      resolve(line ? JSON.parse(line.slice(line.indexOf('RELICS ') + 7)) : []);
    });
  });
}

let picks = [];
if (process.env.FROM_JSON) picks = JSON.parse(readFileSync('docs/relic-audit.json', 'utf8'));
else {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await run(job);
      picks.push(...r);
      process.stdout.write(`${++done}/${jobs.length} ${job.army}/${job.strat}/${job.seed}: ${r.length} picks\n`);
    }
  }));
  writeFileSync('docs/relic-audit.json', JSON.stringify(picks));
}

const relicsTs = readFileSync('src/game/relics.ts', 'utf8');
const NAMES = Object.fromEntries([...relicsTs.matchAll(/(\w+): \{ id: '\w+', name: t\('([^']+)'\)/g)].map((m) => [m[1], m[2]]));
const key = (p) => `${p.game}:${p.chapter}`;
const base = {};
for (const p of picks) {
  const b = (base[key(p)] ??= { n: 0, won: 0, reached: 0 });
  b.n++; b.won += p.won ? 1 : 0; b.reached += p.reached;
}
const stats = {};
for (const p of picks) {
  const b = base[key(p)];
  const r = (stats[p.relic] ??= { n: 0, dWin: 0, dReach: 0 });
  r.n++;
  r.dWin += (p.won ? 1 : 0) - b.won / b.n;
  r.dReach += p.reached - b.reached / b.n;
}
const rows = Object.entries(stats).map(([id, r]) => ({ id, n: r.n, dWin: (r.dWin / r.n) * 100, dReach: r.dReach / r.n }))
  .sort((a, b) => b.dWin - a.dWin);
const missing = Object.keys(NAMES).filter((id) => !stats[id]);
const fmt = (x, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
const lines = [
  '# Аудит реликвий', '',
  `Сгенерировано \`npm run bot:relics\`: ${jobs.length} прогонов бота (5 армий × 3 стратегии × ${SEEDS} карты), реликвии выбираются случайно.`,
  `Всего выборов: ${picks.length}. Для каждого выбора известны партия, глава и исход забега.`,
  '**Δ победы** — на сколько процентных пунктов чаще забег с этой реликвией выигрывал, чем в среднем забег, взявший любую реликвию в той же партии и главе.',
  '**Δ глубины** — на сколько глав дальше заходил забег (победа считается как глава 5). Меньше ~40 выборов — шум.', '',
  '| Реликвия | id | выборов | Δ победы, п.п. | Δ глубины, глав |', '|---|---|---|---|---|',
  ...rows.map((r) => `| ${NAMES[r.id] ?? r.id} | \`${r.id}\` | ${r.n} | ${fmt(r.dWin)} | ${fmt(r.dReach, 2)} |`),
];
if (missing.length) lines.push('', `Ни разу не выбраны: ${missing.map((id) => NAMES[id] ?? id).join(', ')}.`);
writeFileSync('docs/RELIC_AUDIT.md', lines.join('\n') + '\n');
console.log(lines.join('\n'));
