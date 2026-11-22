# Chart menu

Phase 5b. D.16 (« un peu »), ARCHITECTURE §14. The `menu` module; option `menu: true` or
`{ items: ('type' | 'aggregation' | 'scale' | 'compare' | 'export' | 'print')[] }` — what the app offers (Phase 6: export, print).

## What the user does
Changes, from a small menu, how the chart shows the data: the type of a series, the aggregation, the scale, the
comparison. Not a chart editor.

## What they observe
1. A small button at the end of the chart's top edge (« Options du graphique », a menu button: `aria-haspopup`,
   `aria-expanded`), opening a menu of the items the app offers and that make sense for the data.
2. Type: for one series (the menu lists the series, then the types that suit its data: line, area, column for a
   series of x values; the chart stays combined, owner 2026-11-21).
3. Aggregation: none, or a period (time axis) with its function (aggregation.md).
4. Scale: linear or logarithmic for the value axis (log offered only when every value is positive).
5. Comparison: none, difference, percent, base 100 (compare.md).
6. Keyboard: the WAI-ARIA menu button pattern — Enter, Space or ↓ open it on its first item; arrows move; Enter or
   Space chooses; Escape closes and gives the focus back to the button; submenus open with → and close with ←.
7. A choice applies at once (animated) and is part of the view (view-state.md): saved and given back with it.
8. Without the module, nothing is shown; with `menu` but none of its items making sense, the button is not shown.
9. Phase 6: « Télécharger » opens a submenu of PNG, SVG and CSV (export.md, csv.md); « Imprimer » prints at once
   (print.md). Both only with the `exporting` module, and only when the app lists them (`menu: true` lists them).
