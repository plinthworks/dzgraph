/**
 * A chart made from what a DzGrid grid selects (chart-from-grid.md): its pivot, its block of cells or its rows ticked,
 * read as the grid reads them, and the chart filled again as they change. The grid and its features are described by
 * the parts used, structurally: no import of DzGrid.
 */
import type { Chart } from '@dzgraph/dom';
import { idOfRowKey, type GridSelectionLike } from './link.js';

// The chart's types, read from `Chart` itself: a bridge imports the DOM layer only (ARCHITECTURE §2).
type ChartUpdate = Parameters<Chart['update']>[0];
type SeriesType = NonNullable<ChartUpdate['series']>[number]['type'];
/** A point as a chart takes it written out (DzGraph's `PointInput`): x absent, evenly spaced. */
type XValue = number | string;
export interface GridPoint {
  readonly x?: XValue;
  readonly y: number | null;
  readonly key?: string;
}

/** DzGrid's locale context, as a column's codec takes it. */
interface CtxLike {
  readonly locale: string;
  readonly numerals: 'latn' | 'locale';
  readonly timeZone: string;
  readonly calendar: 'gregory';
  readonly yesNo?: readonly [yes: string, no: string];
}
/** A visible column as DzGrid resolves it: its id, its type, its header, its codec. */
export interface GridColumnLike {
  readonly id: string;
  readonly type: string;
  readonly def: { readonly header?: string | undefined };
  readonly codec: { coerce(raw: unknown, ctx: CtxLike): unknown; format(v: unknown, ctx: CtxLike): string };
}
interface RowNodeLike {
  readonly key: string;
  readonly kind: string;
  readonly data?: unknown;
}
/** The grid as this reads it: the rows shown, the visible columns, the selection, the edits, the events. */
export interface GridReadLike {
  readonly kernel: {
    readonly rows: {
      readonly displayed: {
        readonly count: number;
        nodeAt(i: number): RowNodeLike;
        /** A list loaded in blocks: the positions held (DzGrid walks these, never ten million rows). */
        held?(): Iterable<number>;
      };
    };
    readonly columns: { visible(): readonly GridColumnLike[] };
    readonly selection: GridSelectionLike;
    readonly reader: { value(col: GridColumnLike, row: unknown, id: string): unknown };
    subscribe(listener: (event: { readonly type: string; readonly source?: string }) => void): () => void;
  };
}
/** DzGrid's `range()` feature: the block's box for the rows shown now (positions and visible column indices). */
export interface GridRangeLike<G> {
  api(grid: G): { box(): { readonly top: number; readonly bottom: number; readonly start: number; readonly end: number } | null } | null;
}
/** DzGrid's `pivot()` feature: whether it is on, and its table for a chart. */
export interface GridPivotLike<G> {
  api(grid: G): {
    on(): boolean;
    series(o?: { readonly value?: string; readonly level?: number }): {
      readonly categories: readonly string[];
      readonly series: readonly { readonly id: string; readonly name: string; readonly values: readonly (number | null)[] }[];
    };
  } | null;
}

export interface GridTableOptions<G> {
  /** The grid's `range()` feature: its block of cells is read first (after the pivot). */
  readonly range?: GridRangeLike<G> | undefined;
  /** The grid's `pivot()` feature: while it is on, its table is read. */
  readonly pivot?: GridPivotLike<G> | undefined;
  /** The pivot's value column (DzGrid's default: the first). */
  readonly pivotValue?: string | undefined;
  /** The pivot's group level (DzGrid's default: 1). */
  readonly pivotLevel?: number | undefined;
  /** The grid's zone, for date-time columns (DzGrid's default: UTC). */
  readonly timeZone?: string | undefined;
  /** The grid's language, as its context has it (what a column's text may depend on). @default 'en' */
  readonly locale?: string | undefined;
  /** The grid's words for yes and no (its messages' `cell.yes`, `cell.no`), for a yes/no column naming the points. */
  readonly yesNo?: readonly [yes: string, no: string] | undefined;
}

/** What a grid's selection gives a chart: where it came from, the x axis it needs (null: evenly spaced), the series. */
export interface GridTable {
  readonly source: 'pivot' | 'block' | 'rows' | null;
  readonly xAxis: { readonly scale: 'category'; readonly categories: readonly string[] } | { readonly scale: 'time'; readonly zone: string } | null;
  readonly series: readonly { readonly id: string; readonly name: string; readonly data: readonly GridPoint[] }[];
}

const NOTHING: GridTable = { source: null, xAxis: null, series: [] };
/** Types that name the points (chart-from-grid.md 3); numbers are series; the rest is left out. */
const LABELS = new Set(['text', 'enum', 'boolean', 'day', 'instant']);

