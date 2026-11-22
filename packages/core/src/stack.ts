/**
 * Piles (stacking.md): the visible series of one stack, on the same axes and of the same type, put on each other at
 * equal x values — positives upwards from zero, negatives downwards, each on its own pile; a gap adds nothing. On a
 * percent axis each value becomes its share of the sum of the absolute values at its x, so both sides keep their
 * sign. Computed from the model and the view (a hidden series leaves its pile), once per layout.
 */
import type { ChartModel } from './model.js';
import type { SeriesModel } from './series-type.js';
import { isShown, type View } from './view.js';

/** One series in its pile, per point, in the y axis's unit (percent on a percent axis); NaN at a gap. */
export interface Stacked {
  /** Where the point's segment starts and ends. */
  readonly base: Float64Array;
  readonly top: Float64Array;
  /** The point's share of the pile at its x (|value| ÷ the sum of |values|), 0 to 1; NaN at a gap or a zero total. */
  readonly share: Float64Array;
  /** The pile's net total at the point's x, in the data's unit (never percent). */
  readonly total: Float64Array;
  /** 1 where the segment is the pile's free end: the top of the positives, the bottom of the negatives. */
  readonly outer: Uint8Array;
}

/** Every stacked visible series' pile, by series id; a series that stands alone is not in it. */
export type Stacks = ReadonlyMap<string, Stacked>;

export function stacksOf(model: ChartModel, view: View | undefined): Stacks {
  const groups = new Map<string, SeriesModel[]>();
  for (const s of model.series) {
    if (s.stack === null || !isShown(s, view)) continue;
    const key = JSON.stringify([s.type, s.xAxis, s.yAxis, s.stack]);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  const out = new Map<string, Stacked>();
  for (const members of groups.values()) {
    const percent = model.yAxes.find((a) => a.id === members[0]!.yAxis)?.stacking === 'percent';
    pile(members, percent, out);
  }
  return out;
}

function pile(members: readonly SeriesModel[], percent: boolean, out: Map<string, Stacked>): void {
  // First pass: at each x, the sum of absolute values (shares, percent) and the net total.
  const abs = new Map<number, number>();
  const net = new Map<number, number>();
  for (const s of members) {
    const { x, y } = s.columns;
    for (let i = 0; i < x.length; i++) {
      const v = y[i]!;
      if (Number.isNaN(v)) continue;
      abs.set(x[i]!, (abs.get(x[i]!) ?? 0) + Math.abs(v));
      net.set(x[i]!, (net.get(x[i]!) ?? 0) + v);
    }
  }
  // Second pass: each segment on the pile of its sign; the last non-zero one on each side is that side's end.
  const up = new Map<number, number>();
  const down = new Map<number, number>();
  const lastUp = new Map<number, [Uint8Array, number]>();
  const lastDown = new Map<number, [Uint8Array, number]>();
  for (const s of members) {
    const { x, y } = s.columns;
    const n = x.length;
    const st: Stacked = { base: new Float64Array(n), top: new Float64Array(n), share: new Float64Array(n), total: new Float64Array(n), outer: new Uint8Array(n) };
    for (let i = 0; i < n; i++) {
      const v = y[i]!;
      const at = x[i]!;
      if (Number.isNaN(v)) {
        st.base[i] = st.top[i] = st.share[i] = st.total[i] = Number.NaN;
        continue;
      }
      const whole = abs.get(at)!;
      st.share[i] = whole > 0 ? Math.abs(v) / whole : Number.NaN;
      st.total[i] = net.get(at)!;
      const scaled = percent ? (whole > 0 ? (v / whole) * 100 : 0) : v;
      const side = v < 0 ? down : up;
      const base = side.get(at) ?? 0;
      st.base[i] = base;
      st.top[i] = base + scaled;
      side.set(at, base + scaled);
      if (v > 0) lastUp.set(at, [st.outer, i]);
      else if (v < 0) lastDown.set(at, [st.outer, i]);
    }
    out.set(s.id, st);
  }
  for (const [outer, i] of lastUp.values()) outer[i] = 1;
  for (const [outer, i] of lastDown.values()) outer[i] = 1;
}
