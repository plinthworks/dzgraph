// @dzgraph/dom — public surface.
export { chart, type Chart, type ChartEvents, type ChartSetup, type CreateChart, type ViewPart } from './chart.js';
export type { Messages, PointWords } from './messages.js';
// Features (ADR 0006): an app passes the ones it uses to chart(); the others are left out of its bundle.
export { aggregation, allFeatures, canvas, compare, crosshair, drilldown, measure, menu, navigatorStrip, selection, timeAxis, webgl, zoom, type Feature } from './features.js';
export type { AnimateHook } from './animator.js';
export type { Mode } from './modes.js';
export { linkCharts, type LinkOptions } from './link.js';
