// Phase 2 core: hit testing (hover-tooltip.md 1–3), the tooltip's content (6), emphasis (5), accessibility models
// (screen-reader.md, data-table.md) and scene interpolation (animation.md). Expectations by hand.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout, type ChartLayout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { hitMark, hitShared } from '../src/hit.js';
import { tooltipOf } from '../src/tooltip.js';
import { dataTable, pointLabel, summary } from '../src/a11y.js';
import { interpolateScene } from '../src/interpolate.js';
import type { ChartModel } from '../src/model.js';
import type { View } from '../src/view.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

function build(options: unknown, view?: View): { model: ChartModel; l: ChartLayout; scene: Scene } {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', ...(view ? { view } : {}) });
  return { model, l, scene: composeScene({ model, types, layout: l, measureText, ...(view ? { view } : {}) }) };
}

// Two lines over the same months; the plot of layout.test.ts is 36…592 across (one month every 556 / 12 px).
const LINES = {
  xAxis: { scale: 'category', categories: ['Jan', 'Feb', 'Mar'] },
  series: [
    { type: 'line', id: 'a', name: 'Apples', data: [10, 20, 30] },
    { type: 'line', id: 'b', name: 'Pears', data: [5, null, 15] },
  ],
};

describe('hitShared (hover-tooltip.md 1, 3)', () => {
  it('the x nearest the pointer, anywhere up or down; every line\'s point there; a gap left out', () => {
    const { model, l } = build(LINES);
    const x = l.axes.find((a) => a.id === 'x')!.scale;
    // Pointer a little right of « Feb », at the very top of the plot.
    const hit = hitShared(model, l, undefined, x.map(1) + 10, l.plot.y + 1)!;
    expect(hit.x).toBe(1);
    expect(hit.points.map((p) => [p.seriesId, p.index])).toEqual([['a', 1]]);
    const atMar = hitShared(model, l, undefined, x.map(2), l.plot.y + l.plot.height - 1)!;
    expect(atMar.points.map((p) => [p.seriesId, p.index])).toEqual([['a', 2], ['b', 2]]);
  });

  it('outside the plot: nothing', () => {
    const { model, l } = build(LINES);
    expect(hitShared(model, l, undefined, 2, 2)).toBeNull();
  });

  it('a hidden series is never hit', () => {
    const { model, l } = build(LINES, { hidden: new Set(['a']) });
    const x = l.axes.find((a) => a.id === 'x')!.scale;
    expect(hitShared(model, l, { hidden: new Set(['a']) }, x.map(2), l.plot.y + 5)!.points.map((p) => p.seriesId)).toEqual(['b']);
  });

  it('for any sorted series, the point found is the nearest by x (against a full search)', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 1000, noNaN: true }), { minLength: 2, maxLength: 200 }), fc.double({ min: 0, max: 1, noNaN: true }), (xs, f) => {
        const sorted = [...new Set(xs)].sort((p, q) => p - q);
        if (sorted.length < 2) return;
        const { model, l } = build({ series: [{ type: 'line', id: 's', data: sorted.map((v) => [v, 1]) }] });
        const px = l.plot.x + f * l.plot.width;
        const hit = hitShared(model, l, undefined, px, l.plot.y + 10)!;
        const scale = l.axes.find((a) => a.id === 'x')!.scale;
        const best = Math.min(...sorted.map((v) => Math.abs(scale.map(v) - px)));
        expect(Math.abs(scale.map(sorted[hit.points[0]!.index]!) - px)).toBeCloseTo(best, 6);
      }),
      { numRuns: 200 },
    );
  });
});

