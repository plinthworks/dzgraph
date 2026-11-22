// Aggregation (aggregation.md): points grouped by period on the zone's calendar, or by bucket of x; a function per
// series; the groups kept to map a selection both ways. Phase 5b step 7. Expectations by hand.
import { describe, it, expect } from 'vitest';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { aggregationKit } from '../src/aggregation.js';
import { periodStart } from '../src/time.js';
import { xValueLabel } from '../src/tooltip.js';
import { FULL_KIT } from './helpers/kit.js';
import { NO_KIT } from '../src/kit.js';

const D = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);
const read = (options: object, kit = FULL_KIT) => normalize(options, allTypes, { kit, zone: 'UTC' });

describe('period starts on the zone\'s calendar (aggregation.md 1)', () => {
  it('hour, day, ISO week (Monday), month, quarter, year; in Paris too', () => {
    const t = D(2026, 3, 5, 13) + 1234; // Thursday 5 March 2026, 13:00:01.234 UTC
    expect(periodStart(t, 'hour', 'UTC')).toBe(D(2026, 3, 5, 13));
    expect(periodStart(t, 'day', 'UTC')).toBe(D(2026, 3, 5));
    expect(periodStart(t, 'week', 'UTC')).toBe(D(2026, 3, 2));
    expect(periodStart(t, 'month', 'UTC')).toBe(D(2026, 3, 1));
    expect(periodStart(t, 'quarter', 'UTC')).toBe(D(2026, 1, 1));
    expect(periodStart(t, 'year', 'UTC')).toBe(D(2026, 1, 1));
    // Midnight in Paris on 5 March (UTC+1) is 23:00 UTC the day before.
    expect(periodStart(t, 'day', 'Europe/Paris')).toBe(D(2026, 3, 4, 23));
  });
});

describe('reading (aggregation.md 7)', () => {
  it('on the x axis with its module; not on categories; a series\' function', () => {
    expect(read({ xAxis: { scale: 'time', aggregate: 'month' }, series: [{ type: 'line', aggregate: 'max', data: [[D(2026, 1, 1), 1]] }] }).model.xAxes[0]!.aggregate).toEqual({ period: 'month' });
    expect(read({ xAxis: { aggregate: { step: 10 } }, series: [{ type: 'line', data: [1] }] }).model.series[0]!.aggregate).toBe('mean');
    expect(read({ xAxis: { aggregate: { step: 5 } }, series: [{ type: 'column', data: [1] }] }, NO_KIT).problems).toEqual([{ code: 'missing-module', path: 'xAxis[0].aggregate', detail: 'aggregation' }]);
    expect(read({ xAxis: { scale: 'category', categories: ['a'] }, series: [{ type: 'column', data: [1] }] }).problems).toEqual([]);
    expect(read({ xAxis: { aggregate: 'fortnight' }, series: [{ type: 'line', data: [1] }] }).problems).toEqual([{ code: 'invalid-option', path: 'xAxis[0].aggregate' }]);
    expect(read({ xAxis: { aggregate: 'month' }, series: [{ type: 'line', data: [1] }] }).problems).toEqual([{ code: 'invalid-option', path: 'xAxis[0].aggregate' }]);
  });
});

