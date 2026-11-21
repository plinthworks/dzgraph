/**
 * Keyboard navigation between points (keyboard.md 2–3), in the core so it is tested in node and grows in Phase 5
 * (Shift + arrows, Space). Arrows follow the screen: the scales say which way values go (mirrored, reversed, bars).
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { PointRef } from './scene.js';
import type { SeriesModel } from './series-type.js';
import { pointAt } from './points.js';
import { isShown, type View } from './view.js';

const orders = new WeakMap<Float64Array, Int32Array>();

/** A series' points with a value, in index order (cached while its data is the same). */
export function validOrder(s: SeriesModel): Int32Array {
  const { y } = s.columns;
  let out = orders.get(y);
  if (out) return out;
  let n = 0;
  for (let i = 0; i < y.length; i++) if (!Number.isNaN(y[i]!)) n++;
  out = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < y.length; i++) if (!Number.isNaN(y[i]!)) out[k++] = i;
  orders.set(y, out);
  return out;
}

/** The position of an index in an order (the first at or after it). */
export function rankOf(order: Int32Array, index: number): number {
  let lo = 0;
  let hi = order.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (order[m]! < index) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** Where a key leads from a point; the same point at an edge; null for a key navigation does not use. */
export function navigate(model: ChartModel, layout: ChartLayout, view: View | undefined, at: PointRef, key: string): PointRef | null {
  const s = model.series.find((o) => o.id === at.seriesId);
  if (!s) return null;
  const order = validOrder(s);
  if (!order.length) return null;
  const pos = Math.min(order.length - 1, rankOf(order, at.index));
  const vertical = model.orientation === 'vertical';
  // +1 when larger x values are drawn further along the screen (right in columns, down in bars).
  const xs = layout.axes.find((a) => a.dimension === 'x' && a.id === s.xAxis)?.scale;
  const grows = xs ? Math.sign(xs.map(1) - xs.map(0)) || 1 : 1;
  const along: Record<string, number> = vertical ? { ArrowRight: grows, ArrowLeft: -grows } : { ArrowDown: grows, ArrowUp: -grows };
  const page = Math.max(1, Math.round(order.length / 10));
  const step = along[key] ?? (key === 'PageDown' ? page : key === 'PageUp' ? -page : key === 'Home' ? -order.length : key === 'End' ? order.length : 0);
  if (step) return { seriesId: s.id, index: order[Math.min(order.length - 1, Math.max(0, pos + step))]! };
  const across: Record<string, number> = vertical ? { ArrowUp: 1, ArrowDown: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
  const dir = across[key];
  if (!dir) return null;
  // The other visible series' points at this x: ordered by how high they are drawn (columns) or by series (bars).
  const x = s.columns.x[at.index]!;
  const candidates: { ref: PointRef; key: number; rank: number }[] = [];
  for (const o of model.series) {
    if (!isShown(o, view)) continue;
    const ord = validOrder(o);
    let found = -1;
    for (const i of ord) if (o.columns.x[i] === x) {
      found = i;
      break;
    }
    if (found === -1) continue;
    const ref = { seriesId: o.id, index: found };
    const p = pointAt(model, layout, ref);
    candidates.push({ ref, key: vertical ? -(p?.y ?? 0) : o.rank, rank: o.rank });
  }
  candidates.sort((a, b) => a.key - b.key || a.rank - b.rank);
  const k = candidates.findIndex((c) => c.ref.seriesId === at.seriesId);
  return candidates[k + dir]?.ref ?? { seriesId: at.seriesId, index: at.index };
}
