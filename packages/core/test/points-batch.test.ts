// Dense scatters as one batch of points in data units (ADR 0008, big-data.md 6–11). Phase 3 bis step 2. Expectations
// by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { CANVAS_THRESHOLD, WEBGL_THRESHOLD, composeScene, painterFor } from '../src/compose.js';
import { categoryScale, linearScale, logScale } from '../src/scale.js';
import { markersOf, pointsAt } from '../src/points-batch.js';
import { sceneToSvg } from '../src/svg.js';
import { appearFrom, interpolateScene } from '../src/interpolate.js';
import { hitMark } from '../src/hit.js';
import type { MarkerPrimitive, PointsPrimitive, Primitive } from '../src/scene.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function scene(options: unknown): Scene {
  const { model } = normalize(options, allTypes);
  const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
  return composeScene({ model, types: allTypes, layout: l, measureText });
}
const series = (s: Scene) => s.layers.find((l) => l.id === 'series')!.groups;
const cloud = (n: number) => ({ x: Float64Array.from({ length: n }, (_, i) => i % 100), y: Float64Array.from({ length: n }, (_, i) => Math.floor(i / 100)) });

/** A batch made by hand: x 0–10 over 10–30 px, y on a log axis 1–100 over 100–0 px. */
function batch(x: number[], y: number[], extra: Partial<PointsPrimitive> = {}): PointsPrimitive {
  return {
    kind: 'points',
    sceneId: 'b',
    seriesId: 's',
    paint: { fill: 'series-1', opacity: 0.8 },
    x: Float64Array.from(x),
    y: Float64Array.from(y),
    mapX: { d0: 0, r0: 10, k: 2, log: false },
    mapY: { d0: 0, r0: 100, k: -50, log: true },
    swapped: false,
    size: 8,
    symbol: 'circle',
    ...extra,
  };
}

describe('scales give their affine map (ADR 0008)', () => {
  it('linear, log, categories, and an empty domain', () => {
    expect(linearScale([0, 10], [100, 200]).affine).toEqual({ d0: 0, r0: 100, k: 10, log: false });
    expect(logScale([1, 1000], [300, 0]).affine).toEqual({ d0: 0, r0: 300, k: -100, log: true });
    // A rank's band centre: 0 + (rank − 1 + 0.5) × 100.
    expect(categoryScale(4, [0, 400], 1).affine).toEqual({ d0: 0.5, r0: 0, k: 100, log: false });
    expect(linearScale([5, 5], [0, 100]).affine).toEqual({ d0: 5, r0: 50, k: 0, log: false });
  });
});

describe('a scatter past the Canvas threshold is one batch', () => {
  it('2 000 points stay markers; 2 001 become one primitive holding the columns', () => {
    expect(series(scene({ series: [{ type: 'scatter', data: cloud(CANVAS_THRESHOLD) }] }))[0]!.items).toHaveLength(2000);
    const data = cloud(CANVAS_THRESHOLD + 1);
    const { model } = normalize({ series: [{ type: 'scatter', id: 'c', data }] }, allTypes);
    const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    const g = series(composeScene({ model, types: allTypes, layout: l, measureText }))[0]!;
    expect(g.items).toHaveLength(1);
    const p = g.items[0] as PointsPrimitive;
    expect([p.kind, p.seriesId, p.symbol, p.size, p.paint, p.swapped]).toEqual(['points', 'c', 'circle', 8, { fill: 'series-1', opacity: 0.8 }, false]);
    // The model's own columns, not a copy.
    expect(p.x).toBe(model.series[0]!.columns.x);
    expect(p.y).toBe(model.series[0]!.columns.y);
    expect(p.mapX).toEqual(l.axes.find((a) => a.dimension === 'x')!.scale.affine);
  });

  it('a point\'s place: through each map, swapped in a bar chart; a gap has none', () => {
    const p = batch([5, 1, Number.NaN], [100, 10, 1]);
    // x 5 → 10 + 5 × 2 = 20; y 100 → 100 − 2 × 50 = 0. Swapped: x goes down the screen, y across.
    expect(pointsAt(p, 0)).toEqual([20, 0]);
    expect(pointsAt({ ...p, swapped: true }, 0)).toEqual([0, 20]);
    expect(pointsAt(p, 2)).toBeNull();
  });

  it('as markers (SVG, the export): one per point shown, in the clip grown by a marker, ids as before', () => {
    const p = batch([5, 1, Number.NaN, 0], [100, 10, 1, 1000]);
    // Point 3: y 1000 → 100 − 3 × 50 = −50, far above a clip from y 0.
    const ms = markersOf(p, { x: 0, y: 0, width: 100, height: 100 });
    expect(ms.map((m) => [m.x, m.y, m.point!.index])).toEqual([[20, 0, 0], [12, 50, 1]]);
    expect(ms[0]).toMatchObject({ kind: 'marker', sceneId: 's/s/m/0', size: 8, symbol: 'circle', paint: { fill: 'series-1', opacity: 0.8 } });
    expect(sceneToSvg({ width: 100, height: 100, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 100, height: 100 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'canvas', items: [p] }] }] })).toContain('<circle cx="12" cy="50" r="4"');
  });
});