describe('hitMark (hover-tooltip.md 2–3)', () => {
  it('the column under the pointer, or the nearest one in its band', () => {
    const { scene } = build({ series: [{ type: 'column', id: 'c', data: [['A', 4], ['B', 8]] }] });
    const rect = scene.layers.find((x) => x.id === 'series')!.groups[0]!.items.find((p) => p.point?.index === 1)!;
    if (rect.kind !== 'rect') throw new Error('a column is a rect');
    expect(hitMark(scene, rect.x + 2, rect.y + 2)).toEqual({ seriesId: 'c', index: 1 });
    // Above the column, in its band.
    expect(hitMark(scene, rect.x + rect.width / 2, scene.areas.plot.y + 1)).toEqual({ seriesId: 'c', index: 1 });
  });

  it('a scatter point within 24 px, the nearest; nothing farther', () => {
    const { scene } = build({ series: [{ type: 'scatter', id: 's', data: [[1, 1], [2, 2]] }] });
    const m = scene.layers.find((x) => x.id === 'series')!.groups[0]!.items.find((p) => p.point?.index === 1)!;
    if (m.kind !== 'marker') throw new Error('a scatter point is a marker');
    // The point sits on the plot's end edge (the axis is rounded to it): approach it from inside the plot.
    expect(hitMark(scene, m.x - 20, m.y)).toEqual({ seriesId: 's', index: 1 });
    expect(hitMark(scene, m.x - 30, m.y + 30)).toBeNull();
  });
});

describe('tooltipOf (hover-tooltip.md 6)', () => {
  it('a heading, then one row per series: sign, name, value', () => {
    const { model, l } = build(LINES);
    const x = l.axes.find((a) => a.id === 'x')!.scale;
    const t = tooltipOf(model, l, hitShared(model, l, undefined, x.map(2), l.plot.y + 5)!, 'en-US', text);
    expect(t).toEqual({
      heading: 'Mar',
      rows: [
        { seriesId: 'a', name: 'Apples', value: '30', color: 'series-1', symbol: 'circle' },
        { seriesId: 'b', name: 'Pears', value: '15', color: 'series-2', symbol: 'square' },
      ],
    });
  });

  it('values: six significant digits, or two decimals when that keeps more; in the locale', () => {
    const { model, l } = build({ series: [{ type: 'line', id: 'a', data: [[1, 1234.5], [2, 147.968670892415], [3, 1234567.891], [4, 0.000123456789]] }] });
    const x = l.axes.find((a) => a.id === 'x')!.scale;
    const value = (v: number) => tooltipOf(model, l, hitShared(model, l, undefined, x.map(v), l.plot.y)!, 'fr-FR', text).rows[0]!.value;
    // French groups with a narrow no-break space (U+202F).
    expect([value(1), value(2), value(3), value(4)]).toEqual(['1 234,5', '147,969', '1 234 567,89', '0,000123457']);
  });
});

