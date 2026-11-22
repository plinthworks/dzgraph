# Behaviour sheets

One sheet per imitated behaviour (CLEANROOM.md), in our own words, written **before** the code. Each rule is numbered;
tests cite it (`axes.md 7`). Sources: what public documentation and live demos of professional charting libraries
show a user, standards (WCAG 2.2, WAI-ARIA, Intl, CSS), and our decisions (ARCHITECTURE.md, docs/adr/). A rule where
we differ on purpose says so and why. Numbers are never reused: a dropped rule stays, struck out, with the date.

| Sheet | Phase |
|---|---|
| [axes.md](axes.md) — value and category axes, ticks, labels, gridlines | 1 |
| [layout.md](layout.md) — size, title, legend box, axes, plot area | 1 |
| [line-area.md](line-area.md) — lines and areas, gaps, markers, decimation | 1 |
| [columns-bars.md](columns-bars.md) — columns and bars, groups, baseline | 1 |
| [scatter.md](scatter.md) — scatter plots | 1 |
| [legend.md](legend.md) — the legend, drawn (Phase 1); clicked (Phase 2) | 1 |
| [direction.md](direction.md) — right to left | 1 |
| [hover-tooltip.md](hover-tooltip.md) — hover, crosshair, tooltip, highlight, touch | 2 |
| [legend-interaction.md](legend-interaction.md) — the legend clicked and focused | 2 |
| [keyboard.md](keyboard.md) — the keyboard, point by point | 2 |
| [screen-reader.md](screen-reader.md) — summary, points, live region | 2 |
| [data-table.md](data-table.md) — the table equivalent | 2 |
| [animation.md](animation.md) — appearing and updating | 2 |
| [angular.md](angular.md) — `<dz-chart>` | 2 |
| [time-axis.md](time-axis.md) — time axes in a zone, ticks, two-tier labels | 3 |
| [zoom-pan.md](zoom-pan.md) — zoom and pan, mouse, touch, keyboard | 3 |
| [navigator.md](navigator.md) — the navigator | 3 |
| [range-buttons.md](range-buttons.md) — range buttons | 3 |
| [big-data.md](big-data.md) — big series, Canvas, WebGL2 | 3 |
| [stacking.md](stacking.md) — stacked columns, bars and areas, values and percent | 4 |
| [log-scale.md](log-scale.md) — logarithmic axes | 4 |
| [combined.md](combined.md) — several types in one chart, two value axes | 4 |
| [pie-donut.md](pie-donut.md) — pie and donut, labels, « Autres » | 4 |
| [gauge.md](gauge.md) — the gauge | 4 |
| [view-state.md](view-state.md) — the view as state: getView, setView, viewChange | 5a |
| [modes.md](modes.md) — the mode bar: zoom, selection, measure | 5a |
| [crosshair.md](crosshair.md) — crosshair and axis tags | 5a |
| [compare.md](compare.md) — comparison to a baseline | 5a |
| [measure.md](measure.md) — measuring between two points | 5a |
| [selection.md](selection.md) — rectangle, range, lasso, keyboard | 5a |
| [aggregation.md](aggregation.md) — points grouped by period or bucket | 5b |
| [drilldown.md](drilldown.md) — detail by click, breadcrumb, loading | 5b |
| [menu.md](menu.md) — the chart menu: type, aggregation, scale, comparison | 5b |
| [linked-charts.md](linked-charts.md) — crosshair, zoom, selection and drill shared | 5b |
| [export.md](export.md) — the chart as a picture: PNG, SVG | 6 |
| [csv.md](csv.md) — the data as CSV | 6 |
| [print.md](print.md) — printing the chart, printing the page | 6 |
