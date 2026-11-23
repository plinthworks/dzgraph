/**
 * A chart linked to a DzGrid grid (dzgrid-link.md): the selection both ways by key, and, as an option, the grid
 * filtered by the chart's selection or visible range. The grid is described by the part of DzGrid's kernel this uses
 * (its commands and its selection event), written structurally: no import of DzGrid, any DzGrid 1.x fits.
 */
import type { Chart } from '@dzgraph/dom';

/**
 * A data row's key from its id, as DzGrid makes it (`dataKey`: the family, the id's length, the id) — written here,
 * not imported; a test holds it to DzGrid's own. `1` and `'1'` are one row there too.
 */
export const rowKeyOf = (id: string): string => `d:${id.length}:${id}`;

/** The id inside a data row's key (`idOfDataKey`); null for any other row (a group, a detail) or a key that is not one. */
export function idOfRowKey(key: string): string | null {
  const m = /^d:(0|[1-9]\d*):/.exec(key);
  if (!m) return null;
  const id = key.slice(m[0].length);
  return id.length === Number(m[1]) && id !== '' ? id : null;
}

/** A row selection as DzGrid's kernel holds it: these keys, or every row but these. */
export type GridSelectionLike = { readonly mode: 'include'; readonly keys: ReadonlySet<string> } | { readonly mode: 'exclude'; readonly keys: ReadonlySet<string> };

/** The column filters this bridge sets (DzGrid's `ColumnFilter`, the kinds used). */
export type GridFilterLike =
  | { readonly type: 'set'; readonly include: readonly string[] }
  | { readonly type: 'number'; readonly op: 'between'; readonly value: number; readonly valueTo: number }
  | { readonly type: 'instant'; readonly op: 'between'; readonly at: string; readonly atTo: string };

/** DzGrid's commands this bridge dispatches. */
export type GridCommandLike =
  | { readonly type: 'selection.set'; readonly selection: GridSelectionLike }
  | { readonly type: 'filter.column'; readonly column: string; readonly filter: GridFilterLike | null };

/** A grid as `createGrid` returns it: its kernel's commands and events. */
export interface GridLike {
  readonly kernel: {
    /**
     * Takes a `GridCommandLike`. Typed `never` so that any DzGrid fits: DzGrid brands its row keys (`RowKey`), a brand
     * a structural type cannot write; the strings `rowKeyOf` makes are those keys at run time.
     */
    dispatch(command: never, source: 'api'): unknown;
    /** Its events, each read by its `type` (`selectionChanged` carries `selection`, `filterChanged` carries `filter`). */
    subscribe(listener: (event: { readonly type: string }) => void): () => void;
  };
}

/** DzGrid's `selectionChanged` and `filterChanged` events, the fields read (a cast after their `type`, as DzGrid sends them). */
type SelectionChanged = { readonly type: 'selectionChanged'; readonly selection: GridSelectionLike };
type FilterChanged = { readonly type: 'filterChanged'; readonly filter: Readonly<Record<string, unknown>> };

export interface GridLinkOptions {
  /** The selection both ways (dzgrid-link.md 2). @default true */
  readonly selection?: boolean;
  /**
   * The grid filtered on one of its columns (dzgrid-link.md 4): by the selected points' keys, or by the chart's
   * visible range (`as: 'instant'` for a date-time column; numbers otherwise).
   */
  readonly filter?: { readonly column: string; readonly by: 'selection' | 'range'; readonly as?: 'number' | 'instant' };
}

/** Links a chart and a grid; returns the function that unlinks them (and lifts the link's filter). */
export function linkGrid(chart: Chart, grid: GridLike, options: GridLinkOptions = {}): () => void {
  // A change the link makes is not linked back (dzgrid-link.md 2): a flag while it applies one.
  let applying = false;
  const apply = (f: () => void) => {
    if (applying) return;
    applying = true;
    try {
      f();
    } finally {
      applying = false;
    }
  };
  const offs: (() => void)[] = [];
  const filter = options.filter;
  /** The filter the link set on its column, while it is still there (review 2: never lift the user's own). */
  let sent: GridFilterLike | null = null;
  /** The one way this sends a command (see `GridLike.dispatch`). */
  const send = (c: GridCommandLike) => grid.kernel.dispatch(c as never /* DzGrid's branded command type, see GridLike.dispatch */, 'api');
  const setFilter = (f: GridFilterLike | null) => {
    if (!filter) return;
    sent = f;
    send({ type: 'filter.column', column: filter.column, filter: f });
  };
  if (filter)
    offs.push(
      grid.kernel.subscribe((e) => {
        // Another filter on the column since (the user's): no longer the link's to lift.
        if (e.type === 'filterChanged' && sent && (e as FilterChanged).filter[filter.column] !== sent) sent = null;
      }),
    );

  offs.push(
    chart.on('selectionChange', (d) =>
      apply(() => {
        const keys = new Set<string>();
        for (const s of d.series) for (const k of s.keys ?? []) if (k != null && k !== '') keys.add(k);
        // The filter first: a grid that clears its selection when filtered (`keepOnFilter: false`) then gets it (review 1).
        if (filter?.by === 'selection') setFilter(keys.size ? { type: 'set', include: [...keys] } : null);
        if (options.selection !== false) send({ type: 'selection.set', selection: { mode: 'include', keys: new Set([...keys].map(rowKeyOf)) } });
      }),
    ),
  );
  if (options.selection !== false)
    offs.push(
      grid.kernel.subscribe((e) => {
        // Every row but some (select all on server pages) cannot be told to the chart (dzgrid-link.md 3).
        if (e.type !== 'selectionChanged') return;
        const selection = (e as SelectionChanged).selection;
        if (selection.mode !== 'include') return;
        // Data rows only: a group's or a detail's row has no point (dzgrid-link.md 5).
        const ids = [...selection.keys].map(idOfRowKey).filter((id): id is string => id !== null);
        apply(() => chart.selectBy('key', ids));
      }),
    );
  if (filter?.by === 'range') {
    const byRange = (r: { readonly min: number; readonly max: number } | null | undefined) => {
      if (!r || !Number.isFinite(r.min) || !Number.isFinite(r.max)) return setFilter(null);
      setFilter(filter.as === 'instant' ? { type: 'instant', op: 'between', at: new Date(r.min).toISOString(), atTo: new Date(r.max).toISOString() } : { type: 'number', op: 'between', value: r.min, valueTo: r.max });
    };
    // Once a gesture rests (the view's change), not at every frame of a drag: a server's grid asks once (review 7).
    offs.push(chart.on('viewChange', (d) => d.changed.includes('range') && byRange(d.view.range)));
    // A chart zoomed before the link: its range at once.
    const now = chart.getView().range;
    if (now) byRange(now);
  }
  return () => {
    offs.splice(0).forEach((off) => off());
    if (sent) setFilter(null);
  };
}
