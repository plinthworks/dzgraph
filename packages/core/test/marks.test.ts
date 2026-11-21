// The five Phase 1 series types draw their marks (line-area.md, columns-bars.md, scatter.md). Step 1.7. Simple scales
// so every position is computed by hand: plot 200 × 100 at the origin, y 0–10 upwards.
import { describe, it, expect } from 'vitest';
import type { MarkerPrimitive, PathPrimitive, RectPrimitive, SeriesBase } from '@dzgraph/core';
import type { MarkContext, MarkSet, SeriesModel, SeriesType } from '@dzgraph/core/internal';
import { area, bar, column, line, scatter } from '@dzgraph/core';
import { PathCommand } from '@dzgraph/core';
import { categoryScale, linearScale } from '../src/scale.js';

const plot = { x: 0, y: 0, width: 200, height: 100 };
const Y = linearScale([0, 10], [100, 0]);

function model(ys: readonly (number | null)[], over: Partial<SeriesModel> = {}, xs?: readonly number[]): SeriesModel {
  const y = Float64Array.from(ys, (v) => (v === null ? Number.NaN : v));
  const x = Float64Array.from(xs ?? ys.map((_, i) => i));
  return { id: 's', type: 'line', name: null, rank: 0, color: 'series-1', xAxis: 'x', yAxis: 'y', initiallyHidden: false, columns: { x, y }, keys: null, names: null, sorted: true, options: { type: 'line', data: [] }, ...over };
}

function marks<O extends SeriesBase<string, unknown>>(type: SeriesType<O, 'cartesian'>, s: SeriesModel, extra: Partial<MarkContext<O, 'cartesian'>> = {}): readonly MarkSet[] {
  const x = linearScale([0, Math.max(1, s.columns.x.length - 1)], [0, 200]);
  const ctx = { series: s as SeriesModel<O>, frame: { x, y: Y, orientation: 'vertical' as const }, plot, slot: 0, slots: 1, dir: 'ltr' as const, measureText: () => ({ width: 0, ascent: 0, descent: 0 }), ...extra };
  return type.marks(ctx as MarkContext<O, 'cartesian'>);
}

/** A path as [command, x, y] triples, rounded to 0.01. */
function segments(p: PathPrimitive): (string | number)[][] {
  const out: (string | number)[][] = [];
  let c = 0;
  for (const cmd of p.path.commands) {
    if (cmd === PathCommand.Close) out.push(['Z']);
    else {
      out.push([cmd === PathCommand.MoveTo ? 'M' : 'L', Math.round(p.path.coords[c]! * 100) / 100, Math.round(p.path.coords[c + 1]! * 100) / 100]);
      c += 2;
    }
  }
  return out;
}
const paths = (sets: readonly MarkSet[]) => sets.flatMap((s) => s.items).filter((p): p is PathPrimitive => p.kind === 'path');
const markers = (sets: readonly MarkSet[]) => sets.flatMap((s) => s.items).filter((p): p is MarkerPrimitive => p.kind === 'marker');
const rects = (sets: readonly MarkSet[]) => sets.flatMap((s) => s.items).filter((p): p is RectPrimitive => p.kind === 'rect');

describe('line (line-area.md)', () => {
  it('joins the points in order; 2 px in the series\' colour; a path set and a marks set', () => {
    const sets = marks(line, model([0, 10, 5]));
    expect(segments(paths(sets)[0]!)).toEqual([['M', 0, 100], ['L', 100, 0], ['L', 200, 50]]);
    expect(paths(sets)[0]!.paint).toEqual({ stroke: 'series-1', strokeWidth: 2 });
    expect(sets.map((s) => [s.layer, s.role])).toEqual([['series', 'path'], ['series', 'marks']]);
  });

  it('markers when points are far apart (fewer than width ÷ 12), the series\' symbol, on the points', () => {
    const ms = markers(marks(line, model([0, 10, 5], { rank: 1 })));
    expect(ms.map((m) => [m.x, m.y, m.symbol, m.point?.index])).toEqual([[0, 100, 'square', 0], [100, 0, 'square', 1], [200, 50, 'square', 2]]);
  });

  it('no markers when dense; `marker` forces either way', () => {
    const dense = Array.from({ length: 40 }, (_, i) => i % 10);
    expect(markers(marks(line, model(dense)))).toEqual([]);
    expect(markers(marks(line, model(dense, { options: { type: 'line', data: [], marker: true } as never }))).length).toBe(40); // a forced option, typed loosely on purpose
    expect(markers(marks(line, model([1, 2], { options: { type: 'line', data: [], marker: false } as never })))).toEqual([]); // idem
  });

  it('a gap breaks the line; a point alone between gaps keeps its marker even when dense (line-area.md 2)', () => {
    const ys: (number | null)[] = Array.from({ length: 40 }, (_, i) => i % 10);
    ys[10] = null;
    ys[12] = null;
    const sets = marks(line, model(ys));
    const segs = segments(paths(sets)[0]!);
    expect(segs.filter((s) => s[0] === 'M').length).toBe(3);
    expect(markers(sets).map((m) => m.point?.index)).toEqual([11]);
  });

  it('a long series is decimated: at most a handful of points per pixel column, extremes kept', () => {
    const n = 10_000;
    const ys = Array.from({ length: n }, (_, i) => (i === 7_777 ? 10 : 5));
    const p = paths(marks(line, model(ys)))[0]!;
    expect(p.path.commands.length).toBeLessThanOrEqual(5 * 200 + 2);
    const top = segments(p).some((s) => s[2] === 0);
    expect(top).toBe(true);
  });
});

