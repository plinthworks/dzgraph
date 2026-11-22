/**
 * What screen readers and the data table are given (screen-reader.md, data-table.md), as data: the DOM layer puts the
 * words around it in the reader's language.
 */
import { isSelected, selectedCount } from './selection.js';
import type { CompareMode, SeriesCompare } from './compare.js';
import type { AggregateFn, AggregateSpec } from './aggregation.js';
import type { SeriesModel } from './series-type.js';
import { rangeOf } from './series/shared.js';
import type { ChartModel } from './model.js';
import type { ChartLayout, LayoutText } from './layout.js';
import type { PointRef } from './scene.js';
import { formatShare, formatValue } from './format.js';
import { seriesName, xLabel, xValueLabel } from './tooltip.js';
import { isPointShown, isShown, type View } from './view.js';
import { rankOf, validOrder } from './navigate.js';

export interface Summary {
  /** The visible series' types, in order of first appearance. */
  readonly types: readonly string[];
  /** Each visible series' range, and its value axis when two are in use (combined.md 9): its title, its place. */
  readonly series: readonly { readonly name: string; readonly min: string; readonly max: string; readonly axis?: { readonly title: string | null; readonly index: number } }[];
  /** The x axis's first and last values, as labels; null without data. */
  readonly x: { readonly from: string; readonly to: string } | null;
  /** Whether visible series are stacked (stacking.md 16). */
  readonly stacked: boolean;
  /** A polar chart's drawn points and its largest one, by share (pie-donut.md 14). */
  readonly slices?: number;
  readonly largest?: { readonly name: string; readonly share: string };
  /** A gauge (gauge.md 9): its name, value, bounds and threshold, written. */
  readonly meter?: { readonly name: string; readonly value: string; readonly min: string; readonly max: string; readonly threshold?: string };
  /** A comparison (compare.md 9): how, and its fixed baseline as x reads (null: the first point in view). */
  readonly compare?: { readonly mode: CompareMode; readonly baseline: string | null };
  /** How many points are selected, when some are (selection.md 6). */
  readonly selected?: number;
  /** An aggregation (aggregation.md 8): by what, and the shown series' functions, each once. */
  readonly aggregation?: { readonly by: AggregateSpec; readonly fns: readonly AggregateFn[] };
}