describe('the painter (ADR 0002, 0008)', () => {
  const set = (n: number): { role: 'marks'; items: Primitive[] } => ({ role: 'marks', items: [batch(new Array(n).fill(1), new Array(n).fill(1))] });

  it('a batch goes to Canvas, past the WebGL threshold (100 000, set by the benches) to WebGL2; markers never do', () => {
    expect(WEBGL_THRESHOLD).toBe(100_000);
    expect(painterFor(set(CANVAS_THRESHOLD + 1))).toBe('canvas');
    expect(painterFor(set(WEBGL_THRESHOLD))).toBe('canvas');
    expect(painterFor(set(WEBGL_THRESHOLD + 1))).toBe('webgl2');
    const ms: MarkerPrimitive[] = Array.from({ length: WEBGL_THRESHOLD + 1 }, (_, i) => ({ kind: 'marker', sceneId: `m${i}`, paint: {}, x: 0, y: 0, size: 8, symbol: 'circle' }));
    expect(painterFor({ role: 'marks', items: ms })).toBe('canvas');
  });

  it('in a layer: WebGL2 groups, then Canvas, then SVG', () => {
    const s = scene({ series: [{ type: 'line', data: [1, 2] }, { type: 'scatter', data: cloud(3000) }, { type: 'scatter', data: cloud(WEBGL_THRESHOLD + 1) }] });
    expect(series(s).map((g) => g.painter)).toEqual(['webgl2', 'canvas', 'svg', 'svg']);
  });
});

describe('moving and appearing (animation.md)', () => {
  it('between two maps every point moves in a straight line', () => {
    const a = batch([10], [10]);
    const b = { ...a, mapX: { d0: 0, r0: 100, k: 2, log: false } };
    // x 10: 30 px before, 120 after; halfway 75. y unchanged: 50.
    const wrap = (p: PointsPrimitive): Scene => ({ width: 1, height: 1, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 1, height: 1 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'canvas', items: [p] }] }] });
    const mid = interpolateScene(wrap(a), wrap(b), 0.5).layers[0]!.groups[0]!.items[0] as PointsPrimitive;
    expect(pointsAt(mid, 0)).toEqual([75, 50]);
    // Other columns: the new batch at once.
    const c = { ...b, x: Float64Array.of(1) };
    expect(interpolateScene(wrap(a), wrap(c), 0.5).layers[0]!.groups[0]!.items[0]).toBe(c);
    expect((appearFrom(wrap(a)).layers[0]!.groups[0]!.items[0] as PointsPrimitive).paint.opacity).toBe(0);
  });
});

