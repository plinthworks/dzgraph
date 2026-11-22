// Comparison in a real browser (compare.md 4, 5, 9): the tooltip's note and raw value, the table's columns, the summary.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, compare, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features: [compare] });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const OPTIONS = { dataTable: true, xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb', 'Mar'] }, yAxis: { compare: 'percent' as const }, series: [{ type: 'line' as const, name: 'Apples', data: [10, 20, 15] }] };

describe('comparison on screen (compare.md 4, 5, 9)', () => {
  it('the tooltip: « Since Jan », the compared value then the raw one', () => {
    const { el, svg } = mount(OPTIONS);
    const box = svg.getBoundingClientRect();
    // Over Feb, the plot's middle.
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + box.width / 2, clientY: box.top + 100, pointerType: 'mouse', bubbles: true }));
    const t = el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
    expect(t.querySelector('.dzgraph-tooltip-note')!.textContent).toBe('Since Jan');
    expect([...t.querySelectorAll('.dzgraph-tooltip-row:not(.dzgraph-tooltip-note) span')].map((s) => s.textContent)).toEqual(['Apples', '+100%', '20']);
  });

  it('the table: raw then compared; the summary says how', () => {
    const { el } = mount(OPTIONS);
    const head = [...el.querySelectorAll('.dzgraph-table thead th')].map((t) => t.textContent);
    expect(head.slice(1)).toEqual(['Apples', 'Apples (compared)']);
    const summary = el.querySelector('[id$="-summary"]')!.textContent!;
    expect(summary).toContain('Compared to the first point in view, in percent.');
  });
});