export function summary(model: ChartModel, layout: ChartLayout, view: View | undefined, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): Summary {
  const shown = model.series.filter((s) => isShown(s, view));
  const types = [...new Set(shown.map((s) => s.type as string))];
  const axisOf = valueAxisOf(model, view);
  const series = shown.flatMap((s) => {
    // Kept with the column (column-cache.ts): a summary per frame of a zoom costs nothing.
    const b = rangeOf(s.columns.y);
    const axis = axisOf(s);
    return b ? [{ name: seriesName(s, text), min: formatValue(b.min, locale), max: formatValue(b.max, locale), ...(axis ? { axis } : {}) }] : [];
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
  const x = first && last ? { from: xLabel(model, first.s, first.i, locale), to: xLabel(model, last.s, last.i, locale) } : null;
  const polar = shown.map((s) => layout.placements.get(s.id)).find((p) => p !== undefined);
  if (polar?.meter) {
    const m = polar.meter;
    const value = Number.isNaN(m.value) ? '—' : formatValue(m.value, locale);
    return { types, series, x: null, stacked: false, meter: { name: polar.name(0), value, min: formatValue(m.min, locale), max: formatValue(m.max, locale), ...(m.threshold ? { threshold: m.threshold } : {}) } };
  }
  if (polar) {
    const top = [...polar.order].sort((a, b) => polar.share(b) - polar.share(a))[0];
    const largest = top === undefined ? {} : { largest: { name: polar.name(top), share: formatShare(polar.share(top), locale) } };
    return { types, series, x: null, stacked: false, slices: polar.order.length, ...largest };
  }
  // A comparison: its mode, and its fixed baseline when there is one (compare.md 9).
  const compared = [...layout.compare.axes][0];
  let compare: Summary['compare'];
  if (compared) {
    const chosen = view?.compare !== undefined ? view.compare : model.yAxes.find((a) => a.id === compared[0])?.compare;
    const xId = model.xAxes[0]?.id;
    compare = { mode: compared[1], baseline: chosen?.to != null && xId !== undefined ? xValueLabel(model, xId, chosen.to, locale) : null };
  }
  const selected = selectedCount(view?.selection);
  const by = model.xAxes[0]?.period;
  const aggregation = by ? { by, fns: [...new Set(shown.map((s) => s.aggregate))] } : undefined;
  return { types, series, x, stacked: layout.stacks.size > 0, ...(compare ? { compare } : {}), ...(selected ? { selected } : {}), ...(aggregation ? { aggregation } : {}) };
}

/** A series' value axis, when two or more are in use by visible series (combined.md 9–10); else nothing to say. */
function valueAxisOf(model: ChartModel, view: View | undefined): (s: SeriesModel) => { readonly title: string | null; readonly index: number } | undefined {
  const shown = model.series.filter((s) => isShown(s, view));
  const inUse = model.yAxes.filter((a) => shown.some((s) => s.yAxis === a.id));
  if (inUse.length < 2) return () => undefined;
  return (s) => {
    const index = model.yAxes.findIndex((a) => a.id === s.yAxis);
    return index === -1 ? undefined : { title: model.yAxes[index]!.title, index };
  };
}

export interface PointLabel {
  readonly series: string;
  readonly x: string;
  readonly y: string;
  /** A stacked point's share of its pile, and the pile's total (stacking.md 16). */
  readonly share?: string;
  readonly total?: string;
  /** A compared point's raw value; `y` is then the compared one (compare.md 9). */
  readonly raw?: string;
  /** A selected point (selection.md 6). */
  readonly selected?: true;
  /** A point with a detail to show (drilldown.md 1). */
  readonly detail?: true;
  /** A gauge, read as a meter (gauge.md 9): its bounds and threshold as text, and as numbers. */
  readonly meter?: { readonly min: string; readonly max: string; readonly threshold?: string; readonly now: number; readonly low: number; readonly high: number };
  /** From 1. */
  readonly position: number;
  readonly count: number;
}

/** A point's label; its position and the count are among the points with a value (gaps are not points, review 6). */
export function pointLabel(model: ChartModel, layout: ChartLayout, ref: PointRef, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>, view?: View): PointLabel | null {
  const label = pointLabelOf(model, layout, ref, locale, text);
  if (!label) return null;
  return { ...label, ...(isSelected(view?.selection, ref.seriesId, ref.index) ? { selected: true as const } : {}), ...(hasDetail(model, ref) ? { detail: true as const } : {}) };
}

function pointLabelOf(model: ChartModel, layout: ChartLayout, ref: PointRef, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): PointLabel | null {
  const s = model.series.find((o) => o.id === ref.seriesId);
  // A polar point may be « Autres », one past the data (ADR 0007, review 2): the placement answers first.
  const placed = s ? layout.placements.get(s.id) : undefined;
  if (!s || ref.index < 0 || (ref.index >= s.columns.x.length && !placed?.members(ref.index))) return null;
  const { y } = s.columns;
  // From the series' order of valued points (cached): O(log n), not O(n), per label.
  const order = validOrder(s);
  const at = rankOf(order, ref.index);
  const position = order[at] === ref.index ? at + 1 : at;
  const count = order.length;
  const v = y[ref.index]!;
  const pile = layout.stacks.get(s.id);
  const share = pile?.share[ref.index] ?? Number.NaN;
  const stacked = pile && !Number.isNaN(share) ? { share: formatShare(share, locale), total: formatValue(pile.total[ref.index]!, locale) } : {};
  // A slice (pie-donut.md 14): its share; « Autres » by its name.
  const placement = layout.placements.get(s.id);
  if (placement?.meter) {
    const m = placement.meter;
    // ARIA keeps a meter's value within its bounds (review 6); the text says the real one.
    const meter = { min: formatValue(m.min, locale), max: formatValue(m.max, locale), ...(m.threshold ? { threshold: m.threshold } : {}), now: Math.min(m.max, Math.max(m.min, m.value)), low: m.min, high: m.max };
    return { series: placement.name(0), x: placement.name(0), y: formatValue(m.value, locale), meter, position: 1, count: 1 };
  }
  if (placement) {
    const ps = placement.share(ref.index);
    const at = placement.order.indexOf(ref.index);
    const value = placement.members(ref.index) ? '' : Number.isNaN(v) ? '' : formatValue(v, locale);
    return { series: seriesName(s, text), x: placement.name(ref.index), y: value, ...(Number.isNaN(ps) ? {} : { share: formatShare(ps, locale) }), position: at + 1, count: placement.order.length };
  }
  const cmp = layout.compare.series.get(s.id);
  const kit = model.kit.compare;
  if (cmp && kit && !Number.isNaN(v)) return { series: seriesName(s, text), x: xLabel(model, s, ref.index, locale), y: kit.format(cmp.a * v + cmp.c, cmp.mode, locale), raw: formatValue(v, locale), position, count };
  return { series: seriesName(s, text), x: xLabel(model, s, ref.index, locale), y: Number.isNaN(v) ? '' : formatValue(v, locale), ...stacked, position, count };
}

/**
 * Whether a point has a detail (drilldown.md 1): its series' `details` hold its key, or the app loads details; or a
 * year or a month of an automatic time drill.
 */
export function hasDetail(model: ChartModel, ref: PointRef): boolean {
  const s = model.series.find((o) => o.id === ref.seriesId);
  if (!s || ref.index >= s.columns.x.length) return false;
  const d = (s.options as { readonly drilldown?: unknown }).drilldown as { readonly details?: Readonly<Record<string, unknown>>; readonly load?: unknown } | undefined;
  if (d?.load) return true;
  const key = s.keys?.[ref.index];
  if (d?.details && key != null && Object.hasOwn(d.details, key)) return true;
  const by = model.xAxes.find((a) => a.id === s.xAxis)?.period;
  return model.drill === 'time' && !!by && 'period' in by && (by.period === 'year' || by.period === 'month');
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
  return mergedRows(shown, which === 'visible' ? view : undefined, limit);
}

/** Whether a sorted series has two valued points at one x (gaps carry their neighbour's x and do not count). */
function repeatsX(s: SeriesModel): boolean {
  const { x, y } = s.columns;
  let prev = Number.NaN;
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(y[i]!)) continue;
    if (x[i] === prev) return true;
    prev = x[i]!;
  }
  return false;
}

