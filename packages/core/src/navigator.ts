/**
 * The navigator and the range buttons (navigator.md, range-buttons.md): the strip's scale over the whole x extent,
 * what it draws (the visible series thin, the outside of the window shaded, two handles), and the spans of the
 * buttons, counted on the axis's zone's calendar.
 */
import type { ChartModel } from './model.js';
import type { FontRole, Group, Primitive, Rect } from './scene.js';
import type { PlacedText } from './layout.js';
import type { View } from './view.js';
import { isShown } from './view.js';
import { decimate } from './decimate.js';
import { extentOf, type Extent, type Range } from './zoom.js';
import { numericTicks, tickTarget } from './ticks.js';
import { formatTicks } from './format.js';
import { PathBuilder, rangeOf, sceneId } from './series/shared.js';
import { columnCache } from './column-cache.js';
import type { NavigatorKit } from './kit.js';

/** The strip's height, and the room under it for its labels (navigator.md 1). */
export const NAV_STRIP = 40;
/** The handles' size: drawn here, and the DOM's keyboard handles sit on them. */
export const HANDLE_WIDTH = 8;
export const HANDLE_HEIGHT = 18;

export interface NavigatorLayout {
  /** The x axis it stands for. */
  readonly axisId: string;
  readonly box: Rect;
  readonly extent: Extent;
  /** A value of the whole extent to the strip's pixels, in the x axis's direction. */
  readonly map: (v: number) => number;
  /** Its pixels back to a value. */
  readonly invert: (p: number) => number;
  readonly labels: readonly PlacedText[];
}

/**
 * The navigator over `box`: the whole extent of the x axis, running the way the chart's x axis runs (`reversed`:
 * its larger values first on screen). Null when there is nothing to navigate.
 */
export function navigatorLayout(
  model: ChartModel,
  axisId: string,
  box: Rect,
  reversed: boolean,
  locale: string | undefined,
  labelFont: FontRole,
  widthOf: (s: string, f: FontRole) => number,
  dir: 'ltr' | 'rtl',
): NavigatorLayout | null {
  const extent = extentOf(model, axisId);
  if (!extent || !(extent.max > extent.min)) return null;
  const span = extent.max - extent.min;
  const [p0, p1] = reversed ? [box.x + box.width, box.x] : [box.x, box.x + box.width];
  const map = (v: number) => p0 + ((v - extent.min) / span) * (p1 - p0);
  const invert = (p: number) => extent.min + ((p - p0) / (p1 - p0)) * span;
  // Light labels under the strip (navigator.md 1): time on the zone's clock, numbers rounded; none for categories.
  const axis = model.xAxes.find((a) => a.id === axisId);
  const target = Math.max(2, Math.floor(tickTarget(box.width, 'across') * 0.75));
  let ticks: { value: number; text: string }[] = [];
  const time = model.kit.time;
  if (axis?.scale === 'time' && time) {
    const zone = axis.zone ?? 'UTC';
    const t = time.ticks(extent.min, extent.max, target, zone);
    const named = time.labels(t, locale, zone);
    ticks = t.values.map((v, i) => ({ value: v, text: named.labels[i]! }));
  } else if (axis?.scale !== 'category') {
    const t = numericTicks(extent.min, extent.max, target, 'inside');
    const texts = formatTicks(t.values, t.step, locale);
    ticks = t.values.map((v, i) => ({ value: v, text: texts[i]! }));
  }
  const labels: PlacedText[] = [];
  let lastEnd = -Infinity;
  for (const t of ticks) {
    const w = widthOf(t.text, labelFont);
    const at = map(t.value);
    // Kept inside the strip, never overlapping the previous label.
    const x = Math.min(Math.max(at - w / 2, box.x), box.x + box.width - w);
    const start = Math.min(x, x + w);
    if (start < lastEnd + 4) continue;
    lastEnd = start + w;
    labels.push({ text: t.text, x: x + w / 2, y: box.y + box.height + 2, font: labelFont, anchor: 'middle', baseline: 'top', dir });
  }
  return { axisId, box, extent, map, invert, labels };
}

