/**
 * Numeric ticks (axes.md 1–9). Round steps only — 1, 2, 2.5 or 5 times a power of ten — and among them the one whose
 * tick count is closest to the target the axis's length invites. Value axes are rounded outwards to ticks (`loose`);
 * a continuous x axis and fixed bounds keep their ends, ticks fall inside (`inside`). Ends that are multiples of the
 * step make zero a tick whenever the axis crosses it (axes.md 8).
 */

export interface Ticks {
  /** The axis's ends. */
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly values: readonly number[];
}

/** Round steps, simplest first: the order breaks ties between steps that give as many ticks. */
const ROUND = [1, 5, 2, 2.5] as const;

/** The most decimals Intl and `toFixed` write. */
const MAX_DECIMALS = 100;

/** The decimals a number needs to be written exactly (0.25 → 2, 2.5 → 1, 5000 → 0, 1e-75 → 75), up to 100. */
export function decimalsOf(x: number): number {
  if (x === 0 || !Number.isFinite(x)) return 0;
  for (let d = Math.max(0, -Math.floor(Math.log10(Math.abs(x)))); d <= MAX_DECIMALS; d++) {
    const v = x * 10 ** d;
    if (Math.abs(v - Math.round(v)) < 1e-9 * Math.max(1, Math.abs(v))) return d;
  }
  return MAX_DECIMALS;
}

/** A round step `q × 10^z`, written exactly (2.5e-7, not 2.4999999999999998e-7). */
const roundStep = (q: number, z: number): number => Number.parseFloat((q * 10 ** z).toPrecision(3));

/**
 * The tick at `index × step`, without floating-point noise (0.30000000000000004 → 0.3) at any magnitude: rounded to
 * the step's own decimals; never minus zero.
 */
const tickAt = (index: number, step: number): number => {
  const raw = index * step;
  // Beyond what `toFixed` writes (steps under 1e-100), the product is kept as it is.
  const v = step < 10 ** -MAX_DECIMALS ? raw : Number.parseFloat(raw.toFixed(decimalsOf(step)));
  return v === 0 ? 0 : v;
};

/** More ticks than any axis could show: a candidate step this fine is not one. */
const MAX_TICKS = 1000;

/** How far a ratio may sit from a whole number and still count as one (noise of a division, not data). */
const NOISE = 1e-9;
const floorIndex = (v: number, step: number): number => Math.floor(v / step + NOISE);
const ceilIndex = (v: number, step: number): number => Math.ceil(v / step - NOISE);

/** About one tick every 64 px on an upright axis, every 100 px across (axes.md 7); never fewer than two. */
export function tickTarget(lengthPx: number, direction: 'upright' | 'across'): number {
  return Math.max(2, Math.floor(lengthPx / (direction === 'upright' ? 64 : 100)) + 1);
}

/** Rounded outwards from [a, b] with `step`: the ends and the count. */
function loose(a: number, b: number, step: number): { lo: number; hi: number; count: number } {
  const i0 = floorIndex(a, step);
  const i1 = ceilIndex(b, step);
  return { lo: i0, hi: i1, count: i1 - i0 + 1 };
}

/** The axis may be at most this many times the data's range: the data fills a good part of it (axes.md 7). */
const MAX_STRETCH = 2.5;

/**
 * The round step for [a, b] (a < b) whose loose tick count is closest to `target`, among those that keep the axis
 * within `MAX_STRETCH` times the data; ties go to the fewer ticks past the data, then the simpler step.
 */
