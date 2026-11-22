# Sparklines — a small drawing of a list of numbers in a page

Phase 7a. D.2; owner 2026-11-22 (outside grids only: in a DzGrid cell, DzGrid's own sparklines, `@dzgrid/dom/sparkline`).
The same behaviour as DzGrid's (its `sparklines.md`, our family's), in DzGraph's words: a vertical bar is a **column**.
Sources: what spreadsheets' and dashboards' sparklines show a user; WCAG 2.2 (1.1.1, 1.4.1, 1.4.11). Its own entry,
`@dzgraph/dom/sparkline`: an app that uses only sparklines ships no chart.

## What the user does
Reads a trend at a glance beside a number (a tile, a sentence, a card); a screen-reader user hears its summary.

## What they observe
1. `sparkline(el, values, options)` draws in `el`; `update(values, options?)` draws again; `destroy()` removes it.
   `<dz-sparkline [values] [options]>` in Angular.
2. **Values** (null options are no options): a list of numbers in order (`[3, 5, 41, 27]`, or a typed array), `null` or `undefined` being a **gap**.
   Anything else (a word, `NaN`, `Infinity`, an object) is reported (`invalid-data`, by its index, never its value) and
   taken as a gap. Not a list: reported, nothing drawn. An empty list draws nothing.
3. **Kinds** (`type`, default `line`):
   - `line`: the points joined, a gap breaking the line; a point alone (between gaps, or the only one) a dot;
   - `area`: the line over a filled area down to zero (or the bottom when every value is above zero);
   - `column`: one column per point from zero, a negative column in the negative colour;
   - `winloss`: one column per point, up above zero, down below, nothing for zero or a gap — all of one height.
4. **The range**: from the smallest to the largest value (`column` takes zero in), unless `min` / `max` fix it (so
   several sparklines compare); a value outside is drawn at the edge (all of them, when the values never reach a
   bound given alone); `min` above `max` is the app's range turned the right way. All values equal: a flat line in the middle.
5. **Markers** (`markers`, default `'last'`): `'last'` a dot on the last point (line, area) or the last column in the
   marker colour; `'minmax'` the smallest and the largest (their first time); `'none'`. A shape, never colour alone.
6. **Words** (WCAG 1.1.1): the drawing is `role="img"`, named by a summary — « 12 values, from 3 to 41, last 27 »
   (« 1 value: 27 »), numbers in the page's language — or by the app's `label`, which the summary then follows. All
   gaps: « No data ». English and French built in; `messages` replaces them. A language `Intl` refuses (empty,
   malformed) gives way to the next: the element's, then the browser's.
7. **Size**: 6em × 1.2em by default, inline with text; the app's CSS on `.dzgraph-sparkline` sizes it (a cell, a tile).
   No measuring, no layout read: the drawing stretches over the box, lines and dots keeping their width.
8. **Right to left**: time runs left to right in both directions (as numbers do in Arabic text); never mirrored.
9. **Colours** as variables (`--dzgraph-sparkline-line`, `-area`, `-negative`, `-marker`), from the theme's palette;
   3:1 on the page's background; forced colours: `CanvasText`, markers `Highlight`.
10. **Any list, any number**: a list of any length (no spread of its values as arguments); values near ±1e308 drawn in
    the box (the range scaled by halves, never `max - min` overflowing).
11. No tooltip, no keyboard, no animation: a sparkline is read, not explored (a chart is for that).
