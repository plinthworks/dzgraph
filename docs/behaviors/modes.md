# Mode bar

Phase 5a. Owner 2026-11-22: a bar of modes, zoom by default. GLOSSARY: Mode.

## What the user does
Chooses what a drag across the plot does: zoom (the default), select, or measure.

## What they observe
1. The bar sits at the start of the plot's top edge (the reset-zoom button keeps its end), as a row of small toggle
   buttons with visible names: « Zoom », « Sélection », « Mesure ». It shows only the modes whose modules the app
   imported, and only when there are at least two; a chart with `selection` alone selects on drag.
2. One mode at a time; the pressed button says so (`aria-pressed`), and the cursor over the plot follows (crosshair
   for zoom and measure, a cell cursor for selection).
3. Keyboard: the bar is one tab stop (`role="toolbar"`); arrows move between its buttons, Enter or Space presses one.
   Its name is « Mode du graphique ».
4. Shift + drag pans once zoomed (zoom-pan.md 2) in zoom and measure modes; in selection mode Shift adds to the
   selection (selection.md 3), and Shift + ← → on a focused point extend it rather than move the range. Ctrl/⌘ +
   wheel zooms in every mode.
5. Polar charts have no bar: they select by click (selection.md 12).
6. The mode is the chart's, not the view's (view-state.md 6); `chart.setMode('selection')` sets it, event `modeChange`.
