import { ACHIEVEMENTS, type AchievementDef } from '../../game/achievements';
import { claimAchievement } from '../../game/state';
import { audio } from '../audio';
import type { Ctx, Screen } from '../context';
import { el, pulse, setText, toast } from '../dom';
import { fmt } from '../format';
import { iconUrl, type IconId } from '../icons';
import { t } from '../../i18n';

interface Row {
  def: AchievementDef;
  root: HTMLElement;
  bar: HTMLElement;
  count: HTMLElement;
  btn: HTMLButtonElement;
  state: 'ready' | 'progress' | 'done';
  ratio: number;
}

/** A themed badge per achievement, picked from its id. */
function badgeFor(id: string): IconId {
  if (/win|veteran|commander/.test(id)) return 'sword';
  if (/flawless/.test(id)) return 'heart';
  if (/promote|prestige|crown|boss|captain|rider|fortress|queen|mate/.test(id)) return 'crown';
  if (/kill/.test(id)) return 'skull';
  if (/crit|abilit|relic/.test(id)) return 'spark';
  if (/architect|hq|build/.test(id)) return 'lock';
  return 'star';
}

export class AchievementsScreen implements Screen {
  readonly root = el('section', 'achievements-screen');
  private rows: Row[] = [];
  private list = el('div', 'ach-list');
  private summary = el('div', 'arena-sub');
  private orderSig = '';
  private claimAllBtn = el('button', 'btn btn-buy ach-claim-all');

  constructor(private ctx: Ctx) {
    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', t('← Карта'));
    back.addEventListener('click', () => this.ctx.go('map'));
    const titles = el('div', 'arena-titles');
    titles.append(el('h1', 'arena-title', t('Достижения')), this.summary);
    this.claimAllBtn.addEventListener('click', () => {
      let total = 0;
      for (const r of this.rows) if (r.state === 'ready') total += claimAchievement(this.ctx.state, r.def.id);
      if (total > 0) {
        audio.play('coins');
        toast(t('Награды за достижения: +{n} ♛', { n: total }), 'good');
        this.ctx.save();
      }
    });
    top.append(back, titles, this.claimAllBtn);

    for (const def of ACHIEVEMENTS) {
      const root = el('div', 'ach-row');
      const badge = el('img', 'ach-icon');
      badge.src = iconUrl(badgeFor(def.id));
      badge.alt = '';
      const body = el('div', 'ach-body');
      const head = el('div', 'ach-head');
      const count = el('span', 'ach-count');
      head.append(el('span', 'ach-name', def.name), count);
      const track = el('div', 'ach-track');
      const bar = el('div', 'ach-fill');
      track.append(bar);
      body.append(head, el('div', 'ach-desc', def.description), track);
      const reward = el('div', 'ach-reward', `+${def.crowns} ♛`);
      reward.title = t('Награда: {n} ♛ — короны тратятся в Древе и Колесе короны', { n: def.crowns });
      const btn = el('button', 'btn btn-buy ach-btn', t('Забрать'));
      btn.addEventListener('click', () => {
        const got = claimAchievement(this.ctx.state, def.id);
        if (got > 0) {
          audio.play('coins');
          pulse(btn);
          toast(t('«{name}»: +{n} ♛', { name: def.name, n: got }), 'good');
          this.ctx.save();
        }
      });
      root.append(badge, body, reward, btn);
      this.rows.push({ def, root, bar, count, btn, state: 'progress', ratio: 0 });
    }
    this.root.append(top, this.list);
  }

  show(): void {
    this.orderSig = '';
  }

  frame(): void {
    const s = this.ctx.state;
    let done = 0;
    let ready = 0;
    for (const r of this.rows) {
      const unlocked = s.achievements.includes(r.def.id);
      const claimed = s.achievementsClaimed.includes(r.def.id);
      if (unlocked) done++;
      const value = Math.min(r.def.goal, r.def.progress(s));
      r.ratio = value / r.def.goal;
      r.state = claimed ? 'done' : unlocked ? 'ready' : 'progress';
      if (r.state === 'ready') ready++;
      r.bar.style.width = `${r.ratio * 100}%`;
      setText(r.count, claimed ? '✓' : `${fmt(value)}/${fmt(r.def.goal)}`);
      r.root.dataset.state = r.state;
      r.btn.hidden = r.state !== 'ready';
    }
    // Ready to claim first, then the closest to done, finished ones last.
    const rank = { ready: 0, progress: 1, done: 2 };
    const sorted = [...this.rows].sort((a, b) => rank[a.state] - rank[b.state] || b.ratio - a.ratio);
    const sig = sorted.map((r) => r.def.id).join();
    if (sig !== this.orderSig) {
      this.orderSig = sig;
      this.list.replaceChildren(...sorted.map((r) => r.root));
    }
    this.claimAllBtn.hidden = ready < 2;
    setText(this.claimAllBtn, t('Забрать всё · {n}', { n: ready }));
    setText(this.summary, t('Открыто {done} из {total}', { done, total: this.rows.length }) + (ready ? t(' · забрать: {n}', { n: ready }) : ''));
  }
}
