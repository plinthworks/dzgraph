// Features as imported modules in a real browser (ADR 0006): without `zoom` the user cannot zoom but the app can;
// without `canvas` many marks are drawn in SVG; `navigatorStrip` brings `zoom`; an option without its module is a
// problem. Phase 4 step 1.
import { describe, it, expect, afterEach } from 'vitest';
import { line, scatter } from '@dzgraph/core';
import { chart, navigatorStrip, type Chart, type ChartEvents, type Feature } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const LINE = { series: [{ type: 'line', id: 'a', data: Array.from({ length: 101 }, (_, i) => i % 7) }] } as const;

function mount(options: Parameters<typeof chart>[1], features?: readonly Feature[]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: [line, scatter], ...(features ? { features } : {}) });
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

function wheel(svg: SVGSVGElement) {
  const box = svg.getBoundingClientRect();
  svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, deltaY: -200, ctrlKey: true }));
}

describe('without zoom', () => {
  it('Ctrl + wheel changes nothing and the page keeps the wheel; no reset button', async () => {
    const { el, svg, ranges } = mount(LINE);
    await frames();
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -200, ctrlKey: true });
    svg.dispatchEvent(e);
    await frames();
    expect(e.defaultPrevented).toBe(false);
    expect(ranges).toEqual([]);
    expect(el.querySelector('.dzgraph-reset')).toBeNull();
  });

  it('the app still sets the range', async () => {
    const { c, ranges } = mount(LINE);
    c.setRange({ min: 20, max: 40 });
    await frames();
    expect(ranges).toEqual([{ range: { min: 20, max: 40 } }]);
    expect(c.problems).toEqual([]);
  });
});

describe('without canvas', () => {
  it('a scatter of 3 000 points is drawn in SVG, every marker, and no Canvas is added', async () => {
    const dense = Array.from({ length: 3_000 }, (_, i) => [i, i % 100] as [number, number]);
    const { el } = mount({ series: [{ type: 'scatter', data: dense }] });
    await frames();
    expect(el.querySelector('canvas')).toBeNull();
    const series = el.querySelector('svg')!.querySelector('[data-layer="series"]')!;
    expect(series.querySelectorAll('path, circle, use').length).toBeGreaterThanOrEqual(1);
    // One marker per point, in one path or one element each: the 3 000 points are all there.
    const drawn = [...series.querySelectorAll('path')].reduce((n, p) => n + (p.getAttribute('d')?.match(/M/g)?.length ?? 0), 0) + series.querySelectorAll('circle, use').length;
    expect(drawn).toBe(3_000);
  });
});

describe('options without their module', () => {
  it('`navigator: true` without navigatorStrip: reported, nothing drawn under the plot', async () => {
    const { el, c } = mount({ ...LINE, navigator: true });
    await frames();
    expect(c.problems).toEqual([{ code: 'missing-module', path: 'navigator', detail: 'navigatorStrip' }]);
    expect(el.querySelector('[role="slider"]')).toBeNull();
    expect(el.querySelector('.dzgraph-range-buttons')).toBeNull();
  });
});

describe('navigatorStrip brings zoom', () => {
  it('listed alone: the strip has its sliders, and Ctrl + wheel zooms', async () => {
    const { el, svg, ranges } = mount({ ...LINE, navigator: true }, [navigatorStrip]);
    await frames();
    expect(el.querySelectorAll('[role="slider"]').length).toBe(2);
    wheel(svg);
    await frames();
    expect(ranges.length).toBe(1);
    expect(el.querySelector<HTMLButtonElement>('.dzgraph-reset')!.hidden).toBe(false);
  });
});
