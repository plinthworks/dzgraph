# Polar types place themselves; slices are points

Pie, donut and gauge (Phase 4) are the first series drawn in another coordinate system than the x/y plane (ADR 0005:
coordinate systems are modules). Their geometry is the type's own business — a pie's radius depends on whether its
labels fit beside it, its small slices join « Autres », a gauge is a half ring with thresholds — and an app that draws
only lines must not ship any of it.

- **One coordinate system per chart**: the first series' (combined.md 12). A series of another system is reported
  (`invalid-option` at its `type`) and left out. A polar chart has no axes.
- **A polar type places itself.** Its module has `place()`: given the plot's box, the view and the measurer, it
  returns a *placement* the layout keeps (`layout.placements`, by series id) and hands back to the type's `marks()`
  as its frame. The core asks a placement only what every output needs: where a point is (`anchor`, for the tooltip
  and the focus ring), the points in drawing order (`order`, for the keyboard), each point's share of the whole
  (`share`, for the tooltip, screen readers and the table), its legend items and whether it needs the legend (a pie
  whose labels do not fit). So `polar` adds nothing to the bundle of a cartesian chart.
- **Slices are points.** Each slice is the series' point at its index; the legend lists slices instead of series,
  and hiding one puts its point key (`pointKey(series, index)`, which no series id can equal: app ids never start
  with `#`) in the view's hidden set, next to hidden series. The placement shares the whole again without it.
- **« Autres » is a point too**, at the index just past the data's (`count`), so hover, focus, tooltip and screen
  readers treat it as any slice; it has no row in the data table, which lists every real slice.
- **Slices are drawn as `arc` primitives**, which every painter and the animation already read (Phase 1): the hit test
  reads them from the scene like columns, by angle and radius.
