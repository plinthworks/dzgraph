/**
 * The view (GLOSSARY: View): what the user changed while exploring, never the options. Phase 1 holds which series
 * are hidden; Phase 3 adds visible ranges, Phase 5 the rest (drill level, selection, comparison…). One function
 * answers « is this series shown? » for every part that asks (layout, scene, legend).
 */
import type { CompareMode } from './compare.js';
import type { Selection } from './selection.js';
import type { AggregateSpec } from './aggregation.js';
import type { SeriesModel } from './series-type.js';

export interface View {
  /** The series hidden from the view, by id; absent: each series' `initiallyHidden` decides. */
  readonly hidden?: ReadonlySet<string>;
  /** The visible range of each zoomed x axis, by axis id (GLOSSARY: Visible range); absent: the whole data. */
  readonly range?: Readonly<Record<string, { readonly min: number; readonly max: number }>>;
  /** The user's comparison (compare.md), for every y axis that may be compared; null: none; absent: the options'. */
  readonly compare?: { readonly mode: CompareMode; readonly to: number | null } | null;
  /** The selected points, one bit per point by series (selection.md, ADR 0009); absent or empty: none. */
  readonly selection?: Selection;
  /** The user's aggregation (aggregation.md); null: none; absent: the options'. */
  readonly aggregation?: AggregateSpec | null;
}

export function isShown(series: Pick<SeriesModel, 'id' | 'initiallyHidden'>, view: View | undefined): boolean {
  return view?.hidden ? !view.hidden.has(series.id) : !series.initiallyHidden;
}

/**
 * A point's key in the view's hidden set (ADR 0007: a slice hidden from the legend). No series id equals one: app ids
 * never start with `#`, and default ids are `#` and digits only.
 */
export const pointKey = (seriesId: string, index: number): string => `#${index}/${seriesId}`;

export function isPointShown(seriesId: string, index: number, view: View | undefined): boolean {
  return !view?.hidden?.has(pointKey(seriesId, index));
}
