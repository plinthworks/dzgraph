# Keyboard

Phase 2. Owner 2026-11-21: pattern B of spike S6 — each point takes the real focus — to adjust after the owner's
listening.

## What the user does
Tabs into the chart, moves with the arrow keys, leaves with Tab.

## What they observe
1. The chart's points are one tab stop: Tab lands on the point focused last (the first point of the first visible
   series the first time); Tab again goes on to the legend's items, then out.
2. Arrows follow the screen: ← and → move to the previous and next point along x as drawn (a mirrored axis turns them
   with it); ↑ and ↓ move to the series above or below at the same x (the nearest value). In bars, ↑ and ↓ move
   along the categories and ← → between series.
3. Home and End go to the series' first and last point; Page Up and Page Down jump a tenth of its points.
4. The focused point has a visible focus ring (`--dzgraph-focus`), the crosshair and the tooltip of hover
   (hover-tooltip.md 4–7); Escape hides the tooltip, the focus stays.
5. Every point can be reached, also those decimation does not draw and those of a dense line without markers: the
   ring shows where the point is.
6. Enter on a point is a click (`pointClick`). Focus changes send `pointFocus`.
