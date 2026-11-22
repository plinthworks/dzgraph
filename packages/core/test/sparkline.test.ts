// Sparklines (sparkline.md): values read, range, the drawing in a 100 × 100 box, markers, summary. Phase 7a.
// Expectations by hand.
import { describe, it, expect } from 'vitest';
import { sparklineOf } from '../src/sparkline.js';

describe('values (sparkline.md 2)', () => {
  it('numbers and gaps; anything else a gap, reported by its first index and a count', () => {
    const s = sparklineOf([1, null, 'x', 3, Number.NaN, undefined, Infinity] as never /* plain JavaScript may pass anything */);
    expect(s.problems).toEqual([{ code: 'invalid-data', path: 'values[2]', detail: 'count=3' }]);
    expect(s.summary).toEqual({ count: 2, min: 1, max: 3, last: 3 });
  });

  it('not a list: reported, nothing drawn; an empty list: nothing, no problem', () => {
    const bad = sparklineOf(42 as never /* plain JavaScript may pass anything */);
    expect([bad.problems, bad.line, bad.summary]).toEqual([[{ code: 'invalid-data', path: 'values' }], null, null]);
    const empty = sparklineOf([]);
    expect([empty.problems, empty.line, empty.columns, empty.summary]).toEqual([[], null, [], null]);
  });

  it('a typed array is read', () => {
    expect(sparklineOf(Float64Array.of(2, 4)).summary).toEqual({ count: 2, min: 2, max: 4, last: 4 });
  });
});

describe('line and area (sparkline.md 3, 4)', () => {
  it('a line across the box, the smallest at the bottom, the largest at the top', () => {
    // x 0, 50, 100; y: 0 → 100, 5 → 50, 10 → 0.
    expect(sparklineOf([0, 5, 10]).line).toBe('M0 100L50 50L100 0');
  });

  it('a gap breaks the line; a lone point between gaps is a dot of its own, not in the line (review 3)', () => {
    const s = sparklineOf([0, 10, null, 5, null, 10]);
    expect([s.line, s.dots]).toEqual(['M0 100L20 0', [{ x: 60, y: 50 }, { x: 100, y: 0 }]]);
  });

  it('all values equal: a flat line in the middle; one value: in the middle across', () => {
    expect(sparklineOf([4, 4]).line).toBe('M0 50L100 50');
    expect(sparklineOf([4]).dots).toEqual([{ x: 50, y: 50 }]);
  });

  it('a fixed range; a value outside at the edge', () => {
    expect(sparklineOf([5, 20], { min: 0, max: 10 }).line).toBe('M0 50L100 0');
  });

  it('an area down to zero, or to the bottom when every value is above zero', () => {
    // y 0 at 50 between -10 and 10.
    expect(sparklineOf([-10, 10], { type: 'area' }).area).toBe('M0 100L100 0L100 50L0 50Z');
    expect(sparklineOf([1, 3], { type: 'area' }).area).toBe('M0 100L100 0L100 100L0 100Z');
  });

  it('near the ends of the numbers: drawn in the box', () => {
    expect(sparklineOf([-1e308, 1e308]).line).toBe('M0 100L100 0');
  });
});

describe('columns and win / loss (sparkline.md 3)', () => {
  it('a column per point from zero, zero taken into the range; negative ones marked', () => {
    // Range -2..2: zero at 50; slots of 50 wide, the column 80 % of it, centred.
    const s = sparklineOf([2, -2], { type: 'column', markers: 'none' });
    expect(s.columns).toEqual([
      { x: 5, y: 0, width: 40, height: 50, negative: false, marked: false },
      { x: 55, y: 50, width: 40, height: 50, negative: true, marked: false },
    ]);
  });

  it('win / loss: one height, up or down by sign, nothing for zero or a gap', () => {
    const s = sparklineOf([3, 0, -7, null], { type: 'winloss', markers: 'none' });
    expect(s.columns).toEqual([
      { x: 2.5, y: 0, width: 20, height: 50, negative: false, marked: false },
      { x: 52.5, y: 50, width: 20, height: 50, negative: true, marked: false },
    ]);
  });
});

describe('markers (sparkline.md 5)', () => {
  it('the last point by default; min and max their first time; none', () => {
    expect(sparklineOf([0, 10, 5]).markers).toEqual([{ x: 100, y: 50 }]);
    expect(sparklineOf([0, 10, 10, 0], { markers: 'minmax' }).markers).toEqual([{ x: 0, y: 100 }, { x: expect.closeTo(100 / 3, 9), y: 0 }]);
    expect(sparklineOf([0, 10], { markers: 'none' }).markers).toEqual([]);
  });

  it('a column chart marks its last column', () => {
    expect(sparklineOf([1, 2], { type: 'column' }).columns.map((c) => c.marked)).toEqual([false, true]);
  });

  it('the last point is the last that has a value', () => {
    expect(sparklineOf([0, 10, null]).markers).toEqual([{ x: 50, y: 0 }]);
  });
});

describe('a list of any length (sparkline.md 10)', () => {
  it('300 000 values: no argument spread, a summary', () => {
    const many = Array.from({ length: 300_000 }, (_, i) => i % 1000);
    expect(sparklineOf(many).summary).toEqual({ count: 300_000, min: 0, max: 999, last: 999 });
  });
});

describe('review (Phase 7a close)', () => {
  it('review 2: null options are no options; a length that is not a count is reported', () => {
    expect(sparklineOf([0, 10], null as never /* plain JavaScript may pass null */).line).toBe('M0 100L100 0');
    expect(sparklineOf({ length: -1 } as never /* plain JavaScript may pass anything */).problems).toEqual([{ code: 'invalid-data', path: 'values' }]);
  });

  it('review 3: a point alone between gaps, or alone in the list, is a dot', () => {
    expect(sparklineOf([1, null, 3, null, 5]).dots).toEqual([{ x: 0, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 0 }]);
    expect(sparklineOf([7], { markers: 'none' }).dots).toEqual([{ x: 50, y: 50 }]);
  });

  it('review 4: a fixed bound the values do not reach: they are at its edge, not the range turned over', () => {
    // min 50, values 1–3: all under the range, at the bottom.
    expect(sparklineOf([1, 3], { min: 50 }).line).toBe('M0 100L100 100');
    // max 0, values 1–3: all over it, at the top.
    expect(sparklineOf([1, 3], { max: 0 }).line).toBe('M0 0L100 0');
    // Both given the wrong way round: the app's range, put right.
    expect(sparklineOf([0, 10], { min: 10, max: 0 }).line).toBe('M0 100L100 0');
  });
});

