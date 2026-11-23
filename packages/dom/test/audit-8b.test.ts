// Rules of the sheets the Phase 8b audit found without a test (docs/phase-8-steps/plan.md), in a real browser. By hand.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { allTypes } from '@dzgraph/core';
import { aggregation, chart, compare, crosshair, drilldown, exporting, linkCharts, measure, navigatorStrip, selection, timeAxis, zoom, type Chart, type Feature } from '@dzgraph/dom';
import { sparkline } from '@dzgraph/dom/sparkline';

const made: { el: HTMLElement; c: Chart }[] = [];
const extra: (() => void)[] = [];
function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = [zoom, crosshair, selection, measure, drilldown]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
  extra.splice(0).forEach((f) => f());
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function point(svg: SVGSVGElement, type: string, x: number, y: number, init: PointerEventInit = {}) {
  const box = svg.getBoundingClientRect();
  const all = { clientX: box.left + x, clientY: box.top + y, pointerType: 'mouse', bubbles: true, isPrimary: true, button: 0, pointerId: 1, ...init };
  svg.dispatchEvent(type === 'click' ? new MouseEvent('click', all) : new PointerEvent(type, all));
}
/** The centre of the i-th mark, in the svg's own pixels. */
function at(el: HTMLElement, svg: SVGSVGElement, i: number) {
  const box = svg.getBoundingClientRect();
  const r = [...el.querySelectorAll<SVGElement>('.dzgraph-point')][i]!.getBoundingClientRect();
  return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
}
const key = (k: string) => (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const focused = () => (document.activeElement as Element).getAttribute('aria-label') ?? '';
const tooltip = (el: HTMLElement) => el.querySelector<HTMLElement>('.dzgraph-tooltip')!;

const FRUIT = {
  title: 'Orchard',
  selection: true,
  xAxis: { scale: 'category' as const, categories: ['Apples', 'Pears'] },
  series: [
    { type: 'column' as const, id: 'f', name: 'Fruit', data: { y: [5, 3], key: ['apples', 'pears'] }, drilldown: { details: { apples: [{ type: 'column' as const, id: 'v', name: 'Apples', data: [['Gala', 2], ['Reinette', 3]] as [string, number][] }] } } },
    { type: 'column' as const, id: 'g', name: 'Other', data: { y: [1, 1], key: ['apples', 'pears'] } },
  ],
};
const enterOn = (el: HTMLElement, i: number) => {
  [...el.querySelectorAll<SVGElement>('.dzgraph-point')][i]!.focus();
  key('Enter');
};

describe('drilldown (drilldown.md 5, 8; linked-charts.md 4)', () => {
  it('5: going up restores the level as it was — its range, hidden series, selection', async () => {
    const { el, c } = mount(FRUIT);
    c.setRange({ min: 0, max: 1 });
    c.setSeriesVisible('g', false);
    c.selectBy('key', ['pears']);
    await raf2();
    const before = c.getView();
    enterOn(el, 0);
    await raf2();
    expect(c.getView().drill).toEqual(['apples']);
    el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    key('Backspace');
    await raf2();
    const after = c.getView();
    expect([after.range, after.hidden, after.selection]).toEqual([before.range, before.hidden, before.selection]);
  });

  it('8 / linked 4: in a link group with `drill`, going down and up in one does the same in the other', async () => {
    const a = mount(FRUIT);
    const b = mount(FRUIT);
    linkCharts([a.c, b.c], { drill: true });
    enterOn(a.el, 0);
    await raf2();
    expect(b.c.getView().drill).toEqual(['apples']);
    a.el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    key('Backspace');
    await raf2();
    expect(b.c.getView().drill ?? []).toEqual([]);
  });
});

describe('linked charts (linked-charts.md 6)', () => {
  it('a chart destroyed leaves its group: the others go on linking', async () => {
    const LINE = (id: string) => ({ series: [{ type: 'line' as const, id, data: [1, 3, 2, 5, 4] }] });
    const a = mount(LINE('a'));
    const b = mount(LINE('b'));
    const c = mount(LINE('c'));
    linkCharts([a.c, b.c, c.c], { zoom: 'x' });
    a.c.destroy();
    b.c.setRange({ min: 1, max: 3 });
    await raf2();
    expect(c.c.getView().range).toEqual({ min: 1, max: 3 });
  });
});

describe('columns (columns-bars.md 5)', () => {
  it('a hidden series gives its room back: the other column takes the band', async () => {
    const { el, c } = mount({ series: [{ type: 'column', id: 'a', data: [1, 2] }, { type: 'column', id: 'b', data: [2, 1] }] });
    await raf2();
    // The drawn column (`.dzgraph-point` is its 8 px focus target).
    const width = () => el.querySelector<SVGGraphicsElement>('[data-layer="series"] path')!.getBoundingClientRect().width;
    const shared = width();
    c.setSeriesVisible('b', false);
    await raf2();
    expect(width()).toBeGreaterThan(shared * 1.5);
  });
});

describe('the keyboard across a pile and across types (stacking.md 15, combined.md 8)', () => {
  it('stacking 15: ↑ and ↓ move between the segments of a pile, as drawn', async () => {
    const { el } = mount({ series: [{ type: 'column', id: 'a', name: 'Low', stack: true, data: [1, 2] }, { type: 'column', id: 'b', name: 'High', stack: true, data: [3, 4] }] });
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    expect(focused()).toContain('Low');
    key('ArrowUp');
    expect(focused()).toContain('High');
    key('ArrowDown');
    expect(focused()).toContain('Low');
  });

  it('combined 8: ↑ and ↓ move between a column and a line at the same x, by value on screen', async () => {
    const { el } = mount({ series: [{ type: 'column', id: 'a', name: 'Rain', data: [2, 2] }, { type: 'line', id: 'b', name: 'Heat', data: [8, 8] }] });
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    expect(focused()).toContain('Rain');
    key('ArrowUp');
    expect(focused()).toContain('Heat');
  });
});

describe('hover on a combined chart (combined.md 7, hover-tooltip.md 12)', () => {
  it('on a column, or in its band: its own tooltip; where no column stands: the lines\' shared one', async () => {
    const { el, svg } = mount({ xAxis: { scale: 'category', categories: ['Mon', 'Tue'] }, series: [{ type: 'column', id: 'a', name: 'Rain', data: [2, null] }, { type: 'line', id: 'b', name: 'Heat', data: [8, 8] }, { type: 'line', id: 'c', name: 'Wind', data: [5, 5] }] });
    await raf2();
    const box = svg.getBoundingClientRect();
    const col = el.querySelector('[data-layer="series"] path')!.getBoundingClientRect();
    const x = col.left - box.left + col.width / 2;
    point(svg, 'pointermove', x, col.top - box.top + col.height / 2);
    expect(tooltip(el).hidden).toBe(false);
    expect(tooltip(el).textContent).toContain('Rain');
    expect(tooltip(el).textContent).not.toContain('Wind');
    // Tuesday has no column: the lines' shared tooltip.
    point(svg, 'pointermove', box.width - (x - 0), col.top - box.top);
    expect(tooltip(el).textContent).toContain('Heat');
    expect(tooltip(el).textContent).toContain('Wind');
    expect(tooltip(el).textContent).not.toContain('Rain');
  });
});

describe('the legend and selection (legend-interaction.md 4, selection.md 11)', () => {
  it('legend 4: hiding every series is allowed; the plot says there is nothing to show', async () => {
    const { el } = mount({ series: [{ type: 'line', id: 'a', name: 'A', data: [1, 2] }, { type: 'line', id: 'b', name: 'B', data: [2, 1] }] });
    await raf2();
    for (const b of el.querySelectorAll<SVGElement>('.dzgraph-legend-button')) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await raf2();
    expect(el.querySelectorAll('.dzgraph-point')).toHaveLength(0);
    expect(el.querySelector('svg')!.textContent).toContain('No data');
  });

  it('selection 11: a hidden series\' points are left out of a gesture', async () => {
    // Axes wider than the data, so a rectangle can start inside the plot and still hold every point.
    const { el, c, svg } = mount({ selection: true, xAxis: { min: 0, max: 3 }, yAxis: { min: 0, max: 3 }, series: [{ type: 'scatter', id: 'a', data: [[1, 1], [2, 2]] }, { type: 'scatter', id: 'b', data: [[1, 1.2], [2, 2.2]] }] });
    c.setSeriesVisible('b', false);
    c.setMode('selection');
    await raf2();
    const p = at(el, svg, 0);
    const q = at(el, svg, 1);
    point(svg, 'pointerdown', p.x - 20, p.y + 20);
    point(svg, 'pointermove', q.x + 20, q.y - 50);
    point(svg, 'pointerup', q.x + 20, q.y - 50);
    await raf2();
    expect(c.getView().selection).toEqual({ a: [0, 1] });
  });
});

describe('the crosshair stays in the other modes (crosshair.md 8)', () => {
  it('in measure and selection modes the lines still follow the pointer', async () => {
    const { c, svg } = mount({ crosshair: true, selection: true, series: [{ type: 'line', id: 'a', data: [1, 3, 2, 5, 4] }] });
    for (const mode of ['measure', 'selection'] as const) {
      c.setMode(mode);
      await raf2();
      const box = svg.getBoundingClientRect();
      point(svg, 'pointermove', box.width / 2, box.height / 2);
      expect(svg.querySelector('.dzgraph-crosshair-layer line')).not.toBeNull();
      svg.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true }));
    }
  });
});

