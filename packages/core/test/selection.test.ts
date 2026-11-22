// The selection (selection.md): shapes that choose points, kept as bits in the view; how it looks and reads. Phase 5a
// step 6. Expectations by hand, and the lasso against a plain even-odd test of its whole outline.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { pointAt } from '../src/points.js';
import { combine, crosses, inRange, inRect, Lasso, placesOf, selectedCount } from '../src/selection.js';
import { dataTable, pointLabel, summary } from '../src/a11y.js';
import { viewFromJson, viewToJson } from '../src/view-json.js';
import type { View } from '../src/view.js';
import { FULL_KIT } from './helpers/kit.js';
import type { MarkerPrimitive, PointsPrimitive, Primitive, RectPrimitive } from '../src/scene.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Series ${n}`, noData: 'No data', ellipsis: '…' };
function build(options: object, view?: View) {
  const { model } = normalize(options, allTypes, { kit: FULL_KIT });
  const l = layout({ model, types: allTypes, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', ...(view ? { view } : {}) });
  return { model, l, scene: composeScene({ model, types: allTypes, layout: l, measureText, ...(view ? { view } : {}) }) };
}
const bits = (m: ReadonlyMap<string, Uint8Array>, id: string) => [...(m.get(id) ?? [])].flatMap((b, i) => (b ? [i] : []));
const SCATTER = { series: [{ type: 'scatter', id: 's', data: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]] }] };
const items = (scene: ReturnType<typeof build>['scene']): Primitive[] => scene.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items.map((p) => ({ ...p, paint: { ...p.paint, opacity: (p.paint.opacity ?? 1) * (g.opacity ?? 1) } })));

describe('shapes (selection.md 2)', () => {
  it('a rectangle: the points drawn inside it', () => {
    const { model, l } = build(SCATTER);
    const a = pointAt(model, l, { seriesId: 's', index: 1 })!;
    const b = pointAt(model, l, { seriesId: 's', index: 3 })!;
    expect(bits(inRect(model, l, undefined, { x0: a.x - 1, y0: a.y + 1, x1: b.x + 1, y1: b.y - 1 }), 's')).toEqual([1, 2, 3]);
  });

  it('a range of x: every point with x in it, whatever its y; gaps left out', () => {
    const { model, l } = build({ series: [{ type: 'line', id: 'l', data: [5, null, 7, 8, 9] }] });
    expect(bits(inRange(model, l, undefined, 0.5, 3), 'l')).toEqual([2, 3]);
  });

  it('replace, add, remove (selection.md 3)', () => {
    const { model, l } = build(SCATTER);
    const r = (from: number, to: number) => inRange(model, l, undefined, from, to);
    const one = combine(model, undefined, r(0, 1), 'replace');
    const more = combine(model, one, r(3, 4), 'add');
    expect(bits(more, 's')).toEqual([0, 1, 3, 4]);
    expect(bits(combine(model, more, r(1, 3), 'remove'), 's')).toEqual([0, 4]);
    expect(selectedCount(combine(model, more, r(9, 9), 'replace'))).toBe(0);
  });
});

describe('the lasso (selection.md 2, D.21)', () => {
  it('a triangle around the middle point', () => {
    const { model, l } = build(SCATTER);
    const p = pointAt(model, l, { seriesId: 's', index: 2 })!;
    const lasso = new Lasso(model, l, undefined);
    for (const [dx, dy] of [[-10, 10], [10, 10], [0, -10]] as const) lasso.add(p.x + dx, p.y + dy);
    expect(bits(lasso.inside(), 's')).toEqual([2]);
  });

  it('property: added place by place, the same as an even-odd test of the whole outline', () => {
    const { model, l } = build({ series: [{ type: 'scatter', id: 's', data: Array.from({ length: 400 }, (_, i) => [(i * 37) % 101, (i * 53) % 97]) }] });
    const at = placesOf(model, l, model.series[0]!)!;
    const { plot } = l;
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })), { minLength: 3, maxLength: 25 }), (pts) => {
        const outline = pts.map(([u, v]) => [plot.x + u * plot.width, plot.y + v * plot.height] as [number, number]);
        const lasso = new Lasso(model, l, undefined);
        outline.forEach(([x, y]) => lasso.add(x, y));
        const got = bits(lasso.inside(), 's');
        const want: number[] = [];
        for (let i = 0; i < 400; i++) {
          const [px, py] = at(i);
          let inside = false;
          outline.forEach((p, k) => {
            if (crosses(px, py, p, outline[(k + 1) % outline.length]!)) inside = !inside;
          });
          if (inside) want.push(i);
        }
        expect(got).toEqual(want);
      }),
      { numRuns: 300 },
    );
  });
});

