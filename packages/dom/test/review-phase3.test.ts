// Phase 3 code review findings in a real browser, each a failing case first.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { allFeatures, chart, type Chart, type ChartEvents } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('review 2: + on a chart too small to zoom stays whole', () => {
  it('three categories: + changes nothing, no reset button', async () => {
    const { el, ranges } = mount({ series: [{ type: 'column', data: [1, 2, 3] }] });
    await frames();
    const point = el.querySelector<SVGElement>('.dzgraph-point[tabindex="0"]')!;
    point.focus();
    key(point, '+');
    await frames();
    expect(ranges).toEqual([]);
    expect(el.querySelector<HTMLButtonElement>('.dzgraph-reset')!.hidden).toBe(true);
  });
});

describe('review 6: handles on top of each other can still be pulled apart', () => {
  it('a window narrower than the handles: dragging toward the start moves the start', async () => {
    const { c, svg, ranges } = mount({ navigator: true, series: [{ type: 'line', data: Array.from({ length: 1001 }, (_, i) => i % 7) }] });
    await frames();
    c.setRange({ min: 500, max: 502 });
    await frames();
    const strip = svg.querySelector('[data-layer="navigator"] rect')!;
    const box = svg.getBoundingClientRect();
    const x0 = box.x + Number(strip.getAttribute('x'));
    const w = Number(strip.getAttribute('width'));
    const y = box.y + Number(strip.getAttribute('y')) + 20;
    const at = (v: number) => x0 + (v / 1000) * w;
    const ptr = (type: string, x: number) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 }));
    ptr('pointerdown', at(501));
    ptr('pointermove', at(450));
    ptr('pointermove', at(400));
    ptr('pointerup', at(400));
    await frames();
    const r = ranges.at(-1)!.range!;
    expect(Math.abs(r.min - 400)).toBeLessThan(3);
    expect(r.max).toBe(502);
  });
});

describe('review 8: setRange with bad input', () => {
  it('reports a problem and keeps the range; null shows the whole; ISO dates on a time axis', async () => {
    const day = 86_400_000;
    const { c, ranges } = mount({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', data: Array.from({ length: 60 }, (_, i) => [Date.UTC(2026, 0, 1) + i * day, i] as [number, number]) }] });
    await frames();
    c.setRange({ min: '2026-01-10', max: '2026-01-20T00:00:00Z' });
    await frames();
    expect(ranges.at(-1)!.range).toEqual({ min: Date.UTC(2026, 0, 10), max: Date.UTC(2026, 0, 20) });
    c.setRange(5 as never /* plain JavaScript may pass anything */);
    await frames();
    expect(ranges.length).toBe(1);
    expect(c.problems.map((p) => [p.code, p.path])).toEqual([['invalid-option', 'setRange']]);
    c.setRange(null);
    await frames();
    expect(ranges.at(-1)).toEqual({ range: null });
    expect(c.problems).toEqual([]);
  });
});

describe('review 9: the page changes direction or language without a resize', () => {
  it('the next drawing follows, even one that reads no options (a zoom)', async () => {
    const { el, c } = mount({ series: [{ type: 'line', data: [1, 2, 3, 4] }] }, { lang: 'en' });
    await frames();
    el.setAttribute('lang', 'fr');
    c.setRange({ min: 0.5, max: 2.5 });
    await frames();
    expect(el.querySelector('.dzgraph-reset')!.textContent).toBe('Réinitialiser le zoom');
  });
});