describe('touch (crosshair.md 6, measure.md 6, zoom-pan.md 4)', () => {
  const touch = (svg: SVGSVGElement, type: string, x: number, y: number, id = 1) => point(svg, type, x, y, { pointerType: 'touch', pointerId: id, isPrimary: id === 1 });

  it('crosshair 6: the lines follow the finger while it is down', async () => {
    const { svg } = mount({ crosshair: true, series: [{ type: 'line', id: 'a', data: [1, 3, 2, 5, 4] }] });
    await raf2();
    const box = svg.getBoundingClientRect();
    touch(svg, 'pointerdown', box.width / 3, box.height / 2);
    touch(svg, 'pointermove', box.width / 2, box.height / 2);
    expect(svg.querySelector('.dzgraph-crosshair-layer line')).not.toBeNull();
    touch(svg, 'pointerup', box.width / 2, box.height / 2);
  });

  it('measure 6: in measure mode a finger\'s slide measures', async () => {
    const { el, c, svg } = mount({ series: [{ type: 'line', id: 'a', data: [1, 3, 2, 5, 4] }] });
    c.setMode('measure');
    await raf2();
    const seen: unknown[] = [];
    c.on('measure', (m) => seen.push(m));
    const p = at(el, svg, 1);
    const q = at(el, svg, 3);
    touch(svg, 'pointerdown', p.x, p.y);
    touch(svg, 'pointermove', (p.x + q.x) / 2, (p.y + q.y) / 2);
    touch(svg, 'pointermove', q.x, q.y);
    touch(svg, 'pointerup', q.x, q.y);
    await raf2();
    expect(seen.at(-1)).toEqual({ from: { seriesId: 'a', index: 1 }, to: { seriesId: 'a', index: 3 } });
  });

  it('zoom-pan 4: once zoomed, a one-finger slide across moves the range', async () => {
    const { c, svg } = mount({ series: [{ type: 'line', id: 'a', data: [1, 3, 2, 5, 4, 6, 2, 3, 4] }] });
    c.setRange({ min: 2, max: 5 });
    await raf2();
    const box = svg.getBoundingClientRect();
    touch(svg, 'pointerdown', box.width / 2, box.height / 2);
    for (let k = 1; k <= 5; k++) touch(svg, 'pointermove', box.width / 2 - k * 30, box.height / 2);
    touch(svg, 'pointerup', box.width / 2 - 150, box.height / 2);
    await raf2();
    const r = c.getView().range!;
    expect(r.min).toBeGreaterThan(2);
    expect(r.max - r.min).toBeCloseTo(3, 5);
  });
});

