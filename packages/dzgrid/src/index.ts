/**
 * @dzgraph/dzgrid — DzGraph with DzGrid: a chart linked to a grid (dzgrid-link.md), and a chart made from what a grid
 * selects (chart-from-grid.md).
 *
 * ```ts
 * const unlink = linkGrid(chart, grid, { filter: { column: 'day', by: 'range', as: 'instant' } });
 * const stop = chartFromGrid(chart, grid, { range: blocks, pivot: p });
 * ```
 *
 * DzGrid is described by the parts used, structurally: no import of DzGrid, any DzGrid 1.x fits.
 */
export { idOfRowKey, linkGrid, rowKeyOf } from './link.js';
export type { GridCommandLike, GridFilterLike, GridLike, GridLinkOptions, GridSelectionLike } from './link.js';
export { chartFromGrid, chartMenuItem, gridTable } from './from-grid.js';
export type { ChartFromGridOptions, GridColumnLike, GridPivotLike, GridPoint, GridRangeLike, GridReadLike, GridTable, GridTableOptions } from './from-grid.js';
