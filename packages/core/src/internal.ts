// For DzGraph's own packages (series types, coordinate systems, the DOM layer, the bridges): no semver promise before 1.0.
export type {
  Bounds,
  CoordinateSystemName,
  FramesBySystem,
  MarkContext,
  MarkSet,
  OwnOptionNames,
  Scale,
  SeriesModel,
  SeriesType,
} from './series-type.js';
export type { AxisModel, ChartModel } from './model.js';
export { normalize } from './normalize.js';
export { layout, type AxisLayout, type ChartLayout, type LayoutInput, type LayoutText, type PlacedText } from './layout.js';
export { CANVAS_THRESHOLD, clipIndex, clipsOf, composeScene, painterFor } from './compose.js';
export { clipId, svgOf, type SvgElementSpec, type SvgOptions } from './svg.js';
export { cssColor, type ResolveColor } from './paint.js';
export type { Dir } from './dir.js';
export { isShown, type View } from './view.js';
export { hitMark, hitShared, type SharedHit, type SharedPoint } from './hit.js';
export { tooltipOf, type Tooltip, type TooltipRow } from './tooltip.js';
export { dataTable, pointLabel, summary, type DataTable, type PointLabel, type Summary } from './a11y.js';
export { appearFrom, interpolateScene } from './interpolate.js';
export { formatValue } from './format.js';
export { pointAt, withKey } from './points.js';
export { navigate, rankOf, validOrder } from './navigate.js';
export { dataRows, type DataRows } from './a11y.js';
export { seriesName } from './tooltip.js';
export { crisp } from './compose.js';
