import { ACHIEVEMENTS, type AchievementDef } from '../../game/achievements';
import { claimAchievement } from '../../game/state';
import { audio } from '../audio';
import type { Ctx, Screen } from '../context';
import { el, pulse, setText, toast } from '../dom';
import { fmt } from '../format';

interface Card {
  def: AchievementDef;
  root: HTMLElement;
  bar: HTMLElement;
  count: HTMLElement;
  btn: HTMLButtonElement;
}

export class AchievementsScreen implements Screen {
  readonly root = el('section', 'achievements-screen');
  private cards: Card[] = [];
  private summary = el('div', 'arena-sub');

  constructor(private ctx: Ctx) {
    const top = el('div', 'arena-top');
    const back = el('button', 'btn btn-ghost', '← Карта');
    back.addEventListener('click', () => this.ctx.go('map'));
    const titles = el('div', 'arena-titles');
    titles.append(el('h1', 'arena-title', 'Достижения'), this.summary);
    top.append(back, titles);

    const grid = el('div', 'ach-grid');
    for (const def of ACHIEVEMENTS) {
      const root = el('div', 'card ach-card');
      const badge = el('div', 'ach-badge');
      const body = el('div', 'ach-body');
      const track = el('div', 'bar');
      const bar = el('div', 'bar-fill');
      track.append(bar);
      const count = el('div', 'ach-count');
      body.append(el('div', 'row-name', def.name), el('div', 'row-desc', def.description), track, count);
      const btn = el('button', 'btn btn-buy ach-btn');
      btn.addEventListener('click', () => {
        const got = claimAchievement(this.ctx.state, def.id);
        if (got > 0) {
          audio.play('coins');
          pulse(btn);
          toast(`«${def.name}»: +${fmt(got)} золота`, 'good');
          this.ctx.save();
        }
      });
      root.append(badge, body, btn);
      grid.append(root);
      this.cards.push({ def, root, bar, count, btn });
    }
    this.root.append(top, grid);
  }

  show(): void {}

  frame(): void {
    const s = this.ctx.state;
    let done = 0;
    for (const c of this.cards) {
      const unlocked = s.achievements.includes(c.def.id);
      const claimed = s.achievementsClaimed.includes(c.def.id);
      if (unlocked) done++;
      const value = Math.min(c.def.goal, c.def.progress(s));
      c.bar.style.width = `${(value / c.def.goal) * 100}%`;
      setText(c.count, `${fmt(value)} / ${fmt(c.def.goal)} · награда ${fmt(c.def.reward)} золота`);
      c.root.classList.toggle('unlocked', unlocked);
      c.root.classList.toggle('claimed', claimed);
      setText(c.btn, claimed ? 'Получено' : unlocked ? 'Забрать' : 'В пути');
      c.btn.disabled = !unlocked || claimed;
    }
    setText(this.summary, `Открыто ${done} из ${this.cards.length}. Каждое достижение приносит золото.`);
  }
}
