/**
 * Decimation (GLOSSARY: Decimation; line-area.md 7; ADR 0002; spike S3). M4 (Jugel et al., 2014, from the paper):
 * for each pixel column of the visible window, keep the first, the last, the lowest and the highest point — and the
 * first gap, so a line still breaks there. Exact at any size: each column's index range is found by binary search,
 * then its lowest and highest point read from a min/max pyramid in O(log n) (blocks of 16, 32, 64… points, built
 * once per series and kept while the app's array is the same). A frame costs O(width × log n), whatever the data's
 * length; the pyramid holds about 3 × n / 16 indices.
 */

/** The smallest block the pyramid keeps: points at a column's ragged ends are read one by one (memory: n / 16 × 3). */
const LEAF = 16;

/** Per level: for each block of LEAF × 2^level points, the index of its lowest, highest, and first gap (−1: none). */
interface Pyramid {
  readonly lo: Int32Array[];
  readonly hi: Int32Array[];
  readonly gap: Int32Array[];
}

const pyramids = new WeakMap<Float64Array, Pyramid>();

function pyramidOf(y: Float64Array): Pyramid {
  let p = pyramids.get(y);
  if (p) return p;
  const n = y.length;
  const m0 = Math.ceil(n / LEAF);
  const lo0 = new Int32Array(m0).fill(-1);
  const hi0 = new Int32Array(m0).fill(-1);
  const gap0 = new Int32Array(m0).fill(-1);
  for (let i = 0; i < n; i++) {
    const b = (i / LEAF) | 0;
    if (Number.isNaN(y[i]!)) {
      if (gap0[b] === -1) gap0[b] = i;
    } else {
      lo0[b] = lower(y, lo0[b]!, i);
      hi0[b] = higher(y, hi0[b]!, i);
    }
  }
  const lo = [lo0];
  const hi = [hi0];
  const gap = [gap0];
  while (lo[lo.length - 1]!.length > 1) {
    const pl = lo[lo.length - 1]!;
    const ph = hi[hi.length - 1]!;
    const pg = gap[gap.length - 1]!;
    const m = Math.ceil(pl.length / 2);
    const l = new Int32Array(m);
    const h = new Int32Array(m);
    const g = new Int32Array(m);
    for (let b = 0; b < m; b++) {
      const a = 2 * b;
      const c = Math.min(a + 1, pl.length - 1);
      l[b] = lower(y, pl[a]!, pl[c]!);
      h[b] = higher(y, ph[a]!, ph[c]!);
      g[b] = pg[a]! !== -1 ? pg[a]! : pg[c]!;
    }
    lo.push(l);
    hi.push(h);
    gap.push(g);
  }
  p = { lo, hi, gap };
  pyramids.set(y, p);
  return p;
}

/** The index of the lower value (−1 counts as no value); ties keep the earlier index. */
function lower(y: Float64Array, a: number, b: number): number {
  if (a === -1) return b;
  if (b === -1) return a;
  return y[b]! < y[a]! ? b : a;
}

function higher(y: Float64Array, a: number, b: number): number {
  if (a === -1) return b;
  if (b === -1) return a;
  return y[b]! > y[a]! ? b : a;
}

/** The lowest, highest and first-gap indices over [s, e): single points at the ends, the pyramid's blocks between. */
function query(p: Pyramid, y: Float64Array, s: number, e: number): [number, number, number] {
  let lo = -1;
  let hi = -1;
  let gap = -1;
  while (s < e) {
    if (s % LEAF !== 0 || s + LEAF > e) {
      if (Number.isNaN(y[s]!)) {
        if (gap === -1) gap = s;
      } else {
        lo = lower(y, lo, s);
        hi = higher(y, hi, s);
      }
      s++;
      continue;
    }
    // The largest block starting at s that ends within e.
    let k = 0;
    while (k + 1 < p.lo.length && s % (LEAF << (k + 1)) === 0 && s + (LEAF << (k + 1)) <= e) k++;
    const b = s / (LEAF << k);
    lo = lower(y, lo, p.lo[k]![b]!);
    hi = higher(y, hi, p.hi[k]![b]!);
    // Blocks are read in order: the first gap met is the first gap.
    if (gap === -1) gap = p.gap[k]![b]!;
    s += LEAF << k;
  }
  return [lo, hi, gap];
}

/** First index with x[i] >= v (x sorted ascending, gaps excluded from x). */
function lowerBound(x: Float64Array, v: number, lo = 0, hi = x.length): number {
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (x[m]! < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** First index with x[i] > v. */
function upperBound(x: Float64Array, v: number, lo = 0, hi = x.length): number {
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (x[m]! <= v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * The indices to draw of a series sorted by x, for the window [x0, x1] over `width` pixel columns: ascending, the
 * window's points (decimated when there are more than four per column) and one point on each side of it.
 */
export function decimate(x: Float64Array, y: Float64Array, x0: number, x1: number, width: number): Int32Array {
  const n = x.length;
  const s = lowerBound(x, x0);
  const e = upperBound(x, x1, s);
  const before = s > 0 ? 1 : 0;
  const after = e < n ? 1 : 0;
  const columns = Math.max(1, Math.floor(width));
  if (e - s <= 4 * columns || x1 <= x0) {
    const out = new Int32Array(e - s + before + after);
    let k = 0;
    if (before) out[k++] = s - 1;
    for (let i = s; i < e; i++) out[k++] = i;
    if (after) out[k++] = e;
    return out;
  }
  const p = pyramidOf(y);
  const span = x1 - x0;
  /** The pixel column of point i: the same formula as everywhere a column is computed. */
  const columnOf = (i: number) => Math.min(columns - 1, Math.floor(((x[i]! - x0) / span) * columns));
  const out = new Int32Array(5 * columns + 2);
  let k = 0;
  if (before) out[k++] = s - 1;
  let start = s;
  while (start < e) {
    // The column's end: the first index in a later column (columns are monotonic in i).
    const c = columnOf(start);
    let lo = start + 1;
    let hi = e;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if (columnOf(m) > c) hi = m;
      else lo = m + 1;
    }
    const end = lo;
    const [mn, mx, gap] = query(p, y, start, end);
    // First, lowest, highest, first gap, last: in index order, without repeats.
    const picks = [start, mn, mx, gap, end - 1].filter((i) => i !== -1).sort((a, b) => a - b);
    let last = -1;
    for (const i of picks) {
      if (i !== last) out[k++] = i;
      last = i;
    }
    start = end;
  }
  if (after) out[k++] = e;
  return out.slice(0, k);
}
