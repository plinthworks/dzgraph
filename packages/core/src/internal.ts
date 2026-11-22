// For DzGraph's own packages (series types, coordinate systems, the DOM layer, the bridges): no semver promise before 1.0.
export type {
  Bounds,
  CoordinateSystemName,
  FramesBySystem,
  MarkContext,
  MarkSet,
  OwnOptionNames,
  Placement,
  PlacedLegendItem,
  PlaceInput,
  PlaceText,
  Scale,
  SeriesModel,
  SeriesType,
} from './series-type.js';
export type { AxisModel, ChartModel } from './model.js';
export { normalize, type MenuItem } from './normalize.js';
export { layout, type AxisLayout, type ChartLayout, type LayoutInput, type LayoutText, type PlacedText } from './layout.js';
export { CANVAS_THRESHOLD, WEBGL_THRESHOLD, clipIndex, clipsOf, composeScene, painterFor } from './compose.js';
export { markersOf, place, pointsAt } from './points-batch.js';
export { clipId, drawnItems, svgOf, type SvgElementSpec, type SvgOptions, type SvgPrimitive } from './svg.js';
export { cssColor, type ResolveColor } from './paint.js';
export type { Dir } from './dir.js';
export { isPointShown, isShown, pointKey, type View } from './view.js';
export { hitMark, hitShared, type SharedHit, type SharedPoint } from './hit.js';
export { tooltipOf, type Tooltip, type TooltipRow } from './tooltip.js';
export { dataTable, hasDetail, pointLabel, summary, type DataTable, type PointLabel, type Summary } from './a11y.js';
export { appearFrom, interpolateScene } from './interpolate.js';
export { formatValue } from './format.js';
export { pointAt, withKey } from './points.js';
export { navigate, rankOf, screenStep, sliderStep, validOrder } from './navigate.js';
export { dataRows, tableOf, type DataRows, type RawTable, type TableColumn, type TableText } from './a11y.js';
export { csvOf, isoOf, type CsvOptions } from './csv.js';
export { exportScene } from './export.js';
export { seriesName, xLabel, xValueLabel } from './tooltip.js';
export { crisp } from './compose.js';
export { clampRange, extentOf, isWhole, panBy, zoomAround, type Extent, type Range } from './zoom.js';
export { cornerRadii, endRadius, markerPolygon } from './geometry.js';
export { HANDLE_HEIGHT, HANDLE_WIDTH, navigatorKit, type NavigatorLayout, type RangeButton } from './navigator.js';
export { timeKit } from './time.js';
export { NO_KIT, type CompareKit, type CrosshairKit, type Kit, type NavigatorKit, type TimeKit } from './kit.js';
export { crosshairKit } from './crosshair.js';
export { compareKit, type CompareMode } from './compare.js';
export { viewFromJson, viewToJson, type ChartView, type ViewParts } from './view-json.js';
export { measureKit, type MeasureKit, type MeasureReading } from './measure.js';
export { isSelected, selectedCount, selectionKit, type SelectionKit, type SelectOp, type SelectShape, type Selection } from './selection.js';
export { aggregationKit, type AggregateFn, type AggregateSpec, type Aggregated, type AggregationKit } from './aggregation.js';
