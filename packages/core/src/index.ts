// @dzgraph/core — public surface.
export type { Problem, ProblemCode, ProblemCodes } from './problem.js';
export type { Day, InstantMs, ZoneName } from './time.js';
export type {
  AxisOptions,
  CategoryAxisOptions,
  ChartOptions,
  ChartUpdate,
  ColumnsInput,
  DataInput,
  FormatContext,
  Formatter,
  LegendOptions,
  LinearAxisOptions,
  LogAxisOptions,
  PointInput,
  ScaleKind,
  SeriesBase,
  SeriesColor,
  SeriesOptions,
  SeriesOptionsByType,
  SeriesUnionOf,
  TicksOptions,
  TimeAxisOptions,
  TitleOptions,
  XValue,
  YValue,
} from './options.js';
export type {
  ArcPrimitive,
  ColorRef,
  ColorToken,
  FontRole,
  Group,
  Layer,
  LayerId,
  LinePrimitive,
  MarkerPrimitive,
  PointsPrimitive,
  Affine,
  MarkerSymbol,
  PainterKind,
  Paint,
  PathData,
  PathPrimitive,
  PointRef,
  Primitive,
  Rect,
  RectPrimitive,
  Scene,
  TextMeasurer,
  TextPrimitive,
  TextSize,
} from './scene.js';
export { PathCommand } from './scene.js';

// Series types (ADR 0005): an app passes the ones it draws to chart(); the others are left out of its bundle.
export { line, type LineSeriesOptions } from './series/line.js';
export { area, type AreaSeriesOptions } from './series/area.js';
export { bar, column, type BarSeriesOptions, type ColumnSeriesOptions } from './series/column.js';
export { scatter, type ScatterSeriesOptions } from './series/scatter.js';
export { donut, pie, type DonutSeriesOptions, type PieData, type PieSeriesOptions } from './series/pie.js';
export { gauge, type GaugeSeriesOptions, type GaugeThreshold } from './series/gauge.js';

import { line as lineType } from './series/line.js';
import { area as areaType } from './series/area.js';
import { bar as barType, column as columnType } from './series/column.js';
import { scatter as scatterType } from './series/scatter.js';
import { donut as donutType, pie as pieType } from './series/pie.js';
import { gauge as gaugeType } from './series/gauge.js';
/** Every series type, for apps that do not count bytes (ADR 0005); importing it brings them all into the bundle. */
export const allTypes = [lineType, areaType, columnType, barType, scatterType, pieType, donutType, gaugeType] as const;

// A scene as a standalone SVG document (exports, node).
export { sceneToSvg, type SvgOptions } from './svg.js';
