/**
 * What the pointer or the finger points at (hover-tooltip.md 1–3). Shared: the x nearest the pointer, anywhere up or
 * down, and every shared series' point there (binary search on sorted x, O(log n)). Per mark: the column under the
 * pointer or the nearest in its band, a scatter point within 24 px — read from the scene, so what is hit is what is
 * drawn.
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { ArcPrimitive, MarkerPrimitive, PointRef, PointsPrimitive, RectPrimitive, Scene } from './scene.js';
import { pointsAt } from './points-batch.js';
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
  readonly batches: readonly BatchGrid[];
}

/**
 * A batch's points by cell (ADR 0008): typed arrays, no object per point. Cells of POINT_REACH with a border row and
 * column all round, each point in its own cell only; a lookup reads the pointer's cell and its eight neighbours.
 * Within a cell, points in index order (a counting sort keeps it).
 */
interface BatchGrid {
  readonly prim: PointsPrimitive;
  /** The scene order of its first point; point i's is `order + i`. */
  readonly order: number;
  readonly cols: number;
  readonly start: Uint32Array;
  readonly points: Uint32Array;
}

function batchGrid(p: PointsPrimitive, order: number, x0: number, y0: number, cols: number, rows: number): BatchGrid {
  // Cell of each point, or −1 when it is not within reach of the plot.
  const w = cols + 2;
  const cell = new Int32Array(p.x.length);
  const start = new Uint32Array(w * (rows + 2) + 1);
  for (let i = 0; i < cell.length; i++) {
    const at = pointsAt(p, i);
    const c = at ? Math.floor((at[0] - x0) / POINT_REACH) + 1 : -1;
    const r = at ? Math.floor((at[1] - y0) / POINT_REACH) + 1 : -1;
    if (c < 0 || r < 0 || c > cols + 1 || r > rows + 1) cell[i] = -1;
    else start[(cell[i] = r * w + c) + 1]!++;
  }
  for (let k = 1; k < start.length; k++) start[k]! += start[k - 1]!;
  const fill = start.slice(0, -1);
  const points = new Uint32Array(start[start.length - 1]!);
  for (let i = 0; i < cell.length; i++) if (cell[i]! >= 0) points[fill[cell[i]!]!++] = i;
  return { prim: p, order, cols: w, start, points };
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
  const batches: BatchGrid[] = [];
  for (const grp of scene.layers.find((l) => l.id === 'series')?.groups ?? [])
    for (const p of grp.items) {
      // A selection drawn over its cloud is the same points: the cloud answers (selection.md 10).
      if (p.kind === 'points' && p.only) continue;
      if (p.kind === 'points') {
        batches.push(batchGrid(p, order, x0, y0, cols, rows));
        order += p.x.length;
        continue;
      }
      if (!p.point || (p.kind !== 'rect' && p.kind !== 'marker')) continue;
      const h: Hittable = { order: order++, prim: p, ref: p.point };
      if (p.kind === 'marker') add(h, p.x - POINT_REACH, p.y - POINT_REACH, p.x + POINT_REACH, p.y + POINT_REACH);
      // A column's band runs the plot's whole height (a bar's, its whole width): above a short column is still its band.
      else if (orientation === 'vertical') {
        const reach = p.width * 0.75;
        add(h, p.x - reach, plot.y, p.x + p.width + reach, plot.y + plot.height);
      } else {
        const reach = p.height * 0.75;
        add(h, plot.x, p.y - reach, plot.x + plot.width, p.y + p.height + reach);
      }
    }
  g = { x0, y0, cols, rows, cells, batches };
  byOrientation.set(orientation, g);
  return g;
}

/**
 * The mark pointed at: a column under the pointer or the nearest in its band, else a scatter point within 24 px.
 * `ofSeries` keeps the series whose tooltip is per mark (a line's markers belong to its shared tooltip); `withLines`:
 * the chart also has lines, whose shared tooltip answers where no column is near (a column's reach capped). The marks
 * are looked up in a grid built once per scene (spike S8): a move reads one cell, not the whole scene.
 */
export function hitMark(scene: Scene, px: number, py: number, orientation: 'vertical' | 'horizontal' = 'vertical', ofSeries: (seriesId: string) => boolean = () => true, withLines = false): PointRef | null {
  if (!inside(scene.areas.plot, px, py)) return null;
  // Slices (ADR 0007): the one whose ring and angle hold the pointer. A pie has few; read them in order.
  for (const grp of scene.layers.find((l) => l.id === 'series')?.groups ?? [])
    for (const p of grp.items) if (p.kind === 'arc' && p.point && ofSeries(p.point.seriesId) && inArc(p, px, py)) return p.point;
  const g = gridOf(scene, orientation);
  const c = Math.min(g.cols - 1, Math.floor((px - g.x0) / POINT_REACH));
  const r = Math.min(g.rows - 1, Math.floor((py - g.y0) / POINT_REACH));
  const list = g.cells.get(r * g.cols + c) ?? [];
  let under: Hittable | null = null;
  let band: { h: Hittable; d: number } | null = null;
  let dot: { ref: PointRef; d: number; order: number } | null = null;
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
      // Near it, within its band: three quarters of its width (hover-tooltip.md 2, 3). Beside lines, never past a point's
      // reach: a wide column would answer over the next category, where only the lines are (hover-tooltip.md 12).
      const size = (orientation === 'vertical' ? p.width : p.height) * 0.75;
      const reach = withLines ? Math.min(size, POINT_REACH) : size;
      if (d <= reach && (!band || d < band.d)) band = { h, d };
    } else {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= POINT_REACH && (!dot || d < dot.d)) dot = { ref: h.ref, d, order: h.order };
    }
  }
  // A rect under the pointer wins over any marker, as in the scan: every rect under the pointer is in its cell.
  if (under) return under.ref;
  // Batches' points: the nearest within reach; on a tie, the earlier in the scene, as for markers.
  for (const b of g.batches) {
    if (!ofSeries(b.prim.seriesId)) continue;
    for (let rr = r; rr <= r + 2; rr++)
      for (let cc = c; cc <= c + 2; cc++) {
        const k = rr * b.cols + cc;
        for (let j = b.start[k]!; j < b.start[k + 1]!; j++) {
          const i = b.points[j]!;
          const [x, y] = pointsAt(b.prim, i)!;
          const d = Math.hypot(x - px, y - py);
          if (d <= POINT_REACH && (!dot || d < dot.d || (d === dot.d && b.order + i < dot.order))) dot = { ref: { seriesId: b.prim.seriesId, index: i }, d, order: b.order + i };
        }
      }
  }
  return dot?.ref ?? band?.h.ref ?? null;
}

/** Whether a pixel is in an arc: between its radii, and within its angles (clockwise from twelve o'clock). */
function inArc(a: ArcPrimitive, px: number, py: number): boolean {
  const dx = px - a.cx;
  const dy = py - a.cy;
  const r = Math.hypot(dx, dy);
  if (r < a.innerRadius || r > a.outerRadius) return false;
  const turn = 2 * Math.PI;
  const angle = (((Math.atan2(dx, -dy) - a.startAngle) % turn) + turn) % turn;
  return angle <= a.endAngle - a.startAngle;
}
