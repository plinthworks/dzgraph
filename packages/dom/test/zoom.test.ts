// Zoom and pan in a real browser (zoom-pan.md): drag to zoom, Shift + drag to pan, Ctrl + wheel, pinch, keyboard,
// the reset button and `rangeChange`. Step 3.5. Gestures are dispatched as pointer and wheel events on the chart.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart, type ChartEvents } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function mount(options: Parameters<typeof chart>[1] = { series: [{ type: 'line', id: 'a', data: Array.from({ length: 101 }, (_, i) => i % 7) }] }) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  const ranges: ChartEvents['rangeChange'][] = [];
  c.on('rangeChange', (d) => ranges.push(d));
  const svg = el.querySelector('svg')!;
  return { el, c, svg, ranges };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

/** The plot's box in client pixels, from its background rect's scene area (the first gridline's ends would do too). */
function plotBox(svg: SVGSVGElement) {
  const grid = [...svg.parentElement!.querySelectorAll('svg')[1]!.querySelectorAll('[data-layer="grid"] line')];
  const xs = grid.flatMap((l) => [Number(l.getAttribute('x1')), Number(l.getAttribute('x2'))]);
  const box = svg.getBoundingClientRect();
  return { start: box.x + Math.min(...xs), end: box.x + Math.max(...xs), mid: box.y + box.height / 2 };
}

function pointer(svg: SVGSVGElement, type: string, x: number, y: number, extra: PointerEventInit = {}) {
  svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true, ...extra }));
}

function drag(svg: SVGSVGElement, from: number, to: number, y: number, extra: PointerEventInit = {}) {
  pointer(svg, 'pointerdown', from, y, extra);
  pointer(svg, 'pointermove', (from + to) / 2, y, extra);
  pointer(svg, 'pointermove', to, y, extra);
  pointer(svg, 'pointerup', to, y, extra);
}

const near = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;

describe('drag to zoom (zoom-pan.md 1, 9)', () => {
  it('a drag across a fifth of the plot zooms to it; rangeChange tells the bounds', async () => {
    const { svg, ranges } = mount();
    await frames();
    const p = plotBox(svg);
    const w = p.end - p.start;
    drag(svg, p.start + 0.2 * w, p.start + 0.4 * w, p.mid);
    await frames();
    expect(ranges.length).toBe(1);
    const r = ranges[0]!.range!;
    expect(near(r.min, 20) && near(r.max, 40)).toBe(true);
  });

  it('the band shows while dragging and goes on release', async () => {
    const { el, svg } = mount();
    await frames();
    const p = plotBox(svg);
    pointer(svg, 'pointerdown', p.start + 50, p.mid);
    pointer(svg, 'pointermove', p.start + 150, p.mid);
    expect(el.querySelector('.dzgraph-zoom-band')!.getAttribute('width')).toBe('100');
    pointer(svg, 'pointerup', p.start + 150, p.mid);
    expect(el.querySelector('.dzgraph-zoom-band')).toBeNull();
  });

  it('the click a drag ends with is not a click on a point (hover-tooltip.md 11)', async () => {
    const { c, svg } = mount({ series: [{ type: 'scatter', data: Array.from({ length: 50 }, (_, i) => [i, i % 5] as [number, number]) }] });
    await frames();
    const clicks: unknown[] = [];
    c.on('pointClick', (d) => clicks.push(d));
    const p = plotBox(svg);
    drag(svg, p.start + 100, p.start + 200, p.mid);
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.start + 200, clientY: p.mid }));
    expect(clicks).toEqual([]);
  });

  it('a move under 5 px is a click, not a zoom', async () => {
    const { svg, ranges } = mount();
    await frames();
    const p = plotBox(svg);
    drag(svg, p.start + 100, p.start + 103, p.mid);
    await frames();
    expect(ranges).toEqual([]);
  });

  it('the value axis fits the points in view (zoom-pan.md 6)', async () => {
    const { c, svg } = mount({ series: [{ type: 'line', id: 'a', data: Array.from({ length: 101 }, (_, i) => (i === 90 ? 1000 : i % 7)) }] });
    await frames();
    const top = () => Math.max(...[...svg.querySelectorAll('text')].map((t) => Number(t.textContent!.replace(/,/g, ''))).filter((n) => Number.isFinite(n)));
    expect(top()).toBeGreaterThanOrEqual(1000);
    const p = plotBox(svg);
    drag(svg, p.start + 0.1 * (p.end - p.start), p.start + 0.5 * (p.end - p.start), p.mid);
    await frames();
    expect(top()).toBeLessThan(100);
    expect(c.problems).toEqual([]);
  });
});