/**
 * A series' points that make their own rows (`point` mode) within the range: the first `limit` of them in x order
 * (ties in index order), and how many there are. A series in x order is read as it is; one out of order keeps its
 * `limit` smallest in a bounded heap, O(n log limit), never sorting the whole (a 10 M point scatter, ADR 0008).
 */
function ownRows(s: SeriesModel, range: { readonly min: number; readonly max: number } | undefined, limit: number): { order: Int32Array; count: number } {
  const { x, y } = s.columns;
  const lo = range?.min ?? -Infinity;
  const hi = range?.max ?? Infinity;
  const valid = (i: number) => !Number.isNaN(y[i]!) && x[i]! >= lo && x[i]! <= hi;
  if (s.sorted) {
    const first: number[] = [];
    let count = 0;
    for (let i = range ? firstAtLeast(x, range.min) : 0, end = range ? firstAtLeast(x, range.max, true) : x.length; i < end; i++)
      if (valid(i)) {
        if (first.length < limit) first.push(i);
        count++;
      }
    return { order: Int32Array.from(first), count };
  }
  // A max-heap of the smallest so far: its root the largest of them, replaced by any point before it.
  const heap: number[] = [];
  const after = (a: number, b: number) => x[a]! > x[b]! || (x[a] === x[b] && a > b);
  let count = 0;
  for (let i = 0; i < x.length; i++) {
    if (!valid(i)) continue;
    count++;
    if (heap.length < limit) {
      let k = heap.push(i) - 1;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (!after(heap[k]!, heap[up]!)) break;
        [heap[k], heap[up]] = [heap[up]!, heap[k]!];
        k = up;
      }
    } else if (limit > 0 && after(heap[0]!, i)) {
      heap[0] = i;
      for (let k = 0; ; ) {
        const l = 2 * k + 1;
        const r = l + 1;
        let top = k;
        if (l < heap.length && after(heap[l]!, heap[top]!)) top = l;
        if (r < heap.length && after(heap[r]!, heap[top]!)) top = r;
        if (top === k) break;
        [heap[k], heap[top]] = [heap[top]!, heap[k]!];
        k = top;
      }
    }
  }
  return { order: Int32Array.from(heap).sort((a, b) => x[a]! - x[b]! || a - b), count };
}

