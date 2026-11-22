// Selecting in a real browser (selection.md): shapes, clicks, keys, how it reads, the event, the view. Phase 5a step 6.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, selection, zoom, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1], features = [zoom, selection]) {
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
  const init = { clientX: box.left + x, clientY: box.top + y, pointerType: 'mouse', bubbles: true, isPrimary: true, button: 0, pointerId: 1, ...extra };
  svg.dispatchEvent(type === 'click' ? new MouseEvent('click', init) : new PointerEvent(type, init));
}
function at(el: HTMLElement, svg: SVGSVGElement, i: number) {
  const items = [...el.querySelectorAll<SVGElement>('.dzgraph-point')];
  const box = svg.getBoundingClientRect();
  const r = items[i]!.getBoundingClientRect();
  return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
}
const SCATTER = { selection: true, dataTable: true, series: [{ type: 'scatter' as const, id: 's', name: 'S', data: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] as [number, number][] }] };

describe('the mode and the shapes (selection.md 1, modes.md)', () => {
  it('a « Select » mode; a rectangle on marks, a choice of shapes when offered', async () => {
    const { el, c } = mount({ ...SCATTER, selection: { shapes: ['rectangle', 'lasso'] } });
    const names = () => [...el.querySelectorAll('.dzgraph-modes button')].map((b) => b.textContent);
    expect(names()).toEqual(['Zoom', 'Select']);
    c.setMode('selection');
    await raf2();
    expect(names()).toEqual(['Zoom', 'Select', 'Rectangle', 'Lasso']);
  });

  it('without the module the option is reported', () => {
    const { c } = mount(SCATTER, [zoom]);
    expect(c.problems).toContainEqual({ code: 'missing-module', path: 'selection', detail: 'selection' });
  });
});

describe('a rectangle, then Shift to add, Escape to clear (selection.md 2, 3, 6, 9)', () => {
  it('selects the points inside; the event, the live region, the table and the view say so', async () => {
    const { el, c, svg } = mount(SCATTER);
    c.setMode('selection');
    await raf2();
    const seen: unknown[] = [];
    c.on('selectionChange', (d) => seen.push([d.count, d.series.map((s) => [s.id, [...s.indices]])]));
    const a = at(el, svg, 1);
    const b = at(el, svg, 2);
    point(svg, 'pointerdown', a.x - 6, a.y + 6);
    point(svg, 'pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2);
    point(svg, 'pointermove', b.x + 6, b.y - 6);
    point(svg, 'pointerup', b.x + 6, b.y - 6);
    expect(seen).toEqual([[2, [['s', [1, 2]]]]]);
    expect([...el.querySelectorAll('[aria-live]')].some((n) => n.textContent === '2 points selected')).toBe(true);
    await raf2();
    expect(c.getView().selection).toEqual({ s: [1, 2] });
    expect([...el.querySelectorAll('.dzgraph-table tbody tr')].map((r) => r.lastElementChild!.textContent)).toEqual(['', '✓', '✓', '', '']);
    // Shift + click on a point adds it.
    const d = at(el, svg, 4);
    for (const type of ['pointerdown', 'pointerup', 'click']) point(svg, type, d.x, d.y, { shiftKey: true });
    expect(c.getView().selection).toEqual({ s: [1, 2, 4] });
    el.querySelector<HTMLElement>('.dzgraph-modes button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c.getView().selection).toEqual({});
  });
});

describe('the keyboard (selection.md 5)', () => {
  it('Space selects the focused point; Shift + → extends', async () => {
    const { el, c } = mount(SCATTER);
    c.setMode('selection');
    await raf2();
    el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    const key = (k: string, shiftKey = false) => (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));
    key(' ');
    key('ArrowRight', true);
    key('ArrowRight', true);
    expect(c.getView().selection).toEqual({ s: [0, 1, 2] });
    await raf2();
    expect(document.activeElement!.getAttribute('aria-label')).toContain('selected');
  });
});

describe('a polar chart: a click selects a slice (selection.md 12)', () => {
  it('whatever the mode; no bar', async () => {
    const { el, c, svg } = mount({ selection: true, series: [{ type: 'pie', id: 'p', data: [3, 2, 1] }] });
    expect(el.querySelector<HTMLElement>('.dzgraph-modes')?.hidden ?? true).toBe(true);
    const slice = at(el, svg, 0);
    for (const type of ['pointerdown', 'pointerup', 'click']) point(svg, type, slice.x, slice.y);
    await raf2();
    expect(c.getView().selection).toEqual({ p: [0] });
  });
});

describe('a setView brings a selection back (view-state.md 3)', () => {
  it('by index', async () => {
    const { c } = mount(SCATTER);
    c.setView({ selection: { s: [3] } });
    await raf2();
    expect(c.getView().selection).toEqual({ s: [3] });
  });
});

describe('the lasso, live (selection.md 2, D.21)', () => {
  it('a triangle drawn around one point selects it while drawing', async () => {
    const { el, c, svg } = mount({ ...SCATTER, selection: { shapes: ['lasso'] } });
    c.setMode('selection');
    await raf2();
    const p = at(el, svg, 2);
    point(svg, 'pointerdown', p.x - 15, p.y + 12);
    point(svg, 'pointermove', p.x + 15, p.y + 12);
    point(svg, 'pointermove', p.x, p.y - 15);
    // Before the release: already selected.
    expect(c.getView().selection).toEqual({ s: [2] });
    expect(svg.querySelector('.dzgraph-select-band')!.localName).toBe('path');
    point(svg, 'pointerup', p.x, p.y - 15);
    expect(c.getView().selection).toEqual({ s: [2] });
  });
});

describe('review: a lasso with Shift adds to what was selected before it, not to its own earlier moves', () => {
  it('a point the outline passed over, then left outside, is not added', async () => {
    const { el, c, svg } = mount({ ...SCATTER, selection: { shapes: ['lasso'] } });
    c.setMode('selection');
    c.setView({ selection: { s: [0] } });
    await raf2();
    const p2 = at(el, svg, 2);
    const p3 = at(el, svg, 3);
    // A triangle holding 2 and 3 (A, B, C), then a last place D just past 3: the triangle (A, C, D) takes 3 out again.
    point(svg, 'pointerdown', p2.x - 20, p2.y + 20, { shiftKey: true });
    point(svg, 'pointermove', p3.x + 20, p3.y + 20, { shiftKey: true });
    point(svg, 'pointermove', p3.x + 20, p3.y - 20, { shiftKey: true });
    expect(c.getView().selection!['s']).toContain(3);
    point(svg, 'pointermove', p3.x + 15, p3.y + 15, { shiftKey: true });
    const live = c.getView().selection!['s'];
    point(svg, 'pointerup', p3.x + 15, p3.y + 15, { shiftKey: true });
    expect(c.getView().selection).toEqual({ s: live });
    expect(live).toContain(0);
    expect(live).not.toContain(3);
  });
});
