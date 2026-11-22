/**
 * What an app writes to describe a chart (GLOSSARY). Everything is read-only plain data, so an app can rebuild it
 * from signals or a store and hand it over again; every optional field also accepts `undefined`, so apps compiled
 * with `exactOptionalPropertyTypes` can pass a field they computed as absent.
 *
 * The options are the truth for what they say; what the user does (hiding a series, zooming, selecting) lives in the
 * view (GLOSSARY: View, Phase 5) and is never overwritten by options rebuilt from a signal.
 *
 * Series types are open (ADR 0005): each type module adds its options to `SeriesOptionsByType` by declaration
 * merging, so `SeriesOptions` is a union discriminated by `type` that grows wave by wave without a breaking change.
 */
import type { PointRef } from './scene.js';
import type { InstantMs, ZoneName } from './time.js';

/** The value of a point along x: a number, or a string (a category, an ISO date-time with offset, a Day). */
export type XValue = number | string;
/** A point's value along a value axis; `null` is a gap (the line breaks, the column is absent). */
export type YValue = number | null;

/** A point written out, when the app needs a key or a name on it. */
export interface PointInput {
  readonly x?: XValue | undefined;
  readonly y: YValue;
  /** The point's identity (GLOSSARY: Key): it links the point to a DzGrid row or to another chart's point. */
  readonly key?: string | undefined;
  /** Shown by the tooltip and the data table instead of x, when given. */
  readonly name?: string | undefined;
}

/**
 * Columns, for big series: one array per field, same length. A typed `y` is read without a copy (a copy only if it
 * holds Infinity); `x` is always copied (gaps take their neighbour's x so it stays ordered). In them NaN is a gap.
 * `x` absent: the points are evenly spaced (index, or the axis's categories).
 */
export interface ColumnsInput {
  readonly x?: Float64Array | readonly XValue[] | undefined;
  readonly y: Float64Array | readonly YValue[];
  readonly key?: readonly string[] | undefined;
}

/**
 * The shapes an x/y series accepts:
 * - `[12, 15, null, 9]`: values only, x from their position or the axis's categories;
 * - `[[x, y], …]`: pairs;
 * - `[{ x, y, key }, …]`: points written out;
 * - `{ x, y, key }`: columns (big series).
 * Types with other fields (OHLC, ranges, bubbles, slices, hierarchies, maps) declare their own data shape.
 */
export type DataInput = readonly YValue[] | readonly (readonly [XValue, YValue])[] | readonly PointInput[] | ColumnsInput;

/**
 * A series' colour: a place in the theme's categorical palette, **1 = the first colour** (`--dzgraph-series-1`),
 * counting on past the palette's eight colours from the start again; or the name of a colour the app defines in CSS as
 * `--dzgraph-color-<name>` (a CSS identifier, checked). Never a colour literal (CLAUDE.md).
 */
export type SeriesColor = number | { readonly token: string };

/** What every series has, whatever its type. `D` is the type's data shape. */
export interface SeriesBase<T extends string, D = DataInput> {
  /** A type given to `chart()` in `types` (`'line'`, `'column'`…). */
  readonly type: T;
  /**
   * Stable identity: what `update()`, the view and links use to recognise the series. Absent: `#1`, `#2`… by
   * position (`#` is reserved for these defaults). Give ids when series come and go.
   */
  readonly id?: string | undefined;
  /** Shown in the legend, the tooltip and the data table. */
  readonly name?: string | undefined;
  readonly data: D;
  /** The axes the series is drawn against, by axis id; the first x and y axes by default. */
  readonly xAxis?: string | undefined;
  readonly yAxis?: string | undefined;
  readonly color?: SeriesColor | undefined;
  /**
   * Hidden when the series first appears; read once per series id. Afterwards the legend and the view decide
   * (GLOSSARY: Hidden series), so options rebuilt by a signal never undo what the user did.
   */
  readonly initiallyHidden?: boolean | undefined;
  /**
   * Each point's detail (drilldown.md), by the point's key, or loaded by the app; needs the `drilldown` module. The
   * series given replace the chart's while the detail is shown.
   */
  readonly drilldown?: { readonly details: Readonly<Record<string, readonly SeriesOptions[]>> } | { readonly load: (point: PointRef) => Promise<readonly SeriesOptions[]> } | undefined;
  /** Its function when the x axis aggregates (aggregation.md 1). Default: sum for columns and bars, mean otherwise. */
  readonly aggregate?: 'sum' | 'mean' | 'min' | 'max' | 'count' | undefined;
}

