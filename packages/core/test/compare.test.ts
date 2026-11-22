// Comparison to a baseline (compare.md): each series as an affine of its values, its baseline the first point in
// view or the app's date. Phase 5a step 4. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel } from '../src/a11y.js';
import { pointAt } from '../src/points.js';
import { FULL_KIT } from './helpers/kit.js';
import { NO_KIT } from '../src/kit.js';
import type { View } from '../src/view.js';
import type { LinePrimitive, PathPrimitive } from '../src/scene.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function build(options: object, view?: View, kit = FULL_KIT) {
  const { model, problems } = normalize(options, allTypes, { kit });
  const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', ...(view ? { view } : {}) });
  const scene = composeScene({ model, types: allTypes, layout: l, measureText, ...(view ? { view } : {}) });
  return { model, problems: [...problems, ...l.problems], l, scene };
}
// x 0–3; y 10, 20, 15, 30.
const LINE = (compare: object) => ({ yAxis: compare, series: [{ type: 'line', id: 'a', data: [10, 20, 15, 30] }] });
const yTicks = (l: ReturnType<typeof build>['l']) => l.axes.find((a) => a.dimension === 'y')!.ticks.map((t) => t.label?.text);

describe('reading (compare.md 7)', () => {
  it('on a y axis, with its module; not on a log axis nor a stacked one', () => {
    expect(build(LINE({ compare: 'percent' })).model.yAxes[0]!.compare).toEqual({ mode: 'percent', to: null });
    expect(build(LINE({ compare: 'index', compareTo: 2 })).model.yAxes[0]!.compare).toEqual({ mode: 'index', to: 2 });
    expect(build(LINE({ compare: 'percent' }), undefined, NO_KIT).problems).toEqual([{ code: 'missing-module', path: 'yAxis[0].compare', detail: 'compare' }]);
    expect(build(LINE({ compare: 'percent', scale: 'log' })).problems).toEqual([{ code: 'invalid-option', path: 'yAxis[0].compare' }]);
    expect(build({ yAxis: { compare: 'value' }, series: [{ type: 'column', stack: true, data: [1] }, { type: 'column', stack: true, data: [2] }] }).problems).toEqual([{ code: 'invalid-option', path: 'yAxis[0].compare' }]);
    expect(build(LINE({ compare: 'ratio' })).problems).toEqual([{ code: 'invalid-option', path: 'yAxis[0].compare' }]);
  });
});

describe('the values (compare.md 1, 2)', () => {
  it('percent from the first point: 0, +100, +50, +200; drawn there, placed there', () => {
    const { model, l, scene } = build(LINE({ compare: 'percent' }));
    const y = l.axes.find((a) => a.dimension === 'y')!.scale;
    const path = scene.layers.find((x) => x.id === 'series')!.groups[0]!.items[0] as PathPrimitive;
    const ys = Array.from(path.path.coords).filter((_, i) => i % 2 === 1);
    expect(ys).toEqual([0, 100, 50, 200].map((v) => y.map(v)));
    expect(pointAt(model, l, { seriesId: 'a', index: 3 })!.y).toBe(y.map(200));
  });

  it('the baseline moves with the range; a fixed one does not', () => {
    // From x 1 (y 20): 15 is −25 %.
    const { model, l } = build(LINE({ compare: 'percent' }), { range: { x: { min: 1, max: 3 } } });
    const t = tooltipOf(model, l, { points: [{ seriesId: 'a', index: 2 }] }, 'en-US', text);
    expect([t.rows[0]!.value, t.rows[0]!.raw, t.baseline]).toEqual(['-25%', '15', '1']);
    // compareTo 2 (y 15): 30 is +100 %, whatever the range.
    const fixed = build(LINE({ compare: 'percent', compareTo: 2 }), { range: { x: { min: 0, max: 3 } } });
    expect(tooltipOf(fixed.model, fixed.l, { points: [{ seriesId: 'a', index: 3 }] }, 'en-US', text).rows[0]!.value).toBe('+100%');
  });

  it('value is the difference, index is base 100', () => {
    const v = build(LINE({ compare: 'value' }));
    expect(tooltipOf(v.model, v.l, { points: [{ seriesId: 'a', index: 1 }] }, 'en-US', text).rows[0]!.value).toBe('+10');
    const i = build(LINE({ compare: 'index' }));
    expect(tooltipOf(i.model, i.l, { points: [{ seriesId: 'a', index: 2 }] }, 'en-US', text).rows[0]!.value).toBe('150');
  });

  it('the view\'s comparison wins over the option; null turns it off', () => {
    const on = build(LINE({}), { compare: { mode: 'value', to: null } });
    expect(tooltipOf(on.model, on.l, { points: [{ seriesId: 'a', index: 3 }] }, 'en-US', text).rows[0]!.value).toBe('+20');
    const off = build(LINE({ compare: 'percent' }), { compare: null });
    expect(tooltipOf(off.model, off.l, { points: [{ seriesId: 'a', index: 3 }] }, 'en-US', text).rows[0]!.value).toBe('30');
  });
});

describe('the axis (compare.md 3)', () => {
  it('signed values, signed percents, plain numbers; a line at the reference', () => {
    expect(yTicks(build(LINE({ compare: 'percent' })).l)).toEqual(['0%', '+50%', '+100%', '+150%', '+200%']);
    expect(yTicks(build(LINE({ compare: 'value' })).l)).toEqual(['0', '+5', '+10', '+15', '+20']);
    const { l, scene } = build(LINE({ compare: 'index' }));
    const y = l.axes.find((a) => a.dimension === 'y')!.scale;
    const ref = scene.layers.find((x) => x.id === 'grid')!.groups.flatMap((g) => g.items).find((p) => p.sceneId.includes('reference')) as LinePrimitive;
    expect([ref.paint.stroke, Math.abs(ref.y1 - y.map(100)) <= 0.5]).toEqual(['axis-line', true]);
  });
});

describe('a series without a baseline (compare.md 6)', () => {
  it('a base of 0 in percent: not drawn, reported by series, no value', () => {
    const { problems, scene } = build({ yAxis: { compare: 'percent' }, series: [{ type: 'line', id: 'z', data: [0, 5] }, { type: 'line', id: 'b', data: [1, 2] }] });
    expect(problems).toEqual([{ code: 'no-baseline', path: 'series[0]', seriesId: 'z' }]);
    expect(scene.layers.find((x) => x.id === 'series')!.groups.some((g) => g.sceneId.includes('z'))).toBe(false);
  });
});

describe('words (compare.md 4, 5, 9)', () => {
  it('the table gives the raw value then the compared one; a point\'s label both', () => {
    const { model, l } = build(LINE({ compare: 'percent' }));
    const t = dataTable(model, l, undefined, 'en-US', { ...text, compared: (name: string) => `${name} (compared)` });
    expect([t.columns, t.rows[1]]).toEqual([['Series 1', 'Series 1 (compared)'], ['1', '20', '+100%']]);
    expect(pointLabel(model, l, { seriesId: 'a', index: 1 }, 'en-US', text)).toMatchObject({ y: '+100%', raw: '20' });
  });
});
