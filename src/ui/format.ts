const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Compact number formatting: 1234 -> "1 234", 12345 -> "12.3K", huge -> "1.23e45". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 10_000) return Math.floor(n).toLocaleString('ru-RU');
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2);
  const scaled = n / 1000 ** tier;
  return `${scaled.toFixed(scaled < 100 ? 2 : 1)}${SUFFIXES[tier]}`;
}
