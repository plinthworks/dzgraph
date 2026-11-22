/**
 * Comparison to a baseline (compare.md), lent to the core by the `compare` module (ADR 0006). A compared value is an
 * affine of the raw one — `value`: y − b, `percent`: 100 · y / b − 100, `index`: 100 · y / b — so a series is drawn
 * through its axis's scale composed with its own affine (compose.ts): series types, decimation and pyramids keep
 * reading the raw columns, and a zoom that moves the baseline recomputes two numbers per series.
 */
import type { ChartModel } from './model.js';
import type { SeriesModel } from './series-type.js';
import type { View } from './view.js';
import { isShown } from './view.js';
import { cachedFormat, decimalsOf } from './format.js';

export type CompareMode = 'value' | 'percent' | 'index';

/** A series compared: its compared value is `a · y + c`; its baseline's value and point. */
export interface SeriesCompare {
  readonly mode: CompareMode;
  readonly a: number;
  readonly c: number;
  readonly base: number;
  readonly baseIndex: number;
}

export interface Compares {
  /** The y axes compared, and how. */
  readonly axes: ReadonlyMap<string, CompareMode>;
  readonly series: ReadonlyMap<string, SeriesCompare>;
  /** Series on a compared axis that have no baseline (compare.md 6): not drawn. */
  readonly missing: ReadonlySet<string>;
}

export const NO_COMPARES: Compares = { axes: new Map(), series: new Map(), missing: new Set() };

export interface CompareKit {
  readonly of: (model: ChartModel, view: View | undefined) => Compares;
  /** A compared value as the tooltip and the table write it. */
  readonly format: (v: number, mode: CompareMode, locale: string | undefined) => string;
  /** A compared axis's tick labels. */
  readonly ticks: (values: readonly number[], mode: CompareMode, locale: string | undefined) => string[];
}

/** Whether an axis may be compared (compare.md 7): not a log axis, not one with piles. */
export function comparable(model: ChartModel, axisId: string): boolean {
  const a = model.yAxes.find((y) => y.id === axisId);
  return !!a && a.scale !== 'log' && a.stacking === null && !model.series.some((s) => s.yAxis === axisId && s.stack !== null);
}

/** The point a series is compared to: the app's x (its point there or the last before), or the first in view. */
function baseIndexOf(s: SeriesModel, to: number | null, range: { readonly min: number; readonly max: number } | undefined): number {
  const { x, y } = s.columns;
  let best = -1;
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(y[i]!) || Number.isNaN(x[i]!)) continue;
    if (to !== null) {
      // The last point at or before `to`: in x order, the one with the largest x not past it.
      if (x[i]! <= to && (best === -1 || x[i]! > x[best]!)) best = i;
      continue;
    }
    if (range && (x[i]! < range.min || x[i]! > range.max)) continue;
    if (best === -1 || x[i]! < x[best]!) best = i;
    // In x order, the first one found is the first in view.
    if (s.sorted) break;
  }
  return best;
}

function of(model: ChartModel, view: View | undefined): Compares {
  const axes = new Map<string, CompareMode>();
  const toOf = new Map<string, number | null>();
  for (const a of model.yAxes) {
    // The view's comparison (the user's, through the menu or setView) wins over the app's option (compare.md).
    const chosen = view?.compare !== undefined ? view.compare : a.compare;
    if (!chosen || !comparable(model, a.id)) continue;
    axes.set(a.id, chosen.mode);
    toOf.set(a.id, chosen.to);
  }
  if (!axes.size) return NO_COMPARES;
  const series = new Map<string, SeriesCompare>();
  const missing = new Set<string>();
  for (const s of model.series) {
    const mode = axes.get(s.yAxis);
    if (!mode || !isShown(s, view)) continue;
    const i = baseIndexOf(s, toOf.get(s.yAxis) ?? null, view?.range?.[s.xAxis]);
    const b = i >= 0 ? s.columns.y[i]! : Number.NaN;
    if (Number.isNaN(b) || (mode !== 'value' && b === 0)) {
      missing.add(s.id);
      continue;
    }
    const a = mode === 'value' ? 1 : 100 / b;
    const c = mode === 'value' ? -b : mode === 'percent' ? -100 : 0;
    series.set(s.id, { mode, a, c, base: b, baseIndex: i });
  }
  return { axes, series, missing };
}

function format(v: number, mode: CompareMode, locale: string | undefined): string {
  if (mode === 'index') return cachedFormat(locale, 'cmp-index', { maximumSignificantDigits: 6, maximumFractionDigits: 2, roundingPriority: 'morePrecision' }).format(v === 0 ? 0 : v);
  if (mode === 'percent') return cachedFormat(locale, 'cmp-pct', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v === 0 ? 0 : v / 100);
  return cachedFormat(locale, 'cmp-value', { maximumSignificantDigits: 6, maximumFractionDigits: 2, roundingPriority: 'morePrecision', signDisplay: 'exceptZero' }).format(v === 0 ? 0 : v);
}

function ticks(values: readonly number[], mode: CompareMode, locale: string | undefined): string[] {
  const d = Math.min(decimalsOf(values, locale), 18);
  if (mode === 'percent') {
    const f = cachedFormat(locale, `cmp-tpct|${d}`, { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: 'exceptZero' });
    return values.map((v) => f.format(v === 0 ? 0 : v / 100));
  }
  const f = cachedFormat(locale, `cmp-t${mode}|${d}`, { minimumFractionDigits: d, maximumFractionDigits: d, ...(mode === 'value' ? { signDisplay: 'exceptZero' as const } : {}) });
  return values.map((v) => f.format(v === 0 ? 0 : v));
}

export const compareKit: CompareKit = { of, format, ticks };