describe('animation (animation.md 4, 5)', () => {
  const height = (el: HTMLElement) => el.querySelector<SVGGraphicsElement>('.dzgraph-point')!.getBoundingClientRect().height;

  it('4: a resize is drawn at once, not animated', async () => {
    const { el } = mount({ animation: true, series: [{ type: 'column', id: 'a', data: [2, 4] }], yAxis: { max: 4 } });
    await wait(600);
    el.style.blockSize = '200px';
    await raf2();
    await raf2();
    const first = height(el);
    await wait(500);
    expect(height(el)).toBeCloseTo(first, 0);
  });

  it('5: prefers-reduced-motion — the end state at once', async () => {
    await commands.reducedMotion(true);
    extra.push(() => void commands.reducedMotion(false));
    const { el, svg } = mount({ animation: true, series: [{ type: 'line', data: [1, 3, 2] }] });
    expect(Number(svg.querySelector('defs clipPath rect')?.getAttribute('width') ?? 1e9)).toBeGreaterThan(500);
    void el;
  });
});

describe('sparkline, print, export (sparkline.md 11, print.md 5, export.md 10)', () => {
  it('sparkline 11: no tooltip, no keyboard stop, no animation', async () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'inline-size:120px;block-size:30px');
    document.body.appendChild(el);
    const s = sparkline(el, [1, 4, 2, 5], { label: 'Visits' });
    extra.push(() => (s.destroy(), el.remove()));
    el.querySelector('svg')!.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 15, bubbles: true }));
    await raf2();
    expect(el.querySelectorAll('[tabindex], [role="tooltip"], .dzgraph-tooltip')).toHaveLength(0);
    expect(el.querySelectorAll('animate, animateTransform, [style*="transition"], [style*="animation"]')).toHaveLength(0);
  });

  it('print 5: without the module, print() does nothing and reports missing-module', async () => {
    const { c } = mount({ series: [{ type: 'line', data: [1, 2] }] }, []);
    c.print();
    // Reported with the next drawing, as the other exports (ADR 0006).
    await raf2();
    expect(c.problems).toContainEqual(expect.objectContaining({ code: 'missing-module', path: 'exporting' }));
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('export 10: a chart with nothing to draw exports its title and « no data »', async () => {
    const { c } = mount({ title: { text: 'Empty (made up)' }, series: [] }, [exporting]);
    const svg = c.exportSvg()!;
    expect(svg).toContain('Empty (made up)');
    expect(svg).toContain('No data');
  });
});

