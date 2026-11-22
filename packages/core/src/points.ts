/**
 * Where a point is, and who it is: one answer for every part that asks (hit tests, the hover layer, the keyboard's
 * items), so a later rule (a stacked baseline, Phase 4) changes one place (ADR 0001).
 */
import type { ChartModel } from './model.js';
import type { ChartLayout } from './layout.js';
import type { PointRef } from './scene.js';

/** A point's place on screen: its x, and its value's end (a column's free end), as drawn. Null if not placeable. */
export function pointAt(model: ChartModel, layout: ChartLayout, ref: PointRef): { readonly x: number; readonly y: number } | null {
  const s = model.series.find((o) => o.id === ref.seriesId);
  // A polar series knows where its points are (ADR 0007), « Autres » included.
  const placement = layout.placements.get(ref.seriesId);
  if (placement) return placement.anchor(ref.index);
  if (!s || ref.index < 0 || ref.index >= s.columns.x.length) return null;
  const xs = layout.axes.find((a) => a.dimension === 'x' && a.id === s.xAxis)?.scale;
  const ys = layout.axes.find((a) => a.dimension === 'y' && a.id === s.yAxis)?.scale;
  if (!xs || !ys) return null;
  const a = xs.map(s.columns.x[ref.index]!);
  // A stacked point is where its segment ends (stacking.md).
  const pile = layout.stacks.get(s.id);
  // A compared point is where its compared value is (compare.md 1).
  const cmp = layout.compare.series.get(s.id);
  const raw = pile ? pile.top[ref.index]! : s.columns.y[ref.index]!;
  const b = ys.map(cmp ? cmp.a * raw + cmp.c : raw);
  return model.orientation === 'vertical' ? { x: a, y: b } : { x: b, y: a };
}

/** The reference with the point's key, when the app gave one (GLOSSARY: Key). */
export function withKey(model: ChartModel, ref: PointRef): PointRef {
  const key = model.series.find((o) => o.id === ref.seriesId)?.keys?.[ref.index];
  return key ? { seriesId: ref.seriesId, index: ref.index, key } : { seriesId: ref.seriesId, index: ref.index };
}
