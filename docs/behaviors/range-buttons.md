# Range buttons

Phase 3. D.12; shown with the navigator, or alone with `rangeButtons: true`.

## What the user does
Picks a usual span of time in one click.

## What they observe
1. Above the plot, at the start of the reading direction: « 1 m », « 3 m », « Début d'année », « 1 an », « Tout »
   (translated).
2. Each shows a span ending at the last point: one or three calendar months back, from 1 January of the last point's
   year, one calendar year back — in the axis's zone; « Tout » goes back to the whole.
3. A button whose span is longer than the data is disabled.
4. The button matching the visible range is pressed (`aria-pressed`), and stops being so when the range changes
   otherwise.
