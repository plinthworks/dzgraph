/**
 * The contract between the core and its modules (ADR 0005): the core knows no series type and no coordinate system
 * by name; `chart()` receives the modules an app uses. Internal until 1.0 (`@dzgraph/core/internal`): our own
 * packages implement it wave by wave; it is published for others once it has carried several families.
 */
import type { Problem } from './problem.js';
import type { SeriesBase } from './options.js';
import type { ColorToken, LayerId, Primitive, Rect, TextMeasurer } from './scene.js';

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
  /** Read once, when the series first appears (GLOSSARY: Hidden series). */
  readonly initiallyHidden: boolean;
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
}

export type CoordinateSystemName = keyof FramesBySystem;

/** Everything a type needs to draw one series in a laid-out chart. */
export interface MarkContext<O extends SeriesBase<string, unknown>, S extends CoordinateSystemName> {
  readonly series: SeriesModel<O>;
  readonly frame: FramesBySystem[S];
  readonly plot: Rect;
  /** The series' place among the visible series sharing its type and axes (side-by-side columns), and their count. */
  readonly slot: number;
  readonly slots: number;
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
  /** For a cartesian type: the chart's orientation it needs (bars: `horizontal`). Default `vertical`. */
  readonly orientation?: 'vertical' | 'horizontal';
  /**
   * For a cartesian type on a continuous x axis: round the axis's ends outwards to ticks, like a value axis (scatter
   * plots: no marker on the edge, axes.md 3). Default: the axis runs from the first point to the last.
   */
  readonly roundX?: boolean;
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
  readData?(data: unknown, path: string): { readonly columns: SeriesModel['columns']; readonly keys: readonly (string | null)[] | null; readonly problems: readonly Problem[] };
  /** Where the series reaches on its axes, before stacking. */
  bounds(series: SeriesModel<O>): { readonly x: Bounds | null; readonly y: Bounds | null };
  /** The series' primitives; the core groups them, picks painters and orders the layers. */
  marks(context: MarkContext<O, S>): readonly MarkSet[];
}
