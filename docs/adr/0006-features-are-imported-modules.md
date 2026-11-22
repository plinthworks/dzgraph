# Features are imported modules, like series types

Time axes, zoom and pan, the navigator with its range buttons, and the Canvas painter are modules an app passes to
`chart(el, options, { types, features })`, as it passes series types (ADR 0005). `allFeatures` brings them all, like
`allTypes`. After Phase 3 these four were a fifth of a one-line chart's code (about 20 KB of 107 KB minified) that
every app shipped whether it zoomed or not; the catalogue of features will grow as the types' has (exports, annotations,
drill-down…), and a closed set in `chart()` would make every app pay for all of them.

- **The core knows no feature by import.** What a feature lends the core (reading and labelling instants, laying out
  and drawing the navigator) is a *kit* the core receives with the options (`normalize(options, types, { kit })`) and
  keeps on the model; layout, scene, tooltip and table read `model.kit`. The visible range stays in the core: it is
  part of the view, and `setRange()` works without any module.
- **The DOM layer imports a feature only through its module.** `chart.ts` imports the types of `gestures.ts`,
  `navigator.ts` and `canvas-painter.ts`, never their code; the module object is the only path to it, so a bundler
  leaves out what the app did not import.
- **A module may bring the ones it needs.** `navigatorStrip` brings `zoom`: its window is dragged, so the chart must be
  zoomable. The app lists either.
- **An option without its module is a `Problem`**, `missing-module`, its detail the module's name: `scale: 'time'`
  (the axis is then linear: numbers still draw, ISO strings become gaps), `navigator` or `rangeButtons` (left out).
  Without `canvas` nothing is reported: every series is drawn in SVG, slower past a few thousand marks but the same
  picture. Without `webgl` (ADR 0008, it brings `canvas`) a dense scatter is drawn on Canvas, the same picture.
  Without `zoom` the user cannot zoom; the app still can.
- **`navigatorStrip`, not `navigator`**: an export named `navigator` would hide the browser's global of that name in
  the app's module. The option keeps its name, `navigator: true`.

The contract between `chart()` and its features is internal until 1.0, as the series types' is (ADR 0005): our own
packages implement it; it is published once it has carried more than these four.
