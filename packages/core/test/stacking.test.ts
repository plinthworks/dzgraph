// Stacking (stacking.md): which series stack, the piles (positives up, negatives down, gaps), percent, the axis taking
// the piles in, the columns in one slot with only the pile's end rounded, the points, the tooltip. Phase 4 step 3.
// Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { stacksOf } from '../src/stack.js';
import { pointAt } from '../src/points.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel, summary } from '../src/a11y.js';
import type { RectPrimitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const lay = (model: Parameters<typeof layout>[0]['model'], view?: Parameters<typeof layout>[0]['view']) =>
  layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', ...(view ? { view } : {}) });
const arr = (a: ArrayLike<number>) => Array.from(a);

// a: 1, 2, −1, gap; b: 3, −2, −4, 5 (stack.md 4–5 by hand).
const AB = [
  { type: 'column', id: 'a', stack: true, data: [1, 2, -1, null] },
  { type: 'column', id: 'b', stack: true, data: [3, -2, -4, 5] },
];

describe('reading `stack` and `stacking` (stacking.md 1, 9, 11)', () => {
  it('`true` is the stack `default`, a string names one, none stands alone', () => {
    const { model, problems } = normalize({ series: [...AB, { type: 'column', id: 'c', stack: 'other', data: [1] }, { type: 'column', id: 'd', data: [1] }] }, types);
    expect(problems).toEqual([]);
    expect(model.series.map((s) => s.stack)).toEqual(['default', 'default', 'other', null]);
  });

  it('a `stack` of another kind is reported and left out; on a line it is not an option', () => {
    const { model, problems } = normalize({ series: [{ type: 'area', id: 'a', stack: 3, data: [1] }, { type: 'line', id: 'b', stack: true, data: [1] }] }, types);
    expect(problems).toEqual([
      { code: 'invalid-option', path: 'series[0].stack', seriesId: 'a' },
      { code: 'unknown-option', path: 'series[1].stack', seriesId: 'b' },
    ]);
    expect(model.series.map((s) => s.stack)).toEqual([null, null]);
  });

  it('`stacking: "percent"` on the y axis is read; on an x axis, on an axis without piles, or another word: reported', () => {
    const ok = normalize({ yAxis: { stacking: 'percent' }, series: AB }, types);
    expect(ok.problems).toEqual([]);
    expect(ok.model.yAxes[0]!.stacking).toBe('percent');
    const bad = normalize({ xAxis: { stacking: 'percent' }, yAxis: [{ stacking: 'normal' }, { id: 'y2', stacking: 'percent' }], series: AB }, types);
    expect(bad.problems).toEqual([
      { code: 'invalid-option', path: 'xAxis[0].stacking' },
      { code: 'invalid-option', path: 'yAxis[0].stacking' },
      { code: 'invalid-option', path: 'yAxis[1].stacking' },
    ]);
    expect(bad.model.yAxes.map((a) => a.stacking)).toEqual([null, null]);
  });
});

describe('the piles (stacking.md 3–6, 10, 18)', () => {
  it('positives up, negatives down, each on its own pile; a gap adds nothing', () => {
    const { model } = normalize({ series: AB }, types);
    const st = stacksOf(model, undefined);
    const a = st.get('a')!;
    const b = st.get('b')!;
    expect(arr(a.base)).toEqual([0, 0, 0, Number.NaN]);
    expect(arr(a.top)).toEqual([1, 2, -1, Number.NaN]);
    expect(arr(b.base)).toEqual([1, 0, -1, 0]);
    expect(arr(b.top)).toEqual([4, -2, -5, 5]);
    // The pile's free end: a's top at 1 (only positive there), b's everywhere else.
    expect(arr(a.outer)).toEqual([0, 1, 0, 0]);
    expect(arr(b.outer)).toEqual([1, 1, 1, 1]);
    expect(arr(a.share)).toEqual([0.25, 0.5, 0.2, Number.NaN]);
    expect(arr(b.share)).toEqual([0.75, 0.5, 0.8, 1]);
    expect(arr(b.total)).toEqual([4, 0, -5, 5]);
  });

  it('percent: shares of the sum of absolute values, each on its side', () => {
    const { model } = normalize({ yAxis: { stacking: 'percent' }, series: AB }, types);
    const st = stacksOf(model, undefined);
    expect(arr(st.get('a')!.top)).toEqual([25, 50, -20, Number.NaN]);
    expect(arr(st.get('b')!.base)).toEqual([25, 0, -20, 0]);
    expect(arr(st.get('b')!.top)).toEqual([100, -50, -100, 100]);
  });

  it('a hidden series leaves its pile', () => {
    const { model } = normalize({ series: AB }, types);
    const st = stacksOf(model, { hidden: new Set(['a']) });
    expect(st.has('a')).toBe(false);
    expect(arr(st.get('b')!.base)).toEqual([0, 0, 0, 0]);
    expect(arr(st.get('b')!.share)).toEqual([1, 1, 1, 1]);
  });

  it('areas stack by equal x; a missing x counts as zero; other names, types and axes are other piles', () => {
    const { model } = normalize({
      yAxis: [{}, { id: 'y2' }],
      series: [
        { type: 'area', id: 'a', stack: true, data: [[0, 1], [1, 1]] },
        { type: 'area', id: 'b', stack: true, data: [[1, 2], [2, 2]] },
        { type: 'area', id: 'c', stack: 'other', data: [[1, 7]] },
        { type: 'column', id: 'd', stack: true, data: [[1, 9]] },
        { type: 'area', id: 'e', stack: true, yAxis: 'y2', data: [[1, 9]] },
        { type: 'area', id: 'f', data: [[1, 9]] },
      ],
    }, types);
    const st = stacksOf(model, undefined);
    expect(arr(st.get('b')!.base)).toEqual([1, 0]);
    for (const id of ['c', 'd', 'e']) expect(arr(st.get(id)!.base)).toEqual([0]);
    expect(st.has('f')).toBe(false);
  });

  it('an x whose pile totals zero draws nothing in percent', () => {
    const { model } = normalize({ yAxis: { stacking: 'percent' }, series: [{ type: 'column', id: 'a', stack: true, data: [0, 1] }, { type: 'column', id: 'b', stack: true, data: [0, 1] }] }, types);
    const st = stacksOf(model, undefined);
    expect(arr(st.get('b')!.base)).toEqual([0, 50]);
    expect(arr(st.get('b')!.top)).toEqual([0, 100]);
    expect(arr(st.get('b')!.share)).toEqual([Number.NaN, 0.5]);
  });
});

describe('drawn (stacking.md 2, 8, 9, 12)', () => {
  it('the value axis takes the piles in: 1 + 3 on 2 + 4 reach 6, not 4', () => {
    const { model } = normalize({ series: [{ type: 'column', stack: true, data: [1, 2] }, { type: 'column', stack: true, data: [3, 4] }] }, types);
    const y = lay(model).axes.find((a) => a.dimension === 'y')!;
    expect(y.ticks.at(-1)!.value).toBe(6);
  });

  it('percent: the axis runs to 100, its labels read as percents', () => {
    const { model } = normalize({ yAxis: { stacking: 'percent' }, series: [{ type: 'column', stack: true, data: [1, 2] }, { type: 'column', stack: true, data: [3, 4] }] }, types);
    const y = lay(model).axes.find((a) => a.dimension === 'y')!;
    expect(y.ticks[0]!.value).toBe(0);
    expect(y.ticks.at(-1)!.value).toBe(100);
    expect(y.ticks.at(-1)!.label?.text).toBe('100%');
  });

  it('a pile is one slot; the upper segment sits on the lower one, 2 px apart; only the end is rounded', () => {
    const { model } = normalize({ series: [{ type: 'column', id: 'a', stack: true, data: [2] }, { type: 'column', id: 'b', stack: true, data: [2] }, { type: 'column', id: 'c', data: [2] }] }, types);
    const l = lay(model);
    const scene = composeScene({ model, types, layout: l, measureText });
    const rects = scene.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items as RectPrimitive[]);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => rects.find((r) => r.point?.seriesId === id)!);
    expect(b!.x).toBe(a!.x);
    expect(b!.width).toBe(a!.width);
    expect(c!.x).not.toBe(a!.x);
    expect(a!.y - (b!.y + b!.height)).toBe(2);
    expect(a!.radius ?? 0).toBe(0);
    expect(b!.radius).toBe(4);
  });

  it('a point is where its segment ends', () => {
    const { model } = normalize({ series: AB }, types);
    const l = lay(model);
    const y = l.axes.find((a) => a.dimension === 'y')!.scale;
    expect(pointAt(model, l, { seriesId: 'b', index: 0 })!.y).toBe(y.map(4));
    expect(pointAt(model, l, { seriesId: 'b', index: 2 })!.y).toBe(y.map(-5));
  });
});

