// hitMark through a grid of cells (spike S8, big-data.md 3): the same answer as a scan of every mark, on scenes of
// scatters and columns, horizontal or vertical. Step 3.3. The reference below is the Phase 2 scan, kept as the oracle.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FontRole, PointRef, Scene, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { hitMark } from '../src/hit.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

const inside = (r: { x: number; y: number; width: number; height: number }, px: number, py: number) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;

/** Every mark looked at: a rect under the pointer first, else the nearest marker within 24 px, else the nearest band. */
function scan(scene: Scene, px: number, py: number, orientation: 'vertical' | 'horizontal'): PointRef | null {
  if (!inside(scene.areas.plot, px, py)) return null;
  let band: { ref: PointRef; d: number } | null = null;
  let dot: { ref: PointRef; d: number } | null = null;
  for (const g of scene.layers.find((l) => l.id === 'series')?.groups ?? [])
    for (const p of g.items) {
      if (!p.point) continue;
      if (p.kind === 'rect') {
        if (inside(p, px, py)) return p.point;
        const d = orientation === 'vertical' ? Math.max(0, p.x - px, px - (p.x + p.width)) : Math.max(0, p.y - py, py - (p.y + p.height));
        if (d <= (orientation === 'vertical' ? p.width : p.height) * 0.75 && (!band || d < band.d)) band = { ref: p.point, d };
      } else if (p.kind === 'marker') {
        const d = Math.hypot(p.x - px, p.y - py);
        if (d <= 24 && (!dot || d < dot.d)) dot = { ref: p.point, d };
      }
    }
  return dot?.ref ?? band?.ref ?? null;
}

const point = fc.tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }));
const chartArb = fc.record({
  kind: fc.constantFrom('scatter', 'column', 'bar', 'mixed'),
  a: fc.array(point, { minLength: 1, maxLength: 300 }),
  b: fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 40 }),
  probes: fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })), { minLength: 1, maxLength: 30 }),
});

describe('hitMark (big-data.md 3)', () => {
  it('a column is found anywhere up or down its band, far from its top (found by the property, seed 855148467)', () => {
    const { model } = normalize({ series: [{ type: 'column', id: 'c', data: [0, -1] }, { type: 'column', id: 'd', data: [0, 1] }] }, allTypes);
    const l = layout({ model, types: allTypes, width: 500, height: 300, dir: 'ltr', measureText, text, locale: 'en-US' });
    const scene = composeScene({ model, types: allTypes, layout: l, measureText });
    const col = scene.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items).find((p) => p.kind === 'rect' && p.point?.index === 1)!;
    if (col.kind !== 'rect') throw new Error('a column is a rect');
    // At the plot's top, well above the column, which hangs under zero in the plot's middle: in its band.
    const py = l.plot.y + 1;
    expect(col.y - py).toBeGreaterThan(48);
    expect(hitMark(scene, col.x + col.width / 2, py, 'vertical')).toEqual({ seriesId: 'c', index: 1 });
  });

  it('finds what a scan of every mark finds', () => {
    fc.assert(
      fc.property(chartArb, ({ kind, a, b, probes }) => {
        const series =
          kind === 'scatter' ? [{ type: 'scatter', id: 's', data: a }, { type: 'scatter', id: 't', data: a.map(([x, y]) => [y, x]) }]
            : kind === 'mixed' ? [{ type: 'column', id: 'c', data: b }, { type: 'scatter', id: 's', data: a.map(([x, y]) => [Math.abs(x) % b.length, y]) }]
              : [{ type: kind, id: 'c', data: b }, { type: kind, id: 'd', data: b.map((v) => -v) }];
        const { model } = normalize({ series }, allTypes);
        const l = layout({ model, types: allTypes, width: 500, height: 300, dir: 'ltr', measureText, text, locale: 'en-US' });
        const scene = composeScene({ model, types: allTypes, layout: l, measureText });
        for (const [u, v] of probes) {
          const px = u * 500;
          const py = v * 300;
          expect(hitMark(scene, px, py, model.orientation)).toEqual(scan(scene, px, py, model.orientation));
        }
      }),
      { numRuns: 150 },
    );
  });
});
