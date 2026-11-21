// Numeric ticks (axes.md 1–9): the extended Wilkinson search of Talbot, Lin and Hanrahan (2010), round steps only.
// Step 1.5. Expectations written by hand; properties checked with fast-check.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { alignedTicks, numericTicks, tickTarget } from '../src/ticks.js';

describe('numericTicks: rounded outwards (value axes, axes.md 2)', () => {
  it('13–87 gives 0–100 every 20', () => {
    expect(numericTicks(13, 87, 6, 'loose')).toEqual({ min: 0, max: 100, step: 20, values: [0, 20, 40, 60, 80, 100] });
  });

  it('0–1 every 0.2, without floating-point noise', () => {
    expect(numericTicks(0, 1, 6, 'loose').values).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('0–10 every 2', () => {
    expect(numericTicks(0, 10, 6, 'loose')).toEqual({ min: 0, max: 10, step: 2, values: [0, 2, 4, 6, 8, 10] });
  });

  it('an axis crossing zero has zero as a tick (axes.md 8)', () => {
    for (const [a, b] of [[-3, 7], [-0.37, 0.91], [-1234, 98765], [-7, 3]] as const) {
      expect(numericTicks(a, b, 6, 'loose').values).toContain(0);
    }
  });
});

describe('numericTicks: inside fixed ends (continuous x, fixed bounds: axes.md 3–4)', () => {
  it('keeps the ends and puts round ticks between them', () => {
    const t = numericTicks(3, 97, 6, 'inside');
    expect([t.min, t.max]).toEqual([3, 97]);
    expect(t.values).toEqual([20, 40, 60, 80]);
  });
});

describe('numericTicks: one value, or none (axes.md 5)', () => {
  it('one value: centred, one round step around it', () => {
    expect(numericTicks(5, 5, 6, 'loose')).toMatchObject({ min: 4, max: 6 });
    expect(numericTicks(0, 0, 6, 'loose')).toMatchObject({ min: 0, max: 1 });
    expect(numericTicks(-300, -300, 6, 'loose')).toMatchObject({ min: -400, max: -200 });
    // Found by the layout's property test: a tiny value once rounded both ends to 0 and the search never ended.
    expect(numericTicks(2.867e-75, 2.867e-75, 6, 'loose')).toMatchObject({ min: 1.5e-75, max: 4e-75, step: 5e-76 });
    // And a denormal value: its range divided by the target underflows to zero; the axis keeps its two ends.
    expect(numericTicks(9e-323, 9e-323, 14, 'loose').values.length).toBeGreaterThanOrEqual(2);
  });
});

describe('tickTarget (axes.md 7)', () => {
  it('about one tick every 64 px upright, every 100 px across; never fewer than two', () => {
    expect(tickTarget(320, 'upright')).toBe(6);
    expect(tickTarget(1000, 'across')).toBe(11);
    expect(tickTarget(40, 'upright')).toBe(2);
  });
});

describe('alignedTicks: a second value axis on the first one\'s gridlines (axes.md 9)', () => {
  it('same count, its own round step', () => {
    const first = numericTicks(0, 100, 6, 'loose');
    const second = alignedTicks(0, 37, first.values.length);
    expect(second.values).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('a range crossing zero keeps zero as a tick', () => {
    expect(alignedTicks(-12, 30, 6).values).toContain(0);
  });
});

describe('numericTicks, for any data range', () => {
  const ROUND = [1, 2, 2.5, 5];
  const isRound = (step: number) => {
    const z = Math.floor(Math.log10(step));
    const q = +(step / 10 ** z).toPrecision(6);
    return ROUND.includes(q) || q === 10;
  };
  const range = fc
    .tuple(fc.double({ min: -1e9, max: 1e9, noNaN: true }), fc.double({ min: 1e-6, max: 1e9, noNaN: true }))
    .map(([a, span]) => [a, a + span] as const)
    .filter(([a, b]) => b > a && Number.isFinite(b) && (b - a) / Math.max(Math.abs(a), Math.abs(b)) > 1e-9);

  it('ascending, a constant round step, covering the data, zero kept when crossed', () => {
    fc.assert(
      fc.property(range, fc.integer({ min: 2, max: 12 }), ([a, b], m) => {
        const t = numericTicks(a, b, m, 'loose');
        // Covering, to a billionth of the range and of the step: a division's noise (0.1 + 0.2) is not data.
        const eps = 1e-9 * (b - a + t.step);
        expect(t.min).toBeLessThanOrEqual(a + eps);
        expect(t.max).toBeGreaterThanOrEqual(b - eps);
        expect(isRound(t.step)).toBe(true);
        expect(t.values.length).toBeGreaterThanOrEqual(2);
        // The data fills a good part of the axis (at most 2.5 times its range, axes.md 7).
        expect(t.max - t.min).toBeLessThanOrEqual(2.5 * (b - a) * (1 + 1e-9));
        for (let i = 1; i < t.values.length; i++) expect(t.values[i]! - t.values[i - 1]!).toBeCloseTo(t.step, 6);
        if (t.min < 0 && t.max > 0) expect(t.values).toContain(0);
      }),
      { numRuns: 400 },
    );
  });
});
