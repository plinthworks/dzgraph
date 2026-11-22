/**
 * Columns and bars (columns-bars.md): one rectangle per point from zero, the series side by side in each band, or
 * piled when stacked (stacking.md). Bars are columns in a horizontal chart: the same code, turned by the frame's
 * orientation.
 */
import type { SeriesBase } from '../options.js';
import type { Bounds, MarkContext, MarkSet, SeriesModel, SeriesType } from '../series-type.js';
import type { RectPrimitive } from '../scene.js';
import { isGap, rangeOf, sceneId, withZero } from './shared.js';

export interface ColumnSeriesOptions extends SeriesBase<'column'> {
  /** Stacks the column on the other columns of the same stack (stacking.md 1); `true`: the stack `default`. */
  readonly stack?: boolean | string | undefined;
}
export interface BarSeriesOptions extends SeriesBase<'bar'> {
  /** Stacks the bar on the other bars of the same stack (stacking.md 1); `true`: the stack `default`. */
  readonly stack?: boolean | string | undefined;
}

declare module '../options.js' {
  interface SeriesOptionsByType {
    column: ColumnSeriesOptions;
    bar: BarSeriesOptions;
  }
}

/** A fifth of the band is left around each group; a tenth of a column between columns (columns-bars.md 1). */
const GROUP_SHARE = 0.8;
const COLUMN_GAP = 0.1;
/** The free end's corners (owner 2026-11-21: rounded by 4 px, the base straight). */
const END_RADIUS = 4;

/** The smallest step between two x values: a band's width when the x axis is not one of categories. */
function smallestStep(x: Float64Array): number {
  let step = Infinity;
  for (let i = 1; i < x.length; i++) {
    const d = Math.abs(x[i]! - x[i - 1]!);
    if (d > 0 && d < step) step = d;
  }
  return step;
}

function columnMarks<O extends SeriesBase<string, unknown>>(ctx: MarkContext<O, 'cartesian'>): MarkSet[] {
  const s = ctx.series;
  const { x, y } = s.columns;
  const { x: X, y: Y, orientation } = ctx.frame;
  const across = orientation === 'vertical';
  const length = across ? ctx.plot.width : ctx.plot.height;
  // The band: a category's, or the smallest step between points (a tenth of the plot for a single point).
  let band = X.bandwidth;
  if (band === 0) {
    const step = smallestStep(x);
    band = Number.isFinite(step) ? Math.abs(X.map(step) - X.map(0)) : length / 10;
  }
  const group = band * GROUP_SHARE;
  const width = Math.max(1, group / (ctx.slots + COLUMN_GAP * (ctx.slots - 1)));
  // Slots follow the reading direction across, and run top to bottom for bars.
  const slot = across && ctx.dir === 'rtl' ? ctx.slots - 1 - ctx.slot : ctx.slot;
  const offset = -group / 2 + slot * width * (1 + COLUMN_GAP);
  const zero = Y.map(0);
  // The plot's span along the values: a column is cut where the axis's bounds cut it (review 5).
  const [v0, v1] = across ? [ctx.plot.y, ctx.plot.y + ctx.plot.height] : [ctx.plot.x, ctx.plot.x + ctx.plot.width];
  const clamp = (v: number) => Math.min(v1, Math.max(v0, v));
  /** Which way, in pixels, values grow along the plot (+1 or −1), whatever the scale. */
  const rising = Y.invert(v1) > Y.invert(v0) ? 1 : -1;
  const rects: RectPrimitive[] = [];
  const pile = ctx.stacked;
  for (let i = 0; i < x.length; i++) {
    const v = y[i]!;
    if (isGap(s, i) || v === 0) continue;
    const start = X.map(x[i]!) + offset;
    // Stacked: the segment from the pile below it to its own end (stacking.md 4).
    const from = pile ? pile.base[i]! : 0;
    let a = pile ? Y.map(from) : zero;
    let b = Y.map(pile ? pile.top[i]! : v);
    const outer = !pile || pile.outer[i] === 1;
    if (pile) {
      // Two px of background between segments (stacking.md 12): one taken from each side of every joint.
      const toward = b < a ? -1 : 1;
      if (from !== 0) a += toward;
      if (!outer) b -= toward;
      if ((b - a) * toward < 1) b = a + toward;
    }
    // A value that is not zero is at least 1 px (columns-bars.md 3), grown away from zero — on a log axis, up from
    // the bottom even at the axis's lowest value, where the column has no length of its own (log-scale.md 8).
    if (Math.abs(b - a) < 1) b = a + (b !== a ? Math.sign(b - a) : v > 0 ? rising : -rising);
    a = clamp(a);
    const cut = clamp(b) !== b;
    b = clamp(b);
    if (a === b) continue;
    const lo = Math.min(a, b);
    const size = Math.abs(b - a);
    const point = { seriesId: s.id, index: i };
    const id = sceneId('s', s.id, 'c', i);
    // The free end is rounded, unless the plot cut it (that is not the column's end).
    // Only the pile's end is rounded; the segments inside it stay straight (stacking.md 12).
    const radius = cut || !outer ? 0 : Math.min(END_RADIUS, width / 2, size);
    // The free end is always named (animation grows the column from the edge opposite it, review 11); rounded unless cut.
    const end: NonNullable<RectPrimitive['roundEnd']> = across ? (b < a ? 'y-min' : 'y-max') : b > a ? 'x-max' : 'x-min';
    const round = radius > 0 ? { radius, roundEnd: end } : { roundEnd: end };
    rects.push(
      across
        ? { kind: 'rect', sceneId: id, paint: { fill: s.color }, x: start, y: lo, width, height: size, point, ...round }
        : { kind: 'rect', sceneId: id, paint: { fill: s.color }, x: lo, y: start, width: size, height: width, point, ...round },
    );
  }
  return rects.length ? [{ layer: 'series', role: 'marks', items: rects }] : [];
}

/** Columns on a numeric x axis reach half a step beyond the first and last points, so none hangs out of the plot. */
function columnBounds(s: SeriesModel): { x: Bounds | null; y: Bounds | null } {
  const x = rangeOf(s.columns.x);
  const step = smallestStep(s.columns.x);
  const half = Number.isFinite(step) ? step / 2 : 0.5;
  return { x: x ? { min: x.min - half, max: x.max + half } : null, y: withZero(rangeOf(s.columns.y)) };
}

export const column: SeriesType<ColumnSeriesOptions, 'cartesian'> = {
  name: 'column',
  system: 'cartesian',
  orientation: 'vertical',
  zeroBased: true,
  sign: 'square',
  stackable: true,
  optionNames: { stack: true },
  check: () => [],
  bounds: columnBounds,
  marks: columnMarks,
};

export const bar: SeriesType<BarSeriesOptions, 'cartesian'> = {
  name: 'bar',
  system: 'cartesian',
  zeroBased: true,
  orientation: 'horizontal',
  sign: 'square',
  stackable: true,
  optionNames: { stack: true },
  check: () => [],
  bounds: columnBounds,
  marks: columnMarks,
};