describe('area (line-area.md 6)', () => {
  it('fills down to zero, translucent, with the line on top', () => {
    const sets = marks(area, model([5, 10]));
    const [fill, stroke] = paths(sets);
    expect(segments(fill!)).toEqual([['M', 0, 50], ['L', 200, 0], ['L', 200, 100], ['L', 0, 100], ['Z']]);
    expect(fill!.paint).toEqual({ fill: 'series-1', opacity: 0.25 });
    expect(segments(stroke!)).toEqual([['M', 0, 50], ['L', 200, 0]]);
  });
});

describe('columns (columns-bars.md)', () => {
  const cats = (n: number) => categoryScale(n, [0, 200]);

  it('one series: a fifth of the band left around the group (band 100 → column 80, centred)', () => {
    const rs = rects(marks(column, model([5, 10]), { frame: { x: cats(2), y: Y, orientation: 'vertical' } }));
    expect(rs.map((r) => [r.x, r.y, r.width, r.height, r.point?.index])).toEqual([[10, 50, 80, 50, 0], [110, 0, 80, 100, 1]]);
    expect(rs[0]!.paint).toEqual({ fill: 'series-1' });
  });

  it('two series side by side, a tenth of a column between them, in reading order', () => {
    const at = (slot: number, dir: 'ltr' | 'rtl') => rects(marks(column, model([5]), { frame: { x: cats(1), y: Y, orientation: 'vertical' }, slot, slots: 2, dir }))[0]!;
    // Band 200, group 160 from 20; columns 160 / 2.1 ≈ 76.19 wide, the second 1.1 × 76.19 ≈ 83.81 further.
    expect([Math.round(at(0, 'ltr').x), Math.round(at(1, 'ltr').x)]).toEqual([20, 104]);
    expect(Math.round(at(0, 'rtl').x)).toBe(104);
  });

  it('negative values go down from zero; a tiny one is still 1 px; zero draws nothing', () => {
    const Ysigned = linearScale([-10, 10], [100, 0]);
    const rs = rects(marks(column, model([-5, 0.001, 0]), { frame: { x: cats(3), y: Ysigned, orientation: 'vertical' } }));
    expect(rs.map((r) => [r.y, r.height])).toEqual([[50, 25], [49, 1]]);
  });
});

describe('bars (columns-bars.md 4)', () => {
  it('categories down, values from the start side along x', () => {
    const frame = { x: categoryScale(2, [0, 100]), y: linearScale([0, 10], [0, 200]), orientation: 'horizontal' as const };
    const rs = rects(marks(bar, model([5, 10]), { frame }));
    expect(rs.map((r) => [r.x, r.y, r.width, r.height])).toEqual([[0, 5, 100, 40], [0, 55, 200, 40]]);
  });
});

describe('scatter (scatter.md)', () => {
  it('a translucent marker of 8 px per point, gaps left out', () => {
    const sets = marks(scatter, model([5, null, 10]));
    expect(markers(sets).map((m) => [m.x, m.y, m.size, m.point?.index])).toEqual([[0, 50, 8, 0], [200, 0, 8, 2]]);
    expect(markers(sets)[0]!.paint).toEqual({ fill: 'series-1', opacity: 0.8 });
    expect(sets.map((s) => s.role)).toEqual(['marks']);
  });
});

describe('scene ids (scene.ts)', () => {
  it('unique within a series, and no app id can collide with another', () => {
    const a = marks(line, model([1, 2, 3], { id: 'a/m/1' })).flatMap((s) => s.items.map((i) => i.sceneId));
    const b = marks(line, model([1, 2, 3], { id: 'a' })).flatMap((s) => s.items.map((i) => i.sceneId));
    expect(new Set(a).size).toBe(a.length);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });
});
