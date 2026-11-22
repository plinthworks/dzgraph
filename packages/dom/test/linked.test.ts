// Linked charts in a real browser (linked-charts.md): crosshair by x, range, selection by key, drill; no loop.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, crosshair, drilldown, linkCharts, selection, zoom, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:500px;block-size:300px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features: [zoom, crosshair, selection, drilldown] });
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
const LINE = (id: string) => ({ crosshair: true, selection: true, series: [{ type: 'line' as const, id, data: { x: [0, 1, 2, 3, 4], y: [1, 3, 2, 5, 4], key: ['a', 'b', 'c', 'd', 'e'] } }] });

describe('linkCharts (linked-charts.md)', () => {
  it('range: zooming one zooms the others; no loop; unlink stops it', async () => {
    const a = mount(LINE('p'));
    const b = mount(LINE('q'));
    const unlink = linkCharts([a.c, b.c], { zoom: 'x' });
    let told = 0;
    a.c.on('rangeChange', () => told++);
    a.c.setRange({ min: 1, max: 3 });
    await raf2();
    expect([b.c.getView().range, told]).toEqual([{ min: 1, max: 3 }, 1]);
    unlink();
    a.c.setRange(null);
    await raf2();
    expect(b.c.getView().range).toEqual({ min: 1, max: 3 });
  });

  it('crosshair: pointing at an x in one shows it in the other', () => {
    const a = mount(LINE('p'));
    const b = mount(LINE('q'));
    linkCharts([a.c, b.c], { crosshair: true });
    const box = a.svg.getBoundingClientRect();
    a.svg.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + box.width / 2, clientY: box.top + 100, pointerType: 'mouse', bubbles: true }));
    expect(b.el.querySelector<HTMLElement>('.dzgraph-tooltip')!.hidden).toBe(false);
    expect(b.svg.querySelector('.dzgraph-crosshair-layer line')).not.toBeNull();
    a.svg.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true }));
    expect(b.el.querySelector<HTMLElement>('.dzgraph-tooltip')!.hidden).toBe(true);
  });

  it('selection by key: selecting in one selects the same keys in the other', async () => {
    const a = mount(LINE('p'));
    const b = mount(LINE('q'));
    linkCharts([a.c, b.c], { selection: 'key' });
    a.c.setMode('selection');
    await raf2();
    a.el.querySelector<SVGElement>('.dzgraph-point')!.focus();
    (document.activeElement as SVGElement).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await raf2();
    expect(b.c.getView().selection).toEqual({ q: ['a'] });
  });
});