describe('grouping (aggregation.md 1, 2)', () => {
  const data = [[D(2026, 1, 5), 10], [D(2026, 1, 20), 20], [D(2026, 3, 1), 30], [D(2026, 3, 9), null], [D(2026, 3, 30), 50]] as const;

  it('by month: a mean for lines, a sum for columns; an empty month is no point; gaps count for nothing', () => {
    const { model } = read({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'l', data }, { type: 'column', id: 'c', data }] });
    const a = aggregationKit.apply(model, { period: 'month' })!;
    const [l, c] = a.model.series;
    expect([Array.from(l!.columns.x), Array.from(l!.columns.y)]).toEqual([[D(2026, 1, 1), D(2026, 3, 1)], [15, 40]]);
    expect(Array.from(c!.columns.y)).toEqual([30, 80]);
    expect(Array.from(a.counts.get('l')!)).toEqual([2, 2]);
    expect(a.model.xAxes[0]!.period).toEqual({ period: 'month' });
  });

  it('min, max, count; by a step of x', () => {
    const { model } = read({ series: [{ type: 'scatter', id: 's', aggregate: 'max', data: [[1, 5], [9, 7], [12, 1], [25, 3]] }, { type: 'scatter', id: 'n', aggregate: 'count', data: [[1, 5], [9, 7], [12, 1]] }] });
    const a = aggregationKit.apply(model, { step: 10 })!;
    expect([Array.from(a.model.series[0]!.columns.x), Array.from(a.model.series[0]!.columns.y)]).toEqual([[0, 10, 20], [7, 1, 3]]);
    expect(Array.from(a.model.series[1]!.columns.y)).toEqual([2, 1]);
  });

  it('a selection both ways (aggregation.md 5): any point of a period selects it; a period selects all its points', () => {
    const { model } = read({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'l', data }] });
    const a = aggregationKit.apply(model, { period: 'month' })!;
    expect(Array.from(a.forth(new Map([['l', Uint8Array.of(0, 1, 0, 0, 0)]])).get('l')!)).toEqual([1, 0]);
    // March's points with a value: 30 and 50; the gap between them is not a point.
    expect(Array.from(a.back(new Map([['l', Uint8Array.of(0, 1)]])).get('l')!)).toEqual([0, 0, 1, 0, 1]);
  });

  it('a period read as a range of dates; a bucket as a range of numbers', () => {
    const { model } = read({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'l', data }] });
    const a = aggregationKit.apply(model, { period: 'quarter' })!;
    // ICU's spaces around the dash differ between engines (a thin space, a plain one): compared as spaces.
    expect(xValueLabel(a.model, 'x', D(2026, 1, 1), 'en-US').replace(/\s/g, ' ')).toBe('Jan – Mar 2026');
    const b = aggregationKit.apply(read({ series: [{ type: 'line', data: [1, 2] }] }).model, { step: 10 })!;
    expect(xValueLabel(b.model, 'x', 10, 'en-US')).toBe('10–20');
  });
});

describe('the summary (aggregation.md 8)', () => {
  it('says by what and how', async () => {
    const { summary } = await import('../src/a11y.js');
    const { layout } = await import('../src/layout.js');
    const { model } = read({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', data: [[D(2026, 1, 1), 1], [D(2026, 2, 1), 2]] }, { type: 'column', data: [[D(2026, 1, 1), 1]] }] });
    const a = aggregationKit.apply(model, { period: 'month' })!;
    const l = layout({ model: a.model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText: () => ({ width: 10, ascent: 9, descent: 3 }), text: { seriesName: (n) => `S${n}`, noData: '', ellipsis: '…' }, locale: 'en-US' });
    expect(summary(a.model, l, undefined, 'en-US', { seriesName: (n) => `S${n}` }).aggregation).toEqual({ by: { period: 'month' }, fns: ['mean', 'sum'] });
  });
});

describe('review (Phase 5b close)', () => {
  it('6: a step of 0.1 puts 0.3 in the bucket of 0.3, written 0.3', () => {
    const { model } = read({ series: [{ type: 'line', id: 'l', data: [[0.3, 1], [0.35, 3]] }] });
    const a = aggregationKit.apply(model, { step: 0.1 })!;
    expect(Array.from(a.model.series[0]!.columns.x)).toEqual([0.3]);
  });

  it('7: an x past the dates a calendar can show is a gap, never a throw', () => {
    const { model } = read({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'l', data: { x: [1e16, D(2026, 1, 1)], y: [1, 2] } }] });
    const a = aggregationKit.apply(model, { period: 'month' })!;
    expect(Array.from(a.model.series[0]!.columns.y)).toEqual([2]);
  });

  it('8: a view\'s aggregation of the wrong kind for the axis is reported', async () => {
    const { viewFromJson } = await import('../src/view-json.js');
    const { model } = read({ series: [{ type: 'line', data: [1, 2] }] });
    expect(viewFromJson(model, { aggregation: { period: 'month' } }).problems).toEqual([{ code: 'invalid-view', path: 'view.aggregation' }]);
  });
});
