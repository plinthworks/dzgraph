# @dzgraph/dom

`chart(el, options, setup)`: a DzGraph chart in an element — SVG, Canvas and WebGL2 painters chosen by size, the
user's interactions, exports and printing. No dependency besides `@dzgraph/core`.

```ts
import { line } from '@dzgraph/core';
import { chart, zoom } from '@dzgraph/dom';
import '@dzgraph/theme/dzgraph.css';

const c = chart(el, { series: [{ type: 'line', id: 'a', name: 'Apples', data: [3, 5, 4] }] }, { types: [line], features: [zoom] });
```

- **Methods**: `update`, `setData`, `setSeriesVisible`, `setRange`, `getView` / `setView`, `showX`, `selectBy`,
  `setMode`, `exportSvg`, `exportPng`, `exportCsv`, `download`, `print`, `on(event, handler)`, `destroy`.
- **Features** (imported, so an app ships only what it uses): `timeAxis`, `zoom`, `navigatorStrip`, `canvas`, `webgl`,
  `crosshair`, `compare`, `measure`, `selection`, `aggregation`, `drilldown`, `menu`, `exporting`; or `allFeatures`.
- `linkCharts(charts, options)`: several charts sharing their crosshair, zoom, selection and drill.
- `@dzgraph/dom/sparkline`: `sparkline(el, values, options)`, about 2 KB.
- Words: English and French built in, by `locale`; any other language through `setup.messages`.

See the [repository's README](https://github.com/plinthworks/dzgraph#readme). Licence: MIT.

Documentation: [plinthworks.github.io/dzgraph](https://plinthworks.github.io/dzgraph/getting-started/typescript/).
