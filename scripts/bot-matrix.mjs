// Bot matrix: every starting army × every bot strategy × a few map seeds.
// Runs scripts/story-bot.test.ts in parallel and writes docs/BALANCE_MATRIX.md.
// Run: npm run bot:matrix   (SEEDS=3 JOBS=4 by default)
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ARMIES = ['guard', 'cavalry', 'archers', 'fortress', 'warrior'];
const STRATS = ['swarm', 'chess', 'riders'];
const SEEDS = Number(process.env.SEEDS ?? 3);
const JOBS = Number(process.env.JOBS ?? 4);
const ARMY_NAMES = { guard: 'Королевская стража', cavalry: 'Конница', archers: 'Лучники', fortress: 'Твердыня', warrior: 'Король-воин' };
const STRAT_NAMES = { swarm: 'рой (сила за золото)', chess: 'набор (≤4 пешек, по 2 фигуры)', riders: 'конница/слоны (≤2 пешек, 1 ладья)' };

const jobs = [];
for (const army of ARMIES) for (const strat of STRATS) for (let seed = 0; seed < SEEDS; seed++) jobs.push({ army, strat, seed });

function run(job) {
  return new Promise((resolve) => {
    const env = { ...process.env, ARMY: job.army, STRAT: job.strat, SEED: String(job.seed), MOVES: '1', BOLD: '1' };
    const p = spawn('npx', ['vitest', 'run', 'scripts/story-bot.test.ts', '--silent=false'], { env });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', () => {
      const line = out.split('\n').find((l) => l.includes('MATRIX '));
      const army = out.split('\n').filter((l) => l.includes('армия ')).at(0)?.trim() ?? '';
      resolve(line ? { ...JSON.parse(line.slice(line.indexOf('MATRIX ') + 7)), build: army } : { ...job, error: out.slice(-400) });
    });
  });
}

// FROM_JSON=1: rebuild the report from docs/balance-matrix.json without running the bots again.
const results = process.env.FROM_JSON ? JSON.parse(readFileSync('docs/balance-matrix.json', 'utf8')) : [];
let next = process.env.FROM_JSON ? jobs.length : 0;
await Promise.all(Array.from({ length: JOBS }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const r = await run(job);
    results.push(r);
    process.stdout.write(`${results.length}/${jobs.length} ${job.army}/${job.strat}/${job.seed}: ${r.runs ? r.runs.join(',') : 'ERROR'}\n`);
  }
}));

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
// A game not won within the bot's 40 runs counts as 40 (marked "≥").
const g1 = (r) => Math.abs(r.runs[0]);
const cell = (army, strat) => results.filter((r) => r.army === army && r.strat === strat && r.runs);
const lines = [];
lines.push('# Матрица ботов', '');
lines.push(`Сгенерировано \`npm run bot:matrix\` (${SEEDS} карты на комбинацию; бот ходит в элиту и пользуется ходами). Все армии открыты сразу.`);
lines.push('В клетке — **медиана забегов на всю историю** (партии 1–3, с разбросом по картам) · в скобках после «п1» — медиана забегов до победы в 1-й партии.');
lines.push('Сумма честнее, чем одна 1-я партия: долгая 1-я партия копит короны на Древо, и партии 2–3 потом проходят быстрее.', '');
lines.push(`| Армия | ${STRATS.map((s) => STRAT_NAMES[s]).join(' | ')} |`);
lines.push(`|---|${STRATS.map(() => '---').join('|')}|`);
const medians = [];
const totalRuns = (r) => r.runs.reduce((a, x) => a + Math.abs(x), 0);
for (const army of ARMIES) {
  const row = STRATS.map((strat) => {
    const rs = cell(army, strat);
    if (!rs.length) return '—';
    const m = median(rs.map(totalRuns));
    medians.push({ army, strat, m });
    const lost = rs.some((r) => r.runs.some((x) => x < 0)) ? '≥' : '';
    return `**${lost}${m}** (${Math.min(...rs.map(totalRuns))}–${Math.max(...rs.map(totalRuns))}) · п1 ${median(rs.map(g1))}`;
  });
  lines.push(`| ${ARMY_NAMES[army]} | ${row.join(' | ')} |`);
}
const deaths = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (const r of results) for (const [c, n] of Object.entries(r.deaths ?? {})) deaths[c] += n;
const total = Object.values(deaths).reduce((a, b) => a + b, 0) || 1;
lines.push('', '## Где умирают', '');
lines.push(`Все прогоны вместе: ${Object.entries(deaths).map(([c, n]) => `глава ${c} — ${Math.round((n / total) * 100)}%`).join(', ')} (${total} смертей). Цель фазы 3.5: ≈15/25/35/25%.`);
const best = Math.min(...medians.map((m) => m.m));
const viable = medians.filter((m) => m.m <= best * 2);
lines.push('', '## Жизнеспособные сборки', '');
const close = medians.filter((m) => m.m <= best * 1.5);
lines.push(`Лучшая медиана — ${best} забегов на всю историю. В пределах ×2 от неё (≤ ${best * 2}): ${viable.length} из ${medians.length} комбинаций; в пределах ×1,5: ${close.length}.`);
lines.push(`Ближе всего к лучшей: ${[...medians].sort((a, b) => a.m - b.m).slice(0, 5).map((m) => `${ARMY_NAMES[m.army]} · ${STRAT_NAMES[m.strat]} (${m.m})`).join('; ')}.`);
lines.push(`Цель фазы 3.1: минимум 3 жизнеспособные сборки.`, '');
lines.push('## Во что вырастает армия (1-я карта, после 3-й партии)', '');
for (const army of ARMIES) for (const strat of STRATS) {
  const r = results.find((x) => x.army === army && x.strat === strat && x.seed === 0);
  if (r?.build) lines.push(`- ${ARMY_NAMES[army]} · ${STRAT_NAMES[strat]}: ${r.build.replace(/^армия /, '')}`);
}
const errors = results.filter((r) => r.error);
if (errors.length) lines.push('', `Ошибки: ${errors.length}`, ...errors.map((e) => `- ${e.army}/${e.strat}/${e.seed}`));
writeFileSync('docs/BALANCE_MATRIX.md', lines.join('\n') + '\n');
writeFileSync('docs/balance-matrix.json', JSON.stringify(results.map(({ build, ...r }) => r), null, 1));
console.log(lines.join('\n'));
