// Drilldown in a real browser (drilldown.md): a detail by key or loaded, the breadcrumb, going up, the view, time.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { aggregation, chart, drilldown, timeAxis, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, dataTable: true, ...options }, { types: allTypes, features: [timeAxis, aggregation, drilldown] });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const rows = (el: HTMLElement) => [...el.querySelectorAll('.dzgraph-table tbody tr')].map((r) => [...r.children].map((x) => x.textContent));
const crumbs = (el: HTMLElement) => [...el.querySelectorAll('.dzgraph-breadcrumb li')].map((li) => [li.textContent, li.querySelector('button') !== null]);
const enterOn = (el: HTMLElement, i: number) => {
  const item = [...el.querySelectorAll<SVGElement>('.dzgraph-point')][i]!;
  item.focus();
  item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

const FRUIT = {
  title: 'Orchard',
  xAxis: { scale: 'category' as const, categories: ['Apples', 'Pears'] },
  series: [{ type: 'column' as const, id: 'f', name: 'Fruit', data: { y: [5, 3], key: ['apples', 'pears'] }, drilldown: { details: { apples: [{ type: 'column' as const, id: 'v', name: 'Apples', data: [['Gala', 2], ['Reinette', 3]] as [string, number][] }] } } }],
};

describe('a detail by key (drilldown.md 1, 2, 4, 7)', () => {
  it('Enter on Apples shows its varieties; the breadcrumb; the view; the event; Backspace goes up', async () => {
    const { el, c } = mount(FRUIT);
    const seen: unknown[] = [];
    c.on('drill', (d) => seen.push(d.path));
    expect([...el.querySelectorAll('.dzgraph-point')][0]!.getAttribute('aria-label')).toContain('detail available');
    enterOn(el, 0);
    await raf2();
    expect(rows(el)).toEqual([['Gala', '2'], ['Reinette', '3']]);
    expect(crumbs(el)).toEqual([['Orchard', true], ['Apples', false]]);
    expect(c.getView().drill).toEqual(['apples']);
    expect(seen).toEqual([['apples']]);
    el.querySelector<HTMLElement>('.dzgraph-point')!.focus();
    (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await raf2();
    expect(rows(el)).toEqual([['Apples', '5'], ['Pears', '3']]);
    expect(el.querySelector('.dzgraph-breadcrumb')!.hasAttribute('hidden')).toBe(true);
    expect(seen.at(-1)).toEqual([]);
  });

  it('a point without a detail does nothing; setView goes down', async () => {
    const { el, c } = mount(FRUIT);
    enterOn(el, 1);
    await raf2();
    expect(c.getView().drill).toEqual([]);
    c.setView({ drill: ['apples'] });
    await raf2();
    expect(rows(el)).toEqual([['Gala', '2'], ['Reinette', '3']]);
  });
});

describe('a detail loaded (drilldown.md 3)', () => {
  it('loading said, then shown; a failure says so and offers to try again', async () => {
    let fail = true;
    const load = () => (fail ? Promise.reject(new Error('down')) : Promise.resolve([{ type: 'column' as const, data: [['Gala', 2]] as [string, number][] }]));
    const { el } = mount({ ...FRUIT, series: [{ ...FRUIT.series[0]!, drilldown: { load } }] });
    enterOn(el, 0);
    expect([...el.querySelectorAll('[aria-live]')].some((n) => n.textContent === 'Loading…')).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    const retry = el.querySelector<HTMLButtonElement>('.dzgraph-breadcrumb .dzgraph-retry')!;
    expect(retry.textContent).toBe('Try again');
    fail = false;
    retry.click();
    await new Promise((r) => setTimeout(r, 20));
    await raf2();
    expect(rows(el)).toEqual([['Gala', '2']]);
  });
});

describe('time, automatic (drilldown.md 6)', () => {
  it('years, then the months of the year chosen', async () => {
    const day = 86_400_000;
    const start = Date.UTC(2025, 0, 1);
    const data = Array.from({ length: 730 }, (_, i) => [start + i * day, 1] as [number, number]);
    const { el, c } = mount({ drilldown: 'time', xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'column', data }] });
    expect(rows(el).map((r) => r[0])).toEqual(['2025', '2026']);
    enterOn(el, 1);
    await raf2();
    expect(rows(el)).toHaveLength(12);
    expect(rows(el)[0]).toEqual(['January 2026', '31']);
    expect(c.getView().aggregation).toEqual({ period: 'month' });
  });
});

