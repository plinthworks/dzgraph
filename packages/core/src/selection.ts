/**
 * The selection (selection.md, GLOSSARY: Selection): which points the user chose, one bit per point and series, kept
 * in the view (ADR 0009). The shapes that choose them — a rectangle, a range of x, a lasso — read where each point is
 * drawn. The lasso is exact and live at a million points (D.21): adding a place to its outline flips exactly the
 * points inside the triangle that place makes with the previous one and the first (the even-odd rule), and only the
 * grid cells that triangle covers are read.
 */
import { selectionLook } from './selection-look.js';
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { SeriesModel } from './series-type.js';
import type { View } from './view.js';
import { isShown } from './view.js';

/** One bit per point (1: selected), by series id. */
export type Selection = ReadonlyMap<string, Uint8Array>;

export type SelectOp = 'replace' | 'add' | 'remove';

/** How many points are selected. */
export function selectedCount(sel: Selection | undefined): number {
  let n = 0;
  if (sel) for (const bits of sel.values()) for (let i = bits.indexOf(1); i !== -1; i = bits.indexOf(1, i + 1)) n++;
  return n;
}

export function isSelected(sel: Selection | undefined, seriesId: string, index: number): boolean {
  return sel?.get(seriesId)?.[index] === 1;
}

/** Where a cartesian series' points are drawn: a function of the index, NaN for a gap; null for a polar series. */
export function placesOf(model: ChartModel, layout: ChartLayout, s: SeriesModel): ((i: number) => [number, number]) | null {
  if (layout.placements.has(s.id)) return null;
  const xs = layout.axes.find((a) => a.dimension === 'x' && a.id === s.xAxis)?.scale;
  const ys = layout.axes.find((a) => a.dimension === 'y' && a.id === s.yAxis)?.scale;
  if (!xs || !ys) return null;
  const pile = layout.stacks.get(s.id);
  const cmp = layout.compare.series.get(s.id);
  const { x, y } = s.columns;
  const vertical = model.orientation === 'vertical';
  return (i) => {
    const raw = pile ? pile.top[i]! : y[i]!;
    if (Number.isNaN(raw) || Number.isNaN(y[i]!) || Number.isNaN(x[i]!)) return [Number.NaN, Number.NaN];
    const a = xs.map(x[i]!);
    const b = ys.map(cmp ? cmp.a * raw + cmp.c : raw);
    return vertical ? [a, b] : [b, a];
  };
}

/** The series a gesture may select: shown, cartesian (selection.md 11, 12). */
const selectable = (model: ChartModel, layout: ChartLayout, view: View | undefined) => model.series.filter((s) => isShown(s, view) && !layout.placements.has(s.id) && !layout.compare.missing.has(s.id));

/** Applies a gesture's points to a selection: replaced, added to, or taken from (selection.md 3). */
export function combine(model: ChartModel, current: Selection | undefined, chosen: Selection, op: SelectOp): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const s of model.series) {
    const old = current?.get(s.id);
    const now = chosen.get(s.id);
    const n = s.columns.x.length;
    const bits = op === 'replace' ? new Uint8Array(n) : old && old.length === n ? old.slice() : new Uint8Array(n);
    if (now) for (let i = 0; i < n; i++) if (now[i]) bits[i] = op === 'remove' ? 0 : 1;
    if (bits.indexOf(1) !== -1) out.set(s.id, bits);
  }
  return out;
}

/** The points drawn inside a rectangle of the scene (selection.md 2). */
export function inRect(model: ChartModel, layout: ChartLayout, view: View | undefined, r: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }): Map<string, Uint8Array> {
  const [xa, xb] = r.x0 <= r.x1 ? [r.x0, r.x1] : [r.x1, r.x0];
  const [ya, yb] = r.y0 <= r.y1 ? [r.y0, r.y1] : [r.y1, r.y0];
  const out = new Map<string, Uint8Array>();
  for (const s of selectable(model, layout, view)) {
    const at = placesOf(model, layout, s);
    if (!at) continue;
    const bits = new Uint8Array(s.columns.x.length);
    for (let i = 0; i < bits.length; i++) {
      const [px, py] = at(i);
      if (px >= xa && px <= xb && py >= ya && py <= yb) bits[i] = 1;
    }
    out.set(s.id, bits);
  }
  return out;
}

