// The visible range (zoom-pan.md, GLOSSARY: Visible range): zooming and panning as pure data, layout following it,
// value axes fitting what is in view. Step 3.3. Expectations by hand.
import { describe, it, expect } from 'vitest';
import type { FontRole, TextMeasurer } from '@dzgraph/core';
import { allTypes } from '@dzgraph/core';
import { normalize } from '../src/normalize.js';
import { layout } from '../src/layout.js';
import { clampRange, extentOf, panBy, zoomAround } from '../src/zoom.js';
import { rangeMinMax } from '../src/decimate.js';

const types = allTypes;
const PER_CHAR: Record<FontRole, number> = { title: 10, subtitle: 7, 'axis-title': 7, 'tick-label': 6, legend: 6, 'data-label': 6 };
const measureText: TextMeasurer = (t, f) => ({ width: [...t].length * PER_CHAR[f], ascent: 9, descent: 3 });
const text = { seriesName: (n: number) => `Série ${n}`, noData: 'Aucune donnée', ellipsis: '…' };

// x 0…99, y = x except a peak of 1 000 at x = 10.
const LINE = { series: [{ type: 'line', id: 'a', data: Array.from({ length: 100 }, (_, i) => (i === 10 ? 1000 : i)) }] };

describe('the data\'s extent and the range\'s limits (zoom-pan.md 5)', () => {
  it('a range is kept inside the data, and never narrower than two points', () => {
    const { model } = normalize(LINE, types);
    const extent = extentOf(model, 'x')!;
    expect(extent).toEqual({ min: 0, max: 99, step: 1 });
    expect(clampRange({ min: -10, max: 30 }, extent)).toEqual({ min: 0, max: 40 });
    expect(clampRange({ min: 50, max: 50.5 }, extent)).toEqual({ min: 49.25, max: 51.25 });
  });

  it('zooming around a value keeps it in place; panning stops at the ends', () => {
    const extent = { min: 0, max: 100, step: 1 };
    expect(zoomAround({ min: 0, max: 100 }, 0.5, 20, extent)).toEqual({ min: 10, max: 60 });
    expect(panBy({ min: 10, max: 60 }, -30, extent)).toEqual({ min: 0, max: 50 });
  });
});

describe('the min and max of an index range, from the pyramid (O(log n))', () => {
  it('matches a plain scan', () => {
    const y = Float64Array.from({ length: 10_000 }, (_, i) => Math.sin(i / 7) * 100 + (i === 4_321 ? 500 : 0));
    let lo = Infinity, hi = -Infinity;
    for (let i = 1_000; i < 8_000; i++) { lo = Math.min(lo, y[i]!); hi = Math.max(hi, y[i]!); }
    expect(rangeMinMax(y, 1_000, 8_000)).toEqual({ min: lo, max: hi });
  });
});

describe('layout follows the visible range (zoom-pan.md 6)', () => {
  it('x shows the range; y fits the points in view (the peak out of view no longer counts)', () => {
    const { model } = normalize(LINE, types);
    const full = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US' });
    expect(full.axes.find((a) => a.id === 'y')!.ticks.at(-1)!.value).toBeGreaterThanOrEqual(1000);
    const view = { range: { x: { min: 50, max: 90 } } };
    const zoomed = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view });
    const x = zoomed.axes.find((a) => a.id === 'x')!;
    expect([x.scale.invert(zoomed.plot.x), x.scale.invert(zoomed.plot.x + zoomed.plot.width)]).toEqual([50, 90]);
    expect(zoomed.axes.find((a) => a.id === 'y')!.ticks.at(-1)!.value).toBeLessThan(200);
  });

  it('columns keep zero in view', () => {
    const { model } = normalize({ series: [{ type: 'column', data: [5, 50, 60, 70] }] }, types);
    const l = layout({ model, types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view: { range: { x: { min: 1.5, max: 3.5 } } } });
    expect(l.axes.find((a) => a.id === 'y')!.ticks[0]!.value).toBe(0);
  });
});

describe('a typed column changed in place and read again (big-data.md 5)', () => {
  it('nothing computed from its old values survives the new reading', () => {
    // Long enough that the min/max pyramid answers, not a scan.
    const y = Float64Array.from({ length: 10_000 }, (_, i) => i % 7);
    const read = () => normalize({ series: [{ type: 'line', id: 'a', data: { y } }] }, types).model;
    const view = { range: { x: { min: 1_000, max: 8_000 } } };
    const top = () => layout({ model: read(), types, width: 600, height: 400, dir: 'ltr', measureText, text, locale: 'en-US', view }).axes.find((a) => a.id === 'y')!.ticks.at(-1)!.value;
    expect(top()).toBeLessThan(10);
    // The app writes into its own array and gives it again (setData with the same array).
    y[4_321] = 500;
    expect(top()).toBeGreaterThanOrEqual(500);
  });
});
