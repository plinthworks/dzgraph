// A chart linked to a real DzGrid grid, in a real browser (dzgrid-link.md). Phase 7b.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, selection, zoom, type Chart } from '@dzgraph/dom';
import { createGrid } from '@dzgrid/dom';
import { EN } from '@dzgrid/dom/locales/en';
import { dataKey, idOfDataKey } from '@dzgrid/core';
import { idOfRowKey, linkGrid, rowKeyOf } from '@dzgraph/dzgrid';

type Row = { readonly id: string; readonly x: number; readonly sales: number };
const ROWS: readonly Row[] = [
  { id: 'a', x: 0, sales: 5 },
  { id: 'b', x: 1, sales: 8 },
  { id: 'c', x: 2, sales: 3 },
  { id: 'd', x: 3, sales: 9 },
];

const made: (() => void)[] = [];
afterEach(() => made.splice(0).forEach((f) => f()));
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function mount(keepOnFilter = true) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:300px');
  el.lang = 'en';
  const host = document.createElement('div');
  host.setAttribute('style', 'inline-size:600px;block-size:240px');
  document.body.append(el, host);
  const c: Chart = chart(el, { animation: false, selection: true, series: [{ type: 'column', id: 's', name: 'Sales', data: ROWS.map((r) => ({ x: r.x, y: r.sales, key: r.id })) }] }, { types: allTypes, features: [selection, zoom] });
  const grid = createGrid<Row>(host, {
    rows: ROWS,
    messages: EN,
    getRowId: (r) => r.id,
    columns: [{ id: 'id', header: 'Id' }, { id: 'x', header: 'X', type: 'number' }, { id: 'sales', header: 'Sales', type: 'number' }],
    selection: { mode: 'multi', keepOnFilter },
  });
  // Space selects in the selection mode (selection.md 5).
  c.setMode('selection');
  made.push(() => {
    c.destroy();
    grid.destroy();
    el.remove();
    host.remove();
  });
  return { c, grid, el };
}
/** The grid's selection, as the rows' ids. */
const gridKeys = (grid: ReturnType<typeof mount>['grid']) => {
  const s = grid.kernel.selection;
  const ids = [...s.keys].map((k) => idOfDataKey(k) ?? k).sort();
  return s.mode === 'include' ? ids : ['all but', ...ids];
};

