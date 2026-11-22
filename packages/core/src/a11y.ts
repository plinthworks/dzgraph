/**
 * What screen readers and the data table are given (screen-reader.md, data-table.md), as data: the DOM layer puts the
 * words around it in the reader's language.
 */
import type { SeriesModel } from './series-type.js';
import { rangeOf } from './series/shared.js';
import type { ChartModel } from './model.js';
import type { ChartLayout, LayoutText } from './layout.js';
import type { PointRef } from './scene.js';
import { formatValue } from './format.js';
import { seriesName, xLabel, xValueLabel } from './tooltip.js';
import { isShown, type View } from './view.js';
import { rankOf, validOrder } from './navigate.js';

export interface Summary {
  /** The visible series' types, in order of first appearance. */
  readonly types: readonly string[];
  readonly series: readonly { readonly name: string; readonly min: string; readonly max: string }[];
  /** The x axis's first and last values, as labels; null without data. */
  readonly x: { readonly from: string; readonly to: string } | null;
}

export function summary(model: ChartModel, _layout: ChartLayout, view: View | undefined, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): Summary {
  const shown = model.series.filter((s) => isShown(s, view));
  const types = [...new Set(shown.map((s) => s.type as string))];
  const series = shown.flatMap((s) => {
    // Kept with the column (column-cache.ts): a summary per frame of a zoom costs nothing.
    const b = rangeOf(s.columns.y);
    return b ? [{ name: seriesName(s, text), min: formatValue(b.min, locale), max: formatValue(b.max, locale) }] : [];
  });
  // The first and last x with a value, over every visible series.
  type At = { readonly s: (typeof shown)[number]; readonly i: number; readonly x: number };
  // Written inside `consider`: declared wide so the compiler does not narrow them to null.
  let first = null as At | null;
  let last = null as At | null;
  const consider = (s: (typeof shown)[number], i: number) => {
    const x = s.columns.x[i]!;
    if (first === null || x < first.x) first = { s, i, x };
    if (last === null || x > last.x) last = { s, i, x };
  };
  for (const s of shown) {
    const { x, y } = s.columns;
    const has = (i: number) => !Number.isNaN(y[i]!) && !Number.isNaN(x[i]!);
    if (s.sorted) {
      // In x order: the first and last points with a value are found from each end.
      let i = 0;
      while (i < x.length && !has(i)) i++;
      if (i === x.length) continue;
      let j = x.length - 1;
      while (!has(j)) j--;
      consider(s, i);
      consider(s, j);
    } else for (let i = 0; i < x.length; i++) if (has(i)) consider(s, i);
  }
  return { types, series, x: first && last ? { from: xLabel(model, first.s, first.i, locale), to: xLabel(model, last.s, last.i, locale) } : null };
}

export interface PointLabel {
  readonly series: string;
  readonly x: string;
  readonly y: string;
  /** From 1. */
  readonly position: number;
  readonly count: number;
}

/** A point's label; its position and the count are among the points with a value (gaps are not points, review 6). */
export function pointLabel(model: ChartModel, _layout: ChartLayout, ref: PointRef, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): PointLabel | null {
  const s = model.series.find((o) => o.id === ref.seriesId);
  if (!s || ref.index < 0 || ref.index >= s.columns.x.length) return null;
  const { y } = s.columns;
  // From the series' order of valued points (cached): O(log n), not O(n), per label.
  const order = validOrder(s);
  const at = rankOf(order, ref.index);
  const position = order[at] === ref.index ? at + 1 : at;
  const count = order.length;
  const v = y[ref.index]!;
  return { series: seriesName(s, text), x: xLabel(model, s, ref.index, locale), y: Number.isNaN(v) ? '' : formatValue(v, locale), position, count };
}

/** The table's rows as values (data-table.md 1): numbers and gaps, for the screen and for the CSV of Phase 6. */
export interface DataRows {
  /** The visible series' ids, in order: the columns after x. */
  readonly series: readonly string[];
  /** One row per x (lines, areas) or per point (marks), in x order; `from` names the point x was read from. */
  readonly rows: readonly { readonly x: number; readonly from: PointRef; readonly values: readonly (number | null)[] }[];
  /** How many rows there are in all: `rows` stops at the limit asked for. */
  readonly total: number;
}

