# Printing

Phase 6. D.3. The `exporting` module; owner's decisions 2026-11-22.

## What the user does
Prints the chart, alone (from the menu, « Imprimer », or the app's `print()`), or prints the page it sits in.

## What they observe
1. `print()` prints the chart alone on a page: the picture of export.md (the view, without the controls), in the
   light theme whatever the screen's (paper is light), fitted to the page's width, then — when the app asks
   (`print({ table: true })`) — its data table under it.
2. The page around the chart does not move or flash: the printing happens in a hidden frame, removed afterwards.
3. A page printed whole (the browser's Print) prints each chart in light colours, without its controls (mode bar,
   menu button, reset button, breadcrumb, range buttons), never cut between two sheets; a table the app shows prints
   with it.
4. Printing never needs a remote service, and never changes the chart on screen (its view, its focus).
5. Without the `exporting` module, `print()` does nothing and reports `missing-module`; the page's own printing still
   follows rule 3 (the theme's rules).