describe('hit (hover-tooltip.md 2, big-data.md 8)', () => {
  it('the nearest point of a batch within 24 px; the earlier on a tie; none farther', () => {
    const s = scene({ series: [{ type: 'scatter', id: 'c', data: cloud(2500) }] });
    const p = series(s)[0]!.items[0] as PointsPrimitive;
    const [x, y] = pointsAt(p, 1234)!;
    expect(hitMark(s, x + 0.2, y + 0.1)).toEqual({ seriesId: 'c', index: 1234 });
    // Far from every point: the plot's corner past the cloud's last row (y 0–24, x 0–99 fill the plot).
    const empty = scene({ series: [{ type: 'scatter', id: 'c', data: { x: Float64Array.from({ length: 2500 }, () => 0), y: Float64Array.from({ length: 2500 }, (_, i) => i) } }, { type: 'scatter', id: 'd', data: { x: [100], y: [0] } }] });
    const plot = empty.areas.plot;
    expect(hitMark(empty, plot.x + plot.width / 2, plot.y + plot.height / 2)).toBeNull();
    // Equal points: the first index.
    const tie = scene({ series: [{ type: 'scatter', id: 'c', data: { x: Float64Array.from({ length: 2500 }, () => 1), y: Float64Array.from({ length: 2500 }, () => 1) } }] });
    const q = series(tie)[0]!.items[0] as PointsPrimitive;
    const [tx, ty] = pointsAt(q, 7)!;
    expect(hitMark(tie, tx, ty)).toEqual({ seriesId: 'c', index: 0 });
  });
});

describe('hit, property: a batch is found as its markers would be', () => {
  it('the same answer on scenes of batches, markers and columns, upright or lying', async () => {
    const fc = (await import('fast-check')).default;
    const pts = fc.array(fc.tuple(fc.integer({ min: -30, max: 30 }), fc.integer({ min: -30, max: 30 })), { minLength: 2001, maxLength: 2100 });
    fc.assert(
      fc.property(pts, fc.array(fc.tuple(fc.integer({ min: -30, max: 30 }), fc.integer({ min: -30, max: 30 })), { maxLength: 30 }), fc.boolean(), fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })), { minLength: 1, maxLength: 20 }), (a, b, lying, probes) => {
        const options = { series: [...(lying ? [{ type: 'bar', id: 'k', data: [3, -2] }] : []), { type: 'scatter', id: 'a', data: { x: a.map((p) => p[0]), y: a.map((p) => p[1]) } }, { type: 'scatter', id: 'b', data: { x: b.map((p) => p[0]), y: b.map((p) => p[1]) } }] };
        const s = scene(options);
        const orientation = lying ? 'horizontal' : 'vertical';
        const asMarkers: Scene = { ...s, layers: s.layers.map((l) => ({ ...l, groups: l.groups.map((g) => ({ ...g, items: g.items.flatMap((p) => (p.kind === 'points' ? markersOf(p) : [p])) })) })) };
        const plot = s.areas.plot;
        for (const [u, v] of probes) {
          const px = plot.x + u * plot.width;
          const py = plot.y + v * plot.height;
          expect(hitMark(s, px, py, orientation)).toEqual(hitMark(asMarkers, px, py, orientation));
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe('review: appearing fades marks in (animation.md 1)', () => {
  it('halfway, a marker and a batch at half their opacity', () => {
    const marker: Primitive = { kind: 'marker', sceneId: 'm', paint: { fill: 'series-1', opacity: 0.8 }, x: 1, y: 1, size: 8, symbol: 'circle' };
    const p = batch([1], [1]);
    const s: Scene = { width: 10, height: 10, dir: 'ltr', areas: { plot: { x: 0, y: 0, width: 10, height: 10 } }, layers: [{ id: 'series', groups: [{ sceneId: 'g', painter: 'svg', items: [marker, p] }] }] };
    const mid = interpolateScene(appearFrom(s), s, 0.5).layers[0]!.groups[0]!.items;
    expect(mid.map((q) => q.paint.opacity)).toEqual([0.4, 0.4]);
  });
});