describe('highlight (hover-tooltip.md 5)', () => {
  it('the other series at 35 %', () => {
    const { model } = normalize({ series: [{ type: 'column', id: 'a', data: [1] }, { type: 'column', id: 'b', data: [2] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const scene = composeScene({ model, types, layout: l, measureText, highlight: 'a' });
    const groups = scene.layers.find((x) => x.id === 'series')!.groups;
    expect(groups.map((g) => [g.sceneId.split('/')[1], g.opacity ?? 1])).toEqual([['a', 1], ['b', 0.35]]);
  });
});

describe('accessibility models (screen-reader.md, data-table.md)', () => {
  it('a summary: kind, series and their ranges, the x range', () => {
    const { model, l } = build(LINES);
    expect(summary(model, l, undefined, 'en-US', text)).toEqual({
      types: ['line'],
      series: [
        { name: 'Apples', min: '10', max: '30' },
        { name: 'Pears', min: '5', max: '15' },
      ],
      x: { from: 'Jan', to: 'Mar' },
    });
  });

  it('a point\'s label parts', () => {
    const { model, l } = build(LINES);
    expect(pointLabel(model, l, { seriesId: 'a', index: 2 }, 'en-US', text)).toEqual({ series: 'Apples', x: 'Mar', y: '30', position: 3, count: 3 });
  });

  it('the data table: x, then one column per visible series; at most 1 000 rows', () => {
    const { model, l } = build(LINES, { hidden: new Set(['b']) });
    expect(dataTable(model, l, { hidden: new Set(['b']) }, 'en-US', text)).toEqual({ columns: ['Apples'], rows: [['Jan', '10'], ['Feb', '20'], ['Mar', '30']], omitted: 0, range: null });
    const many = build({ series: [{ type: 'line', data: Array.from({ length: 1500 }, (_, i) => i) }] });
    const table = dataTable(many.model, many.l, undefined, 'en-US', text);
    expect([table.rows.length, table.omitted]).toEqual([1000, 500]);
  });
});

describe('interpolateScene (animation.md 2)', () => {
  it('what stays moves between its two places; text takes the new state', () => {
    const a = build({ series: [{ type: 'column', id: 'c', data: [['A', 2]] }] }).scene;
    const b = build({ series: [{ type: 'column', id: 'c', data: [['A', 8]] }] }).scene;
    const rect = (s: Scene) => s.layers.find((x) => x.id === 'series')!.groups[0]!.items[0]!;
    const ra = rect(a);
    const rb = rect(b);
    const mid = rect(interpolateScene(a, b, 0.5));
    if (ra.kind !== 'rect' || rb.kind !== 'rect' || mid.kind !== 'rect') throw new Error('columns are rects');
    expect(mid.y).toBeCloseTo((ra.y + rb.y) / 2, 6);
    expect(mid.height).toBeCloseTo((ra.height + rb.height) / 2, 6);
    expect(interpolateScene(a, b, 1)).toEqual(b);
  });

  it('what comes fades in, what goes fades out', () => {
    const a = build({ series: [{ type: 'column', id: 'old', data: [1] }] }).scene;
    const b = build({ series: [{ type: 'column', id: 'new', data: [1] }] }).scene;
    const groups = interpolateScene(a, b, 0.25).layers.find((x) => x.id === 'series')!.groups;
    expect(groups.map((g) => [g.sceneId.split('/')[1], g.opacity])).toEqual([['new', 0.25], ['old', 0.75]]);
  });
});

describe('appearFrom (animation.md 1)', () => {
  it('lines revealed from the start of x, columns from their baseline, markers faded in; the rest at once', async () => {
    const { appearFrom } = await import('../src/interpolate.js');
    const { scene } = build({ series: [{ type: 'line', id: 'l', data: [1, 3] }, { type: 'column', id: 'c', data: [2, 4] }] });
    const start = appearFrom(scene);
    const groups = (s: Scene) => s.layers.find((x) => x.id === 'series')!.groups;
    const line = groups(start).find((g) => g.sceneId === 's/l/0')!;
    expect(line.clip!.width).toBe(0);
    expect(line.clip!.x).toBe(scene.areas.plot.x);
    for (const p of groups(start).flatMap((g) => g.items)) {
      if (p.kind === 'rect') expect(p.height).toBe(0);
      if (p.kind === 'marker') expect(p.paint.opacity).toBe(0);
    }
    // Columns sit on their baseline: the bottom of the drawn column.
    const drawn = groups(scene).flatMap((g) => g.items).find((p) => p.kind === 'rect')!;
    const collapsed = groups(start).flatMap((g) => g.items).find((p) => p.sceneId === drawn.sceneId)!;
    if (drawn.kind === 'rect' && collapsed.kind === 'rect') expect(collapsed.y).toBe(drawn.y + drawn.height);
    expect(start.layers.find((x) => x.id === 'axes')).toEqual(scene.layers.find((x) => x.id === 'axes'));
    // Half-way, the clip is half open.
    const mid = groups(interpolateScene(start, scene, 0.5)).find((g) => g.sceneId === 's/l/0')!;
    expect(mid.clip!.width).toBeCloseTo(scene.areas.plot.width / 2, 6);
  });
});
