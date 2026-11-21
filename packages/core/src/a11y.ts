/**
 * What screen readers and the data table are given (screen-reader.md, data-table.md), as data: the DOM layer puts the
 * words around it in the reader's language.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout, LayoutText } from './layout.js';
import type { PointRef } from './scene.js';
import { formatValue } from './format.js';
import { seriesName, xLabel } from './tooltip.js';
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
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of s.columns.y) if (!Number.isNaN(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return lo <= hi ? [{ name: seriesName(s, text), min: formatValue(lo, locale), max: formatValue(hi, locale) }] : [];
  });
  // The first and last x with a value, over every visible series.
  type At = { readonly s: (typeof shown)[number]; readonly i: number; readonly x: number };
  let first: At | null = null;
  let last: At | null = null;
  for (const s of shown) {
    const { x, y } = s.columns;
    for (let i = 0; i < x.length; i++) {
      if (Number.isNaN(y[i]!)) continue;
      if (first === null || x[i]! < first.x) first = { s, i, x: x[i]! };
      if (last === null || x[i]! > last.x) last = { s, i, x: x[i]! };
    }
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
}

export function dataRows(model: ChartModel, _layout: ChartLayout, view: View | undefined): DataRows {
  const shown = model.series.filter((s) => isShown(s, view));
  // Series read along x share a row per x; a series of marks gets a row per point (two points at one x, review 9).
  const rowsByKey = new Map<string, { x: number; order: number; from: PointRef; values: (number | null)[] }>();
  let order = 0;
  shown.forEach((s, k) => {
    const perPoint = s.tooltip === 'mark' || !s.sorted;
    s.columns.x.forEach((x, i) => {
      if (Number.isNaN(x)) return;
      const y = s.columns.y[i]!;
      if (perPoint && Number.isNaN(y)) return;
      const key = perPoint ? `p\u0000${s.id}\u0000${i}` : `x\u0000${x}`;
      let row = rowsByKey.get(key);
      if (!row) rowsByKey.set(key, (row = { x, order: order++, from: { seriesId: s.id, index: i }, values: shown.map(() => null) }));
      if (!Number.isNaN(y)) row.values[k] = y;
    });
  });
  const rows = [...rowsByKey.values()].sort((a, b) => a.x - b.x || a.order - b.order).map(({ x, from, values }) => ({ x, from, values }));
  return { series: shown.map((s) => s.id), rows };
}

export interface DataTable {
  /** The visible series' names (the x column comes first and has no name here: the DOM names it). */
  readonly columns: readonly string[];
  /** One row per x or per point, in x order: its label, then each series' value or '' where it has none. */
  readonly rows: readonly (readonly string[])[];
  /** Rows left out past 1 000 (data-table.md 4). */
  readonly omitted: number;
}

const MAX_ROWS = 1000;

/** The table as text, from `dataRows`. */
export function dataTable(model: ChartModel, layout: ChartLayout, view: View | undefined, locale: string | undefined, text: Pick<LayoutText, 'seriesName'>): DataTable {
  const raw = dataRows(model, layout, view);
  const byId = new Map(model.series.map((s) => [s.id, s]));
  const rows = raw.rows.slice(0, MAX_ROWS).map((r) => [xLabel(model, byId.get(r.from.seriesId)!, r.from.index, locale), ...r.values.map((v) => (v === null ? '' : formatValue(v, locale)))]);
  return { columns: raw.series.map((id) => seriesName(byId.get(id)!, text)), rows, omitted: Math.max(0, raw.rows.length - MAX_ROWS) };
}
