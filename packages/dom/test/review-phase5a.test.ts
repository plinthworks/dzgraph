// The Phase 5a code review (2026-11-22): each finding as a test that failed first. In a real browser.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, compare, measure, selection, zoom, type Chart, type Feature } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features: readonly Feature[] = [zoom, selection, measure, compare]) {
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
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
function point(svg: SVGSVGElement, type: string, x: number, y: number, extra: PointerEventInit = {}) {
  const box = svg.getBoundingClientRect();
  svg.dispatchEvent(new PointerEvent(type, { clientX: box.left + x, clientY: box.top + y, pointerType: 'mouse', bubbles: true, isPrimary: true, button: 0, pointerId: 1, ...extra }));
}
function at(el: HTMLElement, svg: SVGSVGElement, i: number) {
  const box = svg.getBoundingClientRect();
  const r = [...el.querySelectorAll<SVGElement>('.dzgraph-point')][i]!.getBoundingClientRect();
  return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
}
const SCATTER = { selection: { shapes: ['rectangle', 'lasso'] as ('rectangle' | 'lasso')[] }, series: [{ type: 'scatter' as const, id: 's', data: { x: [0, 1, 2, 3, 4], y: [0, 1, 2, 3, 4], key: ['a', 'b', 'c', 'd', 'e'] } }] };

describe('review 1: a view given back draws the same (view-state.md 3)', () => {
  it('one axis compared by its option: setView(getView()) compares no other axis', async () => {
    const { el, c } = mount({ yAxis: [{ compare: 'percent' }, { opposite: true }], series: [{ type: 'line', data: [1, 2] }, { type: 'line', yAxis: 'y2', data: [10, 20] }] });
    const before = [...el.querySelectorAll('[data-layer="labels"] text')].map((t) => t.textContent);
    c.setView(c.getView());
    await raf2();
    expect([...el.querySelectorAll('[data-layer="labels"] text')].map((t) => t.textContent)).toEqual(before);
  });
});

describe('review 2: setView of the view as it is changes nothing', () => {
  it('no viewChange', async () => {
    const { c } = mount(SCATTER);
    const seen: unknown[] = [];
    c.on('viewChange', (d) => seen.push(d.changed));
    c.setView(c.getView());
    expect(seen).toEqual([]);
  });
});

describe('review 3: new data keeps a keyed selection on its points (selection.md 8)', () => {
  it('reordered: the same keys stay selected; the app is told when points go', async () => {
    const { c } = mount(SCATTER);
    c.setView({ selection: { s: ['b', 'd'] } });
    await raf2();
    const seen: number[] = [];
    c.on('selectionChange', (d) => seen.push(d.count));
    c.setData('s', { x: [4, 3, 2, 1], y: [4, 3, 2, 1], key: ['e', 'd', 'c', 'b'] });
    await raf2();
    expect(c.getView().selection).toEqual({ s: ['d', 'b'] });
    expect(seen).toEqual([]);
    c.setData('s', { x: [0, 1], y: [0, 1], key: ['a', 'b'] });
    await raf2();
    expect(c.getView().selection).toEqual({ s: ['b'] });
    expect(seen).toEqual([1]);
  });
});

describe('review 4: a selection redraws, it does not lay the chart out again', () => {
  it('the layout is kept (its axes are the same objects)', async () => {
    const { c, el } = mount(SCATTER);
    await raf2();
    const tick = el.querySelector('[data-layer="axes"]')!.firstElementChild;
    c.setView({ selection: { s: ['c'] } });
    await raf2();
    // An axis drawn from the same layout keeps its element; and the aids still say what is selected.
    expect(el.querySelector('[data-layer="axes"]')!.firstElementChild).toBe(tick);
    expect(el.querySelector('[id$="-summary"]')!.textContent).toContain('1 point selected');
  });
});

describe('review 5: Shift + an arrow that moves nothing does not extend the next move', () => {
  it('at the last point, Shift + → then → selects nothing more', async () => {
    const { el, c } = mount(SCATTER);
    c.setMode('selection');
    await raf2();
    const items = [...el.querySelectorAll<SVGElement>('.dzgraph-point')];
    items.at(-1)!.focus();
    const key = (k: string, shiftKey = false) => (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
    key('ArrowRight', true);
    key('ArrowLeft');
    expect(c.getView().selection).toEqual({});
  });
});

describe('review 6: without zoom, the first mode is one the chart has', () => {
  it('selection and measure only: it starts selecting', () => {
    const { c } = mount(SCATTER, [selection, measure]);
    expect(c.mode).toBe('selection');
  });
});

describe('review 7: an update keeps a measure whose points are still there (measure.md 4)', () => {
  it('a title changed: the measure stays', async () => {
    const { el, c, svg } = mount({ series: [{ type: 'line', data: [1, 2, 3] }] });
    c.setMode('measure');
    await raf2();
    const a = at(el, svg, 0);
    const b = at(el, svg, 1);
    point(svg, 'pointerdown', a.x, a.y);
    point(svg, 'pointermove', b.x, b.y);
    point(svg, 'pointerup', b.x, b.y);
    c.update({ title: 'Prices' });
    await raf2();
    expect(svg.querySelector('.dzgraph-measure line')).not.toBeNull();
  });
});

describe('review 8: a lasso cancelled leaves the selection as it was', () => {
  it('pointercancel mid-lasso: back to the selection before it', async () => {
    const { el, c, svg } = mount(SCATTER);
    c.setMode('selection');
    c.setView({ selection: { s: ['a'] } });
    await raf2();
    el.querySelector<HTMLElement>('.dzgraph-modes [data-key="shape:lasso"]')!.click();
    await raf2();
    const p = at(el, svg, 2);
    point(svg, 'pointerdown', p.x - 15, p.y + 12);
    point(svg, 'pointermove', p.x + 15, p.y + 12);
    point(svg, 'pointermove', p.x, p.y - 15);
    expect(c.getView().selection).toEqual({ s: ['c'] });
    point(svg, 'pointercancel', p.x, p.y - 15);
    expect(c.getView().selection).toEqual({ s: ['a'] });
  });
});