/** The navigator's drawing: its strip, the series, the shade outside the window, the window's edges and handles. */
export function navigatorGroups(model: ChartModel, nav: NavigatorLayout, view: View | undefined, text: (t: PlacedText, id: string) => Primitive): Group[] {
  const { box, extent, map } = nav;
  const shown = model.series.filter((s) => s.xAxis === nav.axisId && isShown(s, view));
  // One value scale for every series, so they compare as in the chart.
  // From the bounds kept with each column (column-cache.ts): a zoom's frame does not walk the data.
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of shown) {
    const b = rangeOf(s.columns.y);
    if (b) {
      lo = Math.min(lo, b.min);
      hi = Math.max(hi, b.max);
    }
  }
  const pad = 3;
  const yOf = (v: number) => (hi > lo ? box.y + box.height - pad - ((v - lo) / (hi - lo)) * (box.height - 2 * pad) : box.y + box.height / 2);
  const items: Primitive[] = [{ kind: 'rect', sceneId: sceneId('nav', 'strip'), paint: { fill: 'plot-background', stroke: 'axis-line', strokeWidth: 1 }, ...box }];
  for (const s of shown) {
    const { x, y } = s.columns;
    const order = s.sorted ? decimate(x, y, extent.min, extent.max, box.width) : null;
    const path = new PathBuilder();
    let open = false;
    const visit = (i: number) => {
      if (Number.isNaN(x[i]!) || Number.isNaN(y[i]!)) {
        open = false;
        return;
      }
      if (open) path.lineTo(map(x[i]!), yOf(y[i]!));
      else path.moveTo(map(x[i]!), yOf(y[i]!));
      open = true;
    };
    if (order) for (const i of order) visit(i);
    // Unsorted series (scatters): a dot each would crowd the strip; their line in x order stands for them.
    else for (const i of xOrder(x)) visit(i);
    if (!path.empty) items.push({ kind: 'path', sceneId: sceneId('nav', 'series', s.id), paint: { stroke: s.color, strokeWidth: 1, opacity: 0.8 }, path: path.build() });
  }
  // The window: the visible range, or the whole.
  const r: Range = view?.range?.[nav.axisId] ?? extent;
  const a = Math.min(map(r.min), map(r.max));
  const b = Math.max(map(r.min), map(r.max));
  const shade = { fill: 'text-muted', opacity: 0.18 } as const;
  const startEdge = Math.min(map(extent.min), map(extent.max));
  items.push({ kind: 'rect', sceneId: sceneId('nav', 'shade', 'start'), paint: shade, x: startEdge, y: box.y, width: Math.max(0, a - startEdge), height: box.height });
  items.push({ kind: 'rect', sceneId: sceneId('nav', 'shade', 'end'), paint: shade, x: b, y: box.y, width: Math.max(0, box.x + box.width - b), height: box.height });
  items.push({ kind: 'rect', sceneId: sceneId('nav', 'window'), paint: { stroke: 'text-muted', strokeWidth: 1 }, x: a, y: box.y, width: b - a, height: box.height });
  // Handles: the one at the range's start and the one at its end, wherever they fall on screen.
  for (const [part, v] of [['start', r.min], ['end', r.max]] as const) {
    const cx = map(v);
    items.push({ kind: 'rect', sceneId: sceneId('nav', 'handle', part), paint: { fill: 'background', stroke: 'text-muted', strokeWidth: 1 }, x: cx - HANDLE_WIDTH / 2, y: box.y + (box.height - HANDLE_HEIGHT) / 2, width: HANDLE_WIDTH, height: HANDLE_HEIGHT, radius: 2 });
  }
  nav.labels.forEach((t, i) => items.push(text(t, sceneId('nav', 'label', i))));
  return [{ sceneId: 'nav', painter: 'svg', items }];
}

const orders = columnCache<Int32Array>();

/** The indices of a column's numbers in increasing order, NaN left out; kept with the column (review 11). */
function xOrder(x: Float64Array): Int32Array {
  let o = orders.get(x);
  if (!o) {
    const kept: number[] = [];
    for (let i = 0; i < x.length; i++) if (!Number.isNaN(x[i]!)) kept.push(i);
    o = Int32Array.from(kept).sort((a, b) => x[a]! - x[b]!);
    orders.set(x, o);
  }
  return o;
}

export type RangeButton = '1m' | '3m' | 'ytd' | '1y';

/**
 * A range button's span (range-buttons.md 2–3): ending at the last point, starting a number of calendar months back
 * (the same day, or the month's last when it is shorter, at the same wall-clock time), or at 1 January, on the zone's
 * calendar. `fits`: the data reach back that far.
 */
export function rangeButtonSpan(model: ChartModel, axisId: string, preset: RangeButton): { min: number; max: number; fits: boolean } | null {
  const extent = extentOf(model, axisId);
  const axis = model.xAxes.find((a) => a.id === axisId);
  const time = model.kit.time;
  if (!extent || axis?.scale !== 'time' || !time) return null;
  const zone = axis.zone ?? 'UTC';
  const last = extent.max;
  const min = preset === 'ytd' ? time.yearStart(last, zone) : time.monthsBefore(last, preset === '1m' ? 1 : preset === '3m' ? 3 : 12, zone);
  return { min, max: last, fits: min >= extent.min };
}

/** The navigator's part of the core (ADR 0006): what `navigatorStrip` lends it. */
export const navigatorKit: NavigatorKit = { strip: NAV_STRIP, layout: navigatorLayout, groups: navigatorGroups, span: rangeButtonSpan };
