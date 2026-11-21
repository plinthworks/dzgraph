# The legend

Phase 1 draws it; Phase 2 makes it clickable and focusable.

## What the user does
Reads which colour and symbol is which series.

## What they observe
1. Shown by default when the chart has two series or more; `legend: true` shows it for one, `false` hides it.
2. Under the plot, centred, by default (`position`, `align` change it); with `start` or `end` it is a column beside
   the plot.
3. One item per series, in series order along the reading direction: the series' sign (a short line with its marker
   for a line, a square for columns and areas, its marker for a scatter), then its name.
4. A series without a name is called « Série 1 », « Série 2 »… (translated, by its place).
5. Items wrap onto as many rows as needed, centred; past a third of the chart's height the last visible item ends
   with « … » (Phase 2 pages).
6. A hidden series' item stays, greyed (GLOSSARY: Hidden series).
