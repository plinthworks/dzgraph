// The Phase 2 code review's findings (2026-11-21), each reproduced first in a real browser, then fixed.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
const frames = async (n = 2) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
};
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
function mount(options: Parameters<typeof chart>[1], attrs: Record<string, string> = {}) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
const key = (k: string) => (document.activeElement as Element).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const firstPoint = (el: HTMLElement) => el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement;

describe('review 1: a redraw keeps the keyboard focus', () => {
  it('on a column point (its emphasis redraws)', async () => {
    const { el } = mount({ series: [{ type: 'column', name: 'A', data: [1, 2] }, { type: 'column', name: 'B', data: [2, 1] }] });
    firstPoint(el).focus();
    await frames();
    expect(document.activeElement?.classList.contains('dzgraph-point')).toBe(true);
  });

  it('on a legend button, focused and then pressed', async () => {
    const { el } = mount({ series: [{ type: 'line', name: 'A', data: [1, 2] }, { type: 'line', name: 'B', data: [2, 1] }] });
    const b = el.querySelector('.dzgraph-legend-button') as SVGElement;
    b.focus();
    await frames();
    expect(document.activeElement).toBe(b);
    key('Enter');
    await frames();
    expect(document.activeElement).toBe(b);
  });

  it('on a line point, through an update', async () => {
    const { el, c } = mount({ series: [{ type: 'line', id: 'a', name: 'A', data: [1, 2, 3] }] });
    firstPoint(el).focus();
    c.update({ title: 'Now with a title' });
    await frames();
    expect(document.activeElement?.classList.contains('dzgraph-point')).toBe(true);
  });
});

describe('review 2: a line point focused in a chart with columns', () => {
  it('shows the line\'s tooltip, not the column under it', () => {
    const { el } = mount({ series: [{ type: 'column', name: 'Cols', data: [100, 100, 100] }, { type: 'line', name: 'Line', data: [10, 20, 30] }] });
    const lineItem = [...el.querySelectorAll<SVGElement>('.dzgraph-point')].find((p) => p.getAttribute('aria-label')!.startsWith('Line'))!;
    lineItem.focus();
    const rows = [...el.querySelectorAll('.dzgraph-tooltip-row')].map((r) => r.textContent);
    expect(rows.some((r) => r!.startsWith('Line'))).toBe(true);
  });
});

describe('review 3: the tab stop survives shrinking data', () => {
  it('a point keeps tabindex 0', async () => {
    const { el, c } = mount({ series: [{ type: 'line', id: 'a', name: 'A', data: [1, 2, 3, 4, 5, 6, 7, 8] }] });
    firstPoint(el).focus();
    key('End');
    c.setData('a', [1, 2, 3]);
    await frames();
    expect(el.querySelectorAll('.dzgraph-point[tabindex="0"]').length).toBe(1);
  });
});

describe('review 4: arrows follow the screen on a reversed axis', () => {
  it('→ goes to the point drawn to the right', () => {
    const { el } = mount({ xAxis: { reversed: true }, series: [{ type: 'line', name: 'A', data: [1, 2, 3] }] });
    firstPoint(el).focus();
    // On a reversed axis the first point is drawn rightmost: start from the last one, drawn leftmost.
    key('End');
    const before = Number(document.activeElement!.getAttribute('cx'));
    key('ArrowRight');
    const after = Number(document.activeElement!.getAttribute('cx'));
    expect(after).toBeGreaterThan(before);
  });
});

describe('review 5: the data table comes after the chart', () => {
  it('in the element\'s order', () => {
    const { el } = mount({ series: [{ type: 'line', data: [1] }] });
    expect([...el.children].map((c) => c.classList.contains('dzgraph-sr-only') ? 'table' : 'chart')).toEqual(['chart', 'table']);
  });
});

describe('review 6: positions count the points, not the gaps', () => {
  it('« Point 2 of 2 » for [1, null, 3]', () => {
    const { el } = mount({ series: [{ type: 'line', name: 'A', data: [1, null, 3] }] });
    expect([...el.querySelectorAll('.dzgraph-point')].map((p) => p.getAttribute('aria-label'))).toEqual(['A, 0: 1. Point 1 of 2.', 'A, 2: 3. Point 2 of 2.']);
  });
});

describe('review 8: touch', () => {
  it('the plot keeps horizontal slides for the tooltip', () => {
    const { svg } = mount({ series: [{ type: 'line', data: [1, 2] }] });
    expect(svg.style.touchAction).toBe('pan-y');
  });
});

describe('review 9, 10: the data table', () => {
  it('two points at the same x are two rows; the x column is named', () => {
    const { el } = mount({ xAxis: { title: 'Diameter' }, series: [{ type: 'scatter', name: 'S', data: [[1, 5], [1, 7]] }], dataTable: true });
    const rows = [...el.querySelectorAll('table tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([['Diameter', 'S'], ['1', '5'], ['1', '7']]);
  });

  it('without an axis title: a word for x', () => {
    const { el } = mount({ series: [{ type: 'line', name: 'A', data: [1] }], dataTable: true }, { lang: 'fr' });
    expect(el.querySelector('table thead th')!.textContent).toBe('Valeur x');
  });
});
