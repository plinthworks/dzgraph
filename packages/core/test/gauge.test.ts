// The gauge (gauge.md, ADR 0007): one value on a half ring, filled along the reading direction, its value, scale and
// threshold written, read by screen readers as a meter, one row in the table. Phase 4 step 6. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel } from '../src/a11y.js';
import { appearFrom } from '../src/interpolate.js';
import type { ArcPrimitive, Primitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…', pointName: (n: number) => `Slice ${n}`, others: 'Others', total: 'Total' };
function build(series: object, dir: 'ltr' | 'rtl' = 'ltr') {
  const { model, problems } = normalize({ series: [{ type: 'gauge', id: 'g', name: 'Load', ...series }] }, types);
  const l = layout({ model, types, width: 600, height: 400, dir, measureText, text, locale: 'en-US' });
  const scene = composeScene({ model, types, layout: l, measureText });
  const all: Primitive[] = scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items));
  const arcs = all.filter((p): p is ArcPrimitive => p.kind === 'arc');
  const texts = all.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
  return { model, problems, l, scene, arcs, texts };
}
const H = Math.PI / 2;
const turn = (a: ArcPrimitive) => [+(a.startAngle / H).toFixed(6), +(a.endAngle / H).toFixed(6)];

describe('reading (gauge.md 1, 12)', () => {
  it('a number, or one in an array; the scale 0–100 by default', () => {
    for (const data of [72, [72]]) {
      const { model, problems } = build({ data });
      expect(problems).toEqual([]);
      expect(Array.from(model.series[0]!.columns.y)).toEqual([72]);
    }
  });

  it('a scale whose min is not below its max is reported, the defaults used', () => {
    const { problems, arcs } = build({ data: 50, min: 10, max: 10 });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].min' }]);
    expect(turn(arcs.find((a) => a.point)!)).toEqual([-1, 0]);
  });
});

describe('drawn (gauge.md 2–6)', () => {
  it('a half ring: the track whole, the value from the start, a quarter of the radius thick', () => {
    const { arcs, texts } = build({ data: 72 });
    const track = arcs.find((a) => !a.point && a.paint.fill === 'track')!;
    const value = arcs.find((a) => a.point)!;
    expect(turn(track)).toEqual([-1, 1]);
    expect(turn(value)).toEqual([-1, 0.44]);
    expect(value.paint.fill).toBe('series-1');
    expect(value.innerRadius).toBeCloseTo(value.outerRadius * 0.75, 6);
    expect(texts).toEqual(expect.arrayContaining(['72', '0', '100']));
  });

  it('right to left: it fills from the right end', () => {
    expect(turn(build({ data: 72 }, 'rtl').arcs.find((a) => a.point)!)).toEqual([-0.44, 1]);
  });

  it('past the scale: full, the real value written; no value: an empty track and a dash', () => {
    const over = build({ data: 150 });
    expect(turn(over.arcs.find((a) => a.point)!)).toEqual([-1, 1]);
    expect(over.texts).toContain('150');
    const none = build({ data: null });
    expect(none.arcs.some((a) => a.point)).toBe(false);
    expect(none.texts).toContain('—');
  });

  it('thresholds: a thin ring outside, one segment each; the value\'s written under it', () => {
    const { arcs, texts } = build({ data: 85, thresholds: [{ from: 0, to: 80, label: 'Normal', color: 'calm' }, { from: 80, to: 100, label: 'High', color: 'alert' }] });
    const value = arcs.find((a) => a.point)!;
    const ring = arcs.filter((a) => !a.point && a.paint.fill !== 'track');
    expect(ring.map((a) => [a.paint.fill, ...turn(a)])).toEqual([['color-calm', -1, 0.6], ['color-alert', 0.6, 1]]);
    expect(ring[0]!.innerRadius).toBeGreaterThan(value.outerRadius);
    expect(texts).toContain('High');
  });

  it('a bad threshold is reported and left out', () => {
    const { problems } = build({ data: 1, thresholds: [{ from: 5, to: 2 }] });
    expect(problems).toEqual([{ code: 'invalid-option', path: 'series[0].thresholds[0]' }]);
  });
});

describe('read (gauge.md 7–11)', () => {
  const G = { data: 85, thresholds: [{ from: 80, to: 100, label: 'High', color: 'alert' }] };

  it('the tooltip: the value, then the scale and the threshold', () => {
    const { model, l } = build(G);
    const t = tooltipOf(model, l, { points: [{ seriesId: 'g', index: 0 }] }, 'en-US', text);
    expect([t.heading, t.rows.map((r) => r.value), t.range, t.threshold]).toEqual(['Load', ['85'], { min: '0', max: '100' }, 'High']);
  });

  it('a meter for screen readers: value, bounds, threshold', () => {
    const { model, l } = build(G);
    expect(pointLabel(model, l, { seriesId: 'g', index: 0 }, 'en-US', text)).toEqual({ series: 'Load', x: 'Load', y: '85', meter: { min: '0', max: '100', threshold: 'High', now: 85, low: 0, high: 100 }, position: 1, count: 1 });
  });

  it('one row in the table: value, bounds, threshold', () => {
    const { model, l } = build(G);
    const t = dataTable(model, l, undefined, 'en-US', { ...text, meter: { min: 'Minimum', max: 'Maximum', threshold: 'Threshold' } });
    expect([t.columns, t.rows]).toEqual([['Load', 'Minimum', 'Maximum', 'Threshold'], [['Load', '85', '0', '100', 'High']]]);
  });

  it('appearing: the value fills from the scale\'s start; the track is there at once', () => {
    const { scene } = build({ data: 72 });
    const start = appearFrom(scene).layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is ArcPrimitive => p.kind === 'arc');
    expect(start.map(turn)).toEqual([[-1, 1], [-1, -1]]);
  });
});

describe('the summary (gauge.md 9)', () => {
  it('names the gauge, its value, bounds and threshold', async () => {
    const { summary } = await import('../src/a11y.js');
    const { model, l } = build({ data: 85, thresholds: [{ from: 80, to: 100, label: 'High' }] });
    expect(summary(model, l, undefined, 'en-US', text).meter).toEqual({ name: 'Load', value: '85', min: '0', max: '100', threshold: 'High' });
  });
});
