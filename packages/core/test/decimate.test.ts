// Decimation (line-area.md 7, ADR 0002): M4 through a min/max pyramid keeps, for each pixel column, the first, last,
// lowest and highest point. Step 1.7. Properties with fast-check; small cases written by hand.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { decimate } from '../src/decimate.js';

const cols = (n: number, f: (i: number) => number) => {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = i;
    y[i] = f(i);
  }
  return { x, y };
};

describe('decimate: by hand', () => {
  it('no more points than columns: every point of the window, in order', () => {
    const { x, y } = cols(5, (i) => i * i);
    expect([...decimate(x, y, 0, 4, 100)]).toEqual([0, 1, 2, 3, 4]);
  });

  it('one point before and after the window, so the line enters and leaves the plot', () => {
    const { x, y } = cols(10, (i) => i);
    expect([...decimate(x, y, 3, 6, 100)]).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('many points in one column: its first, lowest, highest and last, by index', () => {
    // 0..99 over one pixel column; the lowest at 40, the highest at 70.
    const { x, y } = cols(100, (i) => (i === 40 ? -5 : i === 70 ? 9 : 1));
    expect([...decimate(x, y, 0, 99.5, 1)]).toEqual([0, 40, 70, 99]);
  });

  it('gaps (NaN) are kept where they fall, so the line still breaks', () => {
    const { x, y } = cols(10_000, (i) => (i === 5_000 ? Number.NaN : Math.sin(i / 50)));
    const kept = [...decimate(x, y, 0, 9_999, 100)];
    expect(kept).toContain(5_000);
  });
});

describe('decimate, for any long series', () => {
  const series = fc
    .tuple(fc.integer({ min: 50, max: 4000 }), fc.integer({ min: 1, max: 200 }), fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 4000 }))
    .map(([n, width, ys]) => {
      const x = new Float64Array(n);
      const y = new Float64Array(n);
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += Math.abs(ys[i % ys.length]!) % 7;
        x[i] = acc;
        y[i] = ys[(i * 7) % ys.length]!;
      }
      return { x, y, width };
    });

  it('keeps every pixel column\'s lowest and highest value, ascending indices, a bounded count', () => {
    fc.assert(
      fc.property(series, ({ x, y, width }) => {
        const x0 = x[0]!;
        const x1 = x[x.length - 1]!;
        if (x1 === x0) return;
        const kept = decimate(x, y, x0, x1, width);
        for (let i = 1; i < kept.length; i++) expect(kept[i]!).toBeGreaterThan(kept[i - 1]!);
        expect(kept.length).toBeLessThanOrEqual(4 * (width + 1) + 2);
        const column = (i: number) => Math.min(width - 1, Math.floor(((x[i]! - x0) / (x1 - x0)) * width));
        const lo = new Map<number, number>();
        const hi = new Map<number, number>();
        for (let i = 0; i < x.length; i++) {
          const c = column(i);
          lo.set(c, Math.min(lo.get(c) ?? Infinity, y[i]!));
          hi.set(c, Math.max(hi.get(c) ?? -Infinity, y[i]!));
        }
        const keptLo = new Map<number, number>();
        const keptHi = new Map<number, number>();
        for (const i of kept) {
          const c = column(i);
          keptLo.set(c, Math.min(keptLo.get(c) ?? Infinity, y[i]!));
          keptHi.set(c, Math.max(keptHi.get(c) ?? -Infinity, y[i]!));
        }
        for (const [c, v] of lo) expect(keptLo.get(c)).toBe(v);
        for (const [c, v] of hi) expect(keptHi.get(c)).toBe(v);
      }),
      { numRuns: 300 },
    );
  });
});
