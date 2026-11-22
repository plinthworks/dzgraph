// The navigator, the range buttons' spans and the table following the visible range (navigator.md, range-buttons.md,
// data-table.md 5). Step 3.6. Expectations by hand; Date.UTC writes instants in tests only.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { rangeButtonSpan } from '../src/navigator.js';
import { dataRows, dataTable } from '../src/a11y.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const utc = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h);

const LINE = { navigator: true, series: [{ type: 'line', id: 'a', data: Array.from({ length: 101 }, (_, i) => i % 7) }] };

describe('the navigator\'s place (navigator.md 1)', () => {
  it('a strip under the plot, as wide, with its labels; off by default', () => {
    const { model } = normalize(LINE, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const nav = l.navigator!;
    expect([nav.box.x, nav.box.width]).toEqual([l.plot.x, l.plot.width]);
    expect(nav.box.height).toBe(40);
    // Under the x axis's labels.
    const xLabels = l.axes.find((a) => a.id === 'x')!.ticks[0]!.label!;
    expect(nav.box.y).toBeGreaterThan(xLabels.y + 12);
    expect(nav.labels.length).toBeGreaterThan(1);
    expect(nav.labels[0]!.y).toBeGreaterThanOrEqual(nav.box.y + nav.box.height);
    const off = layout({ model: normalize({ series: LINE.series }, types).model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    expect(off.navigator).toBeNull();
    expect(off.plot.height).toBeGreaterThan(l.plot.height);
  });

  it('it maps the whole extent, whatever the zoom', () => {
    const { model } = normalize(LINE, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view: { range: { x: { min: 20, max: 40 } } } });
    const nav = l.navigator!;
    expect([nav.map(0), nav.map(100)]).toEqual([nav.box.x, nav.box.x + nav.box.width]);
    expect(nav.extent).toEqual({ min: 0, max: 100, step: 1 });
  });
});

describe('what the navigator draws (navigator.md 1–2)', () => {
  it('the series thin, the outside shaded, two handles on the window\'s edges', () => {
    const { model } = normalize(LINE, types);
    const view = { range: { x: { min: 20, max: 40 } } };
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view });
    const scene = composeScene({ model, types, layout: l, measureText, view });
    const items = scene.layers.find((x) => x.id === 'navigator')!.groups.flatMap((g) => g.items);
    const byId = new Map(items.map((p) => [p.sceneId, p]));
    expect(byId.get('nav/series/a')!.kind).toBe('path');
    const before = byId.get('nav/shade/start')!;
    const nav = l.navigator!;
    expect(before.kind === 'rect' && [before.x, before.width]).toEqual([nav.box.x, nav.map(20) - nav.box.x]);
    const handle = byId.get('nav/handle/end')!;
    expect(handle.kind === 'rect' && handle.x + handle.width / 2).toBe(nav.map(40));
  });
});

describe('the range buttons\' spans (range-buttons.md 2–3)', () => {
  const days = (from: number, n: number) => Array.from({ length: n }, (_, i) => [from + i * 86_400_000, i] as [number, number]);
  const { model } = normalize({ xAxis: { scale: 'time', zone: 'Europe/Paris' }, series: [{ type: 'line', data: days(utc(2025, 6, 1, 10), 400) }] }, types);
  // The last point: 2026-07-05 10:00 UTC, 12:00 in Paris.
  const last = utc(2025, 6, 1, 10) + 399 * 86_400_000;

  it('calendar months back from the last point, in the axis\'s zone', () => {
    expect(rangeButtonSpan(model, 'x', '1m')).toEqual({ min: utc(2026, 6, 5, 10), max: last, fits: true });
    expect(rangeButtonSpan(model, 'x', '3m')).toEqual({ min: utc(2026, 4, 5, 10), max: last, fits: true });
  });

  it('from 1 January in the zone; one year back', () => {
    expect(rangeButtonSpan(model, 'x', 'ytd')).toEqual({ min: utc(2025, 12, 31, 23), max: last, fits: true });
    expect(rangeButtonSpan(model, 'x', '1y')).toEqual({ min: utc(2025, 7, 5, 10), max: last, fits: true });
  });

  it('a span longer than the data does not fit', () => {
    const { model: short } = normalize({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', data: days(utc(2026, 3, 1), 40) }] }, types);
    expect(rangeButtonSpan(short, 'x', '3m')!.fits).toBe(false);
    expect(rangeButtonSpan(short, 'x', '1m')!.fits).toBe(true);
  });

  it('a 31st one month back lands on the last day of a shorter month', () => {
    const { model: m } = normalize({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', data: [[utc(2026, 1, 1), 1], [utc(2026, 3, 31), 2]] }] }, types);
    expect(rangeButtonSpan(m, 'x', '1m')!.min).toBe(utc(2026, 2, 28));
  });
});

describe('the table follows the visible range (data-table.md 5)', () => {
  it('rows in view only, and the range in words; all of them on request', () => {
    const { model } = normalize({ series: [{ type: 'line', id: 'a', data: [5, 6, 7, 8, 9] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const view = { range: { x: { min: 1, max: 3 } } };
    expect(dataRows(model, l, view).rows.map((r) => r.x)).toEqual([1, 2, 3]);
    const t = dataTable(model, l, view, 'en-US', text);
    expect(t.range).toEqual({ from: '1', to: '3' });
    expect(dataRows(model, l, view, 'all').rows.length).toBe(5);
    expect(dataTable(model, l, view, 'en-US', text, 'all').range).toBeNull();
  });
});

describe('range buttons asked on an axis that is not of time (range-buttons.md 1)', () => {
  it('reported, and no row is kept for them', () => {
    const { model, problems } = normalize({ rangeButtons: true, series: [{ type: 'line', data: [1, 2, 3] }] }, types);
    expect(problems).toEqual([{ code: 'not-available', path: 'rangeButtons', detail: 'not-time' }]);
    expect(layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' }).rangeBar).toBeNull();
  });
});
