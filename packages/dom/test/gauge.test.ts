// The gauge in a real browser (gauge.md 7–10): a meter for screen readers, its tooltip's note, its table row and its
// summary, in English and French. Phase 4 step 6.
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

function mount(lang = 'en') {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = lang;
  document.body.appendChild(el);
  const options = { animation: false, dataTable: true, series: [{ type: 'gauge' as const, name: 'Load', data: 85, thresholds: [{ from: 80, to: 100, label: 'High' }] }] };
  const c = chart(el, options, { types: allTypes });
  made.push({ el, c });
  return { el, svg: el.querySelector('svg')! };
}

describe('a gauge in the page', () => {
  it('its point is a meter, in a group', () => {
    const { el } = mount();
    const m = el.querySelector('.dzgraph-point')!;
    expect([m.getAttribute('role'), m.getAttribute('aria-valuemin'), m.getAttribute('aria-valuemax'), m.getAttribute('aria-valuenow')]).toEqual(['meter', '0', '100', '85']);
    expect(m.getAttribute('aria-valuetext')).toBe('Load: 85, between 0 and 100. High.');
    expect(m.parentElement!.getAttribute('role')).toBe('group');
  });

  it('hovered: the value, then its scale and threshold', () => {
    const { el, svg } = mount();
    const value = [...svg.querySelectorAll('[data-layer="series"] path')].at(-1)!;
    const r = value.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 4, clientY: r.bottom - 4, pointerType: 'mouse', bubbles: true, isPrimary: true }));
    const tip = el.querySelector<HTMLElement>('.dzgraph-tooltip')!;
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector('.dzgraph-tooltip-note')!.textContent).toBe('0–100 · High');
  });

  it('French: the summary and the table', () => {
    const { el } = mount('fr');
    const fig = el.querySelector('[role="figure"]')!;
    expect(document.getElementById(fig.getAttribute('aria-describedby')!)!.textContent).toBe('Jauge. Load : 85, entre 0 et 100. High.');
    const rows = [...el.querySelectorAll('table tr')].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([['Catégorie', 'Load', 'Minimum', 'Maximum', 'Seuil'], ['Load', '85', '0', '100', 'High']]);
  });
});
