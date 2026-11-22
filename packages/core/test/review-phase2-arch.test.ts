// The Phase 2 architecture check (2026-11-21): one position per point, navigation in the core, raw table rows,
// keys on point references. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, Scene, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { composeScene } from '../src/compose.js';
import { pointAt, withKey } from '../src/points.js';
import { navigate, validOrder } from '../src/navigate.js';
import { dataRows } from '../src/a11y.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };
function build(options: unknown) {
  const { model } = normalize(options, types);
  const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
  return { model, l, scene: composeScene({ model, types, layout: l, measureText }) };
}
const marks = (s: Scene) => s.layers.find((x) => x.id === 'series')!.groups.flatMap((g) => g.items);

describe('pointAt: one place per point, as drawn', () => {
  it('a line\'s marker and a column\'s free end', () => {
    const { model, l, scene } = build({ series: [{ type: 'line', id: 'l', data: [1, 3, 2] }, { type: 'column', id: 'c', data: [2, 1, 3] }] });
    for (const p of marks(scene)) {
      if (!p.point) continue;
      const at = pointAt(model, l, p.point)!;
      if (p.kind === 'marker') expect([at.x, at.y]).toEqual([p.x, p.y]);
      if (p.kind === 'rect') expect(Math.abs(at.y - p.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('withKey: a point reference carries the app\'s key when it has one', () => {
  it('the key from the data, none otherwise', () => {
    const { model } = build({ series: [{ type: 'line', id: 'a', data: [{ y: 1, key: 'row-7' }, { y: 2 }] }] });
    expect(withKey(model, { seriesId: 'a', index: 0 })).toEqual({ seriesId: 'a', index: 0, key: 'row-7' });
    expect(withKey(model, { seriesId: 'a', index: 1 })).toEqual({ seriesId: 'a', index: 1 });
  });
});

describe('navigate (keyboard.md 2–3), in the core', () => {
  const LINES = {
    xAxis: { scale: 'category', categories: ['Jan', 'Feb', 'Mar'] },
    series: [
      { type: 'line', id: 'a', data: [10, 20, 30] },
      { type: 'line', id: 'b', data: [15, 5, 25] },
    ],
  };
  it('arrows along x and between series by height on screen; Home, End; gaps skipped', () => {
    const { model, l } = build(LINES);
    const go = (seriesId: string, index: number, key: string) => navigate(model, l, undefined, { seriesId, index }, key);
    expect(go('a', 0, 'ArrowRight')).toEqual({ seriesId: 'a', index: 1 });
    expect(go('a', 1, 'ArrowDown')).toEqual({ seriesId: 'b', index: 1 });
    expect(go('b', 1, 'ArrowUp')).toEqual({ seriesId: 'a', index: 1 });
    expect(go('a', 0, 'End')).toEqual({ seriesId: 'a', index: 2 });
    expect(go('a', 0, 'ArrowLeft')).toEqual({ seriesId: 'a', index: 0 });
    expect(go('a', 0, 'Tab')).toBeNull();
    const gaps = build({ series: [{ type: 'line', id: 'g', data: [1, null, 3] }] });
    expect([...validOrder(gaps.model.series[0]!)]).toEqual([0, 2]);
    expect(navigate(gaps.model, gaps.l, undefined, { seriesId: 'g', index: 0 }, 'ArrowRight')).toEqual({ seriesId: 'g', index: 2 });
  });
});

describe('dataRows: the table\'s raw values (for the CSV of Phase 6)', () => {
  it('numbers, not text; a gap is null', () => {
    const { model, l } = build({ series: [{ type: 'line', id: 'a', name: 'A', data: [1.5, null] }] });
    expect(dataRows(model, l, undefined)).toEqual({ series: ['a'], rows: [{ x: 0, from: { seriesId: 'a', index: 0 }, values: [1.5] }, { x: 1, from: { seriesId: 'a', index: 1 }, values: [null] }], total: 2 });
  });
});