describe('row keys (dzgrid-link.md 1)', () => {
  it('written as DzGrid writes them, read back as it reads them', () => {
    for (const id of ['a', 'Pommes', '12', 'd:3:x', 'é😀', ' ']) {
      expect(rowKeyOf(id)).toBe(dataKey(id));
      expect(idOfRowKey(dataKey(id)!)).toBe(idOfDataKey(dataKey(id)!));
    }
    expect([idOfRowKey('g:1:a'), idOfRowKey('d:2:a'), idOfRowKey('nothing')]).toEqual([idOfDataKey('g:1:a' as never /* a group row's key, branded by DzGrid */), null, null]);
  });
});
/** The user selecting points by the keyboard (selection.md 5: Space on each, which adds it): the chart tells it. */
async function pick(el: HTMLElement, indices: readonly number[]) {
  const points = el.querySelectorAll<SVGElement>('.dzgraph-point');
  indices.forEach((i) => {
    points[i]!.focus({ preventScroll: true });
    points[i]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
}
const chartKeys = (c: Chart) => Object.values(c.getView().selection ?? {}).flat().map(String).sort();
describe('selection both ways (dzgrid-link.md 1–2)', () => {
  it('points selected in the chart select their rows; rows selected in the grid select their points', async () => {
    const { c, grid, el } = mount();
    made.push(linkGrid(c, grid));
    await raf2();
    await pick(el, [1, 3]);
    expect(gridKeys(grid)).toEqual(['b', 'd']);
    grid.kernel.dispatch({ type: 'selection.toggle', row: dataKey('a')! }, 'user');
    await raf2();
    expect(chartKeys(c)).toEqual(['a', 'b', 'd']);
  });

  it('no echo: a change the link made is not linked back; unlinking stops both ways', async () => {
    const { c, grid, el } = mount();
    await raf2();
    const unlink = linkGrid(c, grid);
    let told = 0;
    let chartTold = 0;
    const off = grid.kernel.subscribe((e) => void (e.type === 'selectionChanged' && told++));
    const offChart = c.on('selectionChange', () => void chartTold++);
    await pick(el, [2]);
    // Once each: the chart's change made the grid's, which was not linked back.
    expect([told, chartTold]).toEqual([1, 1]);
    unlink();
    await pick(el, [0]);
    expect(gridKeys(grid)).toEqual(['c']);
    off();
    offChart();
  });

  it('selection: false links nothing of it', async () => {
    const { c, grid, el } = mount();
    await raf2();
    made.push(linkGrid(c, grid, { selection: false }));
    await pick(el, [2]);
    expect(gridKeys(grid)).toEqual([]);
  });
});

describe('filter (dzgrid-link.md 4, 6)', () => {
  it('by the selection: the rows of the selected points; none selected: all; unlinking lifts it', async () => {
    const { c, grid, el } = mount();
    await raf2();
    const unlink = linkGrid(c, grid, { filter: { column: 'id', by: 'selection' } });
    await pick(el, [0, 2]);
    expect(grid.kernel.query.filter['id']).toEqual({ type: 'set', include: ['a', 'c'] });
    // Escape empties the selection (selection.md).
    el.querySelectorAll<SVGElement>('.dzgraph-point')[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    expect(grid.kernel.query.filter['id']).toBeUndefined();
    await pick(el, [1]);
    unlink();
    expect(grid.kernel.query.filter['id']).toBeUndefined();
  });

  it('by the visible range: a number filter between its ends; the whole data: none', async () => {
    const { c, grid } = mount();
    made.push(linkGrid(c, grid, { filter: { column: 'x', by: 'range' } }));
    c.setRange({ min: 1, max: 2 });
    await new Promise((r) => setTimeout(r, 600));
    // A column chart shows whole columns (zoom-pan.md): 1 to 2 is the band from 0.5 to 2.5.
    expect(grid.kernel.query.filter['x']).toEqual({ type: 'number', op: 'between', value: 0.5, valueTo: 2.5 });
    c.setRange(null);
    await new Promise((r) => setTimeout(r, 600));
    expect(grid.kernel.query.filter['x']).toBeUndefined();
  });
});

describe('review (Phase 7b close)', () => {
  it('review 1: a grid that clears its selection when filtered still gets the chart\'s selection', async () => {
    const { c, grid, el } = mount(false);
    await raf2();
    made.push(linkGrid(c, grid, { filter: { column: 'id', by: 'selection' } }));
    await pick(el, [0, 2]);
    expect([gridKeys(grid), chartKeys(c)]).toEqual([['a', 'c'], ['a', 'c']]);
  });

  it('review 2: unlinking lifts the link\'s filter only, never one the user set since', async () => {
    const { c, grid, el } = mount();
    await raf2();
    const unlink = linkGrid(c, grid, { filter: { column: 'id', by: 'selection' } });
    await pick(el, [1]);
    const mine = { type: 'set' as const, include: ['a'] };
    grid.kernel.dispatch({ type: 'filter.column', column: 'id', filter: mine }, 'user');
    unlink();
    expect(grid.kernel.query.filter['id']).toEqual(mine);
  });

  it('review 7: the range told once a gesture rests, and a chart zoomed before the link filters at once', async () => {
    const { c, grid } = mount();
    c.setRange({ min: 1, max: 2 });
    await new Promise((r) => setTimeout(r, 600));
    let filters = 0;
    const off = grid.kernel.subscribe((e) => void (e.type === 'filterChanged' && filters++));
    made.push(linkGrid(c, grid, { filter: { column: 'x', by: 'range' } }));
    expect(grid.kernel.query.filter['x']).toEqual({ type: 'number', op: 'between', value: 0.5, valueTo: 2.5 });
    c.setRange({ min: 0, max: 2 });
    await new Promise((r) => setTimeout(r, 600));
    // The link's first filter, then one for the move: not one per frame of it.
    expect(filters).toBe(2);
    off();
  });
});

