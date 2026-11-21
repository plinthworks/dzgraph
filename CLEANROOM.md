# Clean room

DzGraph is written from scratch. It reproduces what a person **sees and does** with a professional charting library
such as Highcharts — never how Highcharts, or any other charting library, does it.

## Allowed

- Highcharts' public documentation, API reference pages and live demos, to learn observable behaviour: what a hover, a
  click on the legend, a drag to zoom, a key, a resize or an export produces, and which features a professional
  library is expected to have.
- Public issue *reports*, for the bug they describe (the symptom), cited by number in tests (`refs: ["HC#1234"]`).
- Standards: SVG 2, the Canvas 2D API, WAI-ARIA (and its graphics roles), WCAG 2.2, Intl, the IANA time zone
  database through Intl, RFC 4180 (CSV), `prefers-reduced-motion`, `forced-colors`.
- Published algorithms, from the paper or the textbook, never from a library's code: « nice numbers » for axis ticks
  (Heckbert, *Graphics Gems*, 1990), extended tick labelling (Talbot, Lin, Hanrahan, 2010), M4 decimation (Jugel et
  al., 2014), Largest-Triangle-Three-Buckets (Steinarsson, 2013), Bézier and arc geometry.
- Our own code: DzGrid, DzTooltip, tzslot, DzCalendar (the CSV writer, the `Problem` model, the direction module,
  the zone helpers, the build and test scripts).

## Not allowed

- Reading, copying or translating Highcharts' source code — its repository is public but its licence is
  commercial — nor its internal types, tests, CSS, themes, SVG output or build setup.
- The same for every other charting or visualisation library, free or not: D3, Chart.js, ECharts, Plotly, ApexCharts,
  amCharts, uPlot, Recharts, Vega, Observable Plot, Google Charts, and the rest.
- Decompiling or reverse-engineering their minified bundles, or inspecting the DOM a demo generates to copy its
  structure.
- Pasting their documentation text into ours. Option names are ours: a generic word (`series`, `axis`, `legend`) is
  fine; a whole copied option tree is not.
- Anything from `/Users/nadou/Dev/dz-grid-migration/`.

## How a behaviour is borrowed

Each imitated behaviour gets a sheet in `docs/behaviors/<name>.md`, in our own words: what the user does, what they
observe, what DzGraph does instead where we differ on purpose (right to left, keyboard, accessibility, time zones,
reduced motion). The sheet is written before the code, and the code's tests point to it.

This applies to every contributor, human or agent.
