// A chart made from what a real DzGrid grid selects, in a real browser (chart-from-grid.md). Phase 8a.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes, type ChartUpdate } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';
import { createGrid } from '@dzgrid/dom';
import type { ColumnOrGroup } from '@dzgrid/core';
import { EN } from '@dzgrid/dom/locales/en';
import { EN_RANGE } from '@dzgrid/dom/locales/en-range';
import { EN_GROUP } from '@dzgrid/dom/locales/en-group';
import { EN_PIVOT } from '@dzgrid/dom/locales/en-pivot';
import { range } from '@dzgrid/dom/range';
import { grouping } from '@dzgrid/dom/grouping';
import { pivot } from '@dzgrid/dom/pivot';
import { spans } from '@dzgrid/dom/spans';
import { dataKey } from '@dzgrid/core';
import { chartFromGrid, chartMenuItem, gridTable } from '@dzgraph/dzgrid';

type Row = { readonly id: string; readonly month: string; readonly apples: number | string | null; readonly pears: number; readonly note: string; readonly at: string; readonly day: string; readonly region: string };
const ROWS: readonly Row[] = [
  { id: 'a', month: 'Jan', apples: 5, pears: 1, note: 'made up', at: '2026-01-01T00:00:00Z', day: '2026-01-01', region: 'North' },
  { id: 'b', month: 'Feb', apples: 8, pears: 2, note: 'made up', at: '2026-01-02T00:00:00Z', day: '2026-01-02', region: 'South' },
  { id: 'c', month: 'Mar', apples: null, pears: 3, note: 'made up', at: '2026-01-03T00:00:00Z', day: '2026-01-03', region: 'North' },
  { id: 'd', month: 'Apr', apples: 9, pears: 4, note: 'made up', at: '2026-01-04T00:00:00Z', day: '2026-01-04', region: 'South' },
];
const COLUMNS: readonly ColumnOrGroup<Row>[] = [
  { id: 'month', header: 'Month' },
  { id: 'apples', header: 'Apples', type: 'number' },
  { id: 'pears', header: 'Pears', type: 'number' },
  { id: 'note', header: 'Note' },
];

const made: (() => void)[] = [];
afterEach(() => made.splice(0).forEach((f) => f()));
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const blocks = range();
const k = (id: string) => dataKey(id)!;

function mountGrid(o: { columns?: readonly ColumnOrGroup<Row>[]; rows?: readonly Row[]; features?: readonly unknown[] } = {}) {
  const host = document.createElement('div');
  host.setAttribute('style', 'inline-size:600px;block-size:240px');
  document.body.append(host);
  const grid = createGrid<Row>(host, {
    rows: o.rows ?? ROWS,
    messages: { ...EN, text: { ...EN.text, ...EN_RANGE.text, ...EN_GROUP.text, ...EN_PIVOT.text } },
    getRowId: (r) => r.id,
    columns: o.columns ?? COLUMNS,
    selection: { mode: 'multi' },
    features: (o.features ?? [blocks]) as never /* DzGrid's GridFeature, from its own build */,
  });
  made.push(() => {
    grid.destroy();
    host.remove();
  });
  return grid;
}
function mountChart(extra: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:300px');
  el.lang = 'en';
  document.body.append(el);
  const c: Chart = chart(el, { animation: false, title: { text: 'Fruit (made up)' }, series: [], ...extra }, { types: allTypes });
  // Every update the bridge gives, as it gives it.
  const seen: ChartUpdate[] = [];
  const update = c.update.bind(c);
  c.update = (u) => (seen.push(u), update(u));
  made.push(() => {
    c.destroy();
    el.remove();
  });
  return { c, el, seen };
}
const block = (from: [string, string], to: [string, string]) => ({ anchor: { row: k(from[0]), column: from[1] }, focus: { row: k(to[0]), column: to[1] } });

