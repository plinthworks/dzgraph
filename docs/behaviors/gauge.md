# Gauge

Phase 4. Owner 2026-11-21: a solid half arc, the value in its centre, optional thresholds; no needle. A polar
coordinate system (ADR 0005).

## What the user does
Reads one value against its scale (a load, a score, a speed), and where it stands among thresholds.

## What they observe
1. `type: 'gauge'`, one value (`data: 72` or `[72]`), on a scale from `min` (default 0) to `max` (default 100).
   `min` not below `max` is reported (`invalid-option`) and the defaults are used.
2. A half ring, open downwards, centred in the plot and as large as it allows; its thickness a quarter of its
   radius. The track (the whole scale) is drawn in a neutral colour (`--dzgraph-track`); the part from `min` to the
   value in the series' colour.
3. It fills along the reading direction: from the left end in left to right, from the right end in right to left (as
   a progress bar does).
4. Under the arc's middle, the value, large, in the chart's locale (with the series' format); `min` and `max` under
   the arc's two ends, smaller.
5. A value past the scale fills the arc (or leaves it empty); the text shows the real value. No value (`null`): an
   empty track and « — ».
6. Thresholds (`thresholds: [{ from, to, label, color }]`): a thin ring just outside the arc, one segment per
   threshold. The label of the threshold the value falls in is written under the value (« Élevé »), so it is not told
   by colour alone. Their colours are colour names the app defines (`--dzgraph-color-<name>`), as for series.
7. Hover or tap on the arc: a tooltip with the name, the value, the scale, and the threshold.
8. Keyboard: one tab stop; it reads as the value, there is nothing to move between.
9. Screen readers: the gauge is a meter (WAI-ARIA `meter`) with its minimum, maximum and value, its text the
   formatted value and the threshold (« Charge : 72 %, entre 0 et 100. Élevé. »).
10. Data table: one row: name, value, minimum, maximum, threshold.
11. Appearing: the arc fills from `min` to the value (400 ms). Updating: from the old value to the new one, the text
    following.
12. No legend by default (the gauge's title names it). One gauge per chart in Phase 4; a second is reported
    (`invalid-option`) and left out.

## Where DzGraph differs on purpose
- No needle (owner): a needle is read against the arc's edge, a filled arc is read at a glance.
- Rule 3: the fill follows the reading direction, as columns-bars.md 4 does for bars.
