// The Canvas painter in a real browser (big-data.md 2, ADR 0002): a series of more than 2 000 marks is painted on a
// Canvas under the SVG; axes and labels stay in the SVG; the Canvas sits on whole device pixels. Step 3.4.
import { describe, it, expect, afterEach } from 'vitest';
import { column, line, scatter } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: [line, column, scatter] });
  made.push({ el, c });
  return { el, c };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

// 3 000 points on a diagonal: x = i, y = i % 100.
const dense = Array.from({ length: 3_000 }, (_, i) => [i, i % 100] as [number, number]);

/** Whether the canvas has any drawn (non-transparent) pixel. */
function inked(canvas: HTMLCanvasElement): boolean {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return true;
  return false;
}

describe('routing to Canvas (big-data.md 2)', () => {
  it('a scatter of 3 000 points: its markers on the Canvas, none in the SVG; axes stay in the SVG', () => {
    const { el } = mount({ series: [{ type: 'scatter', data: dense }] });
    const canvas = el.querySelector('canvas')!;
    expect(canvas.style.display).toBe('block');
    expect(inked(canvas)).toBe(true);
    const main = el.querySelector('svg')!;
    expect(main.querySelectorAll('[data-layer="series"] path, [data-layer="series"] circle').length).toBe(0);
    expect([...main.querySelectorAll('text')].map((t) => t.textContent)).toContain('3,000');
  });

  it('a small chart draws nothing on the Canvas, which stays hidden', () => {
    const { el } = mount({ series: [{ type: 'scatter', data: [[1, 2], [3, 4]] }] });
    expect(el.querySelector('canvas')!.style.display).toBe('none');
  });

  it('the Canvas is sized in device pixels and back to hidden when the series shrinks', () => {
    const { el, c } = mount({ series: [{ type: 'scatter', data: dense }] });
    const canvas = el.querySelector('canvas')!;
    expect(canvas.width).toBeGreaterThanOrEqual(Math.floor(600 * devicePixelRatio));
    c.update({ series: [{ type: 'scatter', data: [[1, 2]] }] });
    return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
      expect(canvas.style.display).toBe('none');
      r();
    })));
  });

  it('the main SVG is above the background plane, which holds the grid', () => {
    const { el } = mount({ series: [{ type: 'scatter', data: dense }] });
    const [main, back] = [...el.querySelectorAll('svg')];
    expect(back!.querySelector('[data-layer="grid"]')).not.toBeNull();
    expect(main!.querySelector('[data-layer="grid"]')).toBeNull();
    expect(getComputedStyle(main!).zIndex).toBe('1');
  });
});

describe('the Canvas lies under the SVG, whatever the direction (review 7, spike S5)', () => {
  for (const dir of ['ltr', 'rtl'] as const)
    it(`${dir}, in a container 600.5 px wide: the Canvas starts at the SVG's origin, on a device pixel`, () => {
      const el = document.createElement('div');
      el.setAttribute('style', 'inline-size:600.5px;block-size:400px;margin-inline-start:0.25px');
      el.setAttribute('dir', dir);
      document.body.appendChild(el);
      const c = chart(el, { animation: false, series: [{ type: 'scatter', data: dense }] }, { types: [line, column, scatter] });
      made.push({ el, c });
      const svg = el.querySelector('svg')!.getBoundingClientRect();
      const canvas = el.querySelector('canvas')!.getBoundingClientRect();
      const dpr = devicePixelRatio;
      const frac = (((svg.x * dpr) % 1) + 1) % 1;
      expect(Math.abs(canvas.x - (svg.x - frac / dpr))).toBeLessThan(0.02);
      expect(Math.abs((canvas.x * dpr) - Math.round(canvas.x * dpr))).toBeLessThan(0.02);
    });
});

