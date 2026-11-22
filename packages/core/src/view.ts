/**
 * The view (GLOSSARY: View): what the user changed while exploring, never the options. Phase 1 holds which series
 * are hidden; Phase 3 adds visible ranges, Phase 5 the rest (drill level, selection, comparison…). One function
 * answers « is this series shown? » for every part that asks (layout, scene, legend).
 */
import type { SeriesModel } from './series-type.js';

export interface View {
  /** The series hidden from the view, by id; absent: each series' `initiallyHidden` decides. */
  readonly hidden?: ReadonlySet<string>;
  /** The visible range of each zoomed x axis, by axis id (GLOSSARY: Visible range); absent: the whole data. */
  readonly range?: Readonly<Record<string, { readonly min: number; readonly max: number }>>;
}

export function isShown(series: Pick<SeriesModel, 'id' | 'initiallyHidden'>, view: View | undefined): boolean {
  return view?.hidden ? !view.hidden.has(series.id) : !series.initiallyHidden;
}