/** The first index whose x is at least `v` (past `v` when `above`), in a series in x order. */
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
 * The table's rows (data-table.md 4–5, stacking.md 17), every series read in x order and merged: at each step the
 * smallest x among the series' next points. A series of lines or areas shares a row per x, gaps included (the line
 * breaks there), a later value at the same x winning; a series of marks shares one too, its gaps left out; a series out
 * of x order, or of marks with two points at one x, gets a row per point. At one x, rows come in series order, then
 * index order; the first point making a row names it. Past `limit`, rows are only counted: a table of 10 million
 * points is 1 000 rows and a count. A series of its own rows gives only its first `limit` to the merge — no more can
 * reach the table — and its count (`ownRows`).
 */
function mergedRows(shown: readonly SeriesModel[], view: View | undefined, limit: number): DataRows {
  let total = 0;
  const cursors = shown.map((s) => {
    const r = view?.range?.[s.xAxis];
    if (!s.sorted || (s.tooltip === 'mark' && repeatsX(s))) {
      const own = ownRows(s, r, limit);
      // Its rows past those merged are counted here.
      total += own.count - own.order.length;
      return { s, mode: 'point' as const, order: own.order as Int32Array | null, at: 0, end: own.order.length };
    }
    return { s, mode: s.tooltip === 'mark' ? ('mark' as const) : ('line' as const), order: null, at: r ? firstAtLeast(s.columns.x, r.min) : 0, end: r ? firstAtLeast(s.columns.x, r.max, true) : s.columns.x.length };
  });
  const rows: { x: number; from: PointRef; values: (number | null)[] }[] = [];
  /** A new row: counted, and made while under the limit. */
  const row = (x: number, from: PointRef) => {
    total++;
    if (rows.length >= limit) return null;
    const r = { x, from, values: shown.map((): number | null => null) };
    rows.push(r);
    return r;
  };
  for (;;) {
    let x = Infinity;
    for (const c of cursors) {
      const cx = c.s.columns.x;
      // Points without an x are skipped.
      while (c.at < c.end && Number.isNaN(cx[c.order ? c.order[c.at]! : c.at]!)) c.at++;
      if (c.at < c.end) x = Math.min(x, cx[c.order ? c.order[c.at]! : c.at]!);
    }
    if (x === Infinity) break;
    let shared: { values: (number | null)[] } | null = null;
    let sharedMade = false;
    cursors.forEach((c, k) => {
      const { x: cx, y: cy } = c.s.columns;
      for (; c.at < c.end; c.at++) {
        const i = c.order ? c.order[c.at]! : c.at;
        if (Number.isNaN(cx[i]!)) continue;
        if (cx[i] !== x) break;
        const y = cy[i]!;
        if (c.mode !== 'line' && Number.isNaN(y)) continue;
        if (c.mode === 'point') {
          const r = row(x, { seriesId: c.s.id, index: i });
          if (r) r.values[k] = y;
          continue;
        }
        if (!sharedMade) {
          shared = row(x, { seriesId: c.s.id, index: i });
          sharedMade = true;
        }
        if (shared && !Number.isNaN(y)) (shared as { values: (number | null)[] }).values[k] = y;
      }
    });
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

/** The table's words: series names, and the header of a pile's total (null: the default pile), when totals are wanted. */
export interface TableText extends Pick<LayoutText, 'seriesName'> {
  readonly stackTotal?: (stack: string | null) => string;
  /** A series' header with its value axis's title, when two value axes are in use (combined.md 10). */
  readonly seriesOnAxis?: (name: string, axis: string) => string;
  /** The header of a polar chart's share column (pie-donut.md 15); absent: no such column. */
  readonly share?: string;
  /** The header of the column marking selected rows (selection.md 7); absent: no such column. */
  readonly selectedColumn?: string;
  /** The header of a compared series' column of compared values (compare.md 5); absent: no such column. */
  readonly compared?: (name: string) => string;
  /** A gauge's columns after its value (gauge.md 10); absent: no such columns. */
  readonly meter?: { readonly min: string; readonly max: string; readonly threshold: string };
}

/** The table as text, from `dataRows`; with `stackTotal`, each pile's total after its last series (stacking.md 17). */
export function dataTable(model: ChartModel, layout: ChartLayout, view: View | undefined, locale: string | undefined, text: TableText, which: 'visible' | 'all' = 'visible'): DataTable {
  const raw = dataRows(model, layout, view, which, MAX_ROWS);
  const axisId = model.xAxes[0]?.id;
  const r = which === 'visible' && axisId !== undefined ? view?.range?.[axisId] : undefined;
  const range = r ? { from: xValueLabel(model, axisId!, r.min, locale), to: xValueLabel(model, axisId!, r.max, locale) } : null;
  const byId = new Map(model.series.map((s) => [s.id, s]));
  // The columns: each series, and after a pile's last series its total, summing that pile's columns.
  const cols: { readonly name: string; readonly of: readonly number[]; readonly compared?: SeriesCompare }[] = [];
  const piles = new Map<string, number[]>();
  const axisOf = valueAxisOf(model, view);
  raw.series.forEach((id, k) => {
    const s = byId.get(id)!;
    const axis = axisOf(s)?.title;
    const name = axis && text.seriesOnAxis ? text.seriesOnAxis(seriesName(s, text), axis) : seriesName(s, text);
    cols.push({ name, of: [k] });
    // A compared series: its raw values, then its compared ones (compare.md 5).
    const compared = layout.compare.series.get(id);
    if (compared && text.compared && model.kit.compare) cols.push({ name: text.compared(name), of: [k], compared });
    if (!text.stackTotal || !layout.stacks.has(id)) return;
    const key = JSON.stringify([s.type, s.xAxis, s.yAxis, s.stack]);
    const members = piles.get(key) ?? [];
    piles.set(key, [...members, k]);
    const last = raw.series.findLastIndex((o) => {
      const t = byId.get(o)!;
      return layout.stacks.has(o) && JSON.stringify([t.type, t.xAxis, t.yAxis, t.stack]) === key;
    });
    if (last === k) cols.push({ name: text.stackTotal(s.stack === 'default' ? null : s.stack), of: [...members, k] });
  });
  const cell = (values: readonly (number | null)[], of: readonly number[], compared?: SeriesCompare) => {
    if (compared) {
      const v = values[of[0]!]!;
      return v === null ? '' : model.kit.compare!.format(compared.a * v + compared.c, compared.mode, locale);
    }
    let sum: number | null = null;
    for (const k of of) if (values[k] !== null) sum = (sum ?? 0) + values[k]!;
    return sum === null ? '' : formatValue(sum, locale);
  };
  // A polar point is named by its placement (« Part 3 » when it has no name of its own, review 3).
  const rowName = (r: { from: PointRef }) => layout.placements.get(r.from.seriesId)?.name(r.from.index) ?? xLabel(model, byId.get(r.from.seriesId)!, r.from.index, locale);
  const rows = raw.rows.slice(0, MAX_ROWS).map((r) => [rowName(r), ...cols.map((c) => cell(r.values, c.of, c.compared))]);
  // A pie's slices with their shares of the whole (pie-donut.md 15): each real slice, never « Autres ».
  const polar = raw.series.length === 1 ? layout.placements.get(raw.series[0]!) : undefined;
  // A gauge: one row, its value, bounds and threshold (gauge.md 10).
  if (polar?.meter && text.meter) {
    const m = polar.meter;
    const value = Number.isNaN(m.value) ? '' : formatValue(m.value, locale);
    return { columns: [cols[0]!.name, text.meter.min, text.meter.max, text.meter.threshold], rows: [[polar.name(0), value, formatValue(m.min, locale), formatValue(m.max, locale), m.threshold ?? '']], omitted: 0, range: null };
  }
  if (polar && text.share) {
    const s = byId.get(raw.series[0]!)!;
    const whole = s.columns.y.reduce((a, v, i) => (v > 0 && isPointShown(s.id, i, view) ? a + v : a), 0);
    const shares = raw.rows.slice(0, MAX_ROWS).map((r) => {
      const v = s.columns.y[r.from.index]!;
      return whole > 0 && v > 0 && isPointShown(s.id, r.from.index, view) ? formatShare(v / whole, locale) : '';
    });
    return { columns: [...cols.map((c) => c.name), text.share], rows: rows.map((r, k) => [...r, shares[k]!]), omitted: raw.total - raw.rows.length, range };
  }
  // Selected rows marked, while there is a selection (selection.md 7).
  if (text.selectedColumn && selectedCount(view?.selection) > 0) {
    const marks = raw.rows.slice(0, MAX_ROWS).map((r) => (isSelected(view?.selection, r.from.seriesId, r.from.index) ? '✓' : ''));
    return { columns: [...cols.map((c) => c.name), text.selectedColumn], rows: rows.map((r, k) => [...r, marks[k]!]), omitted: raw.total - raw.rows.length, range };
  }
  return { columns: cols.map((c) => c.name), rows, omitted: raw.total - raw.rows.length, range };
}