describe('the tooltip (stacking.md 14)', () => {
  it('a stacked column: its value, its share and the pile\'s total', () => {
    const { model } = normalize({ series: AB }, types);
    const t = tooltipOf(model, lay(model), { points: [{ seriesId: 'b', index: 0 }] }, 'en-US', text);
    expect(t.rows.map((r) => [r.value, r.share])).toEqual([['3', '75%']]);
    expect(t.total).toBe('4');
  });

  it('stacked areas: the layers top to bottom, then the total; unstacked: neither', () => {
    const { model } = normalize({ series: [{ type: 'area', id: 'a', stack: true, data: [1, 2] }, { type: 'area', id: 'b', stack: true, data: [3, 6] }] }, types);
    const t = tooltipOf(model, lay(model), { points: [{ seriesId: 'a', index: 1 }, { seriesId: 'b', index: 1 }] }, 'en-US', text);
    expect(t.rows.map((r) => [r.seriesId, r.value, r.share])).toEqual([['b', '6', '75%'], ['a', '2', '25%']]);
    expect(t.total).toBe('8');
    const plain = normalize({ series: [{ type: 'area', id: 'a', data: [1, 2] }] }, types).model;
    const u = tooltipOf(plain, lay(plain), { points: [{ seriesId: 'a', index: 1 }] }, 'en-US', text);
    expect([u.rows[0]!.share, u.total]).toEqual([undefined, undefined]);
  });
});

