import { describe, expect, it } from 'vitest';
import { nicePrice } from '../src/game/price';
import { fmt } from '../src/ui/format';
import { setLangForTests } from '../src/i18n';

describe('readable numbers', () => {
  it('prices are round', () => {
    expect(nicePrice(87.4)).toBe(87);
    expect(nicePrice(437)).toBe(435);
    expect(nicePrice(4_437)).toBe(4_450);
    expect(nicePrice(12_437)).toBe(12_400);
    expect(nicePrice(248_930)).toBe(249_000);
  });

  it('big numbers are short, with the language decimal mark', () => {
    setLangForTests('ru');
    expect(fmt(12_400)).toBe('12,4K');
    expect(fmt(12_000)).toBe('12K');
    expect(fmt(249_000)).toBe('249K');
    setLangForTests('en');
    expect(fmt(12_400)).toBe('12.4K');
    setLangForTests('ru');
  });
});
