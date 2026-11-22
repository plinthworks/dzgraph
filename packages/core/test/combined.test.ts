// Combined charts and two value axes (combined.md): each value axis shows its series' signs before its title, the
// summary says which kinds and which axis, the table's headers name the axis. Phase 4 step 5. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { dataTable, summary } from '../src/a11y.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
const build = (options: unknown, view?: { hidden: Set<string> }) => {
  const { model } = normalize(options, types);
  return { model, l: layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', ...(view ? { view } : {}) }) };
};

const DUAL = {
  xAxis: { scale: 'category', categories: ['Jan', 'Feb'] },
  yAxis: [{ title: 'kg' }, { id: 'y2', title: 'mm', opposite: true }],
  series: [
    { type: 'column', id: 'h', name: 'Harvest', data: [200, 220] },
    { type: 'area', id: 'w', name: 'Wind', data: [1, 2] },
    { type: 'line', id: 'r', name: 'Rain', yAxis: 'y2', data: [40, 60] },
  ],
};

describe('signs beside the axes (combined.md 5)', () => {
  it('each value axis lists its series, in order; one value axis: none', () => {
    const { l } = build(DUAL);
    const y = l.axes.find((a) => a.id === 'y')!;
    const y2 = l.axes.find((a) => a.id === 'y2')!;
    expect(y.signs.map((s) => s.seriesId)).toEqual(['h', 'w']);
    expect(y2.signs.map((s) => s.seriesId)).toEqual(['r']);
    expect(l.axes.find((a) => a.dimension === 'x')!.signs).toEqual([]);
    expect(build({ series: DUAL.series.slice(0, 2) }).l.axes.find((a) => a.id === 'y')!.signs).toEqual([]);
  });

  it('upright: under the title, which reads upwards, in the title\'s column, 12 px apart', () => {
    const { l } = build(DUAL);
    const y = l.axes.find((a) => a.id === 'y')!;
    const [h, w] = y.signs;
    expect(h!.x).toBe(y.title!.x);
    expect(w!.x).toBe(y.title!.x);
    // The title reads upwards: what comes before it is below it. `kg` is 14 px long; the first sign is nearest it.
    expect(h!.y).toBeGreaterThan(y.title!.y + 7);
    expect(w!.y - h!.y).toBe(12);
    // Title and signs together centred on the plot.
    const top = y.title!.y - 7;
    const bottom = w!.y + 4;
    expect((top + bottom) / 2).toBeCloseTo(l.plot.y + l.plot.height / 2, 6);
  });

  it('a hidden series leaves its axis\'s signs; an axis without a title still shows its signs', () => {
    expect(build(DUAL, { hidden: new Set(['w']) }).l.axes.find((a) => a.id === 'y')!.signs.map((s) => s.seriesId)).toEqual(['h']);
    const untitled = build({ ...DUAL, yAxis: [{}, { id: 'y2', opposite: true }] }).l;
    expect(untitled.axes.find((a) => a.id === 'y2')!.signs.map((s) => s.seriesId)).toEqual(['r']);
  });

  it('drawn in the axes layer, in each series\' colour and symbol', () => {
    const { model, l } = build(DUAL);
    const scene = composeScene({ model, types, layout: l, measureText });
    const items = scene.layers.find((x) => x.id === 'axes')!.groups.flatMap((g) => g.items);
    const signs = items.filter((p) => p.sceneId.startsWith('axis-sign/'));
    expect(signs.map((p) => [p.kind, p.paint.fill])).toEqual([['rect', 'series-1'], ['rect', 'series-2'], ['marker', 'series-3']]);
  });
});

describe('read (combined.md 9, 10)', () => {
  it('the summary: the kinds, and each series\' axis when there are two', () => {
    const { model, l } = build(DUAL);
    const s = summary(model, l, undefined, 'en-US', text);
    expect(s.types).toEqual(['column', 'area', 'line']);
    expect(s.series.map((r) => r.axis)).toEqual([{ title: 'kg', index: 0 }, { title: 'kg', index: 0 }, { title: 'mm', index: 1 }]);
    const one = build({ series: DUAL.series.slice(0, 2) });
    expect(summary(one.model, one.l, undefined, 'en-US', text).series.map((r) => r.axis)).toEqual([undefined, undefined]);
  });

  it('the table: with two value axes, each header names its axis', () => {
    const { model, l } = build(DUAL);
    const words = { ...text, seriesOnAxis: (name: string, axis: string) => `${name} (${axis})` };
    expect(dataTable(model, l, undefined, 'en-US', words).columns).toEqual(['Harvest (kg)', 'Wind (kg)', 'Rain (mm)']);
    const one = build({ yAxis: { title: 'kg' }, series: DUAL.series.slice(0, 2) });
    expect(dataTable(one.model, one.l, undefined, 'en-US', words).columns).toEqual(['Harvest', 'Wind']);
  });
});

describe('one orientation (combined.md 3)', () => {
  it('bars with a line: a horizontal chart, the line running down the categories', () => {
    const { model, problems } = normalize({ series: [{ type: 'bar', data: [3, 5] }, { type: 'line', id: 'l', data: [4, 1] }] }, types);
    expect(problems).toEqual([]);
    expect(model.orientation).toBe('horizontal');
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const scene = composeScene({ model, types, layout: l, measureText });
    const path = scene.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items).find((p) => p.kind === 'path' && p.sceneId.includes('l'))!;
    // Two points one under the other: the second's y below the first's.
    const c = path.kind === 'path' ? path.path.coords : new Float64Array();
    expect(c[3]!).toBeGreaterThan(c[1]!);
  });

  it('columns with bars: still reported', () => {
    const { problems } = normalize({ series: [{ type: 'column', data: [3] }, { type: 'bar', data: [3] }] }, types);
    expect(problems.map((p) => p.code)).toEqual(['mixed-orientation']);
  });
});
