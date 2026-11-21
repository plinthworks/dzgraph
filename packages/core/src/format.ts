/**
 * Tick labels (axes.md 10–12): the chart's locale through Intl; every label of an axis with the same number of
 * decimals, the fewest that tell the ticks apart; the locale's short forms (`12 k`, `3,4 M`) once the largest label
 * passes 10 000; scientific notation for numbers too small (under 10⁻⁶) or too large (from 10¹⁵) to read in full.
 * Never minus zero; in short and scientific forms zero is written `0` (« 0,0 k » means nothing).
 */

type Notation = 'standard' | 'compact' | 'scientific';

const formats = new Map<string, Intl.NumberFormat>();

/** A formatter, cached; a locale Intl refuses (`en_US`) falls back to the default locale instead of throwing. */
function cached(locale: string | undefined, key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${locale ?? ''}|${key}`;
  let f = formats.get(k);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    formats.set(k, f);
  }
  return f;
}

function numberFormat(locale: string | undefined, decimals: number, notation: Notation): Intl.NumberFormat {
  const digits = Math.min(decimals, 20);
  return cached(locale, `${digits}|${notation}`, { minimumFractionDigits: digits, maximumFractionDigits: digits, notation });
}

/**
 * The decimals the labels need to be exact: each value written as the locale writes it in this notation (15
 * significant digits: no floating-point noise), its fraction counted. Locale-agnostic: the unit of a short form may
 * be a thousand, ten thousand (万) or a hundred thousand (lakh).
 */
function decimalsNeeded(values: readonly number[], locale: string | undefined, notation: Notation): number {
  const exact = cached(locale, `exact|${notation}`, { maximumSignificantDigits: 15, notation });
  let d = 0;
  for (const v of values) for (const part of exact.formatToParts(v)) if (part.type === 'fraction') d = Math.max(d, part.value.length);
  return d;
}

/** Labels for an axis's tick values (`step` apart: kept for formatters that want it). */
export function formatTicks(values: readonly number[], step: number, locale: string | undefined): string[] {
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const notation: Notation = maxAbs >= 1e15 || (maxAbs > 0 && maxAbs < 1e-6) ? 'scientific' : maxAbs >= 10_000 ? 'compact' : 'standard';
  const f = numberFormat(locale, decimalsNeeded(values, locale, notation), notation);
  const zero = numberFormat(locale, 0, 'standard').format(0);
  return values.map((v) => (v === 0 ? (notation === 'standard' ? f.format(0) : zero) : f.format(v)));
}