describe('a font arriving late (layout.md 7)', () => {
  it('the chart lays out once more when it is there: as a chart made after it', async () => {
    // The font's arrival is ours to time: until then the page says it is not there, and its load waits.
    const family = `DzLate${Date.now()}`;
    const font = `80px ${family}`;
    let arrive!: () => void;
    const arrived = new Promise<void>((r) => (arrive = r));
    const check = vi.spyOn(document.fonts, 'check').mockReturnValue(false);
    const load = vi.spyOn(document.fonts, 'load').mockImplementation(async () => (await arrived, []));
    extra.push(() => (check.mockRestore(), load.mockRestore()));
    /** A chart whose title is in that font from the start (the theme's variable read when it is made). */
    const make = () => {
      const el = document.createElement('div');
      el.setAttribute('style', `inline-size:600px;block-size:400px;--dzgraph-font-title:${font}`);
      document.body.appendChild(el);
      const c = chart(el, { animation: false, title: { text: 'Harvest (made up)' }, series: [{ type: 'line', data: [1, 3, 2] }] }, { types: allTypes });
      made.push({ el, c });
      return el.querySelector('svg')!;
    };
    // The line's path: the plot under the title moves with the title's measured height.
    const grid = (svg: SVGSVGElement) => svg.querySelector('[data-layer="series"] path')?.getAttribute('d') ?? null;
    const early = make();
    await raf2();
    const before = grid(early);
    // It arrives: a sans-serif, whose measures differ from the fallback's (a serif).
    const face = new FontFace(family, "local('Arial'), local('Helvetica'), local('DejaVu Sans')");
    await face.load();
    document.fonts.add(face);
    extra.push(() => void document.fonts.delete(face));
    check.mockRestore();
    arrive();
    await raf2();
    await raf2();
    const late = make();
    await raf2();
    expect(before).not.toEqual(grid(late));
    expect(grid(early)).toEqual(grid(late));
  });
});

describe('aggregation with piles and comparison (aggregation.md 6)', () => {
  const D = (m: number, d: number) => Date.UTC(2026, m - 1, d);
  const days = (id: string, k: number) => ({ type: 'column' as const, id, stack: true, data: [[D(1, 5), k], [D(1, 20), 2 * k], [D(2, 3), 4 * k]] as [number, number][] });

  it('stacked series aggregate before they stack: the pile is the sum of the sums', async () => {
    const { el, c } = mount({ xAxis: { scale: 'time', zone: 'UTC' }, series: [days('a', 1), days('b', 2)] }, [timeAxis, aggregation]);
    c.setView({ aggregation: { period: 'month' } });
    await raf2();
    // January: a 3, b 6 — a pile of 9 (stacked by day first, the highest pile would be 6).
    const ticks = [...el.querySelectorAll('svg text')].map((t) => Number(t.textContent)).filter((n) => Number.isFinite(n));
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(9);
  });

  it('a comparison compares the aggregated values', async () => {
    const { el, c } = mount({ dataTable: true, xAxis: { scale: 'time', zone: 'UTC' }, yAxis: { compare: 'percent' }, series: [{ ...days('a', 1), stack: undefined }] }, [timeAxis, aggregation, compare]);
    c.setView({ aggregation: { period: 'month' } });
    await raf2();
    // January's sum 3, February's 4: +33 %.
    const feb = [...el.querySelectorAll('.dzgraph-table tbody tr')][1]!;
    expect([...feb.children].map((x) => x.textContent)).toEqual(['February 2026', '4', expect.stringMatching(/^\+33/)]);
  });
});

