/**
 * A sparkline's drawing (sparkline.md), pure: the values read, their range, and the shapes in a 100 × 100 box that the
 * DOM stretches over its element (no measuring). Small on purpose: an app that draws only sparklines ships this and
 * nothing of the chart.
 */
import type { Problem } from './problem.js';

export interface SparklineOptions {
  /** `line` (default), `area`, `column`, `winloss` (sparkline.md 3). */
  readonly type?: 'line' | 'area' | 'column' | 'winloss' | undefined;
  /** A fixed range, so several sparklines compare (sparkline.md 4). */
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  /** `last` (default), `minmax`, `none` (sparkline.md 5). */
  readonly markers?: 'last' | 'minmax' | 'none' | undefined;
}

export interface SparkColumn {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Below zero: the negative colour. */
  readonly negative: boolean;
  /** The marker colour (the last column). */
  readonly marked: boolean;
}

export interface Sparkline {
  /** The line's path (line, area), null without one. */
  readonly line: string | null;
  /** The area's path, down to zero or the bottom. */
  readonly area: string | null;
  readonly columns: readonly SparkColumn[];
  /** Dots on points (line, area). */
  readonly markers: readonly { readonly x: number; readonly y: number }[];
  /** Points alone between gaps, or alone in the list: a line cannot show them. */
  readonly dots: readonly { readonly x: number; readonly y: number }[];
  /** What the words say (sparkline.md 6); null without a value. */
  readonly summary: { readonly count: number; readonly min: number; readonly max: number; readonly last: number } | null;
  readonly problems: readonly Problem[];
}

/** The box's size: the DOM's `viewBox`. */
export const SPARK_BOX = 100;
/** A column's share of its slot. */
const COLUMN = 0.8;

const NOTHING: Sparkline = { line: null, area: null, columns: [], markers: [], dots: [], summary: null, problems: [] };
const num = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
};

export function sparklineOf(values: ArrayLike<number | null | undefined>, given?: SparklineOptions | null): Sparkline {
  // Plain JavaScript may pass null options, or a length that is no count (review 2).
  const options: SparklineOptions = given && typeof given === 'object' ? given : {};
  if (values === null || typeof values !== 'object' || !Number.isSafeInteger(values.length) || values.length < 0) return { ...NOTHING, problems: [{ code: 'invalid-data', path: 'values' }] };
  const n = values.length;
  // Read once: a gap is NaN; anything else that is not a finite number too, counted (never its value in the problem).
  const v = new Float64Array(n);
  let bad = 0;
  let firstBad = -1;
  let lo = Infinity;
  let hi = -Infinity;
  let count = 0;
  let last = -1;
  for (let i = 0; i < n; i++) {
    const x = values[i];
    if (typeof x === 'number' && Number.isFinite(x)) {
      v[i] = x;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
      count++;
      last = i;
    } else {
      v[i] = Number.NaN;
      if (x !== null && x !== undefined) {
        if (firstBad < 0) firstBad = i;
        bad++;
      }
    }
  }
  const problems: Problem[] = bad ? [{ code: 'invalid-data', path: `values[${firstBad}]`, detail: `count=${bad}` }] : [];
  if (!count) return { ...NOTHING, problems };
  const summary = { count, min: lo, max: hi, last: v[last]! };
  const type = options.type ?? 'line';
  const bars = type === 'column' || type === 'winloss';
  // The range: the values' (columns take zero in), or the app's; by halves, so ±1e308 never overflows (sparkline.md 10).
  let a = options.min !== undefined && Number.isFinite(options.min) ? options.min : type === 'column' ? Math.min(lo, 0) : lo;
  let b = options.max !== undefined && Number.isFinite(options.max) ? options.max : type === 'column' ? Math.max(hi, 0) : hi;
  if (a > b) [a, b] = [b, a];
  const span = b / 2 - a / 2;
  const B = SPARK_BOX;
  /** A value's height in the box: 0 at the top; the middle when the range is flat; the edge when outside. */
  const yOf = (x: number) => (span > 0 ? B - Math.min(1, Math.max(0, (x / 2 - a / 2) / span)) * B : B / 2);
  const markers: { x: number; y: number }[] = [];
  const marked = new Set<number>();
  const mode = options.markers ?? 'last';
  if (mode === 'last') marked.add(last);
  else if (mode === 'minmax') {
    marked.add(v.indexOf(lo));
    marked.add(v.indexOf(hi));
  }

  if (bars) {
    const slot = B / n;
    const width = slot * COLUMN;
    const zero = type === 'winloss' ? B / 2 : yOf(0);
    const columns: SparkColumn[] = [];
    for (let i = 0; i < n; i++) {
      const x = v[i]!;
      if (Number.isNaN(x) || (type === 'winloss' && x === 0)) continue;
      const top = type === 'winloss' ? (x > 0 ? 0 : B / 2) : Math.min(yOf(x), zero);
      const height = type === 'winloss' ? B / 2 : Math.abs(yOf(x) - zero);
      columns.push({ x: i * slot + (slot - width) / 2, y: top, width, height, negative: x < 0, marked: marked.has(i) });
    }
    return { line: null, area: null, columns, markers: [], dots: [], summary, problems };
  }

  const xOf = (i: number) => (n === 1 ? B / 2 : (i / (n - 1)) * B);
  let line = '';
  let area = '';
  // The area's floor: zero, or the bottom when every value is above zero.
  const floor = lo > 0 ? B : yOf(0);
  const dots: { x: number; y: number }[] = [];
  let run: number[] = [];
  const at = (i: number) => `${num(xOf(i))} ${num(yOf(v[i]!))}`;
  const endRun = () => {
    // A point alone is a dot of its own, as wide as a marker's ring (review 3): a line of one point shows nothing.
    if (run.length === 1) dots.push({ x: xOf(run[0]!), y: yOf(v[run[0]!]!) });
    else if (run.length > 1) {
      line += `M${run.map(at).join('L')}`;
      if (type === 'area') area += `M${run.map(at).join('L')}L${num(xOf(run.at(-1)!))} ${num(floor)}L${num(xOf(run[0]!))} ${num(floor)}Z`;
    }
    run = [];
  };
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(v[i]!)) endRun();
    else run.push(i);
  }
  endRun();
  for (const i of [...marked].sort((p, q) => p - q)) markers.push({ x: xOf(i), y: yOf(v[i]!) });
  return { line: line || null, area: type === 'area' && area ? area : null, columns: [], markers, dots, summary, problems };
}
