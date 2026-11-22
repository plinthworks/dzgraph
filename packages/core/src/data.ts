/**
 * Reads a series' x/y data (options.ts `DataInput`) into columns. Never throws: an entry in none of the shapes, a value
 * that is not a finite number, a bad or repeated key, all become gaps or are left out, and each kind of fault is
 * reported once for the series (its first place, its count), never with a value (CLAUDE.md). The app's arrays are
 * never written to: a typed column is read as it is, or copied when it must change.
 */
import { forgetColumn } from './column-cache.js';
import type { Problem, ProblemCode } from './problem.js';

/** x as read: from the points' positions, or values (numbers, and strings for categories or dates). */
export type RawX =
  | { readonly kind: 'index' }
  | {
      readonly kind: 'values';
      /** Numeric x, NaN where the point has none or a string. */
      readonly numbers: Float64Array;
      /** String x, null where not a string; null as a whole when no point has one. */
      readonly texts: readonly (string | null)[] | null;
    };

export interface RawXY {
  readonly count: number;
  readonly x: RawX;
  /** NaN is a gap. */
  readonly y: Float64Array;
  readonly keys: readonly (string | null)[] | null;
  readonly names: readonly (string | null)[] | null;
  /** Whether numeric x never goes backwards (gaps skipped). Always true for positions. */
  readonly sorted: boolean;
  /** Columns beyond x and y, for types with their own data shape (`open`, `high`…). */
  readonly extra?: Readonly<Record<string, Float64Array>>;
  readonly problems: readonly Problem[];
}

/** Counts one kind of fault and remembers where it was first seen. */
class Tally {
  private first: string | null = null;
  private count = 0;
  constructor(
    private readonly code: ProblemCode,
    private readonly seriesId: string,
  ) {}
  add(path: string): void {
    if (this.count++ === 0) this.first = path;
  }
  drain(into: Problem[]): void {
    if (this.count > 0 && this.first !== null) into.push({ code: this.code, path: this.first, seriesId: this.seriesId, detail: `count=${this.count}` });
  }
}

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === 'object' && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v);
const isArrayLike = (v: unknown): v is readonly unknown[] | Float64Array => Array.isArray(v) || v instanceof Float64Array;

/** Reads a series' data; `path` is where it sits in the options (`series[2].data`), `seriesId` the series' id. */
export function readXYData(data: unknown, path: string, seriesId: string): RawXY {
  try {
    if (Array.isArray(data)) return readArray(data, path, seriesId);
    if (isRecord(data) && isArrayLike(data['y'])) return readColumns(data, path, seriesId);
  } catch {
    // An app's getter or proxy that throws: treated as unreadable data, below.
  }
  return { count: 0, x: { kind: 'index' }, y: new Float64Array(0), keys: null, names: null, sorted: true, problems: [{ code: 'invalid-data', path, seriesId }] };
}

type Shape = 'values' | 'pairs' | 'points';

function shapeOf(data: readonly unknown[]): Shape {
  for (const d of data) {
    if (d === null) continue;
    if (Array.isArray(d)) return 'pairs';
    if (isRecord(d)) return 'points';
    return 'values';
  }
  return 'values';
}

function readArray(data: readonly unknown[], path: string, seriesId: string): RawXY {
  const n = data.length;
  const shape = shapeOf(data);
  const y = new Float64Array(n);
  const xs = shape === 'values' ? null : new Float64Array(n);
  let texts: (string | null)[] | null = null;
  let keys: (string | null)[] | null = null;
  let names: (string | null)[] | null = null;
  const invalid = new Tally('invalid-data', seriesId);
  const nonFinite = new Tally('non-finite-value', seriesId);
  const badKey = new Tally('invalid-data', seriesId);
  const seen = new Set<string>();
  const dupKey = new Tally('duplicate-key', seriesId);

  /** A y as written: a finite number, null (a gap), or a fault. */
  const readY = (v: unknown, i: number, at: string): number => {
    if (v === null) return Number.NaN;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) return v;
      nonFinite.add(at);
      return Number.NaN;
    }
    invalid.add(`${path}[${i}]`);
    return Number.NaN;
  };
  /** An x as written: a number, a string, or absent (the point's position). False: no usable x (a gap). */
  let noX = false;
  const readX = (v: unknown, i: number): boolean => {
    noX = false;
    if (v === undefined) {
      xs![i] = i;
      return true;
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) {
        nonFinite.add(`${path}[${i}]`);
        noX = true;
      }
      xs![i] = Number.isFinite(v) ? v : Number.NaN;
      return true;
    }
    if (typeof v === 'string') {
      xs![i] = Number.NaN;
      (texts ??= new Array<string | null>(n).fill(null))[i] = v;
      return true;
    }
    return false;
  };

  for (let i = 0; i < n; i++) {
    const d = data[i];
    if (shape === 'values') {
      y[i] = readY(d, i, `${path}[${i}]`);
      continue;
    }
    if (d === null) {
      // A gap written as null in pairs or points: no x either, so it never stretches the axis (review 3).
      y[i] = Number.NaN;
      xs![i] = Number.NaN;
      continue;
    }
    if (shape === 'pairs') {
      if (Array.isArray(d) && d.length === 2 && readX(d[0], i)) y[i] = noX ? Number.NaN : readY(d[1], i, `${path}[${i}]`);
      else {
        invalid.add(`${path}[${i}]`);
        y[i] = Number.NaN;
        xs![i] = Number.NaN;
      }
      continue;
    }
    // Points written out.
    if (!isRecord(d) || !('y' in d) || !readX(d['x'], i)) {
      invalid.add(`${path}[${i}]`);
      y[i] = Number.NaN;
      xs![i] = Number.NaN;
      continue;
    }
    y[i] = noX ? Number.NaN : readY(d['y'], i, `${path}[${i}]`);
    const k = d['key'];
    if (k !== undefined) {
      keys ??= new Array<string | null>(n).fill(null);
      if (typeof k !== 'string') badKey.add(`${path}[${i}].key`);
      else if (seen.has(k)) dupKey.add(`${path}[${i}].key`);
      else {
        seen.add(k);
        keys[i] = k;
      }
    }
    const nm = d['name'];
    if (typeof nm === 'string') (names ??= new Array<string | null>(n).fill(null))[i] = nm;
  }

  const problems: Problem[] = [];
  invalid.drain(problems);
  nonFinite.drain(problems);
  badKey.drain(problems);
  dupKey.drain(problems);
  const x: RawX = xs ? { kind: 'values', numbers: xs, texts } : { kind: 'index' };
  return { count: n, x, y, keys, names, sorted: xs ? isSorted(xs) : true, problems };
}