describe('where the data comes from (chart-from-grid.md 2–4)', () => {
  it('a block: its rows, its columns; the first that is not a number names the points', () => {
    const grid = mountGrid();
    blocks.api(grid)!.set(block(['b', 'month'], ['d', 'pears']));
    const t = gridTable(grid, { range: blocks });
    expect(t.source).toBe('block');
    expect(t.xAxis).toEqual({ scale: 'category', categories: ['Feb', 'Mar', 'Apr'] });
    expect(t.series).toEqual([
      { id: 'grid:apples', name: 'Apples', data: [{ x: 'Feb', y: 8, key: 'b' }, { x: 'Mar', y: null, key: 'c' }, { x: 'Apr', y: 9, key: 'd' }] },
      { id: 'grid:pears', name: 'Pears', data: [{ x: 'Feb', y: 2, key: 'b' }, { x: 'Mar', y: 3, key: 'c' }, { x: 'Apr', y: 4, key: 'd' }] },
    ]);
  });

  it('a block of numbers only: evenly spaced; a text column after the numbers is left out', () => {
    const grid = mountGrid();
    blocks.api(grid)!.set(block(['a', 'pears'], ['b', 'note']));
    const t = gridTable(grid, { range: blocks });
    expect(t.xAxis).toBeNull();
    expect(t.series).toEqual([{ id: 'grid:pears', name: 'Pears', data: [{ y: 1, key: 'a' }, { y: 2, key: 'b' }] }]);
  });

  it('rows ticked: those the grid shows, in its order, every visible column', () => {
    const grid = mountGrid();
    grid.kernel.dispatch({ type: 'column.state', patch: [{ id: 'pears', hidden: true }] }, 'api');
    grid.kernel.dispatch({ type: 'sort.set', sort: [{ column: 'apples', dir: 'desc' }] }, 'api');
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'include', keys: new Set([k('a'), k('d')]) } }, 'api');
    const t = gridTable(grid, { range: blocks });
    expect(t.source).toBe('rows');
    expect(t.xAxis).toEqual({ scale: 'category', categories: ['Apr', 'Jan'] });
    expect(t.series).toEqual([{ id: 'grid:apples', name: 'Apples', data: [{ x: 'Apr', y: 9, key: 'd' }, { x: 'Jan', y: 5, key: 'a' }] }]);
  });

  it('a block wins over rows ticked; nothing selected: no source', () => {
    const grid = mountGrid();
    expect(gridTable(grid, { range: blocks })).toEqual({ source: null, xAxis: null, series: [] });
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'include', keys: new Set([k('a')]) } }, 'api');
    blocks.api(grid)!.set(block(['c', 'month'], ['d', 'apples']));
    expect(gridTable(grid, { range: blocks }).source).toBe('block');
    // Every row but some (select all on server pages): nothing (chart-from-grid.md « Not done »).
    blocks.api(grid)!.clear();
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'exclude', keys: new Set() } }, 'api');
    expect(gridTable(grid, { range: blocks }).source).toBeNull();
  });

  it('a date-time column: a time axis in the grid\'s zone, instants; a day column: days', () => {
    const grid = mountGrid({
      columns: [
        { id: 'at', header: 'At', type: 'instant' },
        { id: 'day', header: 'Day', type: 'day' },
        { id: 'pears', header: 'Pears', type: 'number' },
      ],
    });
    blocks.api(grid)!.set(block(['a', 'at'], ['b', 'pears']));
    expect(gridTable(grid, { range: blocks, timeZone: 'Pacific/Auckland' })).toEqual({
      source: 'block',
      xAxis: { scale: 'time', zone: 'Pacific/Auckland' },
      series: [{ id: 'grid:pears', name: 'Pears', data: [{ x: Date.UTC(2026, 0, 1), y: 1, key: 'a' }, { x: Date.UTC(2026, 0, 2), y: 2, key: 'b' }] }],
    });
    blocks.api(grid)!.set(block(['a', 'day'], ['b', 'pears']));
    expect(gridTable(grid, { range: blocks })).toEqual({
      source: 'block',
      xAxis: { scale: 'time', zone: 'UTC' },
      series: [{ id: 'grid:pears', name: 'Pears', data: [{ x: '2026-01-01', y: 1, key: 'a' }, { x: '2026-01-02', y: 2, key: 'b' }] }],
    });
  });

  it('a value the column refuses is a gap; an edit shown by the grid is read', () => {
    const grid = mountGrid({ rows: ROWS.map((r) => (r.id === 'b' ? { ...r, apples: 'eight' } : r)) });
    blocks.api(grid)!.set(block(['a', 'apples'], ['b', 'apples']));
    expect(gridTable(grid, { range: blocks }).series[0]!.data).toEqual([{ y: 5, key: 'a' }, { y: null, key: 'b' }]);
  });

  it('the pivot: its groups as categories, one series per created column', () => {
    const p = pivot({ columns: ['month'], values: { apples: 'sum' } });
    const grid = mountGrid({ columns: [...COLUMNS, { id: 'region', header: 'Region' }], features: [blocks, spans(), grouping({ by: ['region'], pivot: p })] });
    const t = gridTable(grid, { range: blocks, pivot: p });
    expect(t.source).toBe('pivot');
    expect(t.xAxis).toEqual({ scale: 'category', categories: ['North', 'South'] });
    // The created columns in the pivot's order (months as they come, sorted by the grid), each the apples' sum.
    const byName = Object.fromEntries(t.series.map((s) => [s.name, s.data.map((d) => d.y)]));
    expect(byName).toEqual({ Apr: [null, 9], Feb: [null, 8], Jan: [5, null], Mar: [null, null] });
    expect(t.series.every((s) => s.id.startsWith('grid:'))).toBe(true);
  });
});

