/**
 * The y extent of a series out of x order within an x range (zoom-pan.md 6: value axes fit the points in view), for a
 * scatter of millions zoomed frame after frame (ADR 0008). A sorted series has its min/max pyramid; an unsorted one
 * has buckets of equal width on x, built once per column in two passes: each bucket's points and their y extent. A
 * range reads the buckets it covers whole, and scans only the two at its ends.
 */
import { columnCache } from './column-cache.js';

interface Buckets {
  readonly x: Float64Array;
  readonly x0: number;
  /** Buckets per unit of x. */
  readonly per: number;
  readonly count: number;
  /** Bucket b's points are `points[start[b]] … points[start[b + 1] − 1]`, in index order. */
  readonly start: Uint32Array;
  readonly points: Uint32Array;
  /** Each bucket's lowest and highest y (Infinity, −Infinity when it has none). */
  readonly lo: Float64Array;
  readonly hi: Float64Array;
}

/** About this many points a bucket, so a range's two end buckets cost little; no more buckets than this. */
const PER_BUCKET = 256;
const MAX_BUCKETS = 1 << 16;

/** Kept by y, the column the app may own and write into (forgotten when read again); x is checked too. */
const kept = columnCache<Buckets>();

function build(x: Float64Array, y: Float64Array): Buckets {
  let x0 = Infinity;
  let x1 = -Infinity;
  let n = 0;
  for (let i = 0; i < x.length; i++)
    if (!Number.isNaN(x[i]!) && !Number.isNaN(y[i]!)) {
      if (x[i]! < x0) x0 = x[i]!;
      if (x[i]! > x1) x1 = x[i]!;
      n++;
    }
  const count = Math.max(1, Math.min(MAX_BUCKETS, Math.ceil(n / PER_BUCKET)));
  const span = x1 - x0;
  const per = span > 0 && Number.isFinite(count / span) ? count / span : 0;
  const bucketOf = (v: number) => Math.min(count - 1, Math.floor((v - x0) * per));
  const start = new Uint32Array(count + 1);
  const lo = new Float64Array(count).fill(Infinity);
  const hi = new Float64Array(count).fill(-Infinity);
  for (let i = 0; i < x.length; i++) {
    const v = y[i]!;
    if (Number.isNaN(x[i]!) || Number.isNaN(v)) continue;
    const b = bucketOf(x[i]!);
    start[b + 1]!++;
    if (v < lo[b]!) lo[b] = v;
    if (v > hi[b]!) hi[b] = v;
  }
  for (let b = 1; b <= count; b++) start[b]! += start[b - 1]!;
  const fill = start.slice(0, count);
  const points = new Uint32Array(n);
  for (let i = 0; i < x.length; i++) if (!Number.isNaN(x[i]!) && !Number.isNaN(y[i]!)) points[fill[bucketOf(x[i]!)]!++] = i;
  return { x, x0, per, count, start, points, lo, hi };
}

/** The lowest and highest y of the points whose x is within [min, max], gaps left out; null when there are none. */
export function yWithin(x: Float64Array, y: Float64Array, min: number, max: number): { min: number; max: number } | null {
  let k = kept.get(y);
  if (!k || k.x !== x) kept.set(y, (k = build(x, y)));
  if (!(min <= max) || !k.points.length) return null;
  // NaN (an infinite end times no width) and below the first bucket: the first.
  const at = (v: number) => {
    const b = Math.floor((v - k.x0) * k.per);
    return b >= 0 ? Math.min(k.count - 1, b) : 0;
  };
  const b0 = at(min);
  const b1 = at(max);
  let lo = Infinity;
  let hi = -Infinity;
  // The end buckets, point by point.
  for (const b of b0 === b1 ? [b0] : [b0, b1])
    for (let j = k.start[b]!; j < k.start[b + 1]!; j++) {
      const i = k.points[j]!;
      if (x[i]! >= min && x[i]! <= max) {
        if (y[i]! < lo) lo = y[i]!;
        if (y[i]! > hi) hi = y[i]!;
      }
    }
  // Those between, whole.
  for (let b = b0 + 1; b < b1; b++) {
    if (k.lo[b]! < lo) lo = k.lo[b]!;
    if (k.hi[b]! > hi) hi = k.hi[b]!;
  }
  return lo <= hi ? { min: lo, max: hi } : null;
}
