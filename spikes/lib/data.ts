// Spike data, seeded so every browser draws the same thing. Throwaway code (Phase 0).

/** mulberry32: a tiny seeded PRNG (public domain algorithm). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Columns {
  x: Float64Array;
  y: Float64Array;
}

/** A random walk with sorted x (one point per second from 0): the shape of a long time series. */
export function walk(n: number, seed = 1): Columns {
  const r = prng(seed);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    x[i] = i * 1000;
    // Mostly small steps, a few spikes: decimation must keep the spikes.
    v += (r() - 0.5) * 2 + (r() < 0.0005 ? (r() - 0.5) * 200 : 0);
    y[i] = v;
  }
  return { x, y };
}

/** A dense cloud of points (two blobs), x not sorted: the shape of a scatter plot. */
export function cloud(n: number, seed = 2): Columns {
  const r = prng(seed);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Box–Muller.
    const u = Math.max(r(), 1e-12);
    const k = Math.sqrt(-2 * Math.log(u));
    const a = 2 * Math.PI * r();
    const c = r() < 0.6 ? 0 : 3;
    x[i] = c + k * Math.cos(a);
    y[i] = c * 0.5 + k * Math.sin(a);
  }
  return { x, y };
}

export function extent(a: Float64Array): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