describe('pan, wheel, pinch (zoom-pan.md 2–5)', () => {
  it('Shift + drag moves the range, stopping at the data\'s end', async () => {
    const { svg, ranges } = mount();
    await frames();
    const p = plotBox(svg);
    const w = p.end - p.start;
    drag(svg, p.start + 0.2 * w, p.start + 0.4 * w, p.mid);
    await frames();
    // Dragging the content leftward by half the plot shows later values: +10.
    drag(svg, p.start + 0.6 * w, p.start + 0.1 * w, p.mid, { shiftKey: true });
    await frames();
    const r = ranges.at(-1)!.range!;
    expect(near(r.min, 30) && near(r.max, 50)).toBe(true);
    drag(svg, p.start + 0.9 * w, p.start, p.mid, { shiftKey: true });
    drag(svg, p.start + 0.9 * w, p.start, p.mid, { shiftKey: true });
    drag(svg, p.start + 0.9 * w, p.start, p.mid, { shiftKey: true });
    await frames();
    expect(ranges.at(-1)!.range!.max).toBe(100);
  });

  it('the wheel alone does not zoom; Ctrl + wheel zooms around the pointer', async () => {
    const { svg, ranges } = mount();
    await frames();
    const p = plotBox(svg);
    const x = p.start + 0.5 * (p.end - p.start);
    const plain = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: p.mid, deltaY: -100 });
    svg.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    const ctrl = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: p.mid, deltaY: -100, ctrlKey: true });
    svg.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    await frames();
    const r = ranges.at(-1)!.range!;
    expect(r.max - r.min).toBeLessThan(100);
    expect(near((r.min + r.max) / 2, 50, 0.5)).toBe(true);
  });

  it('pinching two fingers apart zooms in around their middle', async () => {
    const { svg, ranges } = mount();
    await frames();
    const p = plotBox(svg);
    const w = p.end - p.start;
    const touch = (type: string, id: number, x: number) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: p.mid, pointerId: id, pointerType: 'touch', isPrimary: id === 2 }));
    touch('pointerdown', 2, p.start + 0.4 * w);
    touch('pointerdown', 3, p.start + 0.6 * w);
    touch('pointermove', 2, p.start + 0.3 * w);
    touch('pointermove', 3, p.start + 0.7 * w);
    touch('pointerup', 2, p.start + 0.3 * w);
    touch('pointerup', 3, p.start + 0.7 * w);
    await frames();
    const r = ranges.at(-1)!.range!;
    expect(near(r.max - r.min, 50, 1)).toBe(true);
    expect(near((r.min + r.max) / 2, 50, 1)).toBe(true);
  });
});

describe('during a gesture (big-data.md 4)', () => {
  it('the table waits for the gesture to rest, then follows the range', async () => {
    const { el, svg } = mount({ dataTable: true, series: [{ type: 'line', id: 'a', data: Array.from({ length: 101 }, (_, i) => i % 7) }] });
    await frames();
    const rows = () => el.querySelectorAll('.dzgraph-table tbody tr').length;
    expect(rows()).toBe(101);
    const p = plotBox(svg);
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: (p.start + p.end) / 2, clientY: p.mid, deltaY: -300, ctrlKey: true }));
    await frames();
    expect(rows()).toBe(101);
    await new Promise((r) => setTimeout(r, 300));
    expect(rows()).toBeLessThan(101);
  });
});

describe('the reset button (zoom-pan.md 7)', () => {
  it('appears when zoomed, goes back to the whole, disappears; rangeChange null', async () => {
    const { el, svg, ranges } = mount();
    await frames();
    const button = () => el.querySelector<HTMLButtonElement>('.dzgraph-reset')!;
    expect(button().hidden).toBe(true);
    const p = plotBox(svg);
    drag(svg, p.start + 100, p.start + 200, p.mid);
    await frames();
    expect(button().hidden).toBe(false);
    expect(button().textContent).toBe('Reset zoom');
    button().click();
    await frames();
    expect(button().hidden).toBe(true);
    expect(ranges.at(-1)).toEqual({ range: null });
  });

  it('in French, and at the plot\'s end edge in either direction', async () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'inline-size:600px;block-size:400px');
    el.setAttribute('dir', 'rtl');
    el.setAttribute('lang', 'fr');
    document.body.appendChild(el);
    const c = chart(el, { animation: false, series: [{ type: 'line', data: Array.from({ length: 101 }, (_, i) => i % 7) }] }, { types: allTypes });
    made.push({ el, c });
    await frames();
    const svg = el.querySelector('svg')!;
    const p = plotBox(svg);
    drag(svg, p.start + 100, p.start + 200, p.mid);
    await frames();
    const b = el.querySelector<HTMLButtonElement>('.dzgraph-reset')!;
    expect(b.textContent).toBe('Réinitialiser le zoom');
    // Right to left, the end of the plot's top edge is its left side.
    expect(Math.abs(b.getBoundingClientRect().x - p.start)).toBeLessThan(40);
  });
});

describe('the keyboard (zoom-pan.md 8)', () => {
  const key = (el: Element, k: string, shiftKey = false) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));

  it('+ zooms around the focused point, Shift + → moves, 0 goes back; the focus stays on a point in view', async () => {
    const { el, ranges } = mount();
    await frames();
    const first = el.querySelector<SVGElement>('.dzgraph-point[tabindex="0"]')!;
    first.focus();
    for (let i = 0; i < 50; i++) key(document.activeElement!, 'ArrowRight');
    await frames();
    key(document.activeElement!, '+');
    await frames();
    let r = ranges.at(-1)!.range!;
    expect(near(r.max - r.min, 50, 0.5)).toBe(true);
    expect(r.min <= 50 && r.max >= 50).toBe(true);
    key(document.activeElement!, 'ArrowRight', true);
    key(document.activeElement!, 'ArrowRight', true);
    key(document.activeElement!, 'ArrowRight', true);
    key(document.activeElement!, 'ArrowRight', true);
    key(document.activeElement!, 'ArrowRight', true);
    key(document.activeElement!, 'ArrowRight', true);
    await frames();
    r = ranges.at(-1)!.range!;
    expect(r.max).toBe(100);
    const focused = Number((document.activeElement as SVGElement).dataset['index']);
    expect(focused >= r.min && focused <= r.max).toBe(true);
    key(document.activeElement!, '0');
    await frames();
    expect(ranges.at(-1)).toEqual({ range: null });
  });
});
