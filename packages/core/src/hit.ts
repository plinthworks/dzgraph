/**
 * What the pointer or the finger points at (hover-tooltip.md 1–3). Shared: the x nearest the pointer, anywhere up or
 * down, and every shared series' point there (binary search on sorted x, O(log n)). Per mark: the column under the
 * pointer or the nearest in its band, a scatter point within 24 px — read from the scene, so what is hit is what is
 * drawn.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { PointRef, Scene } from './scene.js';
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

/**
 * The mark pointed at: a column under the pointer or the nearest in its band, else a scatter point within 24 px.
 * `ofSeries` keeps the series whose tooltip is per mark (a line's markers belong to its shared tooltip).
 */
export function hitMark(scene: Scene, px: number, py: number, orientation: 'vertical' | 'horizontal' = 'vertical', ofSeries: (seriesId: string) => boolean = () => true): PointRef | null {
  if (!inside(scene.areas.plot, px, py)) return null;
  const series = scene.layers.find((l) => l.id === 'series');
  if (!series) return null;
  let band: { ref: PointRef; d: number } | null = null;
  let dot: { ref: PointRef; d: number } | null = null;
  for (const g of series.groups)
    for (const p of g.items) {
      if (!p.point || !ofSeries(p.point.seriesId)) continue;
      if (p.kind === 'rect') {
        if (inside(p, px, py)) return p.point;
        // Across the band: the distance along the categories only.
        const d = orientation === 'vertical' ? Math.max(0, p.x - px, px - (p.x + p.width)) : Math.max(0, p.y - py, py - (p.y + p.height));
        const reach = (orientation === 'vertical' ? p.width : p.height) * 0.75;
        if (d <= reach && (!band || d < band.d)) band = { ref: p.point, d };
      } else if (p.kind === 'marker') {
        const d = Math.hypot(p.x - px, p.y - py);
        if (d <= POINT_REACH && (!dot || d < dot.d)) dot = { ref: p.point, d };
      }
    }
  return dot?.ref ?? band?.ref ?? null;
}
