// Browser smoke test of the whole loop a new player meets:
// new game → first battle → map → death → new run.
// Runs against the single-file build: `npm run e2e` builds it first.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const page_url = pathToFileURL(fileURLToPath(new URL('../dist-artifact/pixel-gambit.html', import.meta.url))).href;
const SAVE_KEY = 'chess-autobattler-save';
// A preinstalled Chromium (cloud containers) is used when Playwright's own is absent.
const executablePath = existsSync('/opt/pw-browsers/chromium') && !process.env.CI ? '/opt/pw-browsers/chromium' : undefined;

const browser = await chromium.launch(executablePath ? { executablePath } : {}).catch(() => chromium.launch());
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
let page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let failed = false;
const step = (name) => console.log(`• ${name}`);
const check = (ok, what) => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failed = true;
};
const screen = () => page.evaluate(() => document.body.dataset.screen);
const save = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);

/** Click whatever teaching overlays are in the way: tips and scene skips. */
async function clearOverlays() {
  for (let i = 0; i < 12; i++) {
    const tip = page.locator('.tip-bubble:visible .btn').first();
    const skip = page.locator('.scene-skip:visible').first();
    if (await tip.count()) await tip.click({ timeout: 1000 }).catch(() => {});
    else if (await skip.count()) await skip.click({ timeout: 1000 }).catch(() => {});
    else return;
    await page.waitForTimeout(250);
  }
}

/** Start the battle on the screen and wait for its result dialog. */
async function fight() {
  await clearOverlays();
  await page.locator('.arena-screen .seg-btn', { hasText: '×4' }).click({ timeout: 500 }).catch(() => {});
  await page.locator('.arena-screen .btn', { hasText: '▶ В бой' }).click();
  await page.waitForSelector('.result-modal, .run-end-modal', { timeout: 90_000 });
  await page.waitForTimeout(300);
  return (await page.locator('.modal-overlay').last().innerText()).replace(/\s+/g, ' ');
}

/** Enter the first open node of the run map (a battle in these scenarios). */
async function enterNode() {
  await clearOverlays();
  await page.locator('.run-node.current').first().click();
  await page.locator('.modal .btn', { hasText: 'В бой' }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.body.dataset.screen === 'arena');
}

try {
  step('A fresh start opens the menu');
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e')) return;
    localStorage.clear();
    localStorage.setItem('pixel-gambit-lang', 'ru');
    sessionStorage.setItem('e2e', '1');
  });
  await page.goto(page_url);
  check(await page.locator('text=Новая игра').isVisible(), 'the menu offers a new game');

  step('New game leads straight into the first battle');
  await page.locator('text=Новая игра').click();
  for (let i = 0; i < 40 && await screen() !== 'arena'; i++) {
    await clearOverlays();
    await page.waitForTimeout(400);
  }
  check(await screen() === 'arena', 'the arena is open');
  check(await page.locator('.arena-screen .unit.enemy').count() > 0, 'enemies stand on the board');

  step('The first battle is won');
  const first = await fight();
  check(first.includes('Победа'), `the result says victory (${first.slice(0, 40)}…)`);

  step('After the battle the run map opens');
  await page.locator('.modal-overlay .btn', { hasText: 'Дальше' }).click();
  await page.waitForTimeout(400);
  if (await screen() !== 'map') await page.locator('.nav-btn', { hasText: 'Карта' }).click().catch(() => {});
  await clearOverlays();
  check(await screen() === 'map', 'the map is shown');
  const afterWin = await save();
  check(afterWin?.run?.wins >= 1, 'the win is saved');

  step('A hopeless battle ends the run');
  // A lone pawn and king walk into chapter 4: the run cannot survive it.
  // The game saves itself when its page closes, so the weakened save is written
  // into a fresh page before the game there starts.
  const weak = { ...afterWin, army: { king: 1, pawn: 1 }, levels: { king: 1, pawn: 1 }, formation: [], relics: [],
    run: { ...afterWin.run, chapter: 4, done: [], at: null } };
  await page.close();
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('weak')) { localStorage.setItem(k, v); sessionStorage.setItem('weak', '1'); } }, [SAVE_KEY, JSON.stringify(weak)]);
  await page.goto(page_url);
  await page.locator('text=Продолжить').click();
  await page.waitForTimeout(500);
  await clearOverlays();
  await enterNode();
  const loss = await fight();
  check(/Поражение|Забег окончен/.test(loss), 'the battle is lost');
  if (!(await page.locator('.run-end-modal').count())) {
    await page.locator('.modal-overlay .btn').last().click();
    await page.waitForSelector('.run-end-modal', { timeout: 10_000 });
  }
  check(await page.locator('.run-end-modal').isVisible(), 'the run-end screen appears');
  check((await save())?.run?.over != null, 'the save marks the run as over');

  step('“Again” starts a new run');
  await page.locator('.run-end-modal .btn', { hasText: 'Ещё раз' }).click();
  await page.waitForTimeout(600);
  for (let i = 0; i < 4 && await page.locator('.modal-overlay').count(); i++) {
    await page.locator('.modal-overlay .btn').last().click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await clearOverlays();
  const fresh = await save();
  check(fresh?.run?.over == null && fresh?.run?.chapter === 1 && fresh?.run?.wins === 0, 'a fresh run begins in chapter 1');
  check(await screen() === 'map' || await screen() === 'arena', 'the game goes on (map or first battle)');
} catch (e) {
  console.log(`  ✗ ${e.message.split('\n')[0]}`);
  failed = true;
  await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {});
}

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
console.log(failed ? '\nE2E FAILED' : '\nE2E passed');
process.exit(failed ? 1 : 0);
