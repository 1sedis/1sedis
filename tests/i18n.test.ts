import { describe, expect, it } from 'vitest';
import { EN } from '../src/i18n/en';
import { plural, setLangForTests, t } from '../src/i18n';

const CYR = /[А-Яа-яЁё]/;

/** Every source file as text, the dictionaries and the i18n core aside. */
const SOURCES = Object.entries(import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }))
  .filter(([f]) => !f.includes('/i18n/') && !f.endsWith('/i18n.ts'));

/** String literals passed as the first argument of t(...). */
function keys(code: string): string[] {
  const out: string[] = [];
  const re = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const m of code.matchAll(re)) out.push(m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n'));
  return out;
}

/** Remove what may hold Cyrillic: comments, t('…') keys, plural([...]) Russian forms. */
function strip(line: string): string {
  return line
    .replace(/\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, 't(')
    .replace(/\[(\s*(['"])[^'"]*\2\s*,){2}\s*(['"])[^'"]*\3\s*\]/g, '[]')
    .replace(/\/\/.*$/, '')
    .replace(/^\s*(\/\*\*|\*|\/\*).*$/, '');
}

describe('localization', () => {
  it('every t() key has an English translation', () => {
    const lost: string[] = [];
    for (const [f, code] of SOURCES) for (const k of keys(code)) if (CYR.test(k) && EN[k] === undefined) lost.push(`${f}: ${k}`);
    expect(lost).toEqual([]);
  });

  it('no Russian text is left outside t()', () => {
    const left: string[] = [];
    for (const [f, code] of SOURCES) {
      code.split('\n').forEach((line, i) => {
        if (line.includes('i18n-ok')) return;
        if (CYR.test(strip(line))) left.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(left).toEqual([]);
  });

  it('translations are English and keep their placeholders', () => {
    const bad: string[] = [];
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [ru, en] of Object.entries(EN)) {
      if (CYR.test(en)) bad.push(`cyrillic: ${en}`);
      if (ph(ru) !== ph(en)) bad.push(`placeholders: ${ru} → ${en}`);
      if (!en.trim()) bad.push(`empty: ${ru}`);
    }
    expect(bad).toEqual([]);
  });

  it('t() and plural() work in both languages', () => {
    expect(t('Победа {n}', { n: 3 })).toBe('Победа 3');
    expect(plural(1, ['бой', 'боя', 'боёв'], ['battle', 'battles'])).toBe('бой');
    expect(plural(3, ['бой', 'боя', 'боёв'], ['battle', 'battles'])).toBe('боя');
    expect(plural(11, ['бой', 'боя', 'боёв'], ['battle', 'battles'])).toBe('боёв');
    setLangForTests('en');
    expect(plural(1, ['бой', 'боя', 'боёв'], ['battle', 'battles'])).toBe('battle');
    expect(plural(5, ['бой', 'боя', 'боёв'], ['battle', 'battles'])).toBe('battles');
    setLangForTests('ru');
  });
});
