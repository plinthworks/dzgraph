/**
 * Aggregation (aggregation.md), lent to the core by the `aggregation` module (ADR 0006): each series' points grouped
 * by a period of the zone's calendar or a bucket of x, one point per group — its x the group's start, its value the
 * series' function of the group's values (gaps count for nothing; an empty group is no point). The groups are kept,
 * so a selection maps both ways: an aggregated point is selected when any of its points is, and selecting it selects
 * them all (GLOSSARY: Selection).
 */
import type { ChartModel } from './model.js';
import type { SeriesModel } from './series-type.js';
import type { Period } from './time.js';

export type AggregateFn = 'sum' | 'mean' | 'min' | 'max' | 'count';
export type AggregateSpec = { readonly period: Period } | { readonly step: number };

export interface Aggregated {
  readonly model: ChartModel;
  /** How many points (with a value) each aggregated point holds, by series. */
  readonly counts: ReadonlyMap<string, Uint32Array>;
  /** A selection of the app's points to the aggregated points, and back. */
  readonly forth: (sel: ReadonlyMap<string, Uint8Array>) => Map<string, Uint8Array>;
  readonly back: (sel: ReadonlyMap<string, Uint8Array>) => Map<string, Uint8Array>;
}

export interface AggregationKit {
  /** The model aggregated; null when nothing may be (no x axis of values, a polar chart). */
  readonly apply: (model: ChartModel, spec: AggregateSpec) => Aggregated | null;
}

/** The group each point falls in, as its start: a period on the axis's zone, or a multiple of the step. */
function groupOf(model: ChartModel, s: SeriesModel, spec: AggregateSpec): ((x: number) => number) | null {
  const axis = model.xAxes.find((a) => a.id === s.xAxis);
  if (!axis || axis.scale === 'category') return null;
  if ('step' in spec) {
    // A step of 0.1 holds 0.3 at 0.3: a hair of tolerance for the division, the start written to the step's precision
    // (review 6: 0.3 / 0.1 is 2.9999999999999996).
    const digits = Math.max(0, -Math.floor(Math.log10(spec.step)) + 6);
    return (x) => Number((Math.floor(x / spec.step + 1e-9) * spec.step).toFixed(Math.min(20, digits)));
  }
  const time = model.kit.time;
  if (axis.scale !== 'time' || !time) return null;
  const zone = axis.zone ?? 'UTC';
  // Past what a calendar can show (±8.64e15 ms), no period: a gap, never a throw (review 7).
  return (x) => (Math.abs(x) <= 8.64e15 ? time.periodStart(x, spec.period, zone) : Number.NaN);
}

function apply(model: ChartModel, spec: AggregateSpec): Aggregated | null {
  if (model.system !== 'cartesian') return null;
  const groups = new Map<string, { readonly of: Int32Array; readonly count: number }>();
  const counts = new Map<string, Uint32Array>();
  const series = model.series.map((s) => {
    const start = groupOf(model, s, spec);
    if (!start) return s;
    const { x, y } = s.columns;
    // Each point's group start; the groups in x order.
    const at = new Float64Array(x.length);
    const starts = new Map<number, number>();
    for (let i = 0; i < x.length; i++) {
      at[i] = Number.isNaN(x[i]!) || Number.isNaN(y[i]!) ? Number.NaN : start(x[i]!);
      if (!Number.isNaN(at[i]!) && !starts.has(at[i]!)) starts.set(at[i]!, 0);
    }
    const keys = [...starts.keys()].sort((a, b) => a - b);
    keys.forEach((k, j) => starts.set(k, j));
    const n = keys.length;
    const of = new Int32Array(x.length).fill(-1);
    const sum = new Float64Array(n);
    const min = new Float64Array(n).fill(Infinity);
    const max = new Float64Array(n).fill(-Infinity);
    const count = new Uint32Array(n);
    for (let i = 0; i < x.length; i++) {
      if (Number.isNaN(at[i]!)) continue;
      const j = starts.get(at[i]!)!;
      of[i] = j;
      sum[j]! += y[i]!;
      count[j]!++;
      if (y[i]! < min[j]!) min[j] = y[i]!;
      if (y[i]! > max[j]!) max[j] = y[i]!;
    }
    const fn = s.aggregate;
    const values = Float64Array.from({ length: n }, (_, j) => (fn === 'sum' ? sum[j]! : fn === 'mean' ? sum[j]! / count[j]! : fn === 'min' ? min[j]! : fn === 'max' ? max[j]! : count[j]!));
    groups.set(s.id, { of, count: n });
    counts.set(s.id, count);
    // `count`: how many points each one holds, for the tooltip (aggregation.md 3).
    return { ...s, columns: { x: Float64Array.from(keys), y: values, count: Float64Array.from(count) }, keys: null, names: null, sorted: true };
  });
  if (!groups.size) return null;
  const xAxes = model.xAxes.map((a) => (model.series.some((s) => s.xAxis === a.id && groups.has(s.id)) ? { ...a, period: spec } : a));
  const forth = (sel: ReadonlyMap<string, Uint8Array>) => {
    const out = new Map<string, Uint8Array>();
    for (const [id, bits] of sel) {
      const g = groups.get(id);
      if (!g) {
        out.set(id, bits);
        continue;
      }
      const to = new Uint8Array(g.count);
      for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) if (g.of[i]! >= 0) to[g.of[i]!] = 1;
      out.set(id, to);
    }
    return out;
  };
  const back = (sel: ReadonlyMap<string, Uint8Array>) => {
    const out = new Map<string, Uint8Array>();
    for (const [id, bits] of sel) {
      const g = groups.get(id);
      if (!g) {
        out.set(id, bits);
        continue;
      }
      const to = new Uint8Array(g.of.length);
      for (let i = 0; i < g.of.length; i++) if (g.of[i]! >= 0 && bits[g.of[i]!]) to[i] = 1;
      out.set(id, to);
    }
    return out;
  };
  return { model: { ...model, series, xAxes }, counts, forth, back };
}

export const aggregationKit: AggregationKit = { apply };
