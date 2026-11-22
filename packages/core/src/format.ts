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

/**
 * One value as the tooltip and the data table write it (hover-tooltip.md 6): six significant digits, or two decimals
 * when that keeps more (a large amount keeps its cents), whichever is more precise; the locale's form.
 */
export function formatValue(v: number, locale: string | undefined): string {
  return cached(locale, 'value', { maximumSignificantDigits: 6, maximumFractionDigits: 2, roundingPriority: 'morePrecision' }).format(v === 0 ? 0 : v);
}

/** Labels for an axis's tick values (`step` apart: kept for formatters that want it). */
export function formatTicks(values: readonly number[], step: number, locale: string | undefined): string[] {
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const notation: Notation = maxAbs >= 1e15 || (maxAbs > 0 && maxAbs < 1e-6) ? 'scientific' : maxAbs >= 10_000 ? 'compact' : 'standard';
  const f = numberFormat(locale, decimalsNeeded(values, locale, notation), notation);
  const zero = numberFormat(locale, 0, 'standard').format(0);
  return values.map((v) => (v === 0 ? (notation === 'standard' ? f.format(0) : zero) : f.format(v)));
}

/** Labels of a percent axis (stacking.md 9): values in percent, written as the locale writes a percentage. */
export function formatPercentTicks(values: readonly number[], locale: string | undefined): string[] {
  const d = Math.min(decimalsNeeded(values, locale, 'standard'), 18);
  const f = cached(locale, `pct|${d}`, { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d });
  return values.map((v) => f.format(v === 0 ? 0 : v / 100));
}

/** A share of a whole, 0 to 1, as the tooltip writes it (stacking.md 14): whole percents, one decimal under 10 %. */
export function formatShare(share: number, locale: string | undefined): string {
  const small = share < 0.1;
  const f = cached(locale, small ? 'share1' : 'share0', { style: 'percent', maximumFractionDigits: small ? 1 : 0 });
  // Below what one decimal shows, said so (pie-donut.md 10), never « 0 % » for a slice that is there.
  return share > 0 && share < 0.001 ? `<${f.format(0.001)}` : f.format(share);
}

/** Labels of a log axis (log-scale.md 5): axes.md 10–12, but each label with its own decimals (0,01 0,1 1 10). */
export function formatLogTicks(values: readonly number[], locale: string | undefined): string[] {
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  const notation: Notation = maxAbs >= 1e15 || (maxAbs > 0 && maxAbs < 1e-6) ? 'scientific' : maxAbs >= 10_000 ? 'compact' : 'standard';
  return values.map((v) => numberFormat(locale, decimalsNeeded([v], locale, notation), notation).format(v));
}

/** A value read at a place (a crosshair's tag): to `decimals` at most, no trailing zeros. */
export function formatReading(v: number, decimals: number, locale: string | undefined): string {
  const d = Math.max(0, Math.min(20, decimals));
  return cached(locale, `reading|${d}`, { maximumFractionDigits: d }).format(v === 0 ? 0 : v);
}

/** A cached Intl number format, for the modules lent to the core (compare.ts). */
export const cachedFormat = (locale: string | undefined, key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => cached(locale, key, options);

/** The decimals tick values need to be written exactly, in the standard notation. */
export const decimalsOf = (values: readonly number[], locale: string | undefined): number => decimalsNeeded(values, locale, 'standard');

/** Two values as a range (a bucket, aggregation.md 3), as the locale writes a range of numbers. */
export function formatValueRange(a: number, b: number, locale: string | undefined): string {
  return cached(locale, 'value', { maximumSignificantDigits: 6, maximumFractionDigits: 2, roundingPriority: 'morePrecision' }).formatRange(a, b);
}
