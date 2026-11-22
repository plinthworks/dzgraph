// Combined charts with two value axes in a real browser (combined.md 5, 9, 10): the axes' signs drawn, the summary
// naming the kinds and each series' axis, the table's headers naming the axis. Phase 4 step 5.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});

function mount(options: Parameters<typeof chart>[1], lang = 'en') {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = lang;
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  return { el, c };
}

const DUAL = {
  xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb'] },
  yAxis: [{ title: 'kg' }, { id: 'y2', title: 'mm', opposite: true }],
  series: [
    { type: 'column' as const, name: 'Harvest', data: [200, 220] },
    { type: 'area' as const, name: 'Wind', data: [1, 2] },
    { type: 'line' as const, name: 'Rain', yAxis: 'y2', data: [40, 60] },
  ],
  dataTable: true,
};
const described = (el: HTMLElement) => document.getElementById(el.querySelector('[role="figure"]')!.getAttribute('aria-describedby')!)!.textContent;

describe('two value axes, read (combined.md 9, 10)', () => {
  it('the summary names the kinds and each series\' axis', () => {
    const { el } = mount(DUAL);
    expect(described(el)).toBe('Combined chart: columns, areas, and lines, 3 series. Harvest: from 200 to 220, on the kg axis. Wind: from 1 to 2, on the kg axis. Rain: from 40 to 60, on the mm axis. X axis: from Jan to Feb.');
  });

  it('in French, an axis without a title is named by its place', () => {
    const { el } = mount({ ...DUAL, yAxis: [{}, { id: 'y2', opposite: true }] }, 'fr');
    expect(described(el)).toBe('Graphique combiné : colonnes, aires et lignes, 3 séries. Harvest : de 200 à 220, premier axe. Wind : de 1 à 2, premier axe. Rain : de 40 à 60, second axe. Axe x : de Jan à Feb.');
  });

  it('the table\'s headers name the axis', () => {
    const { el } = mount(DUAL, 'fr');
    expect([...el.querySelectorAll('table thead th')].map((c) => c.textContent)).toEqual(['Catégorie', 'Harvest (kg)', 'Wind (kg)', 'Rain (mm)']);
  });

  it('the axes\' signs are drawn and hidden from screen readers with the axes', () => {
    const { el } = mount(DUAL);
    const axes = el.querySelector('svg [data-layer="axes"]')!;
    expect(axes.querySelectorAll('rect, path, circle').length).toBeGreaterThanOrEqual(3);
    expect(axes.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
