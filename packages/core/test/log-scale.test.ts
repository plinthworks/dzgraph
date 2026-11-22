// The logarithmic scale (log-scale.md): values of zero or below become reported gaps, bounds of zero or below are left
// out, ends rounded to powers of ten (or to 1-2-5 ticks within a decade), ticks per decade by room, labels, columns
// from the bottom, no stacking. Phase 4 step 4. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { pointAt } from '../src/points.js';
import type { RectPrimitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const lay = (options: unknown) => {
  const { model, problems } = normalize(options, types);
  return { model, problems, l: layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' }) };
};
const yTicks = (options: unknown) => lay(options).l.axes.find((a) => a.dimension === 'y')!.ticks;
const values = (options: unknown) => yTicks(options).map((t) => t.value);
const LOG = { scale: 'log' } as const;
const line = (data: unknown, axis: object = LOG) => ({ yAxis: axis, series: [{ type: 'line', id: 's', data }] });

describe('reading (log-scale.md 1–3, 10)', () => {
  it('drawn, not reported as a scale to come', () => {
    expect(lay(line([1, 10, 100])).problems).toEqual([]);
  });

  it('zero and negative values are gaps, reported once with their count', () => {
    const { model, problems } = lay(line([10, 0, -5, 100]));
    expect(problems).toEqual([{ code: 'non-positive-log-value', path: 'series[0].data[1]', seriesId: 's', detail: 'count=2' }]);
    expect(Array.from(model.series[0]!.columns.y)).toEqual([10, Number.NaN, Number.NaN, 100]);
  });

  it('on a log x axis, a scatter point at x ≤ 0 is a gap too', () => {
    const { model, problems } = lay({ xAxis: LOG, series: [{ type: 'scatter', id: 's', data: [[-1, 4], [10, 5]] }] });
    expect(problems).toEqual([{ code: 'non-positive-log-value', path: 'series[0].data[0]', seriesId: 's', detail: 'count=1' }]);
    expect(Number.isNaN(model.series[0]!.columns.y[0]!)).toBe(true);
  });

  it('a bound of zero or below is reported and left out', () => {
    const { model, problems } = lay(line([5, 50], { scale: 'log', min: 0, max: -2 }));
    expect(problems).toEqual([
      { code: 'invalid-option', path: 'yAxis[0].min' },
      { code: 'invalid-option', path: 'yAxis[0].max' },
    ]);
    expect([model.yAxes[0]!.min, model.yAxes[0]!.max]).toEqual([null, null]);
  });

  it('stacking on a log axis: reported, the series stand alone', () => {
    const { model, problems, l } = lay({ yAxis: LOG, series: [{ type: 'column', id: 'a', stack: true, data: [1] }, { type: 'column', id: 'b', stack: true, data: [2] }] });
    expect(problems).toEqual([
      { code: 'invalid-option', path: 'series[0].stack', seriesId: 'a' },
      { code: 'invalid-option', path: 'series[1].stack', seriesId: 'b' },
    ]);
    expect(model.series.map((s) => s.stack)).toEqual([null, null]);
    expect(l.stacks.size).toBe(0);
  });
});

describe('ends and ticks (log-scale.md 3, 4, 7)', () => {
  it('over several decades: from power of ten to power of ten, one tick each', () => {
    expect(values(line([13, 87_000]))).toEqual([10, 100, 1_000, 10_000, 100_000]);
  });

  it('within a decade: to the nearest 1-2-5 tick, with 1, 2 and 5 ticks', () => {
    expect(values(line([13, 87]))).toEqual([10, 20, 50, 100]);
    expect(values(line([120, 180]))).toEqual([100, 200]);
  });

  it('more decades than room: every second power of ten, from a multiple of two', () => {
    expect(values(line([1, 1e6], { scale: 'log', ticks: { target: 4 } }))).toEqual([1, 100, 10_000, 1_000_000]);
  });

  it('much room: 2 to 9 times each power too', () => {
    expect(values(line([1, 10], { scale: 'log', ticks: { target: 10 } }))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('a bound the app gives is kept exactly, ticks inside it', () => {
    const t = values(line([13, 870], { scale: 'log', min: 3, max: 900 }));
    expect([t[0], t.at(-1)]).toEqual([10, 100]);
    const y = lay(line([13, 870], { scale: 'log', min: 3, max: 900 })).l.axes.find((a) => a.dimension === 'y')!.scale;
    expect(y.invert(y.map(3))).toBeCloseTo(3);
  });

  it('one value: the decade around it; a power of ten alone, one decade each side', () => {
    const five = values(line([5, 5]));
    expect([five[0], five.at(-1)]).toEqual([1, 10]);
    const ten = values(line([10]));
    expect([ten[0], ten.at(-1)]).toEqual([1, 100]);
  });

  it('no positive value: 1 to 10, and « no data »', () => {
    const { l } = lay(line([0, -1]));
    expect(l.noData?.text).toBe('Aucune donnée');
  });
});

describe('labels and marks (log-scale.md 5, 8)', () => {
  it('each label with its own decimals; short forms past 10 000', () => {
    expect(yTicks(line([0.01, 10])).map((t) => t.label?.text)).toEqual(['0.01', '0.1', '1', '10']);
    expect(yTicks(line([13, 87_000])).map((t) => t.label?.text)).toEqual(['10', '100', '1K', '10K', '100K']);
  });

  it('equal ratios, equal lengths: 100 halfway between 10 and 1 000', () => {
    const { model, l } = lay(line([10, 100, 1_000]));
    const y0 = pointAt(model, l, { seriesId: 's', index: 0 })!.y;
    const y1 = pointAt(model, l, { seriesId: 's', index: 1 })!.y;
    const y2 = pointAt(model, l, { seriesId: 's', index: 2 })!.y;
    expect(y1 - y0).toBeCloseTo(y2 - y1, 6);
  });

  it('columns grow from the bottom of the axis', () => {
    const { model, l } = lay({ yAxis: LOG, series: [{ type: 'column', data: [10, 1_000] }] });
    const scene = composeScene({ model, types, layout: l, measureText });
    const rects = scene.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items as RectPrimitive[]);
    const bottom = Math.round(l.plot.y + l.plot.height);
    expect(rects.map((r) => r.y + r.height)).toEqual([bottom, bottom]);
  });
});

describe('with the other axis rules (log-scale.md 9, 11)', () => {
  it('reversed: the smallest value at the top', () => {
    const { model, l } = lay(line([10, 1_000], { scale: 'log', reversed: true }));
    expect(pointAt(model, l, { seriesId: 's', index: 0 })!.y).toBeCloseTo(l.plot.y, 6);
  });

  it('a second axis on a log scale: its own powers of ten, no gridlines of its own', () => {
    const { l } = lay({ yAxis: [{}, { id: 'y2', scale: 'log', opposite: true }], series: [{ type: 'line', data: [1, 2, 3] }, { type: 'line', yAxis: 'y2', data: [10, 100, 1_000] }] });
    const y2 = l.axes.find((a) => a.id === 'y2')!;
    expect(y2.ticks.map((t) => t.value)).toEqual([10, 100, 1_000]);
    expect(y2.grid).toBe(false);
  });
});
