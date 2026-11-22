// @dzgraph/dom — public surface.
export { chart, type Chart, type ChartEvents, type ChartSetup, type CreateChart } from './chart.js';
export type { Messages, PointWords } from './messages.js';
// Features (ADR 0006): an app passes the ones it uses to chart(); the others are left out of its bundle.
export { allFeatures, canvas, navigatorStrip, timeAxis, webgl, zoom, type Feature } from './features.js';
export type { AnimateHook } from './animator.js';