/**
 * The options of each registered series type, by name. Each type module adds itself:
 *
 * ```ts
 * declare module '@dzgraph/core' {
 *   interface SeriesOptionsByType { line: LineSeriesOptions }
 * }
 * ```
 */
// Empty on purpose: filled by declaration merging (ADR 0005).
export interface SeriesOptionsByType {}

/**
 * Any series a chart can hold: the union of every registered type's options, discriminated by `type`. Each entry is
 * held to `SeriesBase` of its own name, so a registry entry without `type` or `data` cannot slip in.
 */
export type SeriesOptions = SeriesUnionOf<SeriesOptionsByType>;

/** The union a registry describes; exported for its own type tests. */
export type SeriesUnionOf<R> = [keyof R] extends [never]
  ? SeriesBase<string>
  : { [K in keyof R]: R[K] & SeriesBase<K & string, unknown> }[keyof R];

/** A formatter the app gives: it receives the value and returns the label. If it throws, the default is used. */
export type Formatter<V> = (value: V, context: FormatContext) => string;

export interface FormatContext {
  /** The chart's locale, as given to Intl. */
  readonly locale: string;
  /** The step between two ticks (in the axis's unit: a number, or milliseconds), to choose a precision. */
  readonly step: number;
}

export interface TicksOptions<V> {
  /** About how many ticks to aim for; the axis picks round values near it. */
  readonly target?: number | undefined;
  readonly format?: Formatter<V> | undefined;
  /** Gridlines across the plot area from each tick. Default: on for value axes, off for the x axis. */
  readonly grid?: boolean | undefined;
}

/** What every axis has, whatever its scale. */
interface AxisBase {
  /** How series refer to this axis. Defaults: `x`, `y`, then `x2`, `y2`… */
  readonly id?: string | undefined;
  readonly title?: string | undefined;
  /**
   * On the far side: an x axis at the top instead of the bottom, a y axis at the end of the reading direction instead
   * of its start. Holds whatever the orientation (bars across turn the x axis upright).
   */
  readonly opposite?: boolean | undefined;
  /** Draws the axis from its end to its start (values grow towards the origin). */
  readonly reversed?: boolean | undefined;
}

export interface LinearAxisOptions extends AxisBase {
  readonly scale?: 'linear' | undefined;
  /** Fixed bounds; otherwise from the data, rounded to ticks. */
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly ticks?: TicksOptions<number> | undefined;
  /** On a y axis: its piles drawn as shares of their totals, from 0 to 100 % (stacking.md 9). */
  readonly stacking?: 'percent' | undefined;
  /** On a y axis: each series shown against a baseline (compare.md); needs the `compare` module. */
  readonly compare?: 'value' | 'percent' | 'index' | undefined;
  /** The baseline's x (a number, or an ISO date-time on a time x axis); default: the first point in view. */
  readonly compareTo?: number | string | undefined;
  /** On an x axis: one point per bucket of this step (aggregation.md); needs the `aggregation` module. */
  readonly aggregate?: { readonly step: number } | undefined;
}

export interface LogAxisOptions extends AxisBase {
  readonly scale: 'log';
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly ticks?: TicksOptions<number> | undefined;
  /** Not on a log axis: a pile's parts do not add up along it (log-scale.md 10); reported. */
  readonly stacking?: undefined;
}

export interface CategoryAxisOptions extends AxisBase {
  readonly scale: 'category';
  /** Categories, in order; otherwise collected from the data in order of appearance. */
  readonly categories?: readonly string[] | undefined;
  readonly ticks?: TicksOptions<string> | undefined;
}

export interface TimeAxisOptions extends AxisBase {
  readonly scale: 'time';
  /** The zone the axis reads instants in (ADR 0004). Default: the page's. */
  readonly zone?: ZoneName | undefined;
  /** Milliseconds, or ISO date-times with an offset. */
  readonly min?: number | string | undefined;
  readonly max?: number | string | undefined;
  readonly ticks?: TicksOptions<InstantMs> | undefined;
  /** One point per period of the zone's calendar, or per bucket (aggregation.md); needs the `aggregation` module. */
  readonly aggregate?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | { readonly step: number } | undefined;
}

/** How an axis turns values into positions (GLOSSARY: Scale). */
export type ScaleKind = 'linear' | 'log' | 'category' | 'time';

/**
 * An axis, by its scale (GLOSSARY: Scale). The formatter and the bounds take the scale's own kind of value. Absent
 * `scale`: linear, or category when the data's x values are strings.
 */
