// Hover and tooltip in a real browser (hover-tooltip.md), with real pointer events. Step 2.3.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  // Hover reads drawn positions: without the appearing animation (animation.test.ts has its own).
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}

/** A pointer event at a point of the chart's own drawing (scene pixels). */
function point(svg: SVGSVGElement, type: string, x: number, y: number, pointerType = 'mouse') {
  const box = svg.getBoundingClientRect();
  svg.dispatchEvent(new PointerEvent(type, { clientX: box.left + x, clientY: box.top + y, pointerType, bubbles: true, isPrimary: true }));
}
/** Where a drawn element is, in scene pixels (its box's centre). */
function centre(svg: SVGSVGElement, el: Element) {
  const box = svg.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
}
const tooltip = (el: HTMLElement) => el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
const rows = (el: HTMLElement) => [...tooltip(el).querySelectorAll('.dzgraph-tooltip-row')].map((r) => r.textContent);

const LINES = {
  xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb', 'Mar'] },
  series: [
    { type: 'line' as const, id: 'a', name: 'Apples', data: [10, 20, 30] },
    { type: 'line' as const, id: 'b', name: 'Pears', data: [5, 12, 15] },
  ],
};

describe('hover on lines: a shared tooltip (hover-tooltip.md 1, 4, 6, 8)', () => {
  it('shows every series at the hovered x, a crosshair, and goes when the pointer leaves', () => {
    const { el, svg } = mount(LINES);
    const marker = svg.querySelector('[data-layer="series"] g:last-child > *:last-child')!;
    const at = centre(svg, marker);
    point(svg, 'pointermove', at.x + 4, 20);
    expect(tooltip(el).hidden).toBe(false);
    expect(tooltip(el).querySelector('.dzgraph-tooltip-heading')!.textContent).toBe('Mar');
    expect(rows(el)).toEqual(['Apples30', 'Pears15']);
    expect(svg.querySelector('.dzgraph-crosshair')).not.toBeNull();
    point(svg, 'pointerleave', -10, -10);
    expect(tooltip(el).hidden).toBe(true);
    expect(svg.querySelector('.dzgraph-crosshair')).toBeNull();
  });

  it('the tooltip stays inside the chart, beside the point (7)', () => {
    const { el, svg } = mount(LINES);
    point(svg, 'pointermove', 590, 200);
    const t = tooltip(el).getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    expect(t.left).toBeGreaterThanOrEqual(box.left);
    expect(t.right).toBeLessThanOrEqual(box.right);
  });

  it('is for the eyes only (10)', () => {
    const { el } = mount(LINES);
    expect(tooltip(el).getAttribute('aria-hidden')).toBe('true');
  });
});

describe('hover on columns: per mark, the others faded (2, 5)', () => {
  it('one row, and the other series at 35 %', async () => {
    const { el, svg } = mount({ series: [{ type: 'column', id: 'a', name: 'A', data: [['x', 4]] }, { type: 'column', id: 'b', name: 'B', data: [['x', 8]] }] });
    const col = svg.querySelector('[data-layer="series"] g:last-child > *')!;
    const at = centre(svg, col);
    point(svg, 'pointermove', at.x, at.y);
    expect(rows(el)).toEqual(['B8']);
    await frame();
    const groups = [...svg.querySelectorAll('[data-layer="series"] > g')];
    expect(groups.map((g) => g.getAttribute('opacity'))).toEqual(['0.35', null]);
  });
});

describe('events (11)', () => {
  it('pointHover when the point changes, null when it leaves; pointClick on a click', () => {
    const { c, svg } = mount(LINES);
    const seen: unknown[] = [];
    const clicks: unknown[] = [];
    c.on('pointHover', (d) => seen.push(d.point && [d.point.seriesId, d.point.index]));
    c.on('pointClick', (d) => clicks.push([d.point.seriesId, d.point.index]));
    const marker = svg.querySelector('[data-layer="series"] g:last-child > *:last-child')!;
    const at = centre(svg, marker);
    point(svg, 'pointermove', at.x, at.y);
    point(svg, 'pointermove', at.x + 1, at.y);
    point(svg, 'click', at.x, at.y);
    point(svg, 'pointerleave', -10, -10);
    // The pointer is on the second series' March marker: of the points at that x, the nearest is the one hovered.
    expect(seen).toEqual([['b', 2], null]);
    expect(clicks).toEqual([['b', 2]]);
  });
});

describe('touch (9)', () => {
  it('a tap shows the tooltip, a tap outside the plot hides it', () => {
    const { el, svg } = mount(LINES);
    point(svg, 'pointerdown', 300, 200, 'touch');
    expect(tooltip(el).hidden).toBe(false);
    point(svg, 'pointerdown', 2, 2, 'touch');
    expect(tooltip(el).hidden).toBe(true);
  });
});
