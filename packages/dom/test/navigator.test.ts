// The navigator, the range buttons and the table's range in a real browser (navigator.md, range-buttons.md,
// data-table.md 5). Step 3.6.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { allFeatures, chart, type Chart, type ChartEvents } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const LINE = { navigator: true, series: [{ type: 'line' as const, id: 'a', data: Array.from({ length: 101 }, (_, i) => i % 7) }] };

function mount(options: Parameters<typeof chart>[1], attrs: Record<string, string> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features: allFeatures });
  made.push({ el, c });
  const ranges: ChartEvents['rangeChange'][] = [];
  c.on('rangeChange', (d) => ranges.push(d));
  return { el, c, svg: el.querySelector('svg')!, ranges };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

/** The strip's box in client pixels, from its drawn rect. */
function strip(svg: SVGSVGElement) {
  const r = svg.querySelector('[data-layer="navigator"] rect')!;
  const box = svg.getBoundingClientRect();
  const x = box.x + Number(r.getAttribute('x'));
  const w = Number(r.getAttribute('width'));
  return { x, w, y: box.y + Number(r.getAttribute('y')) + Number(r.getAttribute('height')) / 2, at: (v: number) => x + (v / 100) * w };
}
const ptr = (svg: SVGSVGElement, type: string, x: number, y: number) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }));
const near = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;

describe('the navigator with the pointer (navigator.md 3, 5)', () => {
  it('dragging a handle moves that end; dragging the window moves the range', async () => {
    const { c, svg, ranges } = mount(LINE);
    await frames();
    const s = strip(svg);
    // The end handle, at the strip's end, dragged to 60.
    ptr(svg, 'pointerdown', s.at(100) - 1, s.y);
    ptr(svg, 'pointermove', s.at(80), s.y);
    ptr(svg, 'pointermove', s.at(60), s.y);
    ptr(svg, 'pointerup', s.at(60), s.y);
    await frames();
    let r = ranges.at(-1)!.range!;
    expect(r.min).toBe(0);
    expect(near(r.max, 60)).toBe(true);
    // The window, grabbed at 30, dragged to 50: the range moves by 20.
    ptr(svg, 'pointerdown', s.at(30), s.y);
    ptr(svg, 'pointermove', s.at(40), s.y);
    ptr(svg, 'pointermove', s.at(50), s.y);
    ptr(svg, 'pointerup', s.at(50), s.y);
    await frames();
    r = ranges.at(-1)!.range!;
    expect(near(r.min, 20) && near(r.max, 80)).toBe(true);
    expect(c.problems).toEqual([]);
  });

  it('a click outside the window centres it there', async () => {
    const { c, svg, ranges } = mount(LINE);
    await frames();
    c.setRange({ min: 0, max: 20 });
    await frames();
    const s = strip(svg);
    ptr(svg, 'pointerdown', s.at(70), s.y);
    ptr(svg, 'pointerup', s.at(70), s.y);
    await frames();
    const r = ranges.at(-1)!.range!;
    expect(near(r.min, 60) && near(r.max, 80)).toBe(true);
  });

  it('zooming the chart moves the window (navigator.md 5)', async () => {
    const { c, svg } = mount(LINE);
    await frames();
    c.setRange({ min: 25, max: 50 });
    await frames();
    const handle = svg.querySelector('[data-layer="navigator"] [data-id$="handle/end"]') ?? [...svg.querySelectorAll('[data-layer="navigator"] rect')].at(-1)!;
    const s = strip(svg);
    const box = svg.getBoundingClientRect();
    const cx = box.x + Number(handle.getAttribute('x')) + Number(handle.getAttribute('width')) / 2;
    expect(near(cx, s.at(50))).toBe(true);
  });
});

describe('the navigator with the keyboard (navigator.md 4)', () => {
  it('two sliders, named and read with their values; arrows move them a hundredth, Page keys a tenth', async () => {
    const { el, ranges } = mount(LINE, { lang: 'fr' });
    await frames();
    const sliders = [...el.querySelectorAll<SVGElement>('[role="slider"]')];
    expect(sliders.map((s) => s.getAttribute('aria-label'))).toEqual(['Début de la plage', 'Fin de la plage']);
    expect([sliders[0]!.getAttribute('aria-valuetext'), sliders[1]!.getAttribute('aria-valuetext')]).toEqual(['0', '100']);
    sliders[1]!.focus();
    sliders[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    sliders[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }));
    await frames();
    expect(ranges.at(-1)!.range).toEqual({ min: 0, max: 89 });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Fin de la plage');
    expect(document.activeElement?.getAttribute('aria-valuetext')).toBe('89');
  });
});

describe('the range buttons (range-buttons.md)', () => {
  const day = 86_400_000;
  const TIME = { navigator: true, xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'line' as const, data: Array.from({ length: 100 }, (_, i) => [Date.UTC(2026, 0, 1) + i * day, i % 9] as [number, number]) }] };

  it('shown with the navigator on a time axis; a span too long is disabled; the one shown is pressed', async () => {
    const { el, ranges } = mount(TIME, { lang: 'fr' });
    await frames();
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.dzgraph-range-buttons button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['1 m', '3 m', 'Début d’année', '1 an', 'Tout']);
    expect(buttons.map((b) => b.disabled)).toEqual([false, false, false, true, false]);
    expect(buttons[4]!.getAttribute('aria-pressed')).toBe('true');
    buttons[0]!.click();
    await frames();
    // The last point is 10 April 2026: one month back, 10 March.
    expect(ranges.at(-1)!.range).toEqual({ min: Date.UTC(2026, 2, 10), max: Date.UTC(2026, 3, 10) });
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('none on a numeric axis unless asked', async () => {
    const { el } = mount(LINE);
    await frames();
    expect(el.querySelector('.dzgraph-range-buttons')?.hasAttribute('hidden') ?? true).toBe(true);
  });
});

describe('the table follows the range (data-table.md 5)', () => {
  it('rows in view, the range in its caption; a button shows all the data and back', async () => {
    const { el, c } = mount({ dataTable: true, series: [{ type: 'line', data: [5, 6, 7, 8, 9] }] });
    await frames();
    c.setRange({ min: 1, max: 3 });
    await frames();
    const rows = () => el.querySelectorAll('.dzgraph-table tbody tr').length;
    expect(rows()).toBe(3);
    expect(el.querySelector('.dzgraph-table caption')!.textContent).toContain('1 to 3');
    const toggle = el.querySelector<HTMLButtonElement>('.dzgraph-table-range')!;
    expect(toggle.textContent).toBe('Show all data');
    toggle.focus();
    toggle.click();
    expect(rows()).toBe(5);
    expect(document.activeElement?.textContent).toBe('Show the visible range');
  });
});
