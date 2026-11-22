/**
 * The chart's model: the options checked and completed, every default applied, the data read into columns. Independent
 * of the chart's size (ARCHITECTURE §3): layout turns it into a scene. Internal.
 */
import type { ExportingOptions, MenuItem } from './normalize.js';
import type { AggregateSpec } from './aggregation.js';
import type { SelectShape } from './selection.js';
import type { CompareMode } from './compare.js';
import type { Formatter, ScaleKind } from './options.js';
import type { InstantMs } from './time.js';
import type { SeriesModel } from './series-type.js';
import type { Kit } from './kit.js';

export interface AxisModel {
  readonly id: string;
  readonly scale: ScaleKind;
  readonly title: string | null;
  readonly opposite: boolean;
  readonly reversed: boolean;
  /** Bounds the app fixed (linear, log: numbers; time: instants), or null. */
  readonly min: number | null;
  readonly max: number | null;
  /** A category axis's categories, in order: the app's, then any found in the data; null for other scales. */
  readonly categories: readonly string[] | null;
  readonly ticks: {
    readonly target: number | null;
    readonly format: Formatter<number> | Formatter<string> | Formatter<InstantMs> | null;
    readonly grid: boolean | null;
  };
  readonly zone: string | null;
  /** A y axis whose piles are drawn as shares (stacking.md 9), or null. */
  readonly stacking: 'percent' | null;
  /** A y axis compared to a baseline (compare.md): how, and the baseline's x when the app fixed one. */
  readonly compare: { readonly mode: CompareMode; readonly to: number | null } | null;
  /** An x axis's aggregation, as the app asked (aggregation.md); null: none. */
  readonly aggregate: AggregateSpec | null;
  /** Set on an aggregated model's x axis: the groups its points stand for (labels read them as ranges). */
  readonly period?: AggregateSpec;
}

export interface ChartModel {
  readonly series: readonly SeriesModel[];
  readonly xAxes: readonly AxisModel[];
  readonly yAxes: readonly AxisModel[];
  readonly title: { readonly text: string; readonly subtitle: string | null; readonly align: 'start' | 'center' | 'end' } | null;
  /** Null when no legend is shown; `auto`: shown only when a polar type needs it (its labels did not fit). */
  readonly legend: { readonly position: 'top' | 'bottom' | 'start' | 'end'; readonly align: 'start' | 'center' | 'end'; readonly auto: boolean } | null;
  readonly locale: string | null;
  readonly dir: 'ltr' | 'rtl' | null;
  readonly mirror: boolean;
  readonly aspectRatio: number;
  readonly description: string | null;
  readonly orientation: 'vertical' | 'horizontal';
  /** The chart's coordinate system, its first series' (ADR 0007): a polar chart has no axes. */
  readonly system: 'cartesian' | 'polar';
  readonly highlight: boolean;
  readonly animation: boolean;
  readonly dataTable: boolean;
  /** What the table starts with when zoomed (data-table.md 5). */
  readonly dataTableRows: 'visible' | 'all';
  readonly navigator: boolean;
  /** The crosshair (crosshair.md), null when off or its module missing. */
  readonly crosshair: { readonly horizontal: boolean } | null;
  /** The chart menu's items the app offers (menu.md); null: no menu. */
  readonly menu: { readonly items: readonly MenuItem[] } | null;
  /** The exports' defaults (export.md 3, 8; csv.md 7). */
  readonly exporting: ExportingOptions;
  /** Automatic drilldown on a time axis (drilldown.md 6); null: none. */
  readonly drill: 'time' | null;
  /** The selection's shapes the app offers (selection.md 1), null when off or its module missing. */
  readonly selection: { readonly shapes: readonly SelectShape[] } | null;
  /** Null: shown with the navigator when the x axis is a time axis (range-buttons.md). */
  readonly rangeButtons: boolean | null;
  /** What the imported features lend the core (ADR 0006). */
  readonly kit: Kit;
}
