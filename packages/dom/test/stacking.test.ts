// Stacked columns in a real browser (stacking.md 14, 16, 17): the tooltip's share and total, the point read with its
// share, the summary, the table's total column, in English and French. Phase 4 step 3.
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
  return { el, c, svg: el.querySelector('svg')! };
}

const PILE = {
  xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb'] },
  series: [
    { type: 'column' as const, id: 'a', name: 'Apples', stack: true, data: [1, 2] },
    { type: 'column' as const, id: 'b', name: 'Pears', stack: true, data: [3, 2] },
  ],
  dataTable: true,
};

function hover(svg: SVGSVGElement, el: Element) {
  const box = svg.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  svg.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'mouse', bubbles: true, isPrimary: true }));
  return box;
}

describe('stacked columns, read (stacking.md 14, 16, 17)', () => {
  it('the tooltip: the value, its share, then the pile\'s total', () => {
    const { el, svg } = mount(PILE);
    // The upper segment of Jan: Pears, 3 of 4.
    const rects = [...svg.querySelectorAll('[data-layer="series"] rect, [data-layer="series"] path')];
    const top = rects.reduce((best, r) => (r.getBoundingClientRect().top < best.getBoundingClientRect().top ? r : best));
    hover(svg, top);
    const tip = el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
    expect([...tip.querySelectorAll('.dzgraph-tooltip-row')].map((r) => r.textContent)).toEqual(['Pears375%', 'Total4']);
    expect(tip.querySelector('.dzgraph-tooltip-share')!.textContent).toBe('75%');
  });

  it('a point is read with its share and the total; the summary says stacked', () => {
    const { el } = mount(PILE);
    expect(el.querySelector('.dzgraph-point[tabindex="0"]')!.getAttribute('aria-label')).toBe('Apples, Jan: 1, 25% of 4. Point 1 of 2.');
    const fig = el.querySelector('[role="figure"]')!;
    expect(document.getElementById(fig.getAttribute('aria-describedby')!)!.textContent).toBe('Stacked column chart, 2 series. Apples: from 1 to 2. Pears: from 2 to 3. X axis: from Jan to Feb.');
  });

  it('the table adds the pile\'s total, named in the reader\'s language', () => {
    const { el } = mount(PILE, 'fr');
    const rows = [...el.querySelectorAll('table tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([['Catégorie', 'Apples', 'Pears', 'Total'], ['Jan', '1', '3', '4'], ['Feb', '2', '2', '4']]);
    const fig = el.querySelector('[role="figure"]')!;
    expect(document.getElementById(fig.getAttribute('aria-describedby')!)!.textContent).toMatch(/^Graphique en colonnes empilées, 2 séries\./);
  });
});