describe('the chart (chart-from-grid.md 1, 5–7)', () => {
  it('fills the chart the app made: columns on categories, its title kept, the app\'s axis words kept', async () => {
    const grid = mountGrid();
    const { c, el, seen } = mountChart();
    blocks.api(grid)!.set(block(['a', 'month'], ['c', 'apples']));
    made.push(chartFromGrid(c, grid, { range: blocks, xAxis: { title: { text: 'Month' } } }));
    await raf2();
    expect(seen.at(-1)).toEqual({
      xAxis: { title: { text: 'Month' }, scale: 'category', categories: ['Jan', 'Feb', 'Mar'] },
      series: [{ type: 'column', id: 'grid:apples', name: 'Apples', data: [{ x: 'Jan', y: 5, key: 'a' }, { x: 'Feb', y: 8, key: 'b' }, { x: 'Mar', y: null, key: 'c' }] }],
    });
    expect(el.querySelectorAll('.dzgraph-point').length).toBe(2);
    expect(el.textContent).toContain('Fruit (made up)');
  });

  it('a line on a time axis; `type` wins', async () => {
    const grid = mountGrid({ columns: [{ id: 'at', header: 'At', type: 'instant' }, { id: 'pears', header: 'Pears', type: 'number' }] });
    blocks.api(grid)!.set(block(['a', 'at'], ['b', 'pears']));
    const one = mountChart();
    made.push(chartFromGrid(one.c, grid, { range: blocks }));
    const two = mountChart();
    made.push(chartFromGrid(two.c, grid, { range: blocks, type: 'area' }));
    await raf2();
    expect(one.seen.at(-1)!.series!.map((s) => s.type)).toEqual(['line']);
    expect(two.seen.at(-1)!.series!.map((s) => s.type)).toEqual(['area']);
  });

  it('follows: the block the user grows, once a frame; rows ticked by the user', async () => {
    const grid = mountGrid();
    const { c, seen } = mountChart();
    made.push(chartFromGrid(c, grid, { range: blocks }));
    await raf2();
    const before = seen.length;
    // Three block changes in one frame: one fill.
    blocks.api(grid)!.set(block(['a', 'month'], ['b', 'apples']));
    blocks.api(grid)!.set(block(['a', 'month'], ['c', 'apples']));
    blocks.api(grid)!.set(block(['a', 'month'], ['d', 'apples']));
    await raf2();
    expect(seen.length).toBe(before + 1);
    expect(seen.at(-1)!.series![0]!.data).toHaveLength(4);
    blocks.api(grid)!.clear();
    grid.kernel.dispatch({ type: 'selection.toggle', row: k('b') }, 'user');
    await raf2();
    expect((seen.at(-1)!.series![0]!.data as readonly { key?: string }[]).map((d) => d.key)).toEqual(['b']);
  });

  it('rows ticked by code (a link\'s) do not refill it; nothing selected keeps what it shows', async () => {
    const grid = mountGrid();
    const { c, seen } = mountChart();
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'include', keys: new Set([k('a'), k('b')]) } }, 'api');
    made.push(chartFromGrid(c, grid, { range: blocks }));
    await raf2();
    const n = seen.length;
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'include', keys: new Set([k('a')]) } }, 'api');
    await raf2();
    expect(seen.length).toBe(n);
    grid.kernel.dispatch({ type: 'selection.clear' }, 'user');
    await raf2();
    expect(seen.length).toBe(n);
  });

  it('new rows refill it; stopped, it follows no more; a snapshot never follows', async () => {
    const grid = mountGrid();
    const { c, seen } = mountChart();
    const snap = mountChart();
    blocks.api(grid)!.set(block(['a', 'month'], ['b', 'pears']));
    const stop = chartFromGrid(c, grid, { range: blocks });
    made.push(chartFromGrid(snap.c, grid, { range: blocks, follow: false }));
    await raf2();
    expect(snap.seen).toHaveLength(1);
    grid.kernel.dispatch({ type: 'selection.set', selection: { mode: 'include', keys: new Set([k('a'), k('b')]) } }, 'user');
    grid.update({ rows: ROWS.map((r) => (r.id === 'a' ? { ...r, apples: 50 } : r)) });
    await raf2();
    expect(seen.at(-1)!.series![0]!.data).toContainEqual({ x: 'Jan', y: 50, key: 'a' });
    stop();
    const n = seen.length;
    grid.kernel.dispatch({ type: 'selection.toggle', row: k('c') }, 'user');
    await raf2();
    expect(seen.length).toBe(n);
    expect(snap.seen).toHaveLength(1);
  });
});