/** The points whose x is within [from, to], whatever their y (selection.md 2). */
export function inRange(model: ChartModel, layout: ChartLayout, view: View | undefined, from: number, to: number): Map<string, Uint8Array> {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const out = new Map<string, Uint8Array>();
  for (const s of selectable(model, layout, view)) {
    const { x, y } = s.columns;
    const bits = new Uint8Array(x.length);
    for (let i = 0; i < x.length; i++) if (x[i]! >= lo && x[i]! <= hi && !Number.isNaN(y[i]!)) bits[i] = 1;
    out.set(s.id, bits);
  }
  return out;
}

/** Cell size of the lasso's grid, in pixels. */
const CELL = 16;

/**
 * A lasso being drawn (selection.md 2, D.21): `add` a place of its outline, `inside` the points it holds so far, by
 * the even-odd rule, exactly.
 */
export class Lasso {
  private readonly series: { readonly id: string; readonly px: Float64Array; readonly py: Float64Array; readonly bits: Uint8Array }[] = [];
  private readonly cols: number;
  private readonly rows: number;
  private readonly x0: number;
  private readonly y0: number;
  /** Per cell, the points in it: series rank and index, as two typed arrays after a counting sort. */
  private readonly start: Uint32Array;
  private readonly which: Uint32Array;
  private readonly index: Uint32Array;
  private first: [number, number] | null = null;
  private last: [number, number] | null = null;

  constructor(model: ChartModel, layout: ChartLayout, view: View | undefined) {
    const { plot } = layout;
    this.x0 = plot.x;
    this.y0 = plot.y;
    this.cols = Math.max(1, Math.ceil(plot.width / CELL) + 1);
    this.rows = Math.max(1, Math.ceil(plot.height / CELL) + 1);
    const cells = this.cols * this.rows;
    const counts = new Uint32Array(cells + 1);
    const cellOf: Int32Array[] = [];
    for (const s of selectable(model, layout, view)) {
      const at = placesOf(model, layout, s);
      if (!at) continue;
      const n = s.columns.x.length;
      const px = new Float64Array(n);
      const py = new Float64Array(n);
      const cell = new Int32Array(n).fill(-1);
      for (let i = 0; i < n; i++) {
        const [a, b] = at(i);
        px[i] = a;
        py[i] = b;
        const c = Math.floor((a - this.x0) / CELL);
        const r = Math.floor((b - this.y0) / CELL);
        if (c >= 0 && r >= 0 && c < this.cols && r < this.rows) counts[(cell[i] = r * this.cols + c) + 1]!++;
      }
      this.series.push({ id: s.id, px, py, bits: new Uint8Array(n) });
      cellOf.push(cell);
    }
    for (let k = 1; k <= cells; k++) counts[k]! += counts[k - 1]!;
    this.start = counts;
    this.which = new Uint32Array(counts[cells]!);
    this.index = new Uint32Array(counts[cells]!);
    const fill = counts.slice(0, cells);
    cellOf.forEach((cell, w) => {
      for (let i = 0; i < cell.length; i++)
        if (cell[i]! >= 0) {
          const at = fill[cell[i]!]!++;
          this.which[at] = w;
          this.index[at] = i;
        }
    });
  }