function bestStep(a: number, b: number, target: number): number {
  const base = (b - a) / Math.max(target - 1, 1);
  const z0 = Math.floor(Math.log10(base));
  // A range so small its share underflows to zero (denormal numbers): no power of ten to search from.
  if (!Number.isFinite(z0)) return 0;
  let best = { step: 0, miss: Infinity, extra: Infinity, order: Infinity };
  let fallback = best;
  for (let z = z0 - 1; z <= z0 + 1; z++) {
    ROUND.forEach((q, order) => {
      const step = roundStep(q, z);
      if (!(step > 0) || !Number.isFinite(step)) return;
      const { lo, hi, count } = loose(a, b, step);
      if (!(count <= MAX_TICKS)) return;
      const miss = Math.abs(count - target);
      // Ties: the fewer ticks past the data, then the simpler step.
      const extra = (a - lo * step) + (hi * step - b);
      if ((hi - lo) * step > MAX_STRETCH * (b - a)) {
        if (miss < fallback.miss) fallback = { step, miss, extra, order };
        return;
      }
      if (miss < best.miss || (miss === best.miss && (extra < best.extra - 1e-12 * step || (Math.abs(extra - best.extra) <= 1e-12 * step && order < best.order)))) best = { step, miss, extra, order };
    });
  }
  return best.step || fallback.step;
}

/** Ticks for data from `a` to `b`, about `target` of them. */
export function numericTicks(a: number, b: number, target: number, mode: 'loose' | 'inside'): Ticks {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, step: 0.2, values: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  if (lo === hi) {
    // One value (axes.md 5): one round step around it; zero alone: 0–1.
    const step = lo === 0 ? 0 : 10 ** Math.floor(Math.log10(Math.abs(lo)));
    if (step > 0 && lo - step < lo && hi + step > hi) {
      lo -= step;
      hi += step;
    } else hi = lo === 0 ? 1 : lo + Math.abs(lo) || 1;
  }
  const step = bestStep(lo, hi, target);
  if (!(step > 0)) {
    // No round step can be written for this range (beyond the doubles' precision): its two ends.
    return { min: lo, max: hi, step: hi - lo, values: [lo, hi] };
  }
  if (mode === 'loose') {
    const r = loose(lo, hi, step);
    const values = Array.from({ length: r.count }, (_, i) => tickAt(r.lo + i, step));
    return { min: values[0]!, max: values[values.length - 1]!, step, values };
  }
  // Inside fixed ends: the multiples of the step between them; a smaller round step if fewer than two fit.
  let s = step;
  for (let guard = 0; guard < 8; guard++) {
    const first = ceilIndex(lo, s);
    const last = floorIndex(hi, s);
    if (last - first + 1 >= 2 || guard === 7) {
      const values = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => tickAt(first + i, s));
      return { min: lo, max: hi, step: s, values };
    }
    s = smallerRound(s);
  }
  return { min: lo, max: hi, step: s, values: [] };
}

/** The next round step below `s` (10 → 5 → 2.5 → 2 → 1 → 0.5 …). */
function smallerRound(s: number): number {
  const z = Math.floor(Math.log10(s));
  const q = Number.parseFloat((s / 10 ** z).toPrecision(3));
  const ladder = [10, 5, 2.5, 2, 1];
  const i = ladder.findIndex((v) => v < q - 1e-9);
  return i === -1 ? roundStep(5, z - 1) : roundStep(ladder[i]!, z);
}

/**
 * A second value axis's ticks on the first one's gridlines (axes.md 9): exactly `count` ticks covering [a, b], with
 * the smallest round step that reaches; the start a multiple of the step (so zero stays a tick when crossed).
 */
export function alignedTicks(a: number, b: number, count: number): Ticks {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  if (lo === hi) hi = lo === 0 ? 1 : lo + Math.abs(lo);
  const need = (hi - lo) / Math.max(count - 1, 1);
  const z0 = Math.floor(Math.log10(need));
  if (!Number.isFinite(z0)) return { min: lo, max: hi, step: hi - lo, values: [lo, hi] };
  for (let z = z0; z <= z0 + 2; z++) {
    for (const q of [1, 2, 2.5, 5]) {
      const step = roundStep(q, z);
      const start = floorIndex(lo, step);
      if ((start + count - 1) * step >= hi - NOISE * step) {
        const values = Array.from({ length: count }, (_, i) => tickAt(start + i, step));
        return { min: values[0]!, max: values[count - 1]!, step, values };
      }
    }
  }
  return numericTicks(lo, hi, count, 'loose');
}
