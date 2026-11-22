// dataRows with a limit (data-table.md 4–5, step 3.7): the same rows as reading every point into a map, cut at the
// limit, and the right total — on sorted series with gaps, repeated x, ranges and hidden series. The oracle below is
// the Phase 2 reading, kept as it was.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { FontRole, PointRef, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { dataRows } from '../src/a11y.js';
import type { ChartModel } from '../src/model.js';
import { isShown, type View } from '../src/view.js';

const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

function oracle(model: ChartModel, view: View | undefined) {
  const shown = model.series.filter((s) => isShown(s, view));
  const rowsByKey = new Map<string, { x: number; order: number; from: PointRef; values: (number | null)[] }>();
  let order = 0;
  shown.forEach((s, k) => {
    const perPoint = s.tooltip === 'mark' || !s.sorted;
    const r = view?.range?.[s.xAxis];
    s.columns.x.forEach((x, i) => {
      if (Number.isNaN(x) || (r && (x < r.min || x > r.max))) return;
      const y = s.columns.y[i]!;
      if (perPoint && Number.isNaN(y)) return;
      const key = perPoint ? `p\u0000${s.id}\u0000${i}` : `x\u0000${x}`;
      let row = rowsByKey.get(key);
      if (!row) rowsByKey.set(key, (row = { x, order: order++, from: { seriesId: s.id, index: i }, values: shown.map(() => null) }));
      if (!Number.isNaN(y)) row.values[k] = y;
    });
  });
  return [...rowsByKey.values()].sort((a, b) => a.x - b.x || a.order - b.order).map(({ x, from, values }) => ({ x, from, values }));
}

// A sorted series: x steps of 0–2 (repeats allowed), y a number or a gap.
const series = fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.option(fc.integer({ min: -9, max: 9 }), { nil: null })), { minLength: 0, maxLength: 60 }).map((pts) => {
  let x = 0;
  return pts.map(([dx, y]) => [(x += dx), y] as [number, number | null]);
});

describe('dataRows with a limit', () => {
  it('the first rows of the full reading, and its count', () => {
    fc.assert(
      fc.property(
        fc.array(series, { minLength: 1, maxLength: 3 }),
        fc.constantFrom('line', 'area', 'scatter'),
        fc.option(fc.tuple(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 60 }))),
        fc.integer({ min: 0, max: 40 }),
        fc.boolean(),
        (all, type, r, limit, hideFirst) => {
          const { model } = normalize({ series: all.map((data, i) => ({ type, id: `s${i}`, data })) }, allTypes);
          const l = layout({ model, types: allTypes, width: 500, height: 300, dir: 'ltr', measureText, text, locale: 'en-US' });
          const view: View = { ...(hideFirst ? { hidden: new Set(['s0']) } : {}), ...(r ? { range: { x: { min: Math.min(...r), max: Math.max(...r) } } } : {}) };
          const full = oracle(model, view);
          const got = dataRows(model, l, view, 'visible', limit);
          expect(got.rows).toEqual(full.slice(0, limit));
          expect(got.total).toBe(full.length);
        },
      ),
      { numRuns: 400 },
    );
  });
});
