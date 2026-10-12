/**
 * Localization. The Russian text stays in the code and is the key; other
 * languages look it up in their dictionaries (src/i18n/<lang>/*.ts).
 *
 *   t('Победа')                       → "Victory"
 *   t('Враги: {n} · ур. {lv}', { n, lv })
 *   plural(n, ['бой', 'боя', 'боёв'], ['battle', 'battles'])
 *
 * The language is fixed for a page load (texts in data tables are built once);
 * switching it saves the choice and reloads the page.
 */
import { EN } from './i18n/en';

export type Lang = 'ru' | 'en';
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
];

const KEY = 'pixel-gambit-lang';

function detect(): Lang {
  // Tests and tools run without a page: Russian, the source language.
  if (typeof document === 'undefined') return 'ru';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // storage unavailable
  }
  const langs = [...(navigator.languages ?? []), navigator.language ?? ''];
  return langs.some((l) => /^(ru|be|uk|kk)\b/i.test(l)) ? 'ru' : 'en';
}

let lang: Lang = detect();

export function getLang(): Lang {
  return lang;
}

/** For tests: switch the language in place. */
export function setLangForTests(next: Lang): void {
  lang = next;
}

/** Save the choice and reload so every text is built again. */
export function switchLang(next: Lang): void {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  location.reload();
}

const DICTS: Record<Exclude<Lang, 'ru'>, Record<string, string>> = { en: EN };

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Missing translations met at run time (shown in dev tools, checked by tests). */
export const missing = new Set<string>();

export function t(ru: string, params?: Record<string, string | number>): string {
  if (lang === 'ru') return fill(ru, params);
  const hit = DICTS[lang][ru];
  if (hit === undefined) {
    missing.add(ru);
    return fill(ru, params);
  }
  return fill(hit, params);
}

/** Pick the word form for a count: Russian has three forms, English two. */
export function plural(n: number, ru: [string, string, string], en: [string, string]): string {
  if (lang === 'en') return Math.abs(n) === 1 ? en[0] : en[1];
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return ru[2];
  if (b > 1 && b < 5) return ru[1];
  if (b === 1) return ru[0];
  return ru[2];
}
