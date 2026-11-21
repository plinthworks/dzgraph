// Animation (animation.md), in a real browser. Step 2.6.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes, type Scene } from '@dzgraph/core';
import { chart, type Chart, type ChartSetup } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
};
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
function mount(options: Parameters<typeof chart>[1], extra: Partial<ChartSetup> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, options, { types: allTypes, ...extra });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
const clipWidth = (svg: SVGSVGElement) => Number(svg.querySelector('defs clipPath rect')!.getAttribute('width'));
const columnHeight = (svg: SVGSVGElement) => {
  const box = (svg.querySelector('[data-layer="series"] g > *') as SVGGraphicsElement).getBBox();
  return box.height;
};

describe('appearing (animation.md 1)', () => {
  it('a line is revealed from the start of x, in about 400 ms', async () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1, 3, 2] }] });
    expect(clipWidth(svg)).toBeLessThan(5);
    await wait(500);
    await frames(2);
    expect(clipWidth(svg)).toBeGreaterThan(500);
  });

  it('`animation: false`: the end state at once (5)', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1, 3, 2] }], animation: false });
    expect(clipWidth(svg)).toBeGreaterThan(500);
  });
});

describe('updating (2, 3)', () => {
  it('a column moves from its old height to its new one', async () => {
    const { c, svg } = mount({ series: [{ type: 'column', id: 'c', data: [['a', 2]] }], yAxis: { max: 10 } });
    await wait(500);
    const before = columnHeight(svg);
    c.update({ series: [{ type: 'column', id: 'c', data: [['a', 8]] }] });
    await frames(4);
    const during = columnHeight(svg);
    await wait(400);
    const after = columnHeight(svg);
    expect(during).toBeGreaterThan(before);
    expect(during).toBeLessThan(after);
  });
});

describe('the app drives it (6)', () => {
  it('the animate hook gets both states and draws what it asks', async () => {
    const calls: { from: Scene; to: Scene; duration: number }[] = [];
    const { svg } = mount(
      { series: [{ type: 'line', data: [1, 3, 2] }] },
      {
        animate: (a) => {
          calls.push(a);
          a.draw(1);
          a.done();
        },
      },
    );
    await frames(2);
    expect(calls.map((c) => c.duration)).toEqual([400]);
    expect(clipWidth(svg)).toBeGreaterThan(500);
  });
});
