# DzGraph

Charts for showing **and exploring** data: lines, areas, columns and bars (grouped, stacked), scatters up to millions of
points, pies, donuts and gauges, time series in any zone, zoom and a navigator, a crosshair, comparison, measures,
point selection with a lasso, drilldown, linked charts, exports and printing — accessible from the keyboard and to
screen readers, right to left designed in. Written from scratch in TypeScript; no runtime dependency.

| Package | What |
| --- | --- |
| [`@dzgraph/core`](packages/core) | the pure core: options and data in, a scene out; the series types (`line`, `column`…) — no DOM |
| [`@dzgraph/dom`](packages/dom) | `chart(el, options, setup)`: SVG, Canvas and WebGL2 painters, the user's interactions, exports; `@dzgraph/dom/sparkline` |
| [`@dzgraph/theme`](packages/theme) | the look: `dzgraph.css` (layer `dzgraph.theme`), `dzgraph.unlayered.css`, `dzgraph.scss` |
| [`@dzgraph/angular`](packages/angular) | `<dz-chart>`, `<dz-sparkline>` — Angular 19 to 22, signals, an output per event |
| [`@dzgraph/dztooltip`](packages/dztooltip) | the points' tooltip drawn by DzTooltip (`@dztooltip/core` 1.x) |
| [`@dzgraph/dzgrid`](packages/dzgrid) | a chart linked to a DzGrid grid, and a chart made from what a grid selects |

## Install

```sh
npm install @dzgraph/core @dzgraph/dom @dzgraph/theme
npm install @dzgraph/angular      # an Angular app
npm install @dzgraph/dztooltip    # tooltips drawn by DzTooltip (@dztooltip/core ^1.0.0)
npm install @dzgraph/dzgrid       # with a DzGrid grid
```

## A chart

```ts
import { line, column } from '@dzgraph/core';
import { chart, zoom, timeAxis } from '@dzgraph/dom';
import '@dzgraph/theme/dzgraph.css';

const c = chart(document.querySelector<HTMLElement>('#sales')!, {
  title: { text: 'Sales (made up)' },
  xAxis: { scale: 'time', zone: 'Europe/Paris' },
  series: [
    { type: 'line', id: 'north', name: 'North', data: [['2026-01-01T00:00:00+01:00', 12], ['2026-02-01T00:00:00+01:00', 15]] },
    { type: 'column', id: 'south', name: 'South', data: [['2026-01-01T00:00:00+01:00', 9], ['2026-02-01T00:00:00+01:00', 11]] },
  ],
}, { types: [line, column], features: [timeAxis, zoom] });

c.update({ title: { text: 'Sales, updated' } }); // the fields given replace the old ones; series matched by id
c.on('pointClick', (e) => console.log(e.point.seriesId, e.point.index, e.point.key));
c.destroy(); // when the element goes
```

- **Options** are plain data (`ChartOptions`), typed; give them again with `update()`, or one series' values with
  `setData()`. Bad input never throws: it becomes a `Problem` (a code and a path, never your data) in `c.problems` and
  the `problems` event; the chart draws what it can.
- **Series types and features are imported**, so a chart ships only what it uses: `types: [line, column]` or
  `allTypes`; `features: [zoom, timeAxis]` or `allFeatures`. An option whose module is missing is a `missing-module`
  problem.
- **Sizes**: the chart takes its element's size and follows it; without a height, `aspectRatio`.
- **The painter** is chosen for you: SVG; Canvas for large series (past 2 000 marks); WebGL2 for scatters past 100 000
  points (the `webgl` feature), Canvas again if the context is lost. Every output — screen, export, print, data table —
  comes from the same scene.

## Exploring

The user's exploration is the **view** — hidden series, the visible range, comparison, selection, aggregation,
drilldown, the type and scale chosen in the menu. It is never overwritten by options given again; `getView()` gives
it as JSON (save it, put it in a URL), `setView()` brings it back, `viewChange` tells each change once it rests.

| Feature | What the user does |
| --- | --- |
| `zoom`, `navigatorStrip` | drags, wheels, pinches, uses the keys or the navigator and its range buttons (1 m, 3 m, YTD, 1 y, all) |
| `crosshair` | follows the pointer or the keys with a crosshair reading every series |
| `compare` | sees series as change from a point (percent or value) |
| `measure` | measures between two points |
| `selection` | selects points by click, rectangle, range or an exact lasso (a million points live) |
| `aggregation`, `drilldown` | sums or averages by period of the zone's calendar; clicks a year to see its months |
| `menu` | changes the type (line, area, columns), the aggregation, the scale, the comparison; exports and prints |
| `exporting` | `exportSvg()`, `exportPng()`, `exportCsv()`, `download()`, `print()` — made here, no service |
| `linkCharts(charts, options)` | several charts sharing their crosshair, range, selection and drill |

## Accessible

Every point is reachable from the keyboard (arrows through the points and the series, Home, End, Page keys), each
named for screen readers; a data table equivalent to the chart (the visible range or all of it); the legend's items are
buttons; colour is never the only way to tell series apart (each has its marker symbol); text at 4.5:1, marks at 3:1,
light and dark; reduced motion respected. Right to left: the legend, the titles and the reading order follow the
direction; the x axis is not mirrored unless `mirror: true`.

English and French words are built in, chosen by `locale` (the element's `lang` by default); give any other language
in `setup.messages`.

## Sparklines

```ts
import { sparkline } from '@dzgraph/dom/sparkline';
sparkline(el, [3, 5, null, 4, 8], { type: 'area', label: 'Visits' }); // about 2 KB, no axes, a summary for screen readers
```

## Angular

```ts
import { DzChart, DzSparkline } from '@dzgraph/angular';
// <dz-chart [options]="options()" [types]="types" [features]="features" (pointClick)="open($event.point)" (viewChange)="save($event.view)" />
// types and features default to allTypes and allFeatures; `chart` gives the methods (exportPng, setView…).
```

## DzTooltip and DzGrid

```ts
import { dzTooltip } from '@dzgraph/dztooltip';
const c = chart(el, options, { types, features: [dzTooltip({ tone: 'info', placement: 'top' })] });

import { chartFromGrid, linkGrid } from '@dzgraph/dzgrid';
const unlink = linkGrid(c, grid, { filter: { column: 'day', by: 'range', as: 'instant' } }); // selection both ways
const stop = chartFromGrid(otherChart, grid, { range: blocks, pivot: p }); // the block, the rows ticked, the pivot
```

## More

- What each behaviour does, rule by rule: [`docs/behaviors/`](docs/behaviors/README.md).
- The design and the decisions: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/adr/`](docs/adr), the words:
  [`GLOSSARY.md`](GLOSSARY.md).
- Written in a clean room: [`CLEANROOM.md`](CLEANROOM.md).
- Changes: [`CHANGELOG.md`](CHANGELOG.md). Licence: MIT.
