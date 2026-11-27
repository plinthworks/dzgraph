# Changelog

## [1.0.0] — prepared 2026-11-23, completed 2026-11-26

The first release: the whole v1 scope (ARCHITECTURE D.2, D.3, D.15, D.16), written from scratch in a clean room
(`CLEANROOM.md`). Six packages, no runtime dependency; every behaviour described rule by rule in `docs/behaviors/`
before its code, each rule a test, in Chrome, Firefox and WebKit. Documentation, in English and French:
https://plinthworks.github.io/dzgraph/ (`llms.txt` and `llms-full.txt` there too).

- `@dzgraph/core`: options and data in, a scene out — no DOM, no `Date`. Series types `line`, `area`, `column`, `bar`
  (grouped, stacked, percent), `scatter`, `pie`, `donut`, `gauge`, imported one by one or as `allTypes`. Linear,
  category, logarithmic and time scales; two value axes; time in any IANA zone, instants and calendar days kept apart;
  data as values, pairs, points or typed columns (millions of points, M4 decimation). `Problem`s, never a throw.
  The gauge as an arc or a straight bar (across or upright), its `thickness` in pixels, an `origin`, `ticks`
  (`step`, `labels`), coloured and named zones on the track or as a ring; the scale's ends always written.
  `@dzgraph/core/sparkline`. `sceneToSvg`.
- `@dzgraph/dom`: `chart(el, options, setup)`. SVG; Canvas past 2 000 marks; WebGL2 for scatters past 100 000 points
  (D.20), Canvas while its context is lost. Hover, a shared tooltip, the legend, keyboard point to point, screen
  readers, a data table equivalent to the chart (the visible range or all of it), animation (reduced motion
  respected, an `animate` hook). An app's own words through `setup.messages`, merged word by word over the built-in
  ones. Features: `timeAxis`, `zoom`, `navigatorStrip` (with range buttons), `crosshair`,
  `compare`, `measure`, `selection` (click, rectangle, range, an exact live lasso), `aggregation`, `drilldown`,
  `menu` (type, aggregation, scale, comparison, export, print), `exporting` (SVG, PNG, CSV, download, print — no
  remote service), `canvas`, `webgl`. The view as JSON (`getView`, `setView`, `viewChange`). `linkCharts`.
  `@dzgraph/dom/sparkline`. English and French words.
- `@dzgraph/theme`: `--dzgraph-*` variables over the family's `--tz-*` palette, light and dark, a series palette checked
  for colour blindness and contrast, print rules.
- `@dzgraph/angular`: `<dz-chart>`, `<dz-sparkline>` — Angular 19 to 22, signals, an output per event. The app names
  the types and features it ships, on the tag or once with `provideDzGraph({ types, features, messages })`.
- `@dzgraph/dztooltip`: `dzTooltip(look)`, the points' tooltip drawn by DzTooltip 1.x.
- `@dzgraph/dzgrid`: `linkGrid` (selection both ways, the grid filtered by the chart's selection or range),
  `chartFromGrid` (a chart of a grid's pivot, block of cells or rows ticked, followed live), `gridTable`,
  `chartMenuItem`.
- The public types are frozen (`api/*.api.txt`, `npm run check:api`): from here on, removing or narrowing one is a
  major version.
