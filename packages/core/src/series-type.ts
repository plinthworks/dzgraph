/**
 * The contract between the core and its modules (ADR 0005): the core knows no series type and no coordinate system
 * by name; `chart()` receives the modules an app uses. Internal until 1.0 (`@dzgraph/core/internal`): our own
 * packages implement it wave by wave; it is published for others once it has carried several families.
 */
import type { AggregateFn } from './aggregation.js';
import type { Problem } from './problem.js';
import type { SeriesBase } from './options.js';
import type { Affine, ColorToken, LayerId, Primitive, Rect, TextMeasurer } from './scene.js';
import type { Stacked } from './stack.js';
import type { View } from './view.js';

/** A series after checking: named columns of numbers, whatever shape the app wrote. */
export interface SeriesModel<O extends SeriesBase<string, unknown> = SeriesBase<string, unknown>> {
  readonly id: string;
  readonly type: O['type'];
  /** The app's name for it, or null (the DOM layer then writes « Série 1 », translated). */
  readonly name: string | null;
  /** The series' place among all series (palette, legend order), 0-based. */
  readonly rank: number;
  /** Resolved: `series-<n>` (the palette, wrapped) or `color-<name>` (the app's CSS variable). */
  readonly color: ColorToken;
  /** The axes it is drawn against, by id. */
  readonly xAxis: string;
  readonly yAxis: string;
  /** The stack it is piled in (stacking.md 1), or null: it stands alone. */
  readonly stack: string | null;
  /** Read once, when the series first appears (GLOSSARY: Hidden series). */
  readonly initiallyHidden: boolean;
  /** Its function when aggregated (aggregation.md 1): its own, else a sum for columns and bars, a mean otherwise. */
  readonly aggregate: AggregateFn;
  /** Every column the type reads, same length: `x` and `y` for most types, `open`/`high`/`low`/`close`, `z`… NaN is a gap. */
  readonly columns: { readonly x: Float64Array; readonly y: Float64Array } & { readonly [name: string]: Float64Array };
  /** Point keys, when the app gave them (GLOSSARY: Key); null for a point without one or with a duplicate. */
  readonly keys: readonly (string | null)[] | null;
  /** Point names, when the app gave them. */
  readonly names: readonly (string | null)[] | null;
  /** Whether x never goes backwards (lines may then be decimated and searched by x). */
  readonly sorted: boolean;
  /** Its tooltip: shared on the hovered x (lines, areas: types drawn in x order), or per mark (hover-tooltip.md 1–2). */
  readonly tooltip: 'shared' | 'mark';
  /** The app's options for this series, after the type's check. */
  readonly options: O;
}

/** A scale as modules see it: values to pixels along one screen direction, and back (GLOSSARY: Scale). */
export interface Scale {
  map(value: number): number;
  invert(pixel: number): number;
  /** For categories: one category's size in pixels; 0 for continuous scales. */
  readonly bandwidth: number;
  /** `map` as numbers (ADR 0008), for painters that place many points themselves. */
  readonly affine: Affine;
}

export interface Bounds {
  readonly min: number;
  readonly max: number;
}

/**
 * What a coordinate system gives a series to place its points, by system name. Coordinate systems are modules too;
 * each adds its frame here by declaration merging (polar, none for hierarchies, 3D, geographic).
 */
export interface FramesBySystem {
  /**
   * The x/y plane. `vertical`: x runs along the reading direction and values go up (columns); `horizontal`: x runs
   * down and values along the reading direction (bars). One orientation per chart (`mixed-orientation` otherwise).
   */
  cartesian: {
    readonly x: Scale;
    readonly y: Scale;
    readonly orientation: 'vertical' | 'horizontal';
  };
  /**
   * Around a centre (pie, donut, gauge: ADR 0007): the type placed itself (`SeriesType.place`); its marks receive that
   * placement back, as their own type.
   */
  polar: {
    readonly placement: Placement;
  };
}

export type CoordinateSystemName = keyof FramesBySystem;

/** What a polar type is given to place itself (ADR 0007). */
export interface PlaceInput {
  readonly series: SeriesModel;
  /** The room it has: the chart less its title (and its legend, when the legend is shown). */
  readonly box: Rect;
  /** Whether it may label its points beside itself; false once the legend shows instead (pie-donut.md 9). */
  readonly labels: boolean;
  readonly view: View | undefined;
  readonly dir: 'ltr' | 'rtl';
  readonly mirror: boolean;
  readonly locale: string | undefined;
  readonly measureText: TextMeasurer;
  readonly text: PlaceText;
}

/** The words a placement writes in the scene (the DOM layer's translated messages). */
export interface PlaceText {
  readonly seriesName: (place: number) => string;
  /** A point without a name, by its place (from 1): « Part 3 ». */
  readonly pointName: (place: number) => string;
  /** The slice that holds the smallest ones (pie-donut.md 7). */
  readonly others: string;
  /** The word under a donut's total (pie-donut.md 3). */
  readonly total: string;
  /** A slice's label from its name and share (pie-donut.md 9). */
  readonly sliceLabel: (name: string, share: string) => string;
}

/** A legend item a placement asks for: one per point (a slice), instead of one for the series. */
export interface PlacedLegendItem {
  readonly index: number;
  readonly name: string;
  readonly color: ColorToken;
  readonly hidden: boolean;
}

