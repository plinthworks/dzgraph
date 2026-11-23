# @dzgraph/dzgrid

DzGraph with a [DzGrid](https://github.com/plinthworks/dzgrid) grid. The grid is described by structural types: no
import of DzGrid, any DzGrid 1.x fits.

```ts
import { chartFromGrid, chartMenuItem, linkGrid } from '@dzgraph/dzgrid';

// A chart linked to a grid: the selection both ways by key; the grid filtered by the chart's selection or range.
const unlink = linkGrid(chart, grid, { filter: { column: 'day', by: 'range', as: 'instant' } });

// A chart made from what the grid selects: its pivot, else its block of cells, else its rows ticked; followed live.
const stop = chartFromGrid(otherChart, grid, { range: blocks, pivot: p, timeZone: 'Europe/Paris' });

// An item for DzGrid's cell menu that calls the app.
contextMenu({ items: (c, defaults) => [...defaults, chartMenuItem('Chart', (cell) => openChart(cell))] });
```

A point's key is its row's id. `gridTable(grid, options)` gives what `chartFromGrid` draws, without a chart.

See the [repository's README](https://github.com/plinthworks/dzgraph#readme) and the sheets
`docs/behaviors/dzgrid-link.md`, `docs/behaviors/chart-from-grid.md`. Licence: MIT.
