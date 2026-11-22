/**
 * The visible range as pure data (zoom-pan.md, GLOSSARY: Visible range): the data's extent along an x axis, and a
 * range clamped, zoomed and panned inside it. The DOM layer turns gestures into these calls.
 */
import type { ChartModel } from './model.js';

export interface Range {
  readonly min: number;
  readonly max: number;
}

/** The data's x extent on an axis, and its smallest step between two points (the narrowest range is two steps). */
export interface Extent extends Range {
  readonly step: number;
}

const extents = new WeakMap<ChartModel, Map<string, Extent | null>>();

/** Kept with the model: a model is one reading of the options, never changed (a new reading makes a new one). */
export function extentOf(model: ChartModel, xAxis: string): Extent | null {
  let byAxis = extents.get(model);
  if (!byAxis) extents.set(model, (byAxis = new Map()));
  if (!byAxis.has(xAxis)) byAxis.set(xAxis, scanExtent(model, xAxis));
  return byAxis.get(xAxis)!;
}

function scanExtent(model: ChartModel, xAxis: string): Extent | null {
  let min = Infinity;
  let max = -Infinity;
  let step = Infinity;
  for (const s of model.series) {
    if (s.xAxis !== xAxis) continue;
    const { x, y } = s.columns;
    let prev = Number.NaN;
    for (let i = 0; i < x.length; i++) {
      const v = x[i]!;
      if (Number.isNaN(v) || Number.isNaN(y[i]!)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      if (s.sorted && !Number.isNaN(prev) && v > prev && v - prev < step) step = v - prev;
      prev = v;
    }
  }
  if (!(min <= max)) return null;
  // No two sorted points to measure: a hundredth of the extent (never an absolute unit, review 3), 1 for one point.
  return { min, max, step: Number.isFinite(step) ? step : (max - min) / 100 || 1 };
}

/** A range kept inside the extent (moved, not shrunk, when it can be) and at least two steps wide (zoom-pan.md 5). */
export function clampRange(r: Range, e: Extent): Range {
  const full = e.max - e.min;
  let span = Math.min(Math.max(r.max - r.min, 2 * e.step), full);
  if (full <= 0) return { min: e.min, max: e.max };
  if (!(span > 0)) span = full;
  const mid = (r.min + r.max) / 2;
  let min = mid - span / 2;
  if (r.max - r.min >= 2 * e.step) min = r.min;
  min = Math.min(Math.max(min, e.min), e.max - span);
  return { min, max: min + span };
}

/** Zoomed by `factor` (< 1 closer, > 1 farther) around `at`, which stays where it is on screen. */
export function zoomAround(r: Range, factor: number, at: number, e: Extent): Range {
  const span = (r.max - r.min) * factor;
  const rel = r.max > r.min ? (at - r.min) / (r.max - r.min) : 0.5;
  return clampRange({ min: at - rel * span, max: at - rel * span + span }, e);
}

/** Moved by `delta` (data units), stopping at the extent's ends. */
export function panBy(r: Range, delta: number, e: Extent): Range {
  const span = r.max - r.min;
  const min = Math.min(Math.max(r.min + delta, e.min), e.max - span);
  return { min, max: min + span };
}

/** Whether a range shows the whole extent (nothing zoomed). */
export function isWhole(r: Range | undefined, e: Extent | null): boolean {
  return !r || !e || (r.min <= e.min && r.max >= e.max);
}