  /** A new place of the outline: the points in the triangle (first, last, this) change sides. */
  add(x: number, y: number): void {
    if (!this.first) {
      this.first = this.last = [x, y];
      return;
    }
    const a = this.first;
    const b = this.last!;
    this.last = [x, y];
    const c0 = Math.max(0, Math.floor((Math.min(a[0], b[0], x) - this.x0) / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((Math.max(a[0], b[0], x) - this.x0) / CELL));
    const r0 = Math.max(0, Math.floor((Math.min(a[1], b[1], y) - this.y0) / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((Math.max(a[1], b[1], y) - this.y0) / CELL));
    const tri = [a, b, [x, y] as const] as const;
    for (let r = r0; r <= r1; r++) {
      // Only the cells of this row the triangle reaches: its x span within the row's band (a long thin triangle
      // crosses many rows, few cells in each).
      const top = this.y0 + r * CELL;
      const bottom = top + CELL;
      let lo = Infinity;
      let hi = -Infinity;
      for (let e = 0; e < 3; e++) {
        const p = tri[e]!;
        const q = tri[(e + 1) % 3]!;
        if (p[1] >= top && p[1] <= bottom) (lo = Math.min(lo, p[0])), (hi = Math.max(hi, p[0]));
        for (const yy of [top, bottom])
          if ((p[1] - yy) * (q[1] - yy) < 0) {
            const xx = p[0] + ((q[0] - p[0]) * (yy - p[1])) / (q[1] - p[1]);
            lo = Math.min(lo, xx);
            hi = Math.max(hi, xx);
          }
      }
      if (lo > hi) continue;
      // A cell wider on each side: a point on a cell's edge is counted by the cell it falls in.
      const from = Math.max(c0, Math.floor((lo - this.x0) / CELL) - 1);
      const to = Math.min(c1, Math.floor((hi - this.x0) / CELL) + 1);
      for (let c = from; c <= to; c++) {
        const k = r * this.cols + c;
        for (let j = this.start[k]!; j < this.start[k + 1]!; j++) {
          const s = this.series[this.which[j]!]!;
          const i = this.index[j]!;
          if (inTriangle(s.px[i]!, s.py[i]!, a, b, [x, y])) s.bits[i]! ^= 1;
        }
      }
    }
  }

  /** The points inside the outline drawn so far. */
  inside(): Map<string, Uint8Array> {
    return new Map(this.series.map((s) => [s.id, s.bits]));
  }

  /** The outline so far: its first place, then each one added. */
  get started(): boolean {
    return this.first !== null;
  }
}

/** The even-odd test of one edge, for the tests' oracle: the same arithmetic as the lasso's. */
export function crosses(px: number, py: number, p: readonly [number, number], q: readonly [number, number]): boolean {
  if (p[1] > q[1] || (p[1] === q[1] && p[0] > q[0])) [p, q] = [q, p];
  return p[1] > py !== q[1] > py && px < ((q[0] - p[0]) * (py - p[1])) / (q[1] - p[1]) + p[0];
}

/**
 * Whether (px, py) is inside a triangle, by the same half-open rule as the even-odd crossing test: a point is counted
 * once by the triangles sharing an edge, so flipping by triangles gives the polygon's even-odd inside exactly.
 */
function inTriangle(px: number, py: number, a: readonly [number, number], b: readonly [number, number], c: readonly [number, number]): boolean {
  let inside = false;
  const edge = (p: readonly [number, number], q: readonly [number, number]) => {
    // The same arithmetic whichever way the edge is walked: the fan's inner edges, crossed twice, cancel exactly.
    if (p[1] > q[1] || (p[1] === q[1] && p[0] > q[0])) [p, q] = [q, p];
    if (p[1] > py !== q[1] > py && px < ((q[0] - p[0]) * (py - p[1])) / (q[1] - p[1]) + p[0]) inside = !inside;
  };
  edge(a, b);
  edge(b, c);
  edge(c, a);
  return inside;
}

export type SelectShape = 'rectangle' | 'range' | 'lasso';

/** What the `selection` module lends: the gestures' shapes (the look and the reading are every chart's seams). */
export interface SelectionKit {
  /** How a selection looks (selection-look.ts), lent with the module: a chart without it draws no selection. */
  readonly look: typeof selectionLook;
  readonly inRect: typeof inRect;
  readonly inRange: typeof inRange;
  readonly lasso: (model: ChartModel, layout: ChartLayout, view: View | undefined) => Lasso;
  readonly combine: typeof combine;
}

export const selectionKit: SelectionKit = { look: selectionLook, inRect, inRange, lasso: (m, l, v) => new Lasso(m, l, v), combine };