function readColumns(data: Readonly<Record<string, unknown>>, path: string, seriesId: string): RawXY {
  const yIn = data['y'] as readonly unknown[] | Float64Array;
  const xIn = data['x'];
  const kIn = data['key'];
  // Reported in this order: the columns' own faults (shape, length), the values', then the keys'.
  const problems: Problem[] = [];
  const keyProblems: Problem[] = [];
  let n = yIn.length;
  if (xIn !== undefined) {
    if (!isArrayLike(xIn)) problems.push({ code: 'invalid-data', path: `${path}.x`, seriesId });
    else if (xIn.length !== n) {
      problems.push({ code: 'invalid-data', path: `${path}.x`, seriesId, detail: 'length' });
      n = Math.min(n, xIn.length);
    }
  }
  const invalid = new Tally('invalid-data', seriesId);
  const nonFinite = new Tally('non-finite-value', seriesId);

  // y: a typed column is used as it is unless it holds Infinity (then copied, Infinity made a gap).
  let y: Float64Array;
  if (yIn instanceof Float64Array) {
    let clean = yIn.length === n;
    for (let i = 0; i < n && clean; i++) if (yIn[i] === Infinity || yIn[i] === -Infinity) clean = false;
    if (clean) {
      y = yIn;
      // The app's own array, perhaps written into since: what was computed from it is forgotten.
      forgetColumn(yIn);
    }
    else {
      y = yIn.slice(0, n);
      for (let i = 0; i < n; i++) if (y[i] === Infinity || y[i] === -Infinity) {
        nonFinite.add(`${path}.y[${i}]`);
        y[i] = Number.NaN;
      }
    }
  } else {
    y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const v = yIn[i];
      if (v === null) y[i] = Number.NaN;
      else if (typeof v === 'number' && Number.isFinite(v)) y[i] = v;
      else {
        (typeof v === 'number' ? nonFinite : invalid).add(`${path}.y[${i}]`);
        y[i] = Number.NaN;
      }
    }
  }

  let x: RawX = { kind: 'index' };
  if (isArrayLike(xIn)) {
    const numbers = new Float64Array(n);
    let texts: (string | null)[] | null = null;
    for (let i = 0; i < n; i++) {
      const v = xIn[i];
      if (typeof v === 'number') {
        if (!Number.isFinite(v) && !(xIn instanceof Float64Array && Number.isNaN(v))) nonFinite.add(`${path}.x[${i}]`);
        numbers[i] = Number.isFinite(v) ? v : Number.NaN;
      } else if (typeof v === 'string') {
        numbers[i] = Number.NaN;
        (texts ??= new Array<string | null>(n).fill(null))[i] = v;
      } else {
        invalid.add(`${path}.x[${i}]`);
        numbers[i] = Number.NaN;
      }
    }
    x = { kind: 'values', numbers, texts };
    // A point without a usable x is a gap: its y goes too (copied, never written into the app's array).
    let copied = false;
    for (let i = 0; i < n; i++) {
      if (Number.isNaN(numbers[i]!) && (texts === null || texts[i] === null) && !Number.isNaN(y[i]!)) {
        if (!copied) {
          y = y.slice(0, n);
          copied = true;
        }
        y[i] = Number.NaN;
      }
    }
  }

  let keys: (string | null)[] | null = null;
  if (kIn !== undefined) {
    if (!Array.isArray(kIn)) keyProblems.push({ code: 'invalid-data', path: `${path}.key`, seriesId });
    else {
      if (kIn.length !== n) keyProblems.push({ code: 'invalid-data', path: `${path}.key`, seriesId, detail: 'length' });
      keys = new Array<string | null>(n).fill(null);
      const seen = new Set<string>();
      const badKey = new Tally('invalid-data', seriesId);
      const dupKey = new Tally('duplicate-key', seriesId);
      for (let i = 0; i < Math.min(n, kIn.length); i++) {
        const k: unknown = kIn[i];
        if (typeof k !== 'string') badKey.add(`${path}.key[${i}]`);
        else if (seen.has(k)) dupKey.add(`${path}.key[${i}]`);
        else {
          seen.add(k);
          keys[i] = k;
        }
      }
      badKey.drain(keyProblems);
      dupKey.drain(keyProblems);
    }
  }

  invalid.drain(problems);
  nonFinite.drain(problems);
  problems.push(...keyProblems);
  return {
    count: n,
    x,
    y,
    keys,
    names: null,
    sorted: x.kind === 'values' ? isSorted(x.numbers) : true,
    problems,
  };
}

/** Whether x never goes backwards, gaps (NaN) skipped. */
export function isSorted(xs: Float64Array): boolean {
  let last = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i]!;
    if (Number.isNaN(v)) continue;
    if (v < last) return false;
    last = v;
  }
  return true;
}
