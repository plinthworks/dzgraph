// Keyboard and screen readers (keyboard.md, screen-reader.md, data-table.md), pattern B: each point takes the real
// focus. Step 2.5. Real browser, real focus.
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
  el.setAttribute('lang', lang);
  document.body.appendChild(el);
  const c = chart(el, options, { types: allTypes });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
const key = (k: string) => (document.activeElement as Element).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const focused = () => document.activeElement?.getAttribute('aria-label');

const LINES = {
  title: 'Orchard sales',
  xAxis: { scale: 'category' as const, categories: ['Jan', 'Feb', 'Mar'] },
  series: [
    { type: 'line' as const, id: 'a', name: 'Apples', data: [10, 20, 30] },
    { type: 'line' as const, id: 'b', name: 'Pears', data: [15, 5, 25] },
  ],
};

describe('one tab stop for the points (keyboard.md 1)', () => {
  it('only one point is in the tab order: the first one of the first series', () => {
    const { el } = mount(LINES);
    const stops = [...el.querySelectorAll('.dzgraph-point')].filter((p) => p.getAttribute('tabindex') === '0');
    expect(stops.map((p) => p.getAttribute('aria-label'))).toEqual(['Apples, Jan: 10. Point 1 of 3.']);
  });
});

describe('arrows follow the screen (2, 3)', () => {
  it('→ ← along x, ↑ ↓ to the series above or below at that x, Home and End', () => {
    const { el } = mount(LINES);
    (el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement).focus();
    key('ArrowRight');
    expect(focused()).toBe('Apples, Feb: 20. Point 2 of 3.');
    key('ArrowDown');
    expect(focused()).toBe('Pears, Feb: 5. Point 2 of 3.');
    key('ArrowUp');
    expect(focused()).toBe('Apples, Feb: 20. Point 2 of 3.');
    key('End');
    expect(focused()).toBe('Apples, Mar: 30. Point 3 of 3.');
    key('Home');
    expect(focused()).toBe('Apples, Jan: 10. Point 1 of 3.');
    key('ArrowLeft');
    expect(focused()).toBe('Apples, Jan: 10. Point 1 of 3.');
  });

  it('the focused point keeps the tab stop', () => {
    const { el } = mount(LINES);
    (el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement).focus();
    key('ArrowRight');
    expect([...el.querySelectorAll('.dzgraph-point[tabindex="0"]')].map((p) => p.getAttribute('aria-label'))).toEqual(['Apples, Feb: 20. Point 2 of 3.']);
  });
});

describe('what focus shows and sends (4, 6)', () => {
  it('the tooltip and a focus ring; pointFocus; Enter clicks; Escape hides the tooltip', () => {
    const { el, c } = mount(LINES);
    const focus: unknown[] = [];
    const clicks: unknown[] = [];
    c.on('pointFocus', (d) => focus.push([d.point.seriesId, d.point.index]));
    c.on('pointClick', (d) => clicks.push([d.point.seriesId, d.point.index]));
    (el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement).focus();
    const tip = el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
    expect(tip.hidden).toBe(false);
    expect(el.querySelector('.dzgraph-focus-ring')).not.toBeNull();
    key('Enter');
    key('Escape');
    expect(tip.hidden).toBe(true);
    expect(focus).toEqual([['a', 0]]);
    expect(clicks).toEqual([['a', 0]]);
  });
});

describe('screen readers (screen-reader.md 1, 2, 4)', () => {
  it('a figure named by its title and described by a summary', () => {
    const { el } = mount(LINES);
    const fig = el.querySelector('[role="figure"]')!;
    expect(fig.getAttribute('aria-label')).toBe('Orchard sales');
    const summary = document.getElementById(fig.getAttribute('aria-describedby')!)!;
    expect(summary.textContent).toBe('Line chart, 2 series. Apples: from 10 to 30. Pears: from 5 to 25. X axis: from Jan to Mar.');
  });

  it('in French', () => {
    const { el } = mount(LINES, 'fr');
    const fig = el.querySelector('[role="figure"]')!;
    expect(document.getElementById(fig.getAttribute('aria-describedby')!)!.textContent).toBe('Graphique en lignes, 2 séries. Apples : de 10 à 30. Pears : de 5 à 25. Axe x : de Jan à Mar.');
    expect(el.querySelector('[role="list"]')!.getAttribute('aria-label')).toBe('Apples, 3 points');
  });

  it('each series a list; the drawing itself hidden from screen readers', () => {
    const { svg } = mount(LINES);
    expect([...svg.querySelectorAll('[role="list"]')].map((l) => l.getAttribute('aria-label'))).toEqual(['Apples, 3 points', 'Pears, 3 points']);
    for (const layer of svg.querySelectorAll('[data-layer]')) expect(layer.getAttribute('aria-hidden')).toBe('true');
  });

  it('a long series: one item stands for the focused point, replaced on each move (3)', () => {
    const { el } = mount({ series: [{ type: 'line', name: 'Long', data: Array.from({ length: 2000 }, (_, i) => i) }] });
    expect(el.querySelectorAll('.dzgraph-point').length).toBe(1);
    (el.querySelector('.dzgraph-point') as SVGElement).focus();
    key('ArrowRight');
    expect(focused()).toBe('Long, 1: 1. Point 2 of 2,000.');
  });
});

describe('data table (data-table.md)', () => {
  it('hidden from sight, read by screen readers; shown with dataTable: true', () => {
    const hiddenTable = mount(LINES).el.querySelector('table')!;
    expect(hiddenTable.closest('.dzgraph-sr-only')).not.toBeNull();
    const shown = mount({ ...LINES, dataTable: true }).el.querySelector('table')!;
    expect(shown.closest('.dzgraph-sr-only')).toBeNull();
    expect([...shown.querySelectorAll('tr')].map((r) => [...r.children].map((c) => c.textContent))).toEqual([
      ['Category', 'Apples', 'Pears'],
      ['Jan', '10', '15'],
      ['Feb', '20', '5'],
      ['Mar', '30', '25'],
    ]);
    expect(shown.querySelector('caption')!.textContent).toBe('Orchard sales');
  });
});

describe('events carry the point\'s key; pointHover is the pointer\'s only (architecture check)', () => {
  it('pointFocus with the key; no pointHover for a focus', () => {
    const { el, c } = mount({ series: [{ type: 'line', id: 'a', name: 'A', data: [{ y: 1, key: 'row-1' }, { y: 2, key: 'row-2' }] }] });
    const focus: unknown[] = [];
    const hovers: unknown[] = [];
    c.on('pointFocus', (d) => focus.push(d.point));
    c.on('pointHover', (d) => hovers.push(d.point));
    (el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement).focus();
    expect(focus).toEqual([{ seriesId: 'a', index: 0, key: 'row-1' }]);
    expect(hovers).toEqual([]);
  });
});

describe('the pointer does not take the keyboard focus away (keyboard.md 4)', () => {
  it('pointing at nothing gives the focused point\'s ring and tooltip back', () => {
    const { el, svg } = mount(LINES);
    (el.querySelector('.dzgraph-point[tabindex="0"]') as SVGElement).focus();
    const box = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + 1, clientY: box.top + 1, pointerType: 'mouse', bubbles: true }));
    expect(el.querySelector('.dzgraph-focus-ring')).not.toBeNull();
    expect(el.querySelector<HTMLElement>('.dzgraph-tooltip')!.hidden).toBe(false);
  });
});