describe('review (Phase 8a close)', () => {
  it('review 1: a yes/no column names the points with the grid\'s words', () => {
    const rows = ROWS.map((r, i) => ({ ...r, ripe: i % 2 === 0 }));
    const grid = mountGrid({ rows, columns: [{ id: 'ripe', header: 'Ripe', type: 'boolean' }, { id: 'pears', header: 'Pears', type: 'number' }] as never /* a column of a field the Row type does not name */ });
    blocks.api(grid)!.set(block(['a', 'ripe'], ['b', 'pears']));
    expect(gridTable(grid, { range: blocks, yesNo: ['Oui', 'Non'] }).xAxis).toEqual({ scale: 'category', categories: ['Oui', 'Non'] });
  });

  it('review 2: on a time axis the points are in time order, whatever the grid\'s sort', () => {
    const grid = mountGrid({ columns: [{ id: 'at', header: 'At', type: 'instant' }, { id: 'pears', header: 'Pears', type: 'number' }] });
    grid.kernel.dispatch({ type: 'sort.set', sort: [{ column: 'pears', dir: 'desc' }] }, 'api');
    blocks.api(grid)!.set(block(['d', 'at'], ['a', 'pears']));
    const data = gridTable(grid, { range: blocks }).series[0]!.data;
    expect(data.map((d) => d.key)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('the cell menu entry (chart-from-grid.md 8)', () => {
  it('an item with the app\'s label that calls the app with the cell\'s context', () => {
    const got: unknown[] = [];
    const item = chartMenuItem('Chart', (c) => got.push(c));
    expect([item.id, item.label]).toEqual(['dzgraph.chart', 'Chart']);
    const ctx = { row: ROWS[0] };
    item.action(ctx);
    expect(got).toEqual([ctx]);
  });
});
