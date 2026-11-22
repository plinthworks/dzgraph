// Pie and donut (pie-donut.md, ADR 0007): read, placed, drawn as arcs, « Autres », labels or legend, hidden slices,
// hover, keyboard, screen readers and table. Phase 4 step 6. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { pointAt } from '../src/points.js';
import { hitMark } from '../src/hit.js';
import { tooltipOf } from '../src/tooltip.js';
import { navigate } from '../src/navigate.js';
import { dataTable, pointLabel, summary } from '../src/a11y.js';
import { pointKey, type View } from '../src/view.js';
import type { ArcPrimitive, Primitive } from '../src/scene.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…', pointName: (n: number) => `Slice ${n}`, others: 'Others', total: 'Total' };
function build(options: unknown, o: { width?: number; height?: number; dir?: 'ltr' | 'rtl'; view?: View } = {}) {
  const { model, problems } = normalize(options, types);
  const l = layout({ model, types, width: o.width ?? 600, height: o.height ?? 400, dir: o.dir ?? 'ltr', measureText, text, locale: 'en-US', ...(o.view ? { view: o.view } : {}) });
  const scene = composeScene({ model, types, layout: l, measureText, ...(o.view ? { view: o.view } : {}) });
  const all: Primitive[] = scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items));
  const arcs = all.filter((p): p is ArcPrimitive => p.kind === 'arc' && p.point !== undefined);
  return { model, problems, l, scene, all, arcs };
}
const FRUIT = { series: [{ type: 'pie', id: 's', data: [['Apples', 50], ['Pears', 30], ['Plums', 20]] }] };
const PI = Math.PI;
const angles = (arcs: readonly ArcPrimitive[]) => arcs.map((a) => [a.point!.index, +(a.startAngle / PI).toFixed(6), +(a.endAngle / PI).toFixed(6)]);

describe('reading (pie-donut.md 1, 4, 17; combined.md 12)', () => {
  it('pairs: names and values; a polar chart, no axes', () => {
    const { model, problems, l } = build(FRUIT);
    expect(problems).toEqual([]);
    expect(model.system).toBe('polar');
    expect(model.series[0]!.names).toEqual(['Apples', 'Pears', 'Plums']);
    expect(Array.from(model.series[0]!.columns.y)).toEqual([50, 30, 20]);
    expect(l.axes).toEqual([]);
  });

  it('a negative value is reported and left out; zero gives no slice', () => {
    const { problems, arcs } = build({ series: [{ type: 'pie', id: 's', data: [['a', -1], ['b', 0], ['c', 2]] }] });
    expect(problems).toEqual([{ code: 'invalid-data', path: 'series[0].data[0]', seriesId: 's', detail: 'count=1' }]);
    expect(arcs.map((a) => a.point!.index)).toEqual([2]);
  });

  it('a second pie, or a cartesian series after a pie, is reported and left out', () => {
    const { model, problems } = build({ series: [{ type: 'pie', data: [1] }, { type: 'pie', data: [2] }, { type: 'line', data: [3] }] });
    expect(model.series.length).toBe(1);
    expect(problems).toEqual([
      { code: 'invalid-option', path: 'series[1].type', seriesId: '#2', detail: 'pie' },
      { code: 'invalid-option', path: 'series[2].type', seriesId: '#3', detail: 'line' },
    ]);
  });

  it('a number alone is named by its place', () => {
    const { l, model } = build({ legend: true, series: [{ type: 'pie', id: 's', data: [3, 1] }] });
    expect(model.series[0]!.names).toBeNull();
    expect(l.legend!.items.map((i) => i.label.text)).toEqual(['Slice 1', 'Slice 2']);
  });
});