describe('time, from the axis\'s own period (drilldown.md 6, Phase 9)', () => {
  it('an axis by months starts at the months, a month drills into its days', async () => {
    const day = 86_400_000;
    const start = Date.UTC(2025, 0, 1);
    const data = Array.from({ length: 730 }, (_, i) => [start + i * day, 1] as [number, number]);
    const { el, c } = mount({ drilldown: 'time', xAxis: { scale: 'time', zone: 'UTC', aggregate: 'month' }, series: [{ type: 'column', data }] });
    expect(rows(el)).toHaveLength(24);
    expect(rows(el)[1]).toEqual(['February 2025', '28']);
    enterOn(el, 1);
    await raf2();
    expect(rows(el)).toHaveLength(28);
    expect(c.getView().aggregation).toEqual({ period: 'day' });
  });

  it('an axis by days, finer than the drill knows: it starts at the years', () => {
    const day = 86_400_000;
    const data = Array.from({ length: 730 }, (_, i) => [Date.UTC(2025, 0, 1) + i * day, 1] as [number, number]);
    const { el } = mount({ drilldown: 'time', xAxis: { scale: 'time', zone: 'UTC', aggregate: 'day' }, series: [{ type: 'column', data }] });
    expect(rows(el).map((r) => r[0])).toEqual(['2025', '2026']);
  });
});

describe('time, a year the data only begin (drilldown.md 6, found by the site\'s demo)', () => {
  it('the level shows the whole year, not a year of data moved back to fit', async () => {
    const day = 86_400_000;
    const start = Date.UTC(2025, 0, 1);
    // From 1 January 2025 to 4 February 2026: 2026 holds a month and a few days.
    const data = Array.from({ length: 400 }, (_, i) => [start + i * day, 1] as [number, number]);
    const { el, c } = mount({ drilldown: 'time', xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'column', data }] });
    enterOn(el, 1);
    await raf2();
    // The year's last instant ends it: 1 January 2027 belongs to the next year.
    expect(c.getView().range).toEqual({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 0, 1) - 1 });
    expect(rows(el).map((r) => r[0])).toEqual(['January 2026', 'February 2026']);
  });
});

describe('a slice with a detail, selectable too (drilldown.md 2, selection.md 12)', () => {
  it('a click drills, it does not select', async () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'inline-size:600px;block-size:400px');
    document.body.appendChild(el);
    const { selection } = await import('@dzgraph/dom');
    const c = chart(el, { animation: false, selection: true, series: [{ type: 'pie', id: 'p', data: [{ name: 'A', y: 3, key: 'a' }, { name: 'B', y: 1, key: 'b' }], drilldown: { details: { a: [{ type: 'pie', data: [1, 2] }] } } }] }, { types: allTypes, features: [drilldown, selection] });
    made.push({ el, c });
    const svg = el.querySelector('svg')!;
    const box = svg.getBoundingClientRect();
    const told: number[] = [];
    c.on('selectionChange', (d) => told.push(d.count));
    const r = el.querySelector<SVGElement>('.dzgraph-point')!.getBoundingClientRect();
    for (const type of ['pointerdown', 'pointerup', 'click']) svg.dispatchEvent(new (type === 'click' ? MouseEvent : PointerEvent)(type, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, button: 0, pointerId: 1, pointerType: 'mouse' }));
    await raf2();
    expect([c.getView().drill, c.getView().selection, told]).toEqual([['a'], {}, []]);
    void box;
  });
});