describe('screen readers and the table (stacking.md 16, 17)', () => {
  const words = { ...text, stackTotal: (stack: string | null) => (stack === null ? 'Total' : `Total ${stack}`) };

  it('a stacked point is read with its share and its pile\'s total; the summary says the series are stacked', () => {
    const { model } = normalize({ series: AB }, types);
    const l = lay(model);
    expect(pointLabel(model, l, { seriesId: 'b', index: 0 }, 'en-US', text)).toEqual({ series: 'Série 2', x: '0', y: '3', share: '75%', total: '4', position: 1, count: 4 });
    expect(pointLabel(model, l, { seriesId: 'a', index: 3 }, 'en-US', text)?.share).toBeUndefined();
    expect(summary(model, l, undefined, 'en-US', text).stacked).toBe(true);
    const plain = normalize({ series: [{ type: 'column', data: [1] }] }, types).model;
    expect(summary(plain, lay(plain), undefined, 'en-US', text).stacked).toBe(false);
  });

  it('the table adds each pile\'s total after its series; the default pile\'s is « Total »', () => {
    const { model } = normalize({
      series: [
        { type: 'column', name: 'A', stack: true, data: [1, 2] },
        { type: 'column', name: 'B', stack: true, data: [3, null] },
        { type: 'column', name: 'C', stack: 'x', data: [5, 6] },
        { type: 'column', name: 'D', data: [7, 8] },
      ],
    }, types);
    const t = dataTable(model, lay(model), undefined, 'en-US', words);
    expect(t.columns).toEqual(['A', 'B', 'Total', 'C', 'Total x', 'D']);
    expect(t.rows).toEqual([['0', '1', '3', '4', '5', '5', '7'], ['1', '2', '', '2', '6', '6', '8']]);
    // Without a word for totals (an app's own reader of the rows), no total column.
    expect(dataTable(model, lay(model), undefined, 'en-US', text).columns).toEqual(['A', 'B', 'C', 'D']);
  });
});