/** Reads what the grid selects as a chart's table (chart-from-grid.md 2–4); nothing selected: no source. */
export function gridTable<G extends GridReadLike>(grid: G, o: GridTableOptions<G> = {}): GridTable {
  const k = grid.kernel;
  const p = o.pivot?.api(grid);
  if (p?.on()) {
    const t = p.series({ ...(o.pivotValue !== undefined && { value: o.pivotValue }), ...(o.pivotLevel !== undefined && { level: o.pivotLevel }) });
    return {
      source: 'pivot',
      xAxis: { scale: 'category', categories: [...t.categories] },
      series: t.series.map((s) => ({ id: `grid:${s.id}`, name: s.name, data: s.values.map((y, i) => ({ x: t.categories[i] ?? '', y })) })),
    };
  }
  const d = k.rows.displayed;
  const visible = k.columns.visible();
  /** The positions shown between two, ascending: a list loaded in blocks gives those it holds. */
  const shown = function* (from: number, to: number) {
    if (d.held) {
      for (const i of d.held()) if (i >= from && i <= to) yield i;
    } else for (let i = from; i <= to; i++) yield i;
  };
  const box = o.range?.api(grid)?.box();
  let source: GridTable['source'];
  let columns: readonly GridColumnLike[];
  const rows: RowNodeLike[] = [];
  if (box) {
    source = 'block';
    columns = visible.slice(box.start, box.end + 1);
    for (const i of shown(box.top, box.bottom)) {
      const n = d.nodeAt(i);
      if (n.kind === 'data') rows.push(n);
    }
  } else if (k.selection.mode === 'include' && k.selection.keys.size > 0) {
    source = 'rows';
    columns = visible;
    for (const i of shown(0, d.count - 1)) {
      const n = d.nodeAt(i);
      if (n.kind === 'data' && k.selection.keys.has(n.key)) rows.push(n);
    }
  } else return NOTHING;

  const ctx: CtxLike = { locale: o.locale ?? 'en', numerals: 'latn', timeZone: o.timeZone ?? 'UTC', calendar: 'gregory', ...(o.yesNo && { yesNo: o.yesNo }) };
  const numbers = columns.filter((c) => c.type === 'number');
  // The columns before the first number name the points (the first that can); a text column after them is left out.
  const first = numbers[0] ? columns.indexOf(numbers[0]) : columns.length;
  const label = columns.slice(0, first).find((c) => LABELS.has(c.type));
  const time = label?.type === 'instant' || label?.type === 'day';
  // Each row's id (its key's), its x, and the values of the number columns, as the grid reads them (its edits too).
  const read = (c: GridColumnLike, n: RowNodeLike, id: string) => c.codec.coerce(k.reader.value(c, n.data, id), ctx);
  const points: { key: string; x: XValue | undefined; row: RowNodeLike }[] = [];
  for (const n of rows) {
    const key = idOfRowKey(n.key) ?? n.key;
    let x: XValue | undefined;
    if (label) {
      const v = read(label, n, key);
      if (time) {
        // A row with no date cannot be placed on a time axis: left out.
        if (typeof v !== 'number' && typeof v !== 'string') continue;
        x = v;
      } else x = v == null ? '' : label.codec.format(v, ctx);
    }
    points.push({ key, x, row: n });
  }
  // A time axis draws a line in time order (an x out of order is `unsorted-x`): the grid may be sorted on anything.
  // Instants are numbers, days `YYYY-MM-DD`: each column's values compare as they are. Stable: ties keep the grid's order.
  if (time) points.sort((a, b) => (a.x! < b.x! ? -1 : a.x! > b.x! ? 1 : 0));
  const categories = label && !time ? [...new Set(points.map((q) => q.x as string))] : null;
  return {
    source,
    xAxis: !label ? null : categories ? { scale: 'category', categories } : { scale: 'time', zone: ctx.timeZone },
    series: numbers.map((c) => ({
      id: `grid:${c.id}`,
      name: c.def.header ?? c.id,
      data: points.map(({ key, x, row }) => {
        const v = read(c, row, key);
        const y = typeof v === 'number' && Number.isFinite(v) ? v : null;
        return x === undefined ? { y, key } : { x, y, key };
      }),
    })),
  };
}

export interface ChartFromGridOptions<G> extends GridTableOptions<G> {
  /** The series' type; absent: a line on a time axis, columns otherwise. */
  readonly type?: SeriesType | undefined;
  /** The app's x axis options (its title…), kept under the scale the grid's columns give. */
  readonly xAxis?: Readonly<Record<string, unknown>> | undefined;
  /** False: one snapshot, no following (chart-from-grid.md 6). @default true */
  readonly follow?: boolean | undefined;
}

/**
 * Fills `chart` with what `grid` selects and, unless `follow: false`, again as it changes (chart-from-grid.md 1–7):
 * once a frame at most. Rows ticked by code do not refill it (`linkGrid` ticks them); nothing selected keeps what it
 * shows. Returns the function that stops.
 */
export function chartFromGrid<G extends GridReadLike>(chart: Chart, grid: G, o: ChartFromGridOptions<G> = {}): () => void {
  let filled = false;
  const fill = () => {
    const t = gridTable(grid, o);
    // Nothing selected: a press outside the grid drops its block, and the user going to the chart must not empty it.
    if (!t.source && filled) return;
    filled = true;
    const type = o.type ?? (t.xAxis?.scale === 'time' ? 'line' : 'column');
    const xAxis = t.xAxis || o.xAxis ? { ...o.xAxis, ...t.xAxis } : undefined;
    // One type for every series: a union of types the compiler cannot narrow to one member of `SeriesOptions`.
    chart.update({ xAxis, series: t.series.map((s) => ({ type, ...s })) } as ChartUpdate);
  };
  fill();
  if (o.follow === false) return () => {};
  let frame = 0;
  const soon = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), fill()));
  };
  const off = grid.kernel.subscribe((e) => {
    // Rows ticked by code (a link's) are not followed: the chart would shrink to the points selected in it.
    if (e.type === 'selectionChanged' ? e.source !== 'api' : e.type === 'rangeChanged' || e.type === 'modelUpdated' || e.type === 'columnsChanged') soon();
  });
  return () => {
    off();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}

/** An item for DzGrid's cell menu (`items`): the app's label, translated; it calls `open` with the cell's context. */
export function chartMenuItem<C>(label: string, open: (c: C) => void): { readonly id: 'dzgraph.chart'; readonly label: string; readonly action: (c: C) => void } {
  return { id: 'dzgraph.chart', label, action: (c) => open(c) };
}