describe('slices (pie-donut.md 2, 3, 5, 6)', () => {
  it('from the top, clockwise, in data order, each its share of the turn; 2 px of background between them', () => {
    const { arcs, l } = build(FRUIT);
    expect(angles(arcs)).toEqual([[0, 0, 1], [1, 1, 1.6], [2, 1.6, 2]]);
    expect(arcs.map((a) => [a.paint.fill, a.paint.stroke, a.paint.strokeWidth])).toEqual([['series-1', 'background', 2], ['series-2', 'background', 2], ['series-3', 'background', 2]]);
    expect(arcs[0]!.cx).toBeCloseTo(l.plot.x + l.plot.width / 2, 6);
    expect(arcs[0]!.innerRadius).toBe(0);
  });

  it('right to left with `mirror`: anticlockwise', () => {
    const { arcs } = build({ ...FRUIT, mirror: true }, { dir: 'rtl' });
    expect(angles(arcs)).toEqual([[0, 1, 2], [1, 0.4, 1], [2, 0, 0.4]]);
    // Without `mirror`, clockwise in right to left too (D.10).
    expect(angles(build(FRUIT, { dir: 'rtl' }).arcs)).toEqual([[0, 0, 1], [1, 1, 1.6], [2, 1.6, 2]]);
  });

  it('a donut: a hole of 60 %, the total and « Total » in its centre', () => {
    const { arcs, all } = build({ series: [{ type: 'donut', id: 's', data: FRUIT.series[0]!.data }] });
    expect(arcs[0]!.innerRadius).toBeCloseTo(arcs[0]!.outerRadius * 0.6, 6);
    const texts = all.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(texts).toEqual(expect.arrayContaining(['100', 'Total']));
  });

  it('`hole` and `center` change it; a hole out of range is reported', () => {
    const { arcs, all, problems } = build({ series: [{ type: 'donut', id: 's', hole: 0.5, center: { label: 'Fruit', value: '3 kinds' }, data: [1, 1] }] });
    expect(problems).toEqual([]);
    expect(arcs[0]!.innerRadius).toBeCloseTo(arcs[0]!.outerRadius * 0.5, 6);
    expect(all.some((p) => p.kind === 'text' && p.text === '3 kinds')).toBe(true);
    const bad = build({ series: [{ type: 'donut', id: 's', hole: 2, center: 3, data: [1] }] });
    expect(bad.problems).toEqual([
      { code: 'invalid-option', path: 'series[0].hole' },
      { code: 'invalid-option', path: 'series[0].center' },
    ]);
  });
});