export type AxisOptions = LinearAxisOptions | LogAxisOptions | CategoryAxisOptions | TimeAxisOptions;

export interface TitleOptions {
  readonly text: string;
  readonly subtitle?: string | undefined;
  /** Along the reading direction. Default `start`. */
  readonly align?: 'start' | 'center' | 'end' | undefined;
}

export interface LegendOptions {
  /** Default `bottom`; `start` and `end` follow the reading direction. */
  readonly position?: 'top' | 'bottom' | 'start' | 'end' | undefined;
  readonly align?: 'start' | 'center' | 'end' | undefined;
}

export interface ChartOptions {
  readonly title?: string | TitleOptions | undefined;
  readonly series: readonly SeriesOptions[];
  /** One axis or several; absent: one of each, guessed from the data. */
  readonly xAxis?: AxisOptions | readonly AxisOptions[] | undefined;
  readonly yAxis?: AxisOptions | readonly AxisOptions[] | undefined;
  /** `false` hides it. Default: shown when there are two series or more. */
  readonly legend?: LegendOptions | boolean | undefined;
  /** For numbers and dates (Intl). Default: the page's language. */
  readonly locale?: string | undefined;
  /** Reading direction. Default: the element's (`dir` attribute or CSS `direction`). */
  readonly dir?: 'ltr' | 'rtl' | undefined;
  /** Mirror the x axis in RTL (D.10): default `false`, time and categories flow left to right everywhere. */
  readonly mirror?: boolean | undefined;
  /** Width ÷ height, used only when the container has no height of its own (D.11). */
  readonly aspectRatio?: number | undefined;
  /** A sentence describing the chart for screen readers, after the generated summary (screen-reader.md 1). */
  readonly description?: string | undefined;
  /** Fade the other series while one is pointed at (GLOSSARY: Highlight; hover-tooltip.md 5). Default `true`. */
  readonly highlight?: boolean | undefined;
  /** Animate appearing and updates (animation.md). Default `true`; never under `prefers-reduced-motion`. */
  readonly animation?: boolean | undefined;
  /**
   * The data table (data-table.md 2, 5): `true` shows it under the chart (default `false`: it is there for screen
   * readers only); `{ show, rows }` also chooses which rows it starts with when zoomed, the visible range (default) or all.
   */
  readonly dataTable?: boolean | { readonly show?: boolean | undefined; readonly rows?: 'visible' | 'all' | undefined } | undefined;
  /** A strip under the plot showing the whole x range and the visible window (navigator.md). Default `false`. */
  readonly navigator?: boolean | undefined;
  /** Buttons for usual time spans (range-buttons.md). Default: shown with the navigator on a time axis. */
  readonly rangeButtons?: boolean | undefined;
  /** Lines through the pointer and its values on the axes (crosshair.md); needs the `crosshair` module. */
  readonly crosshair?: boolean | { readonly horizontal?: boolean | undefined } | undefined;
  /** A small menu for the user: type, aggregation, scale, comparison (menu.md); needs the `menu` module. */
  readonly menu?: boolean | { readonly items: readonly ('type' | 'aggregation' | 'scale' | 'compare' | 'export' | 'print')[] } | undefined;
  /**
   * The exports' defaults (export.md, csv.md); the export itself needs the `exporting` module. `filename`: the
   * downloaded file's name, without extension (default: from the title); `theme`: the pictures' colours (default: as
   * on screen); `csv.locale`: semicolons and a decimal comma where the language writes one.
   */
  readonly exporting?: { readonly filename?: string | undefined; readonly theme?: 'light' | 'dark' | undefined; readonly csv?: { readonly locale?: boolean | undefined } | undefined } | undefined;
  /** `'time'`: years, then months, then days, by click (drilldown.md 6); needs `drilldown` and `aggregation`. */
  readonly drilldown?: 'time' | undefined;
  /** Points the user can select (selection.md); needs the `selection` module. `shapes`: those offered. */
  readonly selection?: boolean | { readonly shapes?: readonly ('rectangle' | 'range' | 'lasso')[] | undefined } | undefined;
}

/**
 * What `update()` takes: any top-level field of the options. A field given replaces the previous one whole (no deep
 * merge to guess about); a field given as `undefined` goes back to its default; a field left out is kept. `series`
 * is matched by `id`: a series that keeps its id keeps the user's state on it and is animated from where it was.
 * Data given here replaces data given earlier by `setData()`.
 */
export type ChartUpdate = { readonly [K in keyof ChartOptions]?: ChartOptions[K] | undefined };
