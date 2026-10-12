import { ABILITY_LEVELS, abilityOf } from '../game/abilities';
import { PIECES, PRESTIGE_PIECES, type PieceKind } from '../game/pieces';
import { SYNERGIES } from '../game/synergies';
import { el, openModal } from './dom';
import { spriteUrl } from './sprites';
import { TERRAIN_INFO } from '../game/terrain';
import { terrainUrl } from './terrainArt';
import { traitUrl } from './traitIcons';
import { TRAITS, TRAIT_ORDER } from '../game/elites';
import { featureOpen } from '../game/features';
import type { GameState } from '../game/state';
import { t } from '../i18n';

const ORDER: PieceKind[] = ['king', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'archbishop', 'chancellor', 'ghost'];

/** Reference of all pieces (yours and the enemy's) and composition bonuses. */
export function openCodex(s?: GameState): void {
  // No spoilers: Crown Tree pieces show up once there is a Crown Tree, synergies once they open.
  const treeKnown = !s || s.prestige > 0 || s.crowns > 0;
  const content = el('div', 'codex');
  content.append(el('h2', '', t('Справочник')));
  const list = el('div', 'codex-list');
  for (const kind of ORDER) {
    if (!treeKnown && PRESTIGE_PIECES.includes(kind)) continue;
    const def = PIECES[kind];
    const card = el('details', 'codex-item');
    const sum = el('summary', 'codex-head');
    const pics = el('span', 'codex-pics');
    for (const team of ['ally', 'enemy'] as const) {
      const img = el('img');
      img.src = spriteUrl(kind, team);
      img.alt = '';
      pics.append(img);
    }
    const title = el('span', 'codex-title', def.name);
    title.append(el('span', 'codex-role', ` · ${def.role}`));
    const stats = el('span', 'codex-stats', `❤ ${def.hp}  ⚔ ${def.atk}${def.range ? `  ◎ ${def.range}` : ''}${def.cost ? `  · ${t('{cost} з.', { cost: def.cost })}` : ''}`);
    const text = el('span', 'codex-text');
    text.append(title, stats);
    sum.append(pics, text);
    const body = el('div', 'codex-body');
    body.append(el('p', '', def.description));
    if (PRESTIGE_PIECES.includes(kind)) body.append(el('p', 'codex-ability', t('♛ Открывается в Древе короны.')));
    for (const b of [0, 1] as const) {
      const ab = abilityOf(kind, b);
      body.append(el('p', 'codex-ability',
        `★ ${ab.name}${b === 0 && !PRESTIGE_PIECES.includes(kind) ? t(' (и у врагов)') : ''}: ${t('{t1} С ур. {lv}: {t2}', { t1: ab.tiers[0], lv: ABILITY_LEVELS[1], t2: ab.tiers[1] })}`));
    }
    card.append(sum, body);
    list.append(card);
  }
  const land = el('details', 'codex-item');
  const landHead = el('summary', 'codex-head');
  landHead.append(el('span', 'codex-title', t('▦ Ландшафт')));
  const landBody = el('div', 'codex-body');
  for (const id of Object.keys(TERRAIN_INFO) as (keyof typeof TERRAIN_INFO)[]) {
    const row = el('p', 'codex-terrain');
    const img = el('img');
    img.src = terrainUrl(id);
    img.alt = '';
    row.append(img, `${TERRAIN_INFO[id].name}: ${TERRAIN_INFO[id].text}`);
    landBody.append(row);
  }
  landBody.append(el('p', '', t('Пешка обходит камень или воду наискосок. Король, оставшийся без армии, больше не убегает.')));
  land.append(landHead, landBody);
  list.append(land);
  const elite = el('details', 'codex-item');
  const eliteHead = el('summary', 'codex-head');
  eliteHead.append(el('span', 'codex-title', t('✦ Элитные враги')));
  const eliteBody = el('div', 'codex-body');
  eliteBody.append(el('p', '', t('Со 2-й главы часть вражеских фигур — элита со значком над головой.')));
  for (const id of TRAIT_ORDER) {
    const row = el('p', 'codex-terrain');
    const img = el('img');
    img.src = traitUrl(id);
    img.alt = '';
    row.append(img, `${TRAITS[id].name[0]}: ${TRAITS[id].text}.`);
    eliteBody.append(row);
  }
  elite.append(eliteHead, eliteBody);
  list.append(elite);
  const syn = el('details', 'codex-item');
  const synHead = el('summary', 'codex-head');
  synHead.append(el('span', 'codex-title', t('✦ Синергии состава')));
  const synBody = el('div', 'codex-body');
  for (const d of SYNERGIES) synBody.append(el('p', '', `${d.name}: ${d.description}.`));
  syn.append(synHead, synBody);
  if (!s || featureOpen(s, 'synergies')) list.append(syn);
  content.append(el('p', 'hint', t('Здоровье и атака — на 1-м уровне, каждый уровень +18%. Приём открывается на {lv}-м.', { lv: ABILITY_LEVELS[0] })), list);
  const actions = el('div', 'modal-actions codex-actions');
  const ok = el('button', 'btn btn-primary', t('Закрыть'));
  actions.append(ok);
  content.append(actions);
  const close = openModal(content, { cls: 'codex-modal' });
  ok.addEventListener('click', close);
}
