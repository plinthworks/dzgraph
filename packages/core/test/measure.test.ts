// Measuring between two points (measure.md): the difference in value, in percent of the start, and along x; drawn
// between the points with a tag. Phase 5a step 5. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { measureKit } from '../src/measure.js';
import { pointAt } from '../src/points.js';
import { FULL_KIT } from './helpers/kit.js';
import type { LinePrimitive, MarkerPrimitive, RectPrimitive, TextPrimitive } from '../src/scene.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function build(options: object) {
  const { model } = normalize(options, allTypes, { kit: FULL_KIT, zone: 'UTC' });
  return { model, l: layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' }) };
}
const CAT = { xAxis: { scale: 'category', categories: ['Jan', 'Feb', 'Mar'] }, series: [{ type: 'line', id: 'a', data: [10, 20, 15] }, { type: 'line', id: 'b', data: [0, 1, 2] }] };

describe('the reading (measure.md 2, 3)', () => {
  it('value, percent of the start, categories between', () => {
    const { model, l } = build(CAT);
    expect(measureKit.read(model, l, { seriesId: 'a', index: 0 }, { seriesId: 'a', index: 1 }, 'en-US')).toEqual({ value: '+10', percent: '+100%', along: { kind: 'categories', count: 1 } });
    expect(measureKit.read(model, l, { seriesId: 'a', index: 1 }, { seriesId: 'a', index: 2 }, 'en-US')).toMatchObject({ value: '-5', percent: '-25%' });
  });

  it('two series; a start of 0 has no percent', () => {
    const { model, l } = build(CAT);
    expect(measureKit.read(model, l, { seriesId: 'b', index: 0 }, { seriesId: 'a', index: 2 }, 'en-US')).toEqual({ value: '+15', percent: null, along: { kind: 'categories', count: 2 } });
  });

  it('on a time axis, a duration: its two largest units', () => {
    const t0 = Date.UTC(2026, 2, 1);
    const { model, l } = build({ xAxis: { scale: 'time', zone: 'UTC' }, series: [{ type: 'line', id: 'a', data: [[t0, 1], [t0 + 28 * 3_600_000, 3]] }] });
    expect(measureKit.read(model, l, { seriesId: 'a', index: 0 }, { seriesId: 'a', index: 1 }, 'en-US')!.along).toEqual({ kind: 'text', text: '1d 4h' });
  });

  it('on a number axis, the signed difference of x', () => {
    const { model, l } = build({ series: [{ type: 'scatter', id: 's', data: [[2, 1], [7.5, 3]] }] });
    expect(measureKit.read(model, l, { seriesId: 's', index: 1 }, { seriesId: 's', index: 0 }, 'en-US')!.along).toEqual({ kind: 'text', text: '-5.5' });
  });
});

describe('drawn (measure.md 2)', () => {
  it('a line between the points, a marker on each, the tag at the middle', () => {
    const { model, l } = build(CAT);
    const a = pointAt(model, l, { seriesId: 'a', index: 0 })!;
    const b = pointAt(model, l, { seriesId: 'a', index: 1 })!;
    const items = measureKit.draw(model, l, { seriesId: 'a', index: 0 }, { seriesId: 'a', index: 1 }, '+10 (+100%)', measureText)!;
    const line = items.find((p): p is LinePrimitive => p.kind === 'line')!;
    expect([line.x1, line.y1, line.x2, line.y2, line.paint.stroke]).toEqual([a.x, a.y, b.x, b.y, 'focus']);
    expect(items.filter((p): p is MarkerPrimitive => p.kind === 'marker').map((m) => [m.x, m.y])).toEqual([[a.x, a.y], [b.x, b.y]]);
    const tag = items.find((p): p is TextPrimitive => p.kind === 'text')!;
    const box = items.find((p): p is RectPrimitive => p.kind === 'rect')!;
    expect([tag.text, tag.x]).toEqual(['+10 (+100%)', (a.x + b.x) / 2]);
    expect(box.x).toBeGreaterThanOrEqual(l.plot.x);
  });

  it('a point no longer there: nothing', () => {
    const { model, l } = build(CAT);
    expect(measureKit.draw(model, l, { seriesId: 'zz', index: 0 }, { seriesId: 'a', index: 1 }, 'x', measureText)).toBeNull();
  });
});