export function dataRows(model: ChartModel, _layout: ChartLayout, view: View | undefined, which: 'visible' | 'all' = 'visible', limit = Infinity): DataRows {
  const shown = model.series.filter((s) => isShown(s, view));
  // Series all in x order, one row per x: their index ranges merged, rows made only up to the limit (a table of
  // 10 million points is 1 000 rows and a count, data-table.md 4).
  if (shown.every((s) => s.sorted && s.tooltip !== 'mark')) return mergedRows(shown, which === 'visible' ? view : undefined, limit);
  // Zoomed, the visible range only (data-table.md 5), unless all the data is asked for.
  const inView = (s: (typeof shown)[number], x: number) => {
    const r = which === 'visible' ? view?.range?.[s.xAxis] : undefined;
    return !r || (x >= r.min && x <= r.max);
  };
  // Series read along x share a row per x; a series of marks gets a row per point (two points at one x, review 9).
  const rowsByKey = new Map<string, { x: number; order: number; from: PointRef; values: (number | null)[] }>();
  let order = 0;
  shown.forEach((s, k) => {
    const perPoint = s.tooltip === 'mark' || !s.sorted;
    s.columns.x.forEach((x, i) => {
      if (Number.isNaN(x) || !inView(s, x)) return;
      const y = s.columns.y[i]!;
      if (perPoint && Number.isNaN(y)) return;
      const key = perPoint ? `p\u0000${s.id}\u0000${i}` : `x\u0000${x}`;
      let row = rowsByKey.get(key);
      if (!row) rowsByKey.set(key, (row = { x, order: order++, from: { seriesId: s.id, index: i }, values: shown.map(() => null) }));
      if (!Number.isNaN(y)) row.values[k] = y;
    });
  });
  const all = [...rowsByKey.values()].sort((a, b) => a.x - b.x || a.order - b.order);
  const rows = all.slice(0, limit).map(({ x, from, values }) => ({ x, from, values }));
  return { series: shown.map((s) => s.id), rows, total: all.length };
}

/** The first index whose x is not below `v` (`above`: above it), x sorted; a leading gap (NaN x) sorts first. */
function firstAtLeast(x: Float64Array, v: number, above = false): number {
  let lo = 0;
  let hi = x.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (Number.isNaN(x[m]!) || x[m]! < v || (above && x[m]! === v)) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * Rows of sorted series, merged by x: at each step the smallest x among the series' next points; every point at that
 * x, of every series, fills the row (a later value of a series at the same x wins, as a gap's carried x does). The
 * first series at an x names the row's point. Past `limit`, rows are only counted.
 */
function mergedRows(shown: readonly SeriesModel[], view: View | undefined, limit: number): DataRows {
  const at = shown.map((s) => {
    const r = view?.range?.[s.xAxis];
    return r ? firstAtLeast(s.columns.x, r.min) : 0;
  });
  const end = shown.map((s) => {
    const r = view?.range?.[s.xAxis];
    return r ? firstAtLeast(s.columns.x, r.max, true) : s.columns.x.length;
  });
  const rows: { x: number; from: PointRef; values: (number | null)[] }[] = [];
  let total = 0;
  for (;;) {
    // Skip points without an x.
    let x = Infinity;
    let first = -1;
    shown.forEach((s, k) => {
      while (at[k]! < end[k]! && Number.isNaN(s.columns.x[at[k]!]!)) at[k]!++;
      if (at[k]! < end[k]! && s.columns.x[at[k]!]! < x) {
        x = s.columns.x[at[k]!]!;
        first = k;
      }
    });
    if (first === -1) break;
    total++;
    const making = rows.length < limit;
    const values: (number | null)[] | null = making ? shown.map(() => null) : null;
    const from: PointRef = { seriesId: shown[first]!.id, index: at[first]! };
    shown.forEach((s, k) => {
      while (at[k]! < end[k]! && (s.columns.x[at[k]!] === x || Number.isNaN(s.columns.x[at[k]!]!))) {
        const y = s.columns.y[at[k]!]!;
        if (values && !Number.isNaN(y) && s.columns.x[at[k]!] === x) values[k] = y;
        at[k]!++;
      }
    });
    if (values) rows.push({ x, from, values });
  }
  return { series: shown.map((s) => s.id), rows, total };
}

export interface DataTable {
  /** The visible series' names (the x column comes first and has no name here: the DOM names it). */
  readonly columns: readonly string[];
  /** One row per x or per point, in x order: its label, then each series' value or '' where it has none. */
  readonly rows: readonly (readonly string[])[];
  /** Rows left out past 1 000 (data-table.md 4). */
  readonly omitted: number;
  /** The visible range it shows, in words (data-table.md 5); null when it shows all the data. */
  readonly range: { readonly from: string; readonly to: string } | null;
}

const MAX_ROWS = 1000;

/** The table as text, from `dataRows`. */
export function dataTable(model: ChartModel, layout: ChartLayout, view: View | undefined, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>, which: 'visible' | 'all' = 'visible'): DataTable {
  const raw = dataRows(model, layout, view, which, MAX_ROWS);
  const axisId = model.xAxes[0]?.id;
  const r = which === 'visible' && axisId !== undefined ? view?.range?.[axisId] : undefined;
  const range = r ? { from: xValueLabel(model, axisId!, r.min, locale), to: xValueLabel(model, axisId!, r.max, locale) } : null;
  const byId = new Map(model.series.map((s) => [s.id, s]));
  const rows = raw.rows.slice(0, MAX_ROWS).map((r) => [xLabel(model, byId.get(r.from.seriesId)!, r.from.index, locale), ...r.values.map((v) => (v === null ? '' : formatValue(v, locale)))]);
  return { columns: raw.series.map((id) => seriesName(byId.get(id)!, text)), rows, omitted: raw.total - raw.rows.length, range };
}
