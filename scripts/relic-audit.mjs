// Relic audit: the story bot picks relics at random; for every pick we know the game, the chapter it came in
// and how the run ended. A relic's value is how much more often runs that took it went on to win, compared
// with every pick made at the same game and chapter. Writes docs/RELIC_AUDIT.md.
// The same runs also pick event choices at random and write docs/EVENT_AUDIT.md the same way.
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
      const grab = (tag) => {
        const line = out.split('\n').find((l) => l.includes(`${tag} [`));
        return line ? JSON.parse(line.slice(line.indexOf(`${tag} `) + tag.length + 1)) : [];
      };
      resolve({ relics: grab('RELICS'), events: grab('EVENTS') });
    });
  });
}

let picks = [];
let choices = [];
if (process.env.FROM_JSON) {
  picks = JSON.parse(readFileSync('docs/relic-audit.json', 'utf8'));
  choices = JSON.parse(readFileSync('docs/event-audit.json', 'utf8'));
}
else {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await run(job);
      picks.push(...r.relics);
      choices.push(...r.events);
      process.stdout.write(`${++done}/${jobs.length} ${job.army}/${job.strat}/${job.seed}: ${r.relics.length} relics, ${r.events.length} events\n`);
    }
  }));
  writeFileSync('docs/relic-audit.json', JSON.stringify(picks));
  writeFileSync('docs/event-audit.json', JSON.stringify(choices));
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

// ---------- Events ----------
const runTs = readFileSync('src/game/run.ts', 'utf8');
const events = {};
for (const m of runTs.matchAll(/\n  (\w+): \{\n    title: t\('([^']+)'\)/g)) events[m[1]] = { title: m[2], labels: [] };
for (const id of Object.keys(events)) {
  const from = runTs.indexOf(`\n  ${id}: {\n    title:`);
  const to = runTs.indexOf('\n  },\n', from);
  events[id].labels = [...runTs.slice(from, to).matchAll(/label: t\('([^']+)'\)/g)].map((m) => m[1]);
}
const ebase = {};
for (const c of choices) {
  const b = (ebase[key(c)] ??= { n: 0, won: 0, reached: 0 });
  b.n++; b.won += c.won ? 1 : 0; b.reached += c.reached;
}
const est = {};
for (const c of choices) {
  const b = ebase[key(c)];
  const r = ((est[c.event] ??= {})[c.choice] ??= { n: 0, dWin: 0, dReach: 0 });
  r.n++;
  r.dWin += (c.won ? 1 : 0) - b.won / b.n;
  r.dReach += c.reached - b.reached / b.n;
}
const elines = [
  '# Аудит событий', '',
  `Те же ${jobs.length} прогонов бота: в событиях вариант выбирается случайно. Всего выборов: ${choices.length}.`,
  '**Δ победы** — насколько чаще выигрывал забег после этого варианта, чем в среднем после любого события в той же партии и главе.',
  '**Разрыв** — разница между лучшим и худшим вариантом события: большой разрыв значит, что выбор очевиден. Меньше ~40 выборов — шум.', '',
  '| Событие | Вариант | выборов | Δ победы, п.п. | Δ глубины, глав |', '|---|---|---|---|---|',
];
const gaps = [];
for (const [id, byChoice] of Object.entries(est)) {
  const rs = Object.entries(byChoice).map(([i, r]) => ({ i: +i, n: r.n, dWin: (r.dWin / r.n) * 100, dReach: r.dReach / r.n }));
  const gap = Math.max(...rs.map((r) => r.dWin)) - Math.min(...rs.map((r) => r.dWin));
  gaps.push({ id, gap });
  for (const r of rs.sort((a, b) => a.i - b.i)) {
    elines.push(`| ${events[id]?.title ?? id} | ${events[id]?.labels[r.i] ?? r.i} | ${r.n} | ${fmt(r.dWin)} | ${fmt(r.dReach, 2)} |`);
  }
}
elines.push('', '## Самые «очевидные» события (наибольший разрыв между вариантами)', '');
for (const g of gaps.sort((a, b) => b.gap - a.gap).slice(0, 8)) elines.push(`- ${events[g.id]?.title ?? g.id}: ${g.gap.toFixed(1)} п.п.`);
writeFileSync('docs/EVENT_AUDIT.md', elines.join('\n') + '\n');
console.log(elines.join('\n'));
