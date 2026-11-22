// The Phase 5b code review (2026-11-22): each finding as a test that failed first. In a real browser.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { aggregation, chart, drilldown, menu, selection, timeAxis, zoom, type Chart, type Feature } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = [timeAxis, zoom, aggregation, drilldown, menu, selection]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, dataTable: true, ...options }, { types: allTypes, features });
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
const day = 86_400_000;
const TWO_YEARS = { drilldown: 'time' as const, xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'column' as const, id: 'c', data: Array.from({ length: 730 }, (_, i) => [Date.UTC(2025, 0, 1) + i * day, 1] as [number, number]) }] };

describe('review 1, 3, 10: a drill path given back', () => {
  it('two levels deep, by keys that do not depend on the language; the range given with it kept; the events after the level is read', async () => {
    const { el, c } = mount(TWO_YEARS);
    const enter = (i: number) => {
      const item = [...el.querySelectorAll<SVGElement>('.dzgraph-point')][i]!;
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    enter(1);
    await raf2();
    let seen: unknown = null;
    c.on('drill', () => (seen = c.getView().aggregation));
    // March 2026, by its name (the level's range shows 2026; the keyboard walks every month).
    const march = [...el.querySelectorAll<SVGElement>('.dzgraph-point')].findIndex((p) => p.getAttribute('aria-label')!.includes('March 2026'));
    enter(march);
    await raf2();
    const path = c.getView().drill!;
    // Keys are the periods' starts, not their names in a language.
    expect(path).toEqual([String(Date.UTC(2026, 0, 1)), String(Date.UTC(2026, 2, 1))]);
    // The event came once the level was read: the view already says « by day ».
    expect(seen).toEqual({ period: 'day' });
    const b = mount(TWO_YEARS);
    const range = { min: Date.UTC(2026, 2, 5), max: Date.UTC(2026, 2, 10) };
    b.c.setView({ drill: path, range });
    await raf2();
    expect([b.c.getView().drill, b.c.getView().range, rows(b.el)[0]![0]]).toEqual([path, range, 'Mar 5, 2026']);
  });

  it('a path not there: reported, not silent', async () => {
    const { c } = mount(TWO_YEARS);
    let problems: readonly unknown[] = [];
    c.on('problems', (d) => (problems = d.problems));
    c.setView({ drill: ['nope'] });
    await raf2();
    expect(problems).toContainEqual({ code: 'invalid-view', path: 'view.drill[0]' });
  });
});

describe('review 2: the selection follows a change of aggregation', () => {
  it('a month selected, then by year: the year shows selected, the count right', async () => {
    const { el, c } = mount({ ...TWO_YEARS, drilldown: undefined });
    c.setView({ aggregation: { period: 'month' }, selection: { c: [400] } });
    await raf2();
    c.setView({ aggregation: { period: 'year' } });
    await raf2();
    expect(el.querySelector('[id$="-summary"]')!.textContent).toContain('1 point selected');
    expect([...el.querySelectorAll('.dzgraph-point')].filter((p) => p.getAttribute('aria-label')!.includes('selected'))).toHaveLength(1);
  });
});

describe('review 4: a load that comes back after the user went elsewhere', () => {
  it('is dropped: the level the user chose meanwhile stays', async () => {
    let resolve: (v: unknown) => void = () => {};
    const load = () => new Promise((r) => (resolve = r));
    const { el, c } = mount(
      {
        title: 'T',
        xAxis: { scale: 'category', categories: ['A', 'B'] },
        series: [
          // `as never`: the test's load resolves when it chooses, typed loosely on purpose.
          { type: 'column', id: 's', data: { y: [1, 0], key: ['a', 'x'] }, drilldown: { load: load as never } },
          { type: 'column', id: 't', data: { y: [0, 2], key: ['y', 'b'] }, drilldown: { details: { b: [{ type: 'column', data: [5] }] } } },
        ],
      },
      [drilldown],
    );
    const enter = (series: number, i: number) => {
      const item = [...el.querySelectorAll<SVGElement>('.dzgraph-point')].find((p) => p.getAttribute('aria-label')!.startsWith(`Series ${series}`) && p.getAttribute('aria-label')!.includes(i === 0 ? 'A:' : 'B:'))!;
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    enter(1, 0);
    enter(2, 1);
    await raf2();
    expect(c.getView().drill).toEqual(['b']);
    // The app's function resolves, too late. `as never`: a detail of the app's own shape.
    resolve([{ type: 'column', data: [9] }] as never);
    await new Promise((r) => setTimeout(r, 10));
    await raf2();
    expect(c.getView().drill).toEqual(['b']);
  });
});

describe('review 5: the breadcrumb keeps the keyboard', () => {
  it('a level chosen from the breadcrumb: the focus on the chart\'s points, not on the page', async () => {
    const { el } = mount(TWO_YEARS);
    const item = [...el.querySelectorAll<SVGElement>('.dzgraph-point')][1]!;
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await raf2();
    const link = el.querySelector<HTMLButtonElement>('.dzgraph-breadcrumb button')!;
    link.focus();
    link.click();
    await raf2();
    expect(document.activeElement?.classList.contains('dzgraph-point')).toBe(true);
  });
});

describe('review 8: a view\'s type or scale the menu would not offer', () => {
  it('reported and left out', async () => {
    const { c } = mount({ menu: true, series: [{ type: 'line', id: 'l', data: [0, 1] }] });
    let problems: readonly unknown[] = [];
    c.on('problems', (d) => (problems = d.problems));
    c.setView({ types: { l: 'pie' }, scale: 'log' });
    await raf2();
    expect(problems).toEqual(expect.arrayContaining([{ code: 'invalid-view', path: 'view.types.l' }, { code: 'invalid-view', path: 'view.scale' }]));
    expect(c.getView().types).toBeUndefined();
  });
});

describe('review 9: the menu', () => {
  it('closes on a press outside it; with an automatic time drill it says « by year »', async () => {
    const { el } = mount({ ...TWO_YEARS, menu: true });
    const button = el.querySelector<HTMLButtonElement>('.dzgraph-menu-button')!;
    button.click();
    [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent === 'Aggregation')!.click();
    const checked = [...el.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')].map((i) => i.textContent);
    expect(checked).toEqual(['By year']);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
