// Aggregation in a real browser (aggregation.md, view-state.md): by the option, by the view; the tooltip's count; a
// selection made on an aggregated point kept as the app's points.
import { describe, it, expect, afterEach } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { aggregation, chart, selection, timeAxis, zoom, type Chart } from '@dzgraph/dom';

const made: { el: HTMLElement; c: Chart }[] = [];
function mount(options: Parameters<typeof chart>[1]) {
  const el = document.createElement('div');
  el.setAttribute('style', 'inline-size:600px;block-size:400px');
  el.lang = 'en';
  document.body.appendChild(el);
  const c = chart(el, { animation: false, ...options }, { types: allTypes, features: [timeAxis, zoom, selection, aggregation] });
  made.push({ el, c });
  return { el, c, svg: el.querySelector('svg')! };
}
afterEach(() => {
  for (const { el, c } of made.splice(0)) {
    c.destroy();
    el.remove();
  }
});
const raf2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const D = (m: number, d: number) => Date.UTC(2026, m - 1, d);
const DAYS = { selection: true, dataTable: true, xAxis: { scale: 'time' as const, zone: 'UTC' }, series: [{ type: 'column' as const, id: 'c', data: [[D(1, 5), 1], [D(1, 20), 2], [D(2, 3), 4], [D(3, 1), 8]] as [number, number][] }] };

describe('aggregation through the view (aggregation.md 1, 3; view-state.md 3)', () => {
  it('by month: three columns (sums), months in the table; back to days with null', async () => {
    const { el, c } = mount(DAYS);
    const seen: unknown[] = [];
    c.on('viewChange', (d) => seen.push(d.changed));
    c.setView({ aggregation: { period: 'month' } });
    await raf2();
    const rows = () => [...el.querySelectorAll('.dzgraph-table tbody tr')].map((r) => [...r.children].map((x) => x.textContent));
    expect(rows()).toEqual([['January 2026', '3'], ['February 2026', '4'], ['March 2026', '8']]);
    expect(c.getView().aggregation).toEqual({ period: 'month' });
    expect(seen).toEqual([['aggregation']]);
    c.setView({ aggregation: null });
    await raf2();
    expect(rows()).toHaveLength(4);
  });

  it('selecting January selects its two days, kept as the app\'s points', async () => {
    const { el, c, svg } = mount(DAYS);
    c.setView({ aggregation: { period: 'month' } });
    c.setMode('selection');
    await raf2();
    const told: unknown[] = [];
    c.on('selectionChange', (d) => told.push(d.series.map((x) => [x.id, [...x.indices]])));
    const col = [...svg.querySelectorAll('[data-layer="series"] path, [data-layer="series"] rect')][0]!.getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    const x = col.left - box.left + col.width / 2;
    const y = col.top - box.top + col.height / 2;
    for (const type of ['pointerdown', 'pointerup', 'click']) svg.dispatchEvent(new (type === 'click' ? MouseEvent : PointerEvent)(type, { clientX: box.left + x, clientY: box.top + y, bubbles: true, button: 0, pointerId: 1, pointerType: 'mouse' }));
    await raf2();
    expect(c.getView().selection).toEqual({ c: [0, 1] });
    // The event names the app's points, not the month drawn (found while linking charts).
    expect(told).toEqual([[['c', [0, 1]]]]);
    void el;
  });
});
