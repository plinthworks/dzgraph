// The view as state in a real browser (view-state.md, ADR 0009): getView, setView, viewChange. Phase 5a step 2.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { chart, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes });
  made.push({ el, c });
  return { el, c };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const TWO = { series: [{ type: 'line' as const, id: 'a', name: 'A', data: [1, 2, 3, 4, 5] }, { type: 'line' as const, id: 'b', name: 'B', data: [5, 4, 3, 2, 1] }] };

describe('getView (view-state.md 1, 2)', () => {
  it('what the user changed, as JSON', async () => {
    const { el, c } = mount(TWO);
    expect(c.getView()).toEqual({ hidden: [], range: null, selection: {} });
    el.querySelectorAll<SVGElement>('.dzgraph-legend-button')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    c.setRange({ min: 1, max: 3 });
    await raf2();
    expect(c.getView()).toEqual({ hidden: ['b'], range: { min: 1, max: 3 }, selection: {} });
  });
});

describe('the comparison through the view (compare.md, view-state.md 3)', () => {
  it('setView turns it on: the axis compared, the change told', async () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'inline-size:600px;block-size:400px');
    document.body.appendChild(el);
    const { compare } = await import('@dzgraph/dom');
    const c = chart(el, { animation: false, ...TWO }, { types: allTypes, features: [compare] });
    made.push({ el, c });
    const seen: unknown[] = [];
    c.on('viewChange', (d) => seen.push(d.changed));
    c.setView({ compare: { mode: 'percent', to: null } });
    await raf2();
    expect(c.getView().compare).toEqual({ mode: 'percent', to: null });
    expect(seen).toEqual([['compare']]);
    const labels = [...el.querySelectorAll('[data-layer="labels"] text')].map((t) => t.textContent);
    expect(labels).toContain('+100%');
  });
});

describe('setView (3) and viewChange (4)', () => {
  it('brings a saved view back, and says so: from the app', async () => {
    const { el, c } = mount(TWO);
    const seen: unknown[] = [];
    c.on('viewChange', (d) => seen.push([d.source, d.changed, d.view]));
    c.setView({ hidden: ['a'], range: { min: 2, max: 4 } });
    await raf2();
    expect(c.getView()).toEqual({ hidden: ['a'], range: { min: 2, max: 4 }, selection: {} });
    expect(seen).toEqual([['app', ['hidden', 'range'], { hidden: ['a'], range: { min: 2, max: 4 }, selection: {} }]]);
    // The legend item of A is off.
    expect(el.querySelectorAll('.dzgraph-legend-button')[0]!.getAttribute('aria-pressed')).toBe('false');
  });

  it('a user\'s change: from the user', () => {
    const { el, c } = mount(TWO);
    const seen: unknown[] = [];
    c.on('viewChange', (d) => seen.push([d.source, d.changed]));
    el.querySelectorAll<SVGElement>('.dzgraph-legend-button')[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(seen).toEqual([['user', ['hidden']]]);
  });

  it('a bad view: what it can, the rest reported, never a throw', async () => {
    const { c } = mount(TWO);
    let problems: readonly unknown[] = [];
    c.on('problems', (d) => (problems = d.problems));
    c.setView({ hidden: ['nope'], range: { min: 2, max: 4 } });
    c.setView('garbage' as never); // Plain JavaScript may pass anything.
    await raf2();
    expect(problems).toEqual([{ code: 'invalid-view', path: 'view' }]);
    expect(c.getView()).toEqual({ hidden: [], range: { min: 2, max: 4 }, selection: {} });
  });
});