describe('comparison (compare.md 8, 10)', () => {
  const OPTIONS = { navigator: true, xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'line' as const, id: 'a', data: [[Date.UTC(2026, 0, 1), 10], [Date.UTC(2026, 0, 2), 20], [Date.UTC(2026, 0, 3), 15]] as [number, number][] }] };
  const navPath = (el: HTMLElement) => el.querySelector('[data-layer="navigator"] path')?.getAttribute('d');

  it('8: the navigator shows the raw data, compared or not', async () => {
    const raw = mount(OPTIONS, [timeAxis, zoom, navigatorStrip, compare]);
    const compared = mount({ ...OPTIONS, yAxis: { compare: 'percent' } }, [timeAxis, zoom, navigatorStrip, compare]);
    await raf2();
    // The heights, not the x: wider labels (« +100% ») move the plot, and the strip with it.
    const ys = (d: string | null | undefined) => (d ?? '').split(/[ML]/).filter(Boolean).map((p) => p.split(' ')[1]);
    expect(ys(navPath(raw.el))).toHaveLength(3);
    expect(ys(navPath(compared.el))).toEqual(ys(navPath(raw.el)));
  });

  it('10: changing the comparison animates as an update', async () => {
    const { el, c } = mount({ ...OPTIONS, navigator: false, animation: true }, [timeAxis, compare]);
    await wait(600);
    const line = () => el.querySelector('[data-layer="series"] path')!.getAttribute('d');
    const before = line();
    c.update({ yAxis: { compare: 'percent' } });
    await raf2();
    await raf2();
    const during = line();
    await wait(600);
    const after = line();
    expect(after).not.toBe(before);
    expect(during).not.toBe(after);
  });
});

describe('the crosshair and screen readers (crosshair.md 9)', () => {
  it('nothing more is said while the lines follow the pointer', async () => {
    const { el, svg } = mount({ crosshair: true, series: [{ type: 'line', id: 'a', data: [1, 3, 2, 5, 4] }] });
    await raf2();
    const said = () => [...el.querySelectorAll('[aria-live]')].map((n) => n.textContent);
    const before = said();
    const box = svg.getBoundingClientRect();
    for (const f of [0.3, 0.5, 0.7]) point(svg, 'pointermove', box.width * f, box.height / 2);
    await wait(300);
    expect(svg.querySelector('.dzgraph-crosshair-layer line')).not.toBeNull();
    expect(said()).toEqual(before);
  });
});

describe('review (Phase 8b close)', () => {
  it('review 1: columns alone answer anywhere in their band, even across a wide gap (hover-tooltip.md 2, 3)', async () => {
    const { el, svg } = mount({ xAxis: { scale: 'category', categories: ['Mon', 'Tue'] }, series: [{ type: 'column', id: 'a', name: 'Rain', data: [2, 3] }] });
    el.style.inlineSize = '1200px';
    await raf2();
    await raf2();
    const box = svg.getBoundingClientRect();
    const [m, t] = [...el.querySelectorAll('[data-layer="series"] path')].map((p) => p.getBoundingClientRect());
    const gap = t!.left - m!.right;
    expect(gap).toBeGreaterThan(48);
    point(svg, 'pointermove', (m!.right + t!.left) / 2 - box.left, m!.top - box.top + m!.height / 2);
    expect(tooltip(el).hidden).toBe(false);
    expect(tooltip(el).textContent).toContain('Rain');
  });

  it('review 2: a pie with every slice hidden says there is nothing to show (legend-interaction.md 4)', async () => {
    const { el, c } = mount({ series: [{ type: 'pie', id: 'p', data: [['Apples', 3], ['Pears', 2]] }] });
    // As the legend hides slices, when it shows (pie-donut.md): by their index in the view.
    c.setView({ hiddenPoints: { p: [0, 1] } });
    await raf2();
    expect(el.querySelector('svg')!.textContent).toContain('No data');
  });
});