/**
 * Where a polar type put itself (ADR 0007), as the core asks it: kept by the layout, handed back to the type's marks.
 * Point indices are the series'; one past the last stands for « Autres » when the type groups small slices.
 */
export interface Placement {
  /** Its legend items, in order; the legend shows them when shown. */
  readonly legend: readonly PlacedLegendItem[];
  /** Whether it needs the legend to be read (its labels did not fit). */
  readonly needsLegend: boolean;
  /** The points drawn, in drawing order (the keyboard's order). */
  readonly order: readonly number[];
  /** Where a drawn point is (its tooltip's anchor, its focus ring's centre), or null. */
  anchor(index: number): { readonly x: number; readonly y: number } | null;
  /** A drawn point's share of the whole (0 to 1), NaN when it has none. */
  share(index: number): number;
  /** The points a drawn point stands for (« Autres »), or null for a point of its own. */
  members(index: number): readonly number[] | null;
  /** A drawn point's name: its own, by its place, or « Autres ». */
  name(index: number): string;
  /** A gauge's scale, value and threshold (gauge.md 7–10): read as a meter. */
  readonly meter?: { readonly min: number; readonly max: number; readonly value: number; readonly threshold: string | null };
}

/** Everything a type needs to draw one series in a laid-out chart. */
export interface MarkContext<O extends SeriesBase<string, unknown>, S extends CoordinateSystemName> {
  readonly series: SeriesModel<O>;
  readonly frame: FramesBySystem[S];
  readonly plot: Rect;
  /** The series' place among the visible series sharing its type and axes (side-by-side columns), and their count. */
  readonly slot: number;
  readonly slots: number;
  /** Its pile, when the series is stacked (stacking.md): each point's segment from `base` to `top`. */
  readonly stacked: Stacked | null;
  /** The point pointed at in this series, when the chart highlights one (a slice brought out, pie-donut.md 12). */
  readonly highlight: number | null;
  readonly dir: 'ltr' | 'rtl';
  readonly measureText: TextMeasurer;
}

/**
 * What a type draws for one series: sets of primitives, each for one layer. `role` lets the core choose the painter
 * (ADR 0002) so no type re-implements the rule: `path` (lines, areas: always SVG), `marks` (markers, columns: Canvas
 * above the threshold), `labels` (text).
 */
export interface MarkSet {
  readonly layer: LayerId;
  readonly role: 'path' | 'marks' | 'labels';
  readonly items: readonly Primitive[];
}

/** The option names a type adds to `SeriesBase`, every one listed (the compiler refuses a missing or misspelt one). */
export type OwnOptionNames<O> = { readonly [K in Exclude<keyof O, keyof SeriesBase<string, unknown>>]-?: true };

export interface SeriesType<O extends SeriesBase<string, unknown> = SeriesBase<string, unknown>, S extends CoordinateSystemName = CoordinateSystemName> {
  readonly name: O['type'];
  readonly system: S;
  /**
   * For a cartesian type: the chart's orientation it sets (columns `vertical`, bars `horizontal`); a type without one
   * (lines, areas, scatters) follows the chart's, `vertical` when nothing sets it (combined.md 3).
   */
  readonly orientation?: 'vertical' | 'horizontal';
  /**
   * For a cartesian type on a continuous x axis: round the axis's ends outwards to ticks, like a value axis (scatter
   * plots: no marker on the edge, axes.md 3). Default: the axis runs from the first point to the last.
   */
  readonly roundX?: boolean;
  /** Whether its value axis always shows zero (columns, bars, areas: axes.md 1), also when zoomed. */
  readonly zeroBased?: boolean;
  /** Whether its series may stack (columns, bars, areas: stacking.md 1); the core then reads their `stack` option. */
  readonly stackable?: boolean;
  /** Whether the type draws its points in x order (lines, areas): x going backwards is reported (`unsorted-x`). */
  readonly sortedX?: boolean;
  /** How the legend draws the series' sign (legend.md 3): a short line with its marker, a square, or its marker. */
  readonly sign: 'line' | 'square' | 'marker';
  readonly optionNames: OwnOptionNames<O>;
  /**
   * Checks the options this type adds, as the app wrote them: unknown input (an app in plain JavaScript may pass
   * anything). A bad option is reported and the type uses its default; this never throws.
   */
  check(options: Readonly<Record<string, unknown>>, path: string): readonly Problem[];
  /**
   * Reads the type's own data shape into columns. Absent: the core reads `DataInput` (x and y). Unknown input, like
   * `check`; reports instead of throwing.
   */
  readData?(data: unknown, path: string, seriesId: string): { readonly columns: SeriesModel['columns']; readonly keys: readonly (string | null)[] | null; readonly names?: readonly (string | null)[] | null; readonly problems: readonly Problem[] };
  /** Where the series reaches on its axes, before stacking. */
  bounds(series: SeriesModel<O>): { readonly x: Bounds | null; readonly y: Bounds | null };
  /** The series' primitives; the core groups them, picks painters and orders the layers. */
  marks(context: MarkContext<O, S>): readonly MarkSet[];
  /** A polar type places itself (ADR 0007): its geometry, labels and legend items, in the box it is given. */
  place?(input: PlaceInput): Placement;
}
