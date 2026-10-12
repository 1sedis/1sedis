/**
 * Prices people can read at a glance: exact under 100, then multiples of 5, 50,
 * and three significant digits from ten thousand on (12 437 -> 12 400).
 */
export function nicePrice(n: number): number {
  if (n < 100) return Math.round(n);
  if (n < 1000) return Math.round(n / 5) * 5;
  if (n < 10_000) return Math.round(n / 50) * 50;
  const step = 10 ** (Math.floor(Math.log10(n)) - 2);
  return Math.round(n / step) * step;
}
