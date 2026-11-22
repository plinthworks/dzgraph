/**
 * The scene (GLOSSARY: Scene, ADR 0001): everything to draw, in pixels, produced by the core and drawn alike by every
 * painter (SVG, Canvas, WebGL2), the exports and printing. Plain data, no DOM. Colours are tokens the painter
 * resolves from the theme's CSS variables; text is already measured and placed.
 */

/** Colours the theme defines (`--dzgraph-<token>`): the palette (1 = first), the app's own, the chart's furniture. */
export type ColorToken =
  | `series-${number}`
  | `color-${string}`
  | 'background'
  | 'plot-background'
  | 'text'
  | 'text-muted'
  | 'axis-line'
  | 'grid-line'
  | 'tick'
  | 'focus'
  /** « Autres » in a pie (pie-donut.md 7), and a gauge's unfilled scale (gauge.md 2). */
  | 'others'
  | 'track';

/**
 * A colour in the scene: a token, or a mix of two tokens (`amount` of the second, 0–1), for colour scales (heat maps,
 * choropleths). Painted with `color-mix()` in SVG, resolved once per theme for Canvas and WebGL2.
 */
export type ColorRef = ColorToken | { readonly mix: readonly [ColorToken, ColorToken, number] };

/** The roles of text, each a font the theme defines (`--dzgraph-font-<role>`). */
export type FontRole = 'title' | 'subtitle' | 'axis-title' | 'tick-label' | 'legend' | 'data-label';

export interface Paint {
  readonly fill?: ColorRef;
  readonly stroke?: ColorRef;
  readonly strokeWidth?: number;
  /** Dash lengths in pixels: series stay distinguishable without colour. */
  readonly dash?: readonly number[];
  readonly opacity?: number;
}

/**
 * Path geometry, compact: one command per entry of `commands`, its coordinates read in order from `coords`. Typed
 * arrays, so a decimated series of thousands of points is built without strings; the SVG painter writes the string,
 * Canvas and WebGL2 read the numbers.
 */
export interface PathData {
  readonly commands: Uint8Array;
  readonly coords: Float64Array;
}

/** `PathData.commands` values: MoveTo and LineTo read two coordinates, Close none. */
export const PathCommand = { MoveTo: 0, LineTo: 1, Close: 2 } as const;
export type PathCommand = (typeof PathCommand)[keyof typeof PathCommand];

/** Which point of the app a primitive stands for: the series' id and the point's index in that series. */
export interface PointRef {
  readonly seriesId: string;
  readonly index: number;
  /** The point's key, when the app gave one (GLOSSARY: Key): what selection and links use (Phase 5). */
  readonly key?: string;
}

interface PrimitiveBase {
  /**
   * Unique and stable across scenes for the same thing: painters reuse elements by it, animation pairs two scenes by
   * it. Opaque: built by the core with the app's ids escaped, so no app id can collide with another; never parsed.
   * Who a primitive stands for is `point`, not this.
   */
  readonly sceneId: string;
  readonly paint: Paint;
  /** The app's point it draws, for hit tests, selection and the data table. */
  readonly point?: PointRef;
}

export interface PathPrimitive extends PrimitiveBase {
  readonly kind: 'path';
  readonly path: PathData;
}

export interface RectPrimitive extends PrimitiveBase {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Corner radius: every corner, or only those of `roundEnd`. */
  readonly radius?: number;
  /** The one edge whose corners are rounded (a column's free end; its base stays straight). */
  readonly roundEnd?: 'x-min' | 'x-max' | 'y-min' | 'y-max';
}

export interface LinePrimitive extends PrimitiveBase {
  readonly kind: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ArcPrimitive extends PrimitiveBase {
  readonly kind: 'arc';
  readonly cx: number;
  readonly cy: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** Radians, clockwise from twelve o'clock. */
  readonly startAngle: number;
  readonly endAngle: number;
  /** The end it grows from when it appears (a gauge's value, gauge.md 11); absent: it opens as a pie's slice. */
  readonly grows?: 'start' | 'end';
}

/** The symbols of markers: they tell series apart as well as colours do. */
export type MarkerSymbol = 'circle' | 'square' | 'diamond' | 'triangle' | 'triangle-down';

export interface MarkerPrimitive extends PrimitiveBase {
  readonly kind: 'marker';
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly symbol: MarkerSymbol;
}

/**
 * Where a value goes along one screen direction (ADR 0008): `pixel = r0 + (v − d0) · k`, `v` the value or, on a log
 * axis, its log10. Every scale has one (`Scale.affine`); a value ≤ 0 on a log axis has no place.
 */
export interface Affine {
  readonly d0: number;
  readonly r0: number;
  readonly k: number;
  readonly log: boolean;
}

/**
 * A scatter's points as one batch (ADR 0008): past the Canvas threshold the core does not build a primitive per point.
 * The series' own columns (no copy; a gap — NaN in either — is not drawn), each placed through its map: `x` across
 * the screen and `y` down it, or the other way round when `swapped` (a bar chart). Every point is the series' point at
 * its index (`seriesId`), as a marker's `point` says.
 */
export interface PointsPrimitive extends PrimitiveBase {
  readonly kind: 'points';
  readonly seriesId: string;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly mapX: Affine;
  readonly mapY: Affine;
  readonly swapped: boolean;
  readonly size: number;
  readonly symbol: MarkerSymbol;
}

export interface TextPrimitive extends PrimitiveBase {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: FontRole;
  /** Where `x` falls in the text, along its own reading direction: `start` is its first letter's side. */
  readonly anchor: 'start' | 'middle' | 'end';
  readonly baseline: 'top' | 'middle' | 'alphabetic' | 'bottom';
  /** Degrees, clockwise (rotated tick labels). */
  readonly rotate?: number;
  /** The text's own direction (an Arabic label in an LTR chart). */
  readonly dir?: 'ltr' | 'rtl';
}

export type Primitive = PathPrimitive | RectPrimitive | LinePrimitive | ArcPrimitive | MarkerPrimitive | PointsPrimitive | TextPrimitive;

/** Which painter draws a group (ADR 0002: chosen by the core from the marks drawn). */
export type PainterKind = 'svg' | 'canvas' | 'webgl2';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Primitives drawn together by one painter (a series' line, its markers, an axis), clipped to `clip` if set. */
export interface Group {
  readonly sceneId: string;
  readonly painter: PainterKind;
  /** The whole group's opacity (a series faded while another is emphasised, or animated in or out). */
  readonly opacity?: number;
  readonly clip?: Rect;
  readonly items: readonly Primitive[];
}

/** The scene's layers, back to front (GLOSSARY: Layer). */
export type LayerId = 'background' | 'grid' | 'series' | 'axes' | 'labels' | 'legend' | 'navigator' | 'overlay';

export interface Layer {
  readonly id: LayerId;
  readonly groups: readonly Group[];
}

export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly dir: 'ltr' | 'rtl';
  /**
   * The areas of the chart by name: `plot` always (GLOSSARY: Plot area; for polar charts, the box around the circle),
   * `navigator` when shown (Phase 3).
   */
  readonly areas: { readonly plot: Rect } & { readonly [name: string]: Rect };
  readonly layers: readonly Layer[];
}

/**
 * Text measurement, given to the core (it has no fonts). `font` is a role; the DOM layer resolves it to the theme's
 * font and measures with Canvas (spike S2).
 */
export type TextMeasurer = (text: string, font: FontRole) => TextSize;

export interface TextSize {
  readonly width: number;
  readonly ascent: number;
  readonly descent: number;
}
