// chart() in a real browser (step 1.8): mounting, size from the container (layout.md 1, D.11), redraws gathered per
// frame, elements reused by scene id, problems reported, right to left from the element, destroy.
import { describe, it, expect, afterEach } from 'vitest';
import { column, line } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const types = [line, column];
const made: { el: HTMLElement; c: Chart }[] = [];
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function mount(options: Parameters<typeof chart>[1], style = 'inline-size:600px;block-size:400px', attrs: Record<string, string> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', style);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  // These tests read the end state of each change: without animation (animation.test.ts has its own).
  const c = chart(el, { animation: false, ...options }, { types });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}

afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

const texts = (svg: SVGSVGElement) => [...svg.querySelectorAll('text')].map((t) => t.textContent);

describe('chart(): mounting', () => {
  it('draws at once, at its container\'s size: axes, labels, the line', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [13, 40, 87, 60, 20] }] });
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['600', '400']);
    expect(texts(svg)).toEqual(expect.arrayContaining(['0', '100', '4']));
    expect(svg.querySelectorAll('[data-layer="series"] path').length).toBe(1);
    // The figure is the chart's root, not the SVG: an image role would hide its points from screen readers.
    expect(svg.closest('[role="figure"]')).not.toBeNull();
  });

  it('a container without a height takes the aspect ratio (D.11)', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1, 2] }], aspectRatio: 2 }, 'inline-size:640px');
    expect(svg.getAttribute('height')).toBe('320');
  });

  it('follows its container\'s size, on the frame after the browser reports the change', async () => {
    const { el, svg } = mount({ series: [{ type: 'line', data: [1, 2] }] });
    el.style.inlineSize = '300px';
    // The resize is reported after that frame's animation callbacks: the chart draws on the one after.
    await frame();
    await frame();
    await frame();
    expect(svg.getAttribute('width')).toBe('300');
  });

  it('labels are placed with the browser\'s own text widths: none crosses the chart\'s edge', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1234567, 2345678] }], locale: 'fr-FR' });
    for (const t of svg.querySelectorAll('text')) {
      const box = t.getBBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(600);
    }
  });
});

describe('chart(): updates', () => {
  it('update() redraws on the next frame and keeps the elements of what stays', async () => {
    const { c, svg } = mount({ series: [{ type: 'line', id: 'a', data: [1, 2, 3] }] });
    const path = svg.querySelector('[data-layer="series"] path');
    c.update({ series: [{ type: 'line', id: 'a', data: [3, 2, 1] }] });
    await frame();
    expect(svg.querySelector('[data-layer="series"] path')).toBe(path);
  });

  it('setData() replaces one series\' data; a later update() that gives data wins', async () => {
    const { c, svg } = mount({ series: [{ type: 'column', id: 'a', data: [['x', 1]] }] });
    c.setData('a', [['x', 1], ['y', 2]]);
    await frame();
    expect(svg.querySelectorAll('[data-layer="series"] :is(rect, path)').length).toBe(2);
    c.update({ series: [{ type: 'column', id: 'a', data: [['z', 5]] }] });
    await frame();
    expect(svg.querySelectorAll('[data-layer="series"] :is(rect, path)').length).toBe(1);
  });

  it('problems: read at once, announced when they change', async () => {
    const { c } = mount({ series: [{ type: 'pie', data: [1] }] } as never); // an unknown type, on purpose
    expect(c.problems.map((p) => p.code)).toEqual(['unknown-series-type']);
    const seen: string[][] = [];
    c.on('problems', (d) => seen.push(d.problems.map((p) => p.code)));
    c.update({ series: [{ type: 'line', data: [1] }] });
    await frame();
    expect(seen).toEqual([[]]);
  });
});

describe('chart(): direction and language from the element', () => {
  it('right to left from the element: the y axis on the right (direction.md 1–2)', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1, 50] }] }, 'inline-size:600px;block-size:400px', { dir: 'rtl' });
    const yLabel = [...svg.querySelectorAll('text')].find((t) => t.textContent === '50')!;
    expect(yLabel.getBBox().x).toBeGreaterThan(300);
  });

  it('French from the page\'s language: « Aucune donnée »', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [] }] }, 'inline-size:600px;block-size:400px', { lang: 'fr' });
    expect(texts(svg)).toContain('Aucune donnée');
  });
});

describe('chart(): destroy', () => {
  it('removes what it added, once; no frame draws after it', async () => {
    const { el, c } = mount({ series: [{ type: 'line', data: [1, 2] }] });
    c.update({ title: 'late' });
    c.destroy();
    c.destroy();
    await frame();
    expect(el.children.length).toBe(0);
  });
});
