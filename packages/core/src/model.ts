/**
 * The chart's model: the options checked and completed, every default applied, the data read into columns. Independent
 * of the chart's size (ARCHITECTURE §3): layout turns it into a scene. Internal.
 */
import type { Formatter, ScaleKind } from './options.js';
import type { InstantMs } from './time.js';
import type { SeriesModel } from './series-type.js';

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
}

export interface ChartModel {
  readonly series: readonly SeriesModel[];
  readonly xAxes: readonly AxisModel[];
  readonly yAxes: readonly AxisModel[];
  readonly title: { readonly text: string; readonly subtitle: string | null; readonly align: 'start' | 'center' | 'end' } | null;
  /** Null when no legend is shown. */
  readonly legend: { readonly position: 'top' | 'bottom' | 'start' | 'end'; readonly align: 'start' | 'center' | 'end' } | null;
  readonly locale: string | null;
  readonly dir: 'ltr' | 'rtl' | null;
  readonly mirror: boolean;
  readonly aspectRatio: number;
  readonly description: string | null;
  readonly orientation: 'vertical' | 'horizontal';
  readonly highlight: boolean;
  readonly animation: boolean;
  readonly dataTable: boolean;
}