describe('how it looks (selection.md 4, 10)', () => {
  const sel = (id: string, n: number, on: number[]) => new Map([[id, Uint8Array.from({ length: n }, (_, i) => (on.includes(i) ? 1 : 0))]]);

  it('scatter: the others fade to 35 %, the selected keep their look', () => {
    const { scene } = build(SCATTER, { selection: sel('s', 5, [2]) });
    const ms = items(scene).filter((p): p is MarkerPrimitive => p.kind === 'marker');
    expect(ms.map((m) => +m.paint.opacity!.toFixed(3))).toEqual([0.28, 0.28, 0.8, 0.28, 0.28]);
  });

  it('a selected column gets a ring in the focus colour', () => {
    const { scene } = build({ series: [{ type: 'column', id: 'c', data: [1, 2, 3] }] }, { selection: sel('c', 3, [1]) });
    const rings = items(scene).filter((p): p is RectPrimitive => p.kind === 'rect' && p.paint.stroke === 'focus');
    expect(rings.map((r) => r.point?.index ?? r.sceneId.includes('ring'))).toHaveLength(1);
  });

  it('a line: faded, its selected points get markers at full colour', () => {
    const { scene } = build({ series: [{ type: 'line', id: 'l', data: [1, 2, 3, 4] }] }, { selection: sel('l', 4, [1, 2]) });
    const all = items(scene);
    expect(all.find((p) => p.kind === 'path')!.paint.opacity).toBeCloseTo(0.35);
    expect(all.filter((p): p is MarkerPrimitive => p.kind === 'marker' && p.paint.opacity === 1).map((m) => m.point?.index)).toEqual([1, 2]);
  });

  it('a dense scatter: the cloud faded, its selected points drawn full over it', () => {
    const n = 2500;
    const { scene } = build({ series: [{ type: 'scatter', id: 'd', data: { x: Float64Array.from({ length: n }, (_, i) => i), y: Float64Array.from({ length: n }, (_, i) => i % 9) } }] }, { selection: sel('d', n, [7, 9]) });
    const batches = items(scene).filter((p): p is PointsPrimitive => p.kind === 'points');
    expect(batches.map((b) => [+b.paint.opacity!.toFixed(3), b.only ? [...b.only] : null])).toEqual([[0.28, null], [0.8, [7, 9]]]);
  });
});

describe('how it reads (selection.md 6, 7) and keeps (view-state.md 5)', () => {
  const view: View = { selection: new Map([['s', Uint8Array.of(0, 1, 0, 1, 0)]]) };

  it('a point says it is selected; the summary counts; the table marks the rows', () => {
    const { model, l } = build(SCATTER, view);
    expect(pointLabel(model, l, { seriesId: 's', index: 1 }, 'en-US', text, view)).toMatchObject({ selected: true });
    expect(pointLabel(model, l, { seriesId: 's', index: 2 }, 'en-US', text, view)!.selected).toBeUndefined();
    expect(summary(model, l, view, 'en-US', text).selected).toBe(2);
    const t = dataTable(model, l, view, 'en-US', { ...text, selectedColumn: 'Selected' });
    expect([t.columns, t.rows.map((r) => r.at(-1))]).toEqual([['Series 1', 'Selected'], ['', '✓', '', '✓', '']]);
  });

  it('in JSON: by key where the series has keys, else by index', () => {
    const { model } = normalize({ series: [{ type: 'scatter', id: 's', data: { x: [0, 1, 2], y: [1, 2, 3], key: ['a', 'b', 'c'] } }, { type: 'line', id: 'l', data: [1, 2, 3] }] }, allTypes, { kit: FULL_KIT });
    const selection = new Map([['s', Uint8Array.of(0, 1, 1)], ['l', Uint8Array.of(1, 0, 0)]]);
    const json = viewToJson(model, { hidden: new Set(), range: null, selection });
    expect(json.selection).toEqual({ s: ['b', 'c'], l: [0] });
    const back = viewFromJson(model, { selection: { s: ['c', 'zz'], l: [2] } });
    expect([bits(back.selection!, 's'), bits(back.selection!, 'l'), back.problems]).toEqual([[2], [2], [{ code: 'invalid-view', path: 'view.selection.s[1]' }]]);
  });
});

describe('without the module (ADR 0006)', () => {
  it('a view\'s selection is reported and left out: nothing selected that the chart cannot show', () => {
    const { model } = normalize({ series: [{ type: 'line', id: 'l', data: [1, 2, 3] }] }, allTypes);
    const r = viewFromJson(model, { selection: { l: [1] } });
    expect([r.selection, r.problems]).toEqual([undefined, [{ code: 'missing-module', path: 'view.selection', detail: 'selection' }]]);
  });
});
