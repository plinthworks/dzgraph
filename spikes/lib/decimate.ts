// Decimation for the spikes, written from the papers (CLEANROOM.md): M4 (Jugel et al., VLDB 2014) and
// Largest-Triangle-Three-Buckets (Steinarsson, 2013). Throwaway code (Phase 0); the core will get its own.

/** First index with x[i] >= v (x sorted ascending). */
export function lowerBound(x: Float64Array, v: number, lo = 0, hi = x.length): number {
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (x[m]! < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * M4: for each of `width` pixel columns over [x0, x1], keep the first, last, min and max point (by index order).
 * Returns the kept indices, ascending, in `out` (at most 4 × width + 2), and their count. One point before and after
 * the window are kept so the line enters and leaves the plot.
 */
export function m4(x: Float64Array, y: Float64Array, x0: number, x1: number, width: number, out: Int32Array): number {
  const n = x.length;
  let s = lowerBound(x, x0);
  let e = lowerBound(x, x1, s);
  if (s > 0) s--;
  if (e < n) e++;
  let k = 0;
  const scale = width / (x1 - x0);
  let col = -1;
  let first = 0;
  let last = 0;
  let mn = 0;
  let mx = 0;
  const flush = () => {
    // Four indices, in index order, without repeats.
    const a = first;
    let b = mn < mx ? mn : mx;
    let c = mn < mx ? mx : mn;
    const d = last;
    out[k++] = a;
    if (b !== a) out[k++] = b;
    if (c !== b && c !== a) out[k++] = c;
    if (d !== c && d !== b && d !== a) out[k++] = d;
    void b;
    void c;
  };
  for (let i = s; i < e; i++) {
    const c = Math.floor((x[i]! - x0) * scale);
    if (c !== col) {
      if (col !== -1) flush();
      col = c;
      first = last = mn = mx = i;
    } else {
      last = i;
      if (y[i]! < y[mn]!) mn = i;
      if (y[i]! > y[mx]!) mx = i;
    }
  }
  if (col !== -1) flush();
  return k;
}

/**
 * A pyramid for M4 on huge series: level L holds, per block of 2^L points, the index of its min and its max.
 * A query picks the coarsest level that still gives ≥ 4 blocks per pixel column, then runs M4 over the blocks' min
 * and max points (first and last of a column are approximated by the extreme blocks' points).
 */
export interface Pyramid {
  levels: { size: number; mn: Int32Array; mx: Int32Array }[];
}

export function buildPyramid(y: Float64Array): Pyramid {
  const levels: Pyramid['levels'] = [];
  let prevMn: Int32Array | null = null;
  let prevMx: Int32Array | null = null;
  for (let size = 2; size < y.length; size *= 2) {
    const m = Math.ceil(y.length / size);
    const mn = new Int32Array(m);
    const mx = new Int32Array(m);
    for (let b = 0; b < m; b++) {
      if (!prevMn || !prevMx) {
        const i = b * 2;
        const j = Math.min(i + 1, y.length - 1);
        mn[b] = y[j]! < y[i]! ? j : i;
        mx[b] = y[j]! > y[i]! ? j : i;
      } else {
        const i = b * 2;
        const j = Math.min(i + 1, prevMn.length - 1);
        mn[b] = y[prevMn[j]!]! < y[prevMn[i]!]! ? prevMn[j]! : prevMn[i]!;
        mx[b] = y[prevMx[j]!]! > y[prevMx[i]!]! ? prevMx[j]! : prevMx[i]!;
      }
    }
    levels.push({ size, mn, mx });
    prevMn = mn;
    prevMx = mx;
  }
  return { levels };
}

/** M4 through the pyramid: candidate points are each block's min and max, in index order. */
export function m4Pyramid(
  p: Pyramid,
  x: Float64Array,
  y: Float64Array,
  x0: number,
  x1: number,
  width: number,
  out: Int32Array,
  scratch: Int32Array,
): number {
  let s = lowerBound(x, x0);
  let e = lowerBound(x, x1, s);
  if (s > 0) s--;
  if (e < x.length) e++;
  const visible = e - s;
  let level: Pyramid['levels'][number] | null = null;
  for (const l of p.levels) if (visible / l.size >= 4 * width) level = l;
  if (!level) return m4(x, y, x0, x1, width, out);
  // Candidates: the window's first point, each block's min and max (ascending), its last point.
  let k = 0;
  scratch[k++] = s;
  const b0 = Math.floor(s / level.size);
  const b1 = Math.floor((e - 1) / level.size);
  for (let b = b0; b <= b1; b++) {
    const a = level.mn[b]!;
    const c = level.mx[b]!;
    if (a < c) {
      scratch[k++] = a;
      scratch[k++] = c;
    } else {
      scratch[k++] = c;
      if (a !== c) scratch[k++] = a;
    }
  }
  scratch[k++] = e - 1;
  // M4 over the candidates.
  const scale = width / (x1 - x0);
  let n = 0;
  let col = -1;
  let first = 0;
  let last = 0;
  let mn = 0;
  let mx = 0;
  const flush = () => {
    const lo = mn < mx ? mn : mx;
    const hi = mn < mx ? mx : mn;
    out[n++] = first;
    if (lo !== first) out[n++] = lo;
    if (hi !== lo && hi !== first) out[n++] = hi;
    if (last !== hi && last !== lo && last !== first) out[n++] = last;
  };
  let prev = -1;
  for (let j = 0; j < k; j++) {
    const i = scratch[j]!;
    if (i <= prev) continue;
    prev = i;
    const c = Math.floor((x[i]! - x0) * scale);
    if (c !== col) {
      if (col !== -1) flush();
      col = c;
      first = last = mn = mx = i;
    } else {
      last = i;
      if (y[i]! < y[mn]!) mn = i;
      if (y[i]! > y[mx]!) mx = i;
    }
  }
  if (col !== -1) flush();
  return n;
}

/** LTTB over the points of [s, e): keeps `threshold` indices (first and last always). */
export function lttb(x: Float64Array, y: Float64Array, s: number, e: number, threshold: number, out: Int32Array): number {
  const len = e - s;
  if (threshold >= len || threshold < 3) {
    for (let i = 0; i < len; i++) out[i] = s + i;
    return len;
  }
  const every = (len - 2) / (threshold - 2);
  let a = s;
  let k = 0;
  out[k++] = a;
  for (let i = 0; i < threshold - 2; i++) {
    // Average of the next bucket.
    let avgS = s + Math.floor((i + 1) * every) + 1;
    let avgE = Math.min(s + Math.floor((i + 2) * every) + 1, e);
    let ax = 0;
    let ay = 0;
    const cnt = Math.max(avgE - avgS, 1);
    for (let j = avgS; j < avgE; j++) {
      ax += x[j]!;
      ay += y[j]!;
    }
    ax /= cnt;
    ay /= cnt;
    // The point of this bucket making the largest triangle with a and the average.
    const rs = s + Math.floor(i * every) + 1;
    const re = s + Math.floor((i + 1) * every) + 1;
    let best = rs;
    let area = -1;
    const px = x[a]!;
    const py = y[a]!;
    for (let j = rs; j < re; j++) {
      const ar = Math.abs((px - ax) * (y[j]! - py) - (px - x[j]!) * (ay - py));
      if (ar > area) {
        area = ar;
        best = j;
      }
    }
    out[k++] = best;
    a = best;
    void avgS;
    void avgE;
  }
  out[k++] = e - 1;
  return k;
}
