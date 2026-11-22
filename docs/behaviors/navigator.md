# Navigator

Phase 3. Owner 2026-11-21: off by default (`navigator: true`).
Comes with the `navigatorStrip` module, which brings `zoom` (ADR 0006); `navigator: true` without it is reported `missing-module`.

## What the user does
Sees where the visible range sits in the whole series, and moves or resizes it there.

## What they observe
1. Under the plot, a strip (40 px, its labels under it) draws the visible series over their whole x range, thin, without markers,
   with its own light x labels.
2. A window marks the visible range; outside it the strip is shaded. Two handles sit on its edges.
3. Dragging the window moves the range; dragging a handle moves that end; a click outside the window moves the window
   there.
4. Keyboard: the two handles are sliders (« début de la plage », « fin de la plage »), read with their dates; arrows
   move them by a hundredth of the whole, Page Up/Down by a tenth; the window moves both with Shift.
5. The chart and the navigator follow each other: zooming the chart moves the window, and the other way round.
