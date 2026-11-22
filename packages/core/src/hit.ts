/**
 * What the pointer or the finger points at (hover-tooltip.md 1–3). Shared: the x nearest the pointer, anywhere up or
 * down, and every shared series' point there (binary search on sorted x, O(log n)). Per mark: the column under the
 * pointer or the nearest in its band, a scatter point within 24 px — read from the scene, so what is hit is what is
 * drawn.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { MarkerPrimitive, PointRef, RectPrimitive, Scene } from './scene.js';
import type { SeriesModel } from './series-type.js';
import { isShown, type View } from './view.js';
import { pointAt } from './points.js';

export interface SharedPoint extends PointRef {
  /** The point's place on screen. */
  readonly px: number;
  readonly py: number;
}

export interface SharedHit {
  /** The x value hovered (a category's rank on a category axis). */
  readonly x: number;
  readonly points: readonly SharedPoint[];
}

/** How near a scatter point must be (hover-tooltip.md 2). */
const POINT_REACH = 24;

const inside = (r: { x: number; y: number; width: number; height: number }, px: number, py: number) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;

function lowerBound(x: Float64Array, v: number): number {
  let lo = 0;
  let hi = x.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (x[m]! < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** The point of a sorted series nearest a pixel along x, gaps skipped; -1 if it has none. */
function nearest(s: SeriesModel, map: (v: number) => number, invert: (p: number) => number, px: number): number {
  const { x, y } = s.columns;
  const i = lowerBound(x, invert(px));
  let best = -1;
  let bestD = Infinity;
  // Gaps share the x of the point before them (normalize.ts): walk out from the insertion point both ways.
  for (const step of [-1, 1]) {
    for (let j = step < 0 ? i - 1 : i; j >= 0 && j < x.length; j += step) {
      if (Number.isNaN(y[j]!)) continue;
      const d = Math.abs(map(x[j]!) - px);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
      break;
    }
  }
  return best;
}

export function hitShared(model: ChartModel, layout: ChartLayout, view: View | undefined, px: number, py: number): SharedHit | null {
  if (!inside(layout.plot, px, py) || model.orientation !== 'vertical') return null;
  const candidates = model.series.filter((s) => s.tooltip === 'shared' && s.sorted && isShown(s, view));
  const scaleOf = (s: SeriesModel) => layout.axes.find((a) => a.dimension === 'x' && a.id === s.xAxis)?.scale;
  let chosen: { x: number; px: number } | null = null;
  for (const s of candidates) {
    const sc = scaleOf(s);
    if (!sc) continue;
    const i = nearest(s, (v) => sc.map(v), (p) => sc.invert(p), px);
    if (i === -1) continue;
    const at = sc.map(s.columns.x[i]!);
    if (!chosen || Math.abs(at - px) < Math.abs(chosen.px - px)) chosen = { x: s.columns.x[i]!, px: at };
  }
  if (!chosen) return null;
  const points: SharedPoint[] = [];
  for (const s of candidates) {
    const sc = scaleOf(s);
    if (!sc) continue;
    // Its point at the chosen x: the same value, or within half a pixel of it (series sampled apart).
    const i = nearest(s, (v) => sc.map(v), (p) => sc.invert(p), chosen.px);
    if (i === -1) continue;
    const at = sc.map(s.columns.x[i]!);
    if (s.columns.x[i] !== chosen.x && Math.abs(at - chosen.px) > 0.5) continue;
    const p = pointAt(model, layout, { seriesId: s.id, index: i });
    if (p) points.push({ seriesId: s.id, index: i, px: p.x, py: p.y });
  }
  return { x: chosen.x, points };
}

/** A mark the pointer can find, in scene order (ties go to the earlier, as a scan would). */
interface Hittable {
  readonly order: number;
  readonly prim: RectPrimitive | MarkerPrimitive;
  readonly ref: PointRef;
}

/** The series layer's marks in a grid of POINT_REACH cells (spike S8): each mark in every cell its reach touches. */
interface MarkGrid {
  readonly x0: number;
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
  readonly cells: Map<number, Hittable[]>;
}

const grids = new WeakMap<Scene, Map<string, MarkGrid>>();

function gridOf(scene: Scene, orientation: 'vertical' | 'horizontal'): MarkGrid {
  let byOrientation = grids.get(scene);
  if (!byOrientation) grids.set(scene, (byOrientation = new Map()));
  let g = byOrientation.get(orientation);
  if (g) return g;
  const plot = scene.areas.plot;
  const x0 = plot.x;
  const y0 = plot.y;
  const cols = Math.max(1, Math.ceil(plot.width / POINT_REACH) + 1);
  const rows = Math.max(1, Math.ceil(plot.height / POINT_REACH) + 1);
  const cells = new Map<number, Hittable[]>();
  const add = (h: Hittable, ax: number, ay: number, bx: number, by: number) => {
    // Clamped to the plot: the pointer is never looked up outside it.
    const c0 = Math.max(0, Math.floor((ax - x0) / POINT_REACH));
    const c1 = Math.min(cols - 1, Math.floor((bx - x0) / POINT_REACH));
    const r0 = Math.max(0, Math.floor((ay - y0) / POINT_REACH));
    const r1 = Math.min(rows - 1, Math.floor((by - y0) / POINT_REACH));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const k = r * cols + c;
        const list = cells.get(k);
        if (list) list.push(h);
        else cells.set(k, [h]);
      }
  };
  let order = 0;
  for (const grp of scene.layers.find((l) => l.id === 'series')?.groups ?? [])
    for (const p of grp.items) {
      if (!p.point || (p.kind !== 'rect' && p.kind !== 'marker')) continue;
      const h: Hittable = { order: order++, prim: p, ref: p.point };
      if (p.kind === 'marker') add(h, p.x - POINT_REACH, p.y - POINT_REACH, p.x + POINT_REACH, p.y + POINT_REACH);
      else if (orientation === 'vertical') {
        const reach = p.width * 0.75;
        add(h, p.x - reach, p.y, p.x + p.width + reach, p.y + p.height);
      } else {
        const reach = p.height * 0.75;
        add(h, p.x, p.y - reach, p.x + p.width, p.y + p.height + reach);
      }
    }
  g = { x0, y0, cols, rows, cells };
  byOrientation.set(orientation, g);
  return g;
}

/**
 * The mark pointed at: a column under the pointer or the nearest in its band, else a scatter point within 24 px.
 * `ofSeries` keeps the series whose tooltip is per mark (a line's markers belong to its shared tooltip). The marks
 * are looked up in a grid built once per scene (spike S8): a move reads one cell, not the whole scene.
 */
export function hitMark(scene: Scene, px: number, py: number, orientation: 'vertical' | 'horizontal' = 'vertical', ofSeries: (seriesId: string) => boolean = () => true): PointRef | null {
  if (!inside(scene.areas.plot, px, py)) return null;
  const g = gridOf(scene, orientation);
  const c = Math.min(g.cols - 1, Math.floor((px - g.x0) / POINT_REACH));
  const r = Math.min(g.rows - 1, Math.floor((py - g.y0) / POINT_REACH));
  const list = g.cells.get(r * g.cols + c);
  if (!list) return null;
  let under: Hittable | null = null;
  let band: { h: Hittable; d: number } | null = null;
  let dot: { h: Hittable; d: number } | null = null;
  // Each cell's list is in scene order: the first rect under the pointer, and the first of equal distances, win.
  for (const h of list) {
    const p = h.prim;
    if (!ofSeries(h.ref.seriesId)) continue;
    if (p.kind === 'rect') {
      if (inside(p, px, py)) {
        under = h;
        break;
      }
      const d = orientation === 'vertical' ? Math.max(0, p.x - px, px - (p.x + p.width)) : Math.max(0, p.y - py, py - (p.y + p.height));
      const reach = (orientation === 'vertical' ? p.width : p.height) * 0.75;
      if (d <= reach && (!band || d < band.d)) band = { h, d };
    } else {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= POINT_REACH && (!dot || d < dot.d)) dot = { h, d };
    }
  }
  // A rect under the pointer wins over any marker, as in the scan: every rect under the pointer is in its cell.
  if (under) return under.ref;
  return dot?.h.ref ?? band?.h.ref ?? null;
}