describe('« Autres » (pie-donut.md 7, 8)', () => {
  const NINE = { series: [{ type: 'pie', id: 's', data: [30, 20, 15, 10, 8, 6, 5, 4, 2].map((v, i) => [`f${i}`, v]) }] };

  it('past 7 slices, the 6 largest stay and the rest join « Autres », drawn last, in a neutral colour', () => {
    const { l, arcs } = build(NINE);
    const p = l.placements.get('s')!;
    expect(p.order).toEqual([0, 1, 2, 3, 4, 5, 9]);
    expect(p.members(9)).toEqual([6, 7, 8]);
    expect(p.name(9)).toBe('Others');
    expect(p.share(9)).toBeCloseTo(0.11, 9);
    expect(arcs.at(-1)!.paint.fill).toBe('others');
    expect(arcs.at(-1)!.point).toEqual({ seriesId: 's', index: 9 });
  });

  it('then slices under 2 %; a group of one is not made', () => {
    expect(build({ series: [{ type: 'pie', id: 's', data: [50, 48.5, 1, 0.5] }] }).l.placements.get('s')!.order).toEqual([0, 1, 4]);
    expect(build({ series: [{ type: 'pie', id: 's', data: [60, 39, 1] }] }).l.placements.get('s')!.order).toEqual([0, 1, 2]);
  });

  it('`others: false` keeps every slice', () => {
    expect(build({ series: [{ ...NINE.series[0]!, others: false }] }).l.placements.get('s')!.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('its tooltip lists its slices; the table lists every slice and never « Autres »', () => {
    const { model, l } = build(NINE);
    const t = tooltipOf(model, l, { points: [{ seriesId: 's', index: 9 }] }, 'en-US', text);
    expect(t.heading).toBe('Others');
    expect(t.rows.map((r) => [r.name, r.value])).toEqual([['f6', '5'], ['f7', '4'], ['f8', '2']]);
    const table = dataTable(model, l, undefined, 'en-US', { ...text, share: 'Share' });
    expect(table.rows.length).toBe(9);
  });
});

describe('labels or legend (pie-donut.md 9–11)', () => {
  it('labels outside: the name and the share, with a leader line; no legend', () => {
    const { all, l } = build(FRUIT);
    const labels = all.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(labels).toEqual(['Apples 50%', 'Pears 30%', 'Plums 20%']);
    expect(all.filter((p) => p.kind === 'path' && p.sceneId.includes('leader')).length).toBe(3);
    expect(l.legend).toBeNull();
  });

  it('labels on the right of the pie start right of it, those on the left end left of it', () => {
    const { all, arcs } = build(FRUIT);
    const { cx, outerRadius } = arcs[0]!;
    const label = (t: string) => all.find((p) => p.kind === 'text' && p.text === t)!;
    const apples = label('Apples 50%');
    const pears = label('Pears 30%');
    expect(apples.kind === 'text' && apples.x > cx + outerRadius && apples.anchor === 'start').toBe(true);
    expect(pears.kind === 'text' && pears.x < cx - outerRadius && pears.anchor === 'end').toBe(true);
  });

  it('too narrow for labels: no labels, the legend instead, its items the slices', () => {
    const { all, l } = build(FRUIT, { width: 200 });
    expect(all.some((p) => p.kind === 'text' && p.text.includes('%'))).toBe(false);
    expect(l.legend!.items.map((i) => [i.label.text, i.key, i.point?.color])).toEqual([['Apples', pointKey('s', 0), 'series-1'], ['Pears', pointKey('s', 1), 'series-2'], ['Plums', pointKey('s', 2), 'series-3']]);
  });

  it('a hidden slice: the others share the whole again, its legend item greyed', () => {
    const view = { hidden: new Set([pointKey('s', 0)]) };
    const { arcs, l } = build({ ...FRUIT, legend: true }, { view });
    expect(angles(arcs)).toEqual([[1, 0, 1.2], [2, 1.2, 2]]);
    expect(l.legend!.items.map((i) => i.hidden)).toEqual([true, false, false]);
  });

  it('shares: whole percents, one decimal under 10 %, « < 0.1% » below', () => {
    const { all } = build({ series: [{ type: 'pie', id: 's', others: false, data: [['a', 90.95], ['b', 9], ['c', 0.05]] }] });
    const labels = all.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(labels).toEqual(['a 91%', 'b 9%', 'c <0.1%']);
  });
});

describe('hover, keyboard, screen readers, table (pie-donut.md 12–15)', () => {
  it('the slice under the pointer; its anchor on its middle angle', () => {
    const { arcs, scene, model, l } = build(FRUIT);
    const { cx, cy, outerRadius } = arcs[0]!;
    // Right of the centre: Apples (0 to π, clockwise from the top).
    expect(hitMark(scene, cx + outerRadius / 2, cy)).toEqual({ seriesId: 's', index: 0 });
    expect(hitMark(scene, cx - outerRadius / 2, cy - outerRadius / 2)).toEqual({ seriesId: 's', index: 2 });
    expect(hitMark(scene, cx + outerRadius + 20, cy)).toBeNull();
    const a = pointAt(model, l, { seriesId: 's', index: 0 })!;
    expect(a.x).toBeGreaterThan(cx);
    expect(a.y).toBeCloseTo(cy, 6);
  });

  it('pointed at: the slice comes 6 px out, the others fade', () => {
    const { model, l } = build(FRUIT);
    const scene = composeScene({ model, types, layout: l, measureText, highlight: pointKey('s', 0) });
    const arcs = scene.layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is ArcPrimitive => p.kind === 'arc' && p.point !== undefined);
    const plain = build(FRUIT).arcs;
    expect(arcs[0]!.cx - plain[0]!.cx).toBeCloseTo(6, 6);
    expect(arcs.map((a) => a.paint.opacity ?? 1)).toEqual([1, 0.35, 0.35]);
  });

  it('the tooltip: name, value, share', () => {
    const { model, l } = build(FRUIT);
    const t = tooltipOf(model, l, { points: [{ seriesId: 's', index: 1 }] }, 'en-US', text);
    expect([t.heading, t.rows.map((r) => [r.value, r.share])]).toEqual(['Pears', [['30', '30%']]]);
  });

  it('arrows go round the circle as drawn; Home and End to the first and last', () => {
    const { model, l } = build(FRUIT);
    const at = (index: number, key: string) => navigate(model, l, undefined, { seriesId: 's', index }, key)?.index;
    expect([at(0, 'ArrowRight'), at(0, 'ArrowDown'), at(1, 'ArrowLeft'), at(1, 'ArrowUp'), at(0, 'ArrowLeft'), at(0, 'End'), at(2, 'Home')]).toEqual([1, 1, 0, 0, 0, 2, 0]);
  });

  it('a slice read with its share; the summary names the largest; the table gives the shares', () => {
    const { model, l } = build(FRUIT);
    expect(pointLabel(model, l, { seriesId: 's', index: 1 }, 'en-US', text)).toEqual({ series: 'Series 1', x: 'Pears', y: '30', share: '30%', position: 2, count: 3 });
    const s = summary(model, l, undefined, 'en-US', text);
    expect([s.types, s.slices, s.largest]).toEqual([['pie'], 3, { name: 'Apples', share: '50%' }]);
    const t = dataTable(model, l, undefined, 'en-US', { ...text, share: 'Share' });
    expect([t.columns, t.rows]).toEqual([['Series 1', 'Share'], [['Apples', '50', '50%'], ['Pears', '30', '30%'], ['Plums', '20', '20%']]]);
  });
});

describe('appearing (pie-donut.md 16)', () => {
  it('the slices start closed at the top and open clockwise', async () => {
    const { appearFrom } = await import('../src/interpolate.js');
    const { scene } = build(FRUIT);
    const start = appearFrom(scene).layers.flatMap((x) => x.groups.flatMap((g) => g.items)).filter((p): p is ArcPrimitive => p.kind === 'arc');
    expect(start.map((a) => [a.startAngle, a.endAngle])).toEqual([[0, 0], [0, 0], [0, 0]]);
  });
});
