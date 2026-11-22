// The y extent of an unsorted series within an x range (zoom-pan.md 6, ADR 0008) through buckets on x: the same
// answer as a scan of every point. Phase 3 bis.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { yWithin } from '../src/x-buckets.js';

function scan(x: Float64Array, y: Float64Array, min: number, max: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < x.length; i++) if (x[i]! >= min && x[i]! <= max && !Number.isNaN(y[i]!)) (lo = Math.min(lo, y[i]!), (hi = Math.max(hi, y[i]!)));
  return lo <= hi ? { min: lo, max: hi } : null;
}

const value = fc.oneof(fc.integer({ min: -50, max: 50 }), fc.constant(Number.NaN), fc.double({ min: -1e6, max: 1e6, noNaN: true }));

describe('yWithin', () => {
  it('finds what a scan finds: gaps, repeated x, one x for all, ranges inside, across and outside', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(value, value), { maxLength: 3000 }), fc.tuple(value, value), (pts, [a, b]) => {
        const x = Float64Array.from(pts.map((p) => p[0]));
        const y = Float64Array.from(pts.map((p) => p[1]));
        const min = Number.isNaN(a) ? -10 : Math.min(a, Number.isNaN(b) ? a : b);
        const max = Number.isNaN(b) ? 10 : Math.max(b, Number.isNaN(a) ? b : a);
        expect(yWithin(x, y, min, max)).toEqual(scan(x, y, min, max));
      }),
      { numRuns: 500 },
    );
  });

  it('sees a column written again only when the app gives it again (column-cache.ts)', async () => {
    const { forgetColumn } = await import('../src/column-cache.js');
    const x = Float64Array.of(0, 1, 2);
    const y = Float64Array.of(5, 6, 7);
    expect(yWithin(x, y, 0, 1)).toEqual({ min: 5, max: 6 });
    y[0] = -1;
    forgetColumn(y);
    expect(yWithin(x, y, 0, 1)).toEqual({ min: -1, max: 6 });
  });
});
