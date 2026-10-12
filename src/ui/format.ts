import { getLang } from '../i18n';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Compact number formatting: 1234 -> "1 234", 12345 -> "12,3K" (ru) / "12.3K" (en), huge -> "1.23e45". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs < 10_000) return Math.floor(n).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'en-US');
  const tier = Math.floor(Math.log10(abs) / 3);
  if (tier >= SUFFIXES.length) return n.toExponential(2);
  const scaled = n / 1000 ** tier;
  // "12,4K", "248K": one decimal while it matters, none once the number is big, no trailing ",0".
  const text = scaled.toFixed(scaled < 100 ? 1 : 0).replace(/\.0$/, '');
  return `${getLang() === 'ru' ? text.replace('.', ',') : text}${SUFFIXES[tier]}`;
}
