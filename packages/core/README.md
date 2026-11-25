# @dzgraph/core

DzGraph's pure core: options and data in, a scene out. No DOM, no `Date`, no dependency — it runs in a browser, a
worker or node. Apps use it for the option types and the series types they draw; `@dzgraph/dom` draws the scene.

```ts
import { line, column, allTypes, type ChartOptions } from '@dzgraph/core';
```

- **Options** (`ChartOptions`, `SeriesOptions`…) are plain, typed, read-only data.
- **Series types** are imported one by one (`line`, `area`, `column`, `bar`, `scatter`, `pie`, `donut`, `gauge`), or
  all at once (`allTypes`): a chart ships only those it is given.
- **Problems**: bad input never throws; it becomes a `Problem` — a code and a path, never the app's data.
- **Time**: instants (`InstantMs`, ISO date-times with an offset) and calendar days (`Day`, `YYYY-MM-DD`) are kept
  apart; an offset-less date-time is reported (`ambiguous-instant`), never guessed.
- `@dzgraph/core/sparkline`: `sparklineOf(values, options)`, a sparkline's geometry in a 100 × 100 box.
- `sceneToSvg(scene, options)`: a scene as a standalone SVG document (the scene contract is public: the `animate` hook
  receives scenes).

`@dzgraph/core/internal` is for DzGraph's own packages: no semver promise.

See the [repository's README](https://github.com/plinthworks/dzgraph#readme). Licence: MIT.

Documentation: [plinthworks.github.io/dzgraph](https://plinthworks.github.io/dzgraph/api/core/).
